import { parse } from 'csv-parse';
import { Parse } from 'unzipper';
import { Cache } from '../utils/cache.js';
import type { MobilityDbService } from './mobility-db.service.js';
import type { GeoJSONFeatureCollection } from '@shared/models/geojson.model';
import type { Route } from '@shared/models/route.model';
import type { Stop } from '@shared/models/stop.model';

const STATIC_CACHE_TTL = 24 * 60 * 60 * 1000;

interface StaticData {
  routes: Route[];
  stops: GeoJSONFeatureCollection<Stop>;
  shapes: GeoJSONFeatureCollection;
  trips: Record<string, string>;
  stopToRoutes: Record<string, string[]>;
}

export class GtfsStaticService {
  private static readonly NEEDED_FILES = new Set([
    'routes.txt', 'trips.txt', 'shapes.txt', 'stop_times.txt', 'stops.txt',
  ]);

  private readonly cache = new Cache<StaticData>(STATIC_CACHE_TTL);

  constructor(private readonly mobilityDb: MobilityDbService) {}

  async getRoutes(agencyId: string): Promise<Route[]> {
    const data = await this.getOrFetch(agencyId);
    return data.routes;
  }

  async getStops(agencyId: string): Promise<GeoJSONFeatureCollection<Stop>> {
    const data = await this.getOrFetch(agencyId);
    return data.stops;
  }

  async getShapes(agencyId: string): Promise<GeoJSONFeatureCollection> {
    const data = await this.getOrFetch(agencyId);
    return data.shapes;
  }

  async getTrips(agencyId: string): Promise<Record<string, string>> {
    const data = await this.getOrFetch(agencyId);
    return data.trips;
  }

  async getStopToRoutes(agencyId: string): Promise<Record<string, string[]>> {
    const data = await this.getOrFetch(agencyId);
    return data.stopToRoutes;
  }

  private async getOrFetch(agencyId: string): Promise<StaticData> {
    const cached = this.cache.get(agencyId);
    if (cached) return cached;

    const downloadUrl = await this.mobilityDb.getFeedDownloadUrl(agencyId);
    if (!downloadUrl) {
      throw new Error(`No download URL available for agency ${agencyId}`);
    }

    const data = await this.downloadAndParse(downloadUrl);
    this.cache.set(agencyId, data);
    return data;
  }

  private async downloadAndParse(url: string): Promise<StaticData> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download GTFS feed: ${res.status}`);
    }

    let buffer = Buffer.from(await res.arrayBuffer());
    const files = await this.unzipToMap(buffer);
    buffer = null!;

    const routes = await this.parseRoutes(files.get('routes.txt'));
    files.delete('routes.txt');

    const tripsRaw = await this.parseCsv(files.get('trips.txt'));
    files.delete('trips.txt');

    const trips = this.buildTripsMap(tripsRaw);
    const shapes = await this.parseShapes(files.get('shapes.txt'), tripsRaw);
    files.delete('shapes.txt');

    const stopTimesRaw = await this.parseCsv(files.get('stop_times.txt'));
    files.delete('stop_times.txt');

    const stopToRoutes = this.buildStopToRoutesMap(stopTimesRaw, trips);
    const activeStopIds = new Set(Object.keys(stopToRoutes));
    const stops = await this.parseStops(files.get('stops.txt'), activeStopIds);
    files.delete('stops.txt');

    return { routes, stops, shapes, trips, stopToRoutes };
  }

  private async unzipToMap(buffer: Buffer): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();

    await new Promise<void>((resolve, reject) => {
      const stream = Parse();
      const bufferPromises: Promise<void>[] = [];

      stream.on('entry', (entry: any) => {
        if (entry.type === 'File' && GtfsStaticService.NEEDED_FILES.has(entry.path)) {
          bufferPromises.push(
            entry.buffer().then((content: Buffer) => {
              files.set(entry.path, content);
            }),
          );
        } else {
          entry.autodrain();
        }
      });

      stream.on('error', reject);
      stream.on('close', () => {
        Promise.all(bufferPromises).then(() => resolve()).catch(reject);
      });

      stream.write(buffer);
      stream.end();
    });

    return files;
  }

  private parseCsv(buffer: Buffer | undefined): Promise<Record<string, string>[]> {
    if (!buffer) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      const records: Record<string, string>[] = [];
      parse(buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
        .on('data', (record: Record<string, string>) => records.push(record))
        .on('error', reject)
        .on('end', () => resolve(records));
    });
  }

  private async parseRoutes(buffer: Buffer | undefined): Promise<Route[]> {
    const records = await this.parseCsv(buffer);

    return records.map((r) => {
      const rawColor = (r.route_color ?? '').trim().toUpperCase();
      const color = rawColor && rawColor !== 'FFFFFF' && rawColor !== 'FFF'
        ? rawColor
        : this.generateRouteColor(r.route_id);
      return {
        id: r.route_id,
        agencyId: r.agency_id,
        shortName: r.route_short_name ?? '',
        longName: r.route_long_name ?? '',
        type: parseInt(r.route_type ?? '3', 10),
        color,
        textColor: r.route_text_color ?? '000000',
      };
    });
  }

  private generateRouteColor(routeId: string): string {
    const palette = [
      'e74c3c', '3498db', '2ecc71', 'f39c12', '9b59b6',
      '1abc9c', 'e67e22', 'e91e63', '00bcd4', '8bc34a',
      'ff5722', '607d8b', '795548', 'cddc39', '009688',
      '673ab7', 'ff6f00', 'd81b60', '455a64', '5d4037',
    ];
    let hash = 0;
    for (let i = 0; i < routeId.length; i++) {
      hash = ((hash << 5) - hash + routeId.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(hash) % palette.length];
  }

  private async parseStops(buffer: Buffer | undefined, activeStopIds: Set<string>): Promise<GeoJSONFeatureCollection<Stop>> {
    const records = await this.parseCsv(buffer);

    const features = records
      .filter((r) => r.stop_lat && r.stop_lon && activeStopIds.has(r.stop_id))
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [parseFloat(r.stop_lon), parseFloat(r.stop_lat)] as [number, number],
        },
        properties: {
          id: r.stop_id,
          name: r.stop_name ?? '',
          lat: parseFloat(r.stop_lat),
          lon: parseFloat(r.stop_lon),
          locationType: r.location_type ? parseInt(r.location_type, 10) : undefined,
        },
      }));

    return { type: 'FeatureCollection', features };
  }

  private async parseShapes(
    buffer: Buffer | undefined,
    tripRecords: Record<string, string>[],
  ): Promise<GeoJSONFeatureCollection> {
    if (!buffer) return { type: 'FeatureCollection', features: [] };

    const shapeToRoute = new Map<string, string>();
    for (const t of tripRecords) {
      if (t.shape_id && t.route_id) {
        shapeToRoute.set(t.shape_id, t.route_id);
      }
    }

    const records = await this.parseCsv(buffer);

    const shapeMap = new Map<string, { seq: number; point: [number, number] }[]>();
    for (const r of records) {
      const shapeId = r.shape_id;
      if (!shapeId) continue;

      const point: [number, number] = [parseFloat(r.shape_pt_lon), parseFloat(r.shape_pt_lat)];
      const seq = parseInt(r.shape_pt_sequence ?? '0', 10);

      if (!shapeMap.has(shapeId)) {
        shapeMap.set(shapeId, []);
      }
      shapeMap.get(shapeId)!.push({ seq, point });
    }

    const features = Array.from(shapeMap.entries())
      .filter(([shapeId]) => shapeToRoute.has(shapeId))
      .map(([shapeId, entries]) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: entries.sort((a, b) => a.seq - b.seq).map((e) => e.point),
      },
      properties: {
        shapeId,
        routeId: shapeToRoute.get(shapeId) ?? '',
      },
    }));

    return { type: 'FeatureCollection', features };
  }

  private buildTripsMap(records: Record<string, string>[]): Record<string, string> {
    const trips: Record<string, string> = {};
    for (const r of records) {
      if (r.trip_id && r.route_id) {
        trips[r.trip_id] = r.route_id;
      }
    }
    return trips;
  }

  private buildStopToRoutesMap(
    stopTimes: Record<string, string>[],
    trips: Record<string, string>,
  ): Record<string, string[]> {
    const stopToRoutes = new Map<string, Set<string>>();
    for (const st of stopTimes) {
      const stopId = st.stop_id;
      const tripId = st.trip_id;
      if (!stopId || !tripId) continue;
      const routeId = trips[tripId];
      if (!routeId) continue;
      if (!stopToRoutes.has(stopId)) {
        stopToRoutes.set(stopId, new Set());
      }
      stopToRoutes.get(stopId)!.add(routeId);
    }
    const result: Record<string, string[]> = {};
    for (const [stopId, routeIds] of stopToRoutes) {
      result[stopId] = Array.from(routeIds);
    }
    return result;
  }
}
