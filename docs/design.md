# GTFS Client — Design Document

## 1. Goals

Build a web application that:

1. Presents a browsable catalog of U.S. transit agencies with public GTFS feeds.
2. Lets the user select a city/agency and transitions to an interactive map view.
3. Loads static GTFS data (routes, stops, shapes) for the selected agency.
4. Streams GTFS-realtime data (vehicle positions, trip updates, service alerts) and visualizes them on the map in real time.

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Angular)                  │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │  City    │   │  Map     │   │  Realtime        │ │
│  │  Selector │──▶│  View    │◀──│  Overlay Layer   │ │
│  │  View    │   │(OpenLayers)│  │  (WebSocket/SSE) │ │
│  └──────────┘   └──────────┘   └──────────────────┘ │
│        │              ▲               ▲              │
│        ▼              │               │              │
│  ┌─────────────────────────────────────────────────┐│
│  │            Angular Services Layer               ││
│  │  AgencyService │ GtfsService │ RealtimeService  ││
│  └─────────────────────────────────────────────────┘│
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────┐
│                 Node.js Backend                      │
│                                                      │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Agency       │  │ GTFS Static │  │ GTFS       │ │
│  │ Catalog API  │  │ Proxy/Cache │  │ Realtime   │ │
│  │              │  │             │  │ Proxy      │ │
│  └──────────────┘  └─────────────┘  └────────────┘ │
│         │                │               │          │
│         ▼                ▼               ▼          │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │MobilityDB   │  │ GTFS ZIP   │  │ GTFS-RT      │ │
│  │API v1       │  │ (parsed &  │  │ Protobuf     │ │
│  │             │  │  cached)   │  │ feeds        │ │
│  └─────────────┘  └────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 3. Data Sources

### 3.1 Agency Catalog

- **[Mobility Database](https://mobilitydatabase.org/)** — sole source for discovering agencies and their GTFS feed URLs. Provides a REST API (`api.mobilitydatabase.org`) for searching feeds by location, provider, and data type. Requires a free account and bearer token authentication.
- Key API endpoints used:
  - `GET /v1/gtfs_feeds` — List GTFS feeds (filterable by location, status)
  - `GET /v1/gtfs_feeds/:id` — Feed detail (metadata, download URL)
  - `GET /v1/gtfs_feeds/:id/gtfs_rt_feeds` — Associated realtime feeds
  - `GET /v1/search` — Full-text search across feeds

### 3.2 GTFS Static

Each agency publishes a GTFS feed as a ZIP archive containing CSV files:

| File            | Purpose                                      |
|-----------------|----------------------------------------------|
| `agency.txt`    | Agency metadata (name, URL, timezone)        |
| `routes.txt`    | Transit route definitions                    |
| `stops.txt`     | Stop locations (lat/lon) and names           |
| `shapes.txt`    | Route geometry (polylines)                   |
| `trips.txt`     | Individual trips per route                   |
| `stop_times.txt`| Scheduled arrival/departure at each stop     |
| `calendar.txt`  | Service schedules (day-of-week patterns)     |

The backend downloads, parses, and caches these feeds. Only the subset needed for map rendering (routes, stops, shapes) is sent to the client.

### 3.3 GTFS-Realtime

Realtime feeds are published as Protocol Buffers (`protobuf`) messages. Three standard feed entity types:

| Entity           | Content                                          |
|------------------|--------------------------------------------------|
| VehiclePosition  | Live GPS location, bearing, speed, trip ID       |
| TripUpdate       | Real-time arrival/departure predictions per stop |
| Alert            | Service disruptions, detours, advisories         |

The backend fetches these protobuf feeds, decodes them using `gtfs-realtime-bindings`, and pushes updates to the client via WebSocket.

## 4. Backend Design (Node.js)

### 4.1 Responsibilities

1. **Agency Catalog API** — Proxy and cache the Mobility Database API. Expose a simplified REST endpoint for listing/searching U.S. agencies.
2. **GTFS Static Proxy** — Download and parse agency GTFS ZIP files. Cache parsed data (routes, stops, shapes) with TTL-based invalidation. Serve to client as GeoJSON or a compact binary format.
3. **GTFS-Realtime Proxy** — Poll agency realtime protobuf feeds at a configurable interval (e.g., 5–15 seconds). Decode and push to connected clients via WebSocket.

### 4.2 Agency ID Scheme

The `:id` used across all API endpoints and client routes is the **Mobility Database feed ID** (e.g., `mdb-1234`). This is the stable identifier returned by the Mobility Database API and requires no additional mapping layer. The backend stores agency metadata keyed by this ID in its cache.

- The client route `/agency/mdb-1234` directly maps to `GET /api/agencies/mdb-1234`.
- No custom internal ID scheme — the Mobility Database ID is the canonical identifier throughout the system.

### 4.3 API Endpoints

| Method | Path                              | Description                                      |
|--------|-----------------------------------|--------------------------------------------------|
| GET    | `/api/agencies`                   | List U.S. agencies with GTFS feeds (paginated)   |
| GET    | `/api/agencies/:id`               | Agency detail (metadata, feed URLs, coverage)    |
| GET    | `/api/agencies/:id/routes`        | Static route data (GeoJSON)                      |
| GET    | `/api/agencies/:id/stops`         | Static stop data (GeoJSON)                       |
| GET    | `/api/agencies/:id/shapes`        | Route geometry (GeoJSON)                         |
| GET    | `/api/agencies/:id/trips`         | Trip-to-route mapping (trip_id → route_id)       |
| WS     | `/api/agencies/:id/realtime`      | WebSocket stream of realtime vehicle positions   |
| GET    | `/api/agencies/:id/alerts`        | Current service alerts                           |

> **Note — Trip-to-route mapping**: GTFS-realtime vehicle positions reference `trip_id`, not `route_id`. To display vehicles on the correct route layer and color them by route, the client needs a `trip_id → route_id` lookup. The `/api/agencies/:id/trips` endpoint returns this mapping as a compact JSON object (`{ tripId: routeId }`). The client loads this alongside routes/stops/shapes during map initialization and uses it to associate incoming vehicle positions with their routes. `stop_times.txt` is excluded from the client payload — it is the largest file in most feeds and is not needed for map rendering.

### 4.4 Caching Strategy

- **Agency catalog**: Cached for 24 hours. Re-fetch from Mobility Database on cache miss or expiry.
- **GTFS static**: Cached per agency with configurable TTL (default 24 hours). Re-download and re-parse on expiry.
- **GTFS-realtime**: Not cached — polled continuously and pushed to clients. Backend maintains a single poller per feed, multiplexing updates to all connected WebSocket clients.

### 4.5 Technology Choices

- **Framework**: Fastify — high performance, built-in TypeScript support, schema-based serialization.
- **GTFS-realtime parsing**: `gtfs-realtime-bindings` (Google's official protobuf decoder for Node.js).
- **GTFS static parsing**: Unzip + CSV parsing (e.g., `csv-parse` or `papaparse`).
- **WebSocket**: `@fastify/websocket` (native Fastify plugin).
- **Data format**: GeoJSON for static map data; JSON for realtime updates.
- **Mobility Database auth**: Refresh token → access token exchange, cached with auto-refresh before expiry.

## 5. Frontend Design (Angular)

### 5.1 Routing

The application uses Angular's built-in router for client-side navigation between pages.

| Route               | Page             | Description                                          |
|---------------------|------------------|------------------------------------------------------|
| `/`                 | Home             | City selector — browse/search U.S. transit agencies  |
| `/agency/:id`       | Map              | Live transit map for the selected agency             |
| `**`                | Not Found        | 404 redirect to home                                 |

- The home page is the landing page. No map is loaded until the user selects an agency.
- Navigating to `/agency/:id` loads the map page, which fetches static GTFS data and opens the WebSocket connection for realtime updates.
- Navigating back to `/` tears down the WebSocket connection and disposes the map instance.
- Direct URL access to `/agency/:id` is supported — the map page loads all data from the agency ID in the route parameter.

### 5.2 Module Structure

```
client/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── services/
│   │   │   │   ├── agency.service.ts       # Agency catalog API client
│   │   │   │   ├── gtfs.service.ts         # Static GTFS data client
│   │   │   │   └── realtime.service.ts     # WebSocket realtime client
│   │   │   └── models/
│   │   │       ├── agency.model.ts
│   │   │       ├── route.model.ts
│   │   │       ├── stop.model.ts
│   │   │       └── vehicle-position.model.ts
│   │   ├── features/
│   │   │   ├── home/                      # Home page: city selector
│   │   │   │   ├── home.component.ts
│   │   │   │   ├── home.component.html
│   │   │   │   ├── city-selector.component.ts   # Search/filter UI
│   │   │   │   └── agency-card.component.ts     # Agency card in grid
│   │   │   └── map/                       # Map page: live transit view
│   │   │       ├── map-page.component.ts        # Page shell, route param
│   │   │       ├── map-page.component.html
│   │   │       ├── map/
│   │   │       │   ├── map.component.ts           # OpenLayers map wrapper
│   │   │       │   ├── vehicle-layer.component.ts # Live vehicle positions
│   │   │       │   ├── route-layer.component.ts   # Route shapes
│   │   │       │   └── stop-layer.component.ts    # Stop markers
│   │   │       └── sidebar/
│   │   │           ├── route-list.component.ts    # Filterable route list
│   │   │           └── alert-panel.component.ts   # Service alerts
│   │   ├── shared/
│   │   │   └── components/                # Reusable UI components
│   │   └── app.routes.ts                  # Route definitions
│   └── main.ts
```

### 5.3 Key Components

#### Home Page (`/`)
- City selector with searchable, filterable list/grid of U.S. transit agencies.
- Each agency card shows agency name, city, state, number of routes, and feed status.
- Selecting an agency navigates to `/agency/:id` (map page).
- No map instance is created on this page — keeps the landing page lightweight.

#### Map Page (`/agency/:id`)
- Reads agency ID from route parameter on init.
- Full-screen OpenLayers map centered on the agency's service area.
- Layers (bottom to top):
  1. Base layer (OSM or satellite tiles)
  2. Route shapes (colored polylines per route)
  3. Stops (circle markers, clickable for details)
  4. Vehicle positions (live, updated via WebSocket)
- Sidebar with:
  - Route list (toggle visibility per route, filter by type)
  - Service alerts panel
  - Agency info

### 5.4 OpenLayers Integration

- Use raw `ol` (OpenLayers) 10.9.0 directly — no wrapper dependency. This avoids version coupling with `ngx-openlayers` (which pins to OL 10.7.x) and gives access to the latest OL features.
- Map instance managed by a dedicated `MapComponent` that creates and configures the `ol.Map`, `ol.View`, and layer objects imperatively.
- Vehicle positions updated via Angular signals — OpenLayers vector source is updated reactively when signals change.

### 5.5 State Management

- Use Angular signals (Angular 17+) for reactive state.
- Key signals:
  - `selectedAgency` — currently selected agency
  - `routes` — loaded route data
  - `stops` — loaded stop data
  - `vehiclePositions` — live vehicle positions (updated from WebSocket)
  - `visibleRoutes` — set of route IDs currently visible on map
  - `alerts` — active service alerts

## 6. Data Flow

### 6.1 Agency Selection Flow

```
User opens app
  → CitySelectorComponent loads
  → AgencyService.fetchAgencies() → GET /api/agencies
  → Backend queries Mobility Database (cached)
  → Returns list of agencies
  → User searches/browses, selects an agency
  → Router navigates to /agency/:id
```

### 6.2 Map Loading Flow

```
TransitMapComponent initializes
  → GtfsService.fetchRoutes(agencyId) → GET /api/agencies/:id/routes
  → GtfsService.fetchStops(agencyId) → GET /api/agencies/:id/stops
  → GtfsService.fetchShapes(agencyId) → GET /api/agencies/:id/shapes
  → Map renders route shapes and stop markers
  → Map fits bounds to agency service area
```

### 6.3 Realtime Streaming Flow

```
MapPageComponent initializes
  → RealtimeService.connect(agencyId) → WS /api/agencies/:id/realtime
  → Backend starts polling agency's GTFS-RT feed (if not already polling)
  → Backend decodes protobuf, extracts vehicle positions
  → Backend pushes JSON updates to all connected clients
  → RealtimeService updates vehiclePositions signal
  → VehicleLayerComponent reactively updates OpenLayers vector source
  → Map displays live vehicle markers with bearing rotation
```

### 6.4 WebSocket Reconnection Strategy

WebSocket connections will drop due to network changes, Railway restarts, browser sleep, or idle timeouts. The client must handle this gracefully for a live transit application.

- **Exponential backoff reconnection**: On disconnect, `RealtimeService` attempts reconnection with exponential backoff (initial 1s, max 30s, jittered). Resets to 1s on successful reconnect.
- **Stale data indicator**: While disconnected, the UI shows a "reconnecting…" banner and dims vehicle markers. Vehicle positions are not cleared (they may still be approximately correct) but are marked as stale with a timestamp.
- **Full refresh on reconnect**: After reconnection, the backend sends a full snapshot of current vehicle positions (not just deltas) so the client can reconcile state without missing intermediate updates.
- **Max retries**: After 10 consecutive failures, the UI shows a "connection lost" state with a manual retry button.
- **Heartbeat**: Client sends a ping every 30s; if no pong within 10s, treats as disconnect and begins reconnection.

## 7. Performance Considerations

- **Static data size**: Large agencies (e.g., MTA, LA Metro) have thousands of stops and complex route geometries. The backend should serve simplified geometries at low zoom levels and full detail at high zoom levels (server-side simplification or tile-based serving).
- **Realtime polling**: Backend maintains a single poller per feed regardless of client count. Polling interval configurable per agency (some feeds update every 3s, others every 30s).
- **WebSocket multiplexing**: Multiple clients viewing the same agency share a single backend poller. Client disconnect triggers cleanup when no clients remain for an agency.
- **Client-side rendering**: Limit number of simultaneously rendered stops (cluster at low zoom). Use OpenLayers clustering for vehicle markers when dense.

## 8. Error Handling

- **Feed unavailable**: Display graceful error in UI; allow user to return to city selector.
- **Realtime feed not supported**: Some agencies publish static GTFS but no realtime feed. Detect this and show a "no realtime data available" badge in the city selector and map view.
- **Feed parse errors**: Log on backend, skip malformed entities, continue streaming valid data.

## 9. Future Enhancements

- **Trip updates**: Show predicted arrival times at stops when clicked.
- **Route filtering**: Toggle individual routes on/off the map.
- **Vehicle tooltips**: Click a vehicle to see route, trip, and schedule adherence.
- **Multi-agency view**: Overlay multiple agencies on a single map (e.g., Bay Area).
- **Historical playback**: Replay past vehicle positions (if data is archived).
- **Mobile-responsive layout**: Collapsible sidebar, touch-optimized controls.
- **PWA support**: Offline-capable static data caching via service worker.

## 10. Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Angular 21 (TypeScript) | Strong enterprise GIS ecosystem, structured architecture |
| OpenLayers integration | Raw `ol` 10.9.0 | No wrapper version coupling; access to latest OL features |
| Backend framework | Fastify | ~2x faster than Express, native TS support, `@fastify/websocket` |
| Agency catalog API | Mobility Database API v1 | Modern, actively maintained, comprehensive feed catalog |
| GTFS-RT decoding | `gtfs-realtime-bindings` | Google's official Node.js protobuf decoder |
| WebSocket transport | `@fastify/websocket` | Native Fastify plugin, clean integration |
| Static data format | GeoJSON | Simple, native OpenLayers support. Vector tiles deferred to future optimization for large agencies |
| State management | Angular signals | Built-in to Angular 17+, reactive, no external dependencies |
| Hosting platform | Railway | Monorepo-native, WebSocket-friendly, usage-based pricing ideal for portfolio project |

## 11. Deployment (Railway)

Both frontend and backend are hosted on Railway as a single project with two services deployed from the monorepo.

### 11.1 Service Configuration

| Service | Source | Build Command | Start Command |
|---------|--------|--------------|---------------|
| `client` | `client/` | `npm run build` | Served as static files via Railway's static site or via the backend |
| `server` | `server/` | `npm run build` | `npm start` |

- Railway auto-detects Node.js from `package.json` in each subdirectory.
- Environment variables (e.g., `MOBILITY_DB_REFRESH_TOKEN`) are set via Railway dashboard.
- The `PORT` environment variable is injected by Railway — backend must use `process.env.PORT`.
- GitHub integration enables auto-deploy on push to main.

### 11.2 Architecture on Railway

```
Railway Project
├── server (Fastify)     → https://gtfs-client-api.up.railway.app
│   ├── REST API (/api/*)
│   └── WebSocket (/api/agencies/:id/realtime)
└── client (Angular)     → https://gtfs-client.up.railway.app
    └── Static build served via Railway or Fastify static plugin
```

- The Angular client calls the backend API using the Railway-generated internal URL or a configured public domain.
- CORS is configured on the backend to allow requests from the client's domain.

## 12. Open Questions

1. **Vector tiles for large agencies**: Start with GeoJSON. If performance issues arise with large agencies (MTA, LA Metro), evaluate vector tile serving.
2. **Mobility Database rate limits**: Evaluate API rate limits once access token is obtained.
3. **Custom domain**: Decide whether to use a custom domain or Railway-generated subdomains.
