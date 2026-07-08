import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Circle, Fill } from 'ol/style';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { GtfsService } from '../../../core/services/gtfs.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AgencyService } from '../../../core/services/agency.service';
import { VehiclePosition } from '@shared/models/vehicle-position.model';

@Component({
  selector: 'app-map',
  template: `<div #mapEl class="map__container"></div>`,
  styles: [`
    .map__container {
      width: 100%;
      height: 100%;
    }
  `],
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private readonly gtfsService = inject(GtfsService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly agencyService = inject(AgencyService);

  private map!: Map;
  private routeSource!: VectorSource;
  private stopSource!: VectorSource;
  private vehicleSource!: VectorSource;

  private readonly routeLayer = new VectorLayer({ source: new VectorSource() });
  private readonly stopLayer = new VectorLayer({ source: new VectorSource() });
  private readonly vehicleLayer = new VectorLayer({ source: new VectorSource() });

  ngOnInit(): void {
    this.routeSource = this.routeLayer.getSource()!;
    this.stopSource = this.stopLayer.getSource()!;
    this.vehicleSource = this.vehicleLayer.getSource()!;

    this.map = new Map({
      target: this.mapEl.nativeElement,
      layers: [
        new TileLayer({ source: new OSM() }),
        this.routeLayer,
        this.stopLayer,
        this.vehicleLayer,
      ],
      view: new View({
        center: fromLonLat([-98.5, 39.8]),
        zoom: 4,
      }),
    });

    this.fitBounds();
    this.loadShapes();

    effect(() => {
      this.updateVehiclePositions(this.realtimeService.vehiclePositions());
    });
  }

  private fitBounds(): void {
    const agency = this.agencyService.selectedAgency();
    if (agency?.boundingBox) {
      const { minLat, minLon, maxLat, maxLon } = agency.boundingBox;
      this.map.getView().fit(
        [minLon, minLat, maxLon, maxLat],
        { padding: [50, 50, 50, 50] },
      );
    }
  }

  private loadShapes(): void {
    const agency = this.agencyService.selectedAgency();
    if (!agency) return;

    this.gtfsService.getRouteShapes(agency.id).subscribe({
      next: (geojson) => {
        const features = new GeoJSON().readFeatures(geojson, {
          featureProjection: 'EPSG:3857',
        });
        this.routeSource.addFeatures(features);
      },
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
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: '#1976d2' }),
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
