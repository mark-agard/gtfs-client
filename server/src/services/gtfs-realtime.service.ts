import { createRequire } from 'module';
import type { MobilityDbService } from './mobility-db.service.js';
import type { VehiclePosition, ServiceAlert } from '@shared/models/vehicle-position.model';

const require = createRequire(import.meta.url);
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const POLL_INTERVAL_MS = 10000;

type UpdateListener = (positions: VehiclePosition[], alerts: ServiceAlert[]) => void;

interface RtFeed {
  url: string;
  entityType: string;
}

interface AgencyPoller {
  interval: ReturnType<typeof setInterval>;
  clientCount: number;
  vehiclePositions: VehiclePosition[];
  alerts: ServiceAlert[];
  feeds: RtFeed[];
  listeners: Set<UpdateListener>;
}

export class GtfsRealtimeService {
  private readonly pollers = new Map<string, AgencyPoller>();

  constructor(private readonly mobilityDb: MobilityDbService) {}

  async subscribe(agencyId: string, listener: UpdateListener): Promise<AgencyPoller> {
    let poller = this.pollers.get(agencyId);

    if (!poller) {
      const feeds = await this.mobilityDb.getRealtimeFeedUrls(agencyId);
      poller = {
        interval: setInterval(() => this.poll(agencyId), POLL_INTERVAL_MS),
        clientCount: 0,
        vehiclePositions: [],
        alerts: [],
        feeds,
        listeners: new Set(),
      };
      this.pollers.set(agencyId, poller);

      await this.poll(agencyId);
    }

    poller.clientCount++;
    poller.listeners.add(listener);
    return poller;
  }

  unsubscribe(agencyId: string, listener: UpdateListener): void {
    const poller = this.pollers.get(agencyId);
    if (!poller) return;

    poller.listeners.delete(listener);
    poller.clientCount--;
    if (poller.clientCount <= 0) {
      clearInterval(poller.interval);
      this.pollers.delete(agencyId);
    }
  }

  getSnapshot(agencyId: string): { positions: VehiclePosition[]; alerts: ServiceAlert[] } | undefined {
    const poller = this.pollers.get(agencyId);
    if (!poller) return undefined;

    return { positions: poller.vehiclePositions, alerts: poller.alerts };
  }

  private async poll(agencyId: string): Promise<void> {
    const poller = this.pollers.get(agencyId);
    if (!poller || poller.feeds.length === 0) return;

    try {
      const positions: VehiclePosition[] = [];
      const alerts: ServiceAlert[] = [];

      for (const feed of poller.feeds) {
        const res = await fetch(feed.url);
        if (!res.ok) continue;

        const buffer = Buffer.from(await res.arrayBuffer());
        const msg = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buffer),
        );

        for (const entity of msg.entity) {
          if (entity.vehicle) {
            const v = entity.vehicle;
            if (v.position?.latitude && v.position?.longitude) {
              positions.push({
                vehicleId: v.vehicle?.id ?? '',
                tripId: v.trip?.tripId ?? '',
                routeId: v.trip?.routeId ?? '',
                lat: v.position.latitude,
                lon: v.position.longitude,
                bearing: v.position.bearing ?? 0,
                speed: v.position.speed ?? 0,
                timestamp: Number(v.timestamp ?? Date.now() / 1000),
                currentStopSequence: v.currentStopSequence,
                currentStatus: v.currentStatus,
              });
            }
          }

          if (entity.alert) {
            const a = entity.alert;
            alerts.push({
              id: entity.id,
              cause: a.cause?.toString() ?? 'UNKNOWN_CAUSE',
              effect: a.effect?.toString() ?? 'UNKNOWN_EFFECT',
              headerText: a.headerText?.translation?.[0]?.text ?? '',
              descriptionText: a.descriptionText?.translation?.[0]?.text ?? '',
              severityLevel: a.severityLevel?.toString() ?? 'UNKNOWN_SEVERITY',
              activePeriod: (a.activePeriod ?? []).map((p: { start?: number; end?: number }) => ({
                start: p.start ?? 0,
                end: p.end ?? 0,
              })),
              informedEntities: (a.informedEntity ?? []).map((e: { routeId?: string; stopId?: string }) => ({
                routeId: e.routeId,
                stopId: e.stopId,
              })),
            });
          }
        }
      }

      poller.vehiclePositions = positions;
      poller.alerts = alerts;

      for (const listener of poller.listeners) {
        listener(positions, alerts);
      }
    } catch (err) {
      console.error(`Failed to poll realtime feed for agency ${agencyId}:`, err);
    }
  }
}
