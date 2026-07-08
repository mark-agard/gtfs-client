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
import { GtfsService } from '../../../core/services/gtfs.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AgencyService } from '../../../core/services/agency.service';
import { VehiclePosition } from '@shared/models/vehicle-position.model';

@Component({
  selector: 'app-map',
  template: `<div #mapEl class="map__container"></div>`,
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
  `],
})
export class MapComponent implements OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private readonly gtfsService = inject(GtfsService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly agencyService = inject(AgencyService);

  private map: Map | null = null;
  private readonly mapReady = signal(false);

  private routeSource = new VectorSource();
  private stopSource = new VectorSource();
  private vehicleSource = new VectorSource();
  private routeColorMap = new globalThis.Map<string, string>();

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
          : false;
        if (isHidden) continue;

        const feature = new Feature({
          geometry: new Point(fromLonLat([stop.lon, stop.lat])),
          name: stop.name,
        });
        this.stopSource.addFeature(feature);
      }
    });

    effect(() => {
      if (!this.mapReady()) return;
      const hidden = this.gtfsService.hiddenRoutes();
      const positions = this.realtimeService.vehiclePositions().filter(
        (p) => !p.routeId || !hidden.has(p.routeId),
      );
      this.updateVehiclePositions(positions);
    });
  }

  private updateVehiclePositions(positions: VehiclePosition[]): void {
    this.vehicleSource.clear();

    for (const pos of positions) {
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
    }
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
  }
}
