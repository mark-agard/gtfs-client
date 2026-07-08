import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GeoJSONFeatureCollection } from '@shared/models/geojson.model';
import { Route } from '@shared/models/route.model';
import { Stop } from '@shared/models/stop.model';

@Injectable({ providedIn: 'root' })
export class GtfsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/agencies';

  readonly routes = signal<Route[]>([]);
  readonly stops = signal<Stop[]>([]);
  readonly tripToRoute = signal<Record<string, string>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  loadStaticData(agencyId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<GeoJSONFeatureCollection<Route>>(`${this.baseUrl}/${agencyId}/routes`).subscribe({
      next: (res) => {
        this.routes.set(res.features.map((f) => f.properties));
      },
      error: (err) => this.error.set(err.message ?? 'Failed to load routes'),
    });

    this.http.get<GeoJSONFeatureCollection<Stop>>(`${this.baseUrl}/${agencyId}/stops`).subscribe({
      next: (res) => {
        this.stops.set(res.features.map((f) => f.properties));
      },
      error: (err) => this.error.set(err.message ?? 'Failed to load stops'),
    });

    this.http.get<Record<string, string>>(`${this.baseUrl}/${agencyId}/trips`).subscribe({
      next: (res) => {
        this.tripToRoute.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load trips');
        this.loading.set(false);
      },
    });
  }

  getRouteShapes(agencyId: string) {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${agencyId}/shapes`);
  }

  clear(): void {
    this.routes.set([]);
    this.stops.set([]);
    this.tripToRoute.set({});
    this.loading.set(false);
    this.error.set(null);
  }
}
