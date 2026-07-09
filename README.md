# GTFS Client

An interactive web application for exploring real-time public transit data from U.S. transit agencies! Browse transit systems, view routes and stops on an interactive map, and watch vehicles move in real time — all powered by open GTFS and GTFS-Realtime feeds.

This project is the spiritual successor to much less mature implementation that focused on WMATA data. I think exploring live transit data is an interesting use-case, but I decided starting anew was better than trying to retrofit the old codebase, given how early in development it was. In particular, I wanted to architecture this project more intentionally!

## Features

- **Agency discovery** — Search and browse a catalog of 1,000+ U.S. transit agencies from the [Mobility Database](https://mobilitydatabase.org/). Agencies with multiple feeds (e.g., Bus, Rail) are distinguished by feed type and service area.
- **Interactive map** — OpenLayers-based map with route lines colored to match agency GTFS data, stop markers, and live vehicle positions with bearing indicators.
- **Realtime vehicle tracking** — Live vehicle positions streamed via WebSocket from GTFS-Realtime feeds, with reconnection logic and heartbeat support. Vehicles are colored to match their route.
- **Route filtering** — Search, show, and hide individual routes. Filtering a route hides its line, vehicles, and stops exclusive to that route. Stops shared with other visible routes remain on the map.
- **Stop & vehicle popups** — Click any stop to see its name and all routes serving it. Click any vehicle to see its route, status, speed, and last update time.
- **Realtime status communication** — Clearly communicates when live data is available, requires an agency-specific API key, or is unavailable — so users know why realtime data may be missing.*

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 (standalone components, signals, effects) |
| Mapping | OpenLayers 10 |
| Backend | Node.js + Fastify (TypeScript) |
| Realtime | WebSocket (gtfs-realtime-bindings, protobuf) |
| Feed Catalog | [Mobility Database API](https://mobilitydatabase.org/) |
| Static Data | GTFS CSV parsing (routes, stops, shapes, trips, stop_times) |

## Architecture

```
gtfs-client/
├── client/                  # Angular frontend
│   └── src/app/
│       ├── core/            # Services (agency, gtfs, realtime)
│       └── features/
│           ├── home/        # Agency search & selection
│           └── map/         # Map page, sidebar, route list, alerts
├── server/                  # Fastify backend
│   └── src/
│       ├── routes/          # REST + WebSocket endpoints
│       ├── services/        # MobilityDB, GTFS static, GTFS realtime
│       └── utils/           # In-memory cache with TTL eviction
├── shared/                  # Shared TypeScript models (Agency, Route, Stop, etc.)
└── docs/                    # Design documents
```

### Data Flow

1. **Agency listing** — Server fetches and caches the Mobility Database feed catalog. Client displays agencies with search and pagination.
2. **Static data** — When a user selects an agency, the server downloads and unzips the GTFS static zip, parses routes/stops/shapes/trips/stop_times, and caches the result for 24 hours. The client renders route lines, stops, and builds a stop-to-route mapping.
3. **Realtime data** — The server polls GTFS-Realtime protobuf feeds every 10 seconds, decodes vehicle positions and service alerts, and streams updates to the client via WebSocket. The client renders vehicle markers with route-colored triangles and bearing rotation.

## Key Design Decisions

- **Server-side GTFS parsing** — GTFS static data is downloaded, unzipped, and parsed on the server to keep the client bundle small and avoid shipping CSV parsing libraries to the browser.
- **Shared models** — TypeScript interfaces in `shared/` are imported by both client and server, ensuring type safety across the stack.
- **Route color generation** — Agencies that don't specify route colors in their GTFS data (or use white, which is invisible on the light basemap) get deterministic colors from a 20-color palette, hashed by route ID for consistency.
- **Stop-to-route mapping** — Built from `stop_times.txt` + `trips.txt` to enable intelligent stop filtering: a stop is only hidden when all its routes are hidden.
- **Realtime auth detection** — The server checks `authentication_type` on realtime feeds to distinguish "no realtime available" from "realtime requires an API key," communicating this to the user via map banners.

## Lessons Learned

This is arguably my *third* full-stack web application built in JS. Small sample size aside, I'm finding that JS projects require a lot more intentionality to avoid building labyrinthian codebases. I think I did a bit better this time around because I tried very hard to reason through the architecture before I started coding anything. Of course, using AI complicates things, since there's a need to manage the trade-off between velocity and intentionality. 

*The easy solution would be to prompt users to provide their own API keys to see live data from networks like WMATA which require them. Of course, no sane user would provide those (including myself). So, what's an alternative approach? I struggle to think of a better option than just slowly building up a list of keys managed in the server's env file. I like that we don't make undue API calls from the home page, and "some transit agencies lack live vehicle data" is fine enough for this project!

