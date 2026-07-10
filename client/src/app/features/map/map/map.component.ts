import {
  Component,
  inject,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
  signal,
  afterNextRender,
} from '@angular/core';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, transformExtent } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Circle as CircleStyle, Fill, RegularShape } from 'ol/style';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { defaults as defaultControls } from 'ol/control';
import Overlay from 'ol/Overlay';
import { VehicleStopStatus } from '@shared/models/vehicle-position.model';
import { Route } from '@shared/models/route.model';
import type { FeatureLike } from 'ol/Feature';
import { GtfsService } from '../../../core/services/gtfs.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AgencyService } from '../../../core/services/agency.service';
import { VehiclePosition } from '@shared/models/vehicle-position.model';

@Component({
  selector: 'app-map',
  template: `
    <div #mapEl class="map__container"></div>
    <div #popupEl class="map__popup">
      <button class="map__popup-close" (click)="closePopup()">×</button>
      @if (popupType() === 'stop') {
        <div class="map__popup-title">{{ popupData().title }}</div>
        @if (popupData().routes.length > 0) {
          <div class="map__popup-routes">
            @for (route of popupData().routes; track route.label) {
              <span class="map__popup-route" [style.border-left-color]="route.color">
                {{ route.label }}
              </span>
            }
          </div>
        }
      } @else if (popupType() === 'vehicle') {
        <div class="map__popup-title" [style.border-left-color]="popupData().routeColor || '#1976d2'">
          {{ popupData().title }}
        </div>
        <div class="map__popup-grid">
          <span class="map__popup-label">Vehicle</span>
          <span class="map__popup-value">{{ popupData().vehicleId }}</span>
          <span class="map__popup-label">Status</span>
          <span class="map__popup-value">{{ popupData().status }}</span>
          <span class="map__popup-label">Speed</span>
          <span class="map__popup-value">{{ popupData().speed }}</span>
          @if (popupData().updated) {
            <span class="map__popup-label">Updated</span>
            <span class="map__popup-value">{{ popupData().updated }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1;
      min-height: 0;
    }
    .map__container {
      width: 100%;
      height: 100%;
    }
    :host ::ng-deep .ol-attribution {
      bottom: 0.5rem;
      right: 0.5rem;
      max-width: calc(100% - 2rem);
    }
    :host ::ng-deep .ol-attribution.ol-collapsed {
      background: rgba(255,255,255,0.8);
      border-radius: 4px;
    }
    :host ::ng-deep .ol-attribution.ol-collapsed ul {
      display: none;
    }
    :host ::ng-deep .ol-attribution button {
      display: none;
    }
    :host ::ng-deep .ol-zoom {
      top: 0.75rem;
      left: 0.75rem;
    }
    :host ::ng-deep .ol-zoom button {
      display: block;
      width: 1.75rem;
      height: 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      background: var(--color-bg-card);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition);
    }
    :host ::ng-deep .ol-zoom button:hover {
      background: var(--color-primary-light);
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
    :host ::ng-deep .ol-zoom button:first-child {
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    }
    :host ::ng-deep .ol-zoom button:last-child {
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
      border-top: none;
    }
    :host ::ng-deep .ol-rotate button {
      display: block;
      width: 1.75rem;
      height: 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      background: var(--color-bg-card);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition);
    }
    :host ::ng-deep .ol-rotate button:hover {
      background: var(--color-primary-light);
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
    .map__popup {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: 0.625rem 0.75rem;
      min-width: 180px;
      max-width: 280px;
      font-size: 0.8rem;
      position: relative;
    }
    .map__popup::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: var(--color-border);
    }
    .map__popup-close {
      position: absolute;
      top: 0.25rem;
      right: 0.35rem;
      background: none;
      border: none;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      color: var(--color-text-muted);
      padding: 0;
    }
    .map__popup-close:hover {
      color: var(--color-text);
    }
    .map__popup-title {
      font-weight: 600;
      margin-bottom: 0.375rem;
      padding-right: 1rem;
      padding-left: 0.5rem;
      border-left: 3px solid transparent;
    }
    .map__popup-routes {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .map__popup-route {
      display: inline-block;
      font-size: 0.72rem;
      padding: 0.1rem 0.4rem;
      border-left: 3px solid;
      color: var(--color-text-muted);
    }
    .map__popup-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      color: var(--color-text-muted);
    }
    .map__popup-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.2rem 0.75rem;
    }
    .map__popup-label {
      color: var(--color-text-muted);
      font-size: 0.72rem;
    }
    .map__popup-value {
      font-size: 0.78rem;
      font-weight: 500;
    }
  `],
})
export class MapComponent implements OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('popupEl', { static: true }) popupEl!: ElementRef<HTMLDivElement>;

  private readonly gtfsService = inject(GtfsService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly agencyService = inject(AgencyService);

  private map: Map | null = null;
  private readonly mapReady = signal(false);
  readonly popupType = signal<'stop' | 'vehicle' | null>(null);
  readonly popupData = signal<{
    title: string;
    routes: { label: string; color: string }[];
    routeColor?: string;
    vehicleId?: string;
    status?: string;
    speed?: string;
    updated?: string;
  }>({ title: '', routes: [] });
  private popupOverlay: Overlay | null = null;

  private routeSource = new VectorSource();
  private stopSource = new VectorSource();
  private vehicleSource = new VectorSource();
  private routeColorMap = new globalThis.Map<string, string>();
  private vehicleFeatureMap = new globalThis.Map<string, Feature>();

  private readonly routeLayer = new VectorLayer({
    source: this.routeSource,
    style: (feature) => {
      const routeId = feature.get('routeId') as string;
      const route = this.routeColorMap.get(routeId);
      const color = route ? `#${route}` : '#3388ff';
      return new Style({
        stroke: new Stroke({ color, width: 3 }),
      });
    },
  });

  private readonly stopLayer = new VectorLayer({
    source: this.stopSource,
    style: new Style({
      image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color: '#666' }),
        stroke: new Stroke({ color: '#fff', width: 1 }),
      }),
    }),
  });

  private readonly vehicleLayer = new VectorLayer({
    source: this.vehicleSource,
  });

  constructor() {
    afterNextRender(() => {
      this.map = new Map({
        target: this.mapEl.nativeElement,
        layers: [
          new TileLayer({
            source: new XYZ({
              url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              attributions: '© OpenStreetMap contributors © CARTO',
            }),
          }),
          this.routeLayer,
          this.stopLayer,
          this.vehicleLayer,
        ],
        view: new View({
          center: fromLonLat([-98.5, 39.8]),
          zoom: 4,
        }),
        controls: defaultControls({
          attributionOptions: { collapsible: true, collapsed: true },
        }),
      });
      this.map.updateSize();
      this.mapReady.set(true);

      this.popupOverlay = new Overlay({
        element: this.popupEl.nativeElement,
        autoPan: { animation: { duration: 250 } },
        offset: [0, -12],
        positioning: 'bottom-center',
      });
      this.map.addOverlay(this.popupOverlay);

      this.map.on('singleclick', (evt) => {
        let clicked = false;
        this.map!.forEachFeatureAtPixel(evt.pixel, (feature) => {
          if (clicked) return;
          const stopName = feature.get('name');
          const vehicleId = feature.get('vehicleId');
          if (stopName) {
            this.showStopPopup(feature.get('stopId') as string, stopName as string, evt.coordinate);
            clicked = true;
          } else if (vehicleId) {
            this.showVehiclePopup(feature, evt.coordinate);
            clicked = true;
          }
        });
        if (!clicked) this.closePopup();
      });
    });

    effect(() => {
      if (!this.mapReady()) return;
      const agency = this.agencyService.selectedAgency();
      if (!agency?.boundingBox || !this.map) return;

      this.map.updateSize();
      const { minLat, minLon, maxLat, maxLon } = agency.boundingBox;
      const extent = transformExtent(
        [minLon, minLat, maxLon, maxLat],
        'EPSG:4326',
        'EPSG:3857',
      );
      this.map.getView().fit(extent, { padding: [50, 50, 50, 50] });
    });

    effect(() => {
      if (!this.mapReady()) return;
      const routes = this.gtfsService.routes();
      this.routeColorMap = new globalThis.Map(
        routes.map((r) => [r.id, r.color] as [string, string]),
      );
      this.routeLayer.changed();
    });

    effect(() => {
      if (!this.mapReady()) return;
      const agency = this.agencyService.selectedAgency();
      if (!agency) return;

      this.routeSource.clear();
      this.vehicleSource.clear();
      this.vehicleFeatureMap.clear();
      this.gtfsService.getRouteShapes(agency.id).subscribe({
        next: (geojson) => {
          const features = new GeoJSON().readFeatures(geojson, {
            featureProjection: 'EPSG:3857',
          });
          this.routeSource.addFeatures(features);
          this.routeLayer.changed();
        },
      });
    });

    effect(() => {
      if (!this.mapReady()) return;
      const hidden = this.gtfsService.hiddenRoutes();
      this.routeSource.getFeatures().forEach((feature) => {
        const routeId = feature.get('routeId') as string;
        feature.setStyle(hidden.has(routeId) ? [] : undefined);
      });
    });

    effect(() => {
      if (!this.mapReady()) return;
      const stops = this.gtfsService.stops();
      const hidden = this.gtfsService.hiddenRoutes();
      const allRoutes = this.gtfsService.routes();
      const allHidden = hidden.size >= allRoutes.length && allRoutes.length > 0;
      const stopToRoutes = this.gtfsService.stopToRoutes();
      if (stops.length === 0) {
        this.stopSource.clear();
        return;
      }

      this.stopSource.clear();
      for (const stop of stops) {
        const routeIds = stopToRoutes[stop.id];
        const isHidden = routeIds && routeIds.length > 0
          ? routeIds.every((rid) => hidden.has(rid))
          : allHidden;
        if (isHidden) continue;

        const feature = new Feature({
          geometry: new Point(fromLonLat([stop.lon, stop.lat])),
          name: stop.name,
          stopId: stop.id,
        });
        this.stopSource.addFeature(feature);
      }
    });

    effect(() => {
      if (!this.mapReady()) return;
      const hidden = this.gtfsService.hiddenRoutes();
      const positions = this.realtimeService.vehiclePositions().filter(
        (p) => p.routeId && !hidden.has(p.routeId),
      );
      this.updateVehiclePositions(positions);
    });
  }

  private updateVehiclePositions(positions: VehiclePosition[]): void {
    const seen = new Set<string>();

    for (const pos of positions) {
      seen.add(pos.vehicleId);
      const existing = this.vehicleFeatureMap.get(pos.vehicleId);

      if (existing) {
        (existing.getGeometry() as Point).setCoordinates(fromLonLat([pos.lon, pos.lat]));
        existing.set('bearing', pos.bearing);
        existing.setStyle(
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 8,
              rotation: (pos.bearing * Math.PI) / 180,
              fill: new Fill({ color: `#${this.routeColorMap.get(pos.routeId) ?? '1976d2'}` }),
              stroke: new Stroke({ color: '#fff', width: 1 }),
            }),
          }),
        );
      } else {
        const feature = new Feature({
          geometry: new Point(fromLonLat([pos.lon, pos.lat])),
          vehicleId: pos.vehicleId,
          routeId: pos.routeId,
          bearing: pos.bearing,
        });
        feature.setStyle(
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 8,
              rotation: (pos.bearing * Math.PI) / 180,
              fill: new Fill({ color: `#${this.routeColorMap.get(pos.routeId) ?? '1976d2'}` }),
              stroke: new Stroke({ color: '#fff', width: 1 }),
            }),
          }),
        );
        this.vehicleSource.addFeature(feature);
        this.vehicleFeatureMap.set(pos.vehicleId, feature);
      }
    }

    for (const [vehicleId, feature] of this.vehicleFeatureMap) {
      if (!seen.has(vehicleId)) {
        this.vehicleSource.removeFeature(feature);
        this.vehicleFeatureMap.delete(vehicleId);
      }
    }
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }

  closePopup(): void {
    this.popupOverlay?.setPosition(undefined);
    this.popupType.set(null);
  }

  private showStopPopup(stopId: string, stopName: string, coordinate: number[]): void {
    const routes = this.gtfsService.routes();
    const stopToRoutes = this.gtfsService.stopToRoutes();

    const routeIds = stopToRoutes[stopId] ?? [];
    const routeItems = routeIds
      .map((rid) => routes.find((r) => r.id === rid))
      .filter((r): r is Route => !!r)
      .map((r) => ({
        label: r.shortName ? `${r.shortName} — ${r.longName}` : r.longName,
        color: `#${r.color}`,
      }));

    this.popupType.set('stop');
    this.popupData.set({ title: stopName, routes: routeItems });
    this.popupOverlay?.setPosition(coordinate);
  }

  private showVehiclePopup(feature: FeatureLike, coordinate: number[]): void {
    const vehicleId = feature.get('vehicleId') as string;
    const routeId = feature.get('routeId') as string;
    const routes = this.gtfsService.routes();
    const route = routes.find((r) => r.id === routeId);
    const routeLabel = route
      ? (route.shortName ? `${route.shortName} — ${route.longName}` : route.longName)
      : routeId;

    const positions = this.realtimeService.vehiclePositions();
    const pos = positions.find((p) => p.vehicleId === vehicleId);
    const statusText = pos?.currentStatus !== undefined
      ? this.vehicleStatusText(pos.currentStatus)
      : 'Unknown';
    const speedText = pos && pos.speed > 0
      ? `${(pos.speed * 2.237).toFixed(0)} mph`
      : 'Stopped';
    const timeText = pos
      ? new Date(pos.timestamp * 1000).toLocaleTimeString()
      : undefined;

    this.popupType.set('vehicle');
    this.popupData.set({
      title: routeLabel,
      routes: [],
      routeColor: route ? `#${route.color}` : '#1976d2',
      vehicleId,
      status: statusText,
      speed: speedText,
      updated: timeText,
    });
    this.popupOverlay?.setPosition(coordinate);
  }

  private vehicleStatusText(status: VehicleStopStatus): string {
    switch (status) {
      case VehicleStopStatus.IncomingAt: return 'Incoming at stop';
      case VehicleStopStatus.StoppedAt: return 'At stop';
      case VehicleStopStatus.InTransitTo: return 'In transit';
      default: return 'Unknown';
    }
  }
}
