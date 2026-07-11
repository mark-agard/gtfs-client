import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
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
  readonly stopToRoutes = signal<Record<string, string[]>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hiddenRoutes = signal<Set<string>>(new Set());
  private staticSub?: { unsubscribe(): void };

  toggleRoute(routeId: string, visible: boolean): void {
    this.hiddenRoutes.update((set) => {
      const next = new Set(set);
      if (visible) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }

  setRoutesVisible(routeIds: string[], visible: boolean): void {
    this.hiddenRoutes.update((set) => {
      const next = new Set(set);
      for (const id of routeIds) {
        if (visible) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  loadStaticData(agencyId: string): void {
    this.staticSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.staticSub = forkJoin({
      routes: this.http.get<{ routes: Route[] }>(`${this.baseUrl}/${agencyId}/routes`),
      stops: this.http.get<GeoJSONFeatureCollection<Stop>>(`${this.baseUrl}/${agencyId}/stops`),
      trips: this.http.get<Record<string, string>>(`${this.baseUrl}/${agencyId}/trips`),
      stopToRoutes: this.http.get<Record<string, string[]>>(`${this.baseUrl}/${agencyId}/stop-to-routes`),
    }).subscribe({
      next: ({ routes, stops, trips, stopToRoutes }) => {
        this.routes.set(routes.routes);
        this.stops.set(stops.features.map((f) => f.properties));
        this.tripToRoute.set(trips);
        this.stopToRoutes.set(stopToRoutes);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load GTFS data');
        this.loading.set(false);
      },
    });
  }

  getRouteShapes(agencyId: string) {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${agencyId}/shapes`);
  }

  clear(): void {
    this.staticSub?.unsubscribe();
    this.routes.set([]);
    this.stops.set([]);
    this.tripToRoute.set({});
    this.stopToRoutes.set({});
    this.hiddenRoutes.set(new Set());
    this.loading.set(false);
    this.error.set(null);
  }
}
