import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { MobilityDbService } from './mobility-db.service.js';
import type { VehiclePosition, ServiceAlert } from '@shared/models/vehicle-position.model';

const POLL_INTERVAL_MS = 10000;

interface AgencyPoller {
  interval: ReturnType<typeof setInterval>;
  clientCount: number;
  vehiclePositions: VehiclePosition[];
  alerts: ServiceAlert[];
  feedUrls: string[];
}

export class GtfsRealtimeService {
  private readonly pollers = new Map<string, AgencyPoller>();

  constructor(private readonly mobilityDb: MobilityDbService) {}

  async subscribe(agencyId: string): Promise<AgencyPoller> {
    let poller = this.pollers.get(agencyId);

    if (!poller) {
      const feedUrls = await this.mobilityDb.getRealtimeFeedUrls(agencyId);
      poller = {
        interval: setInterval(() => this.poll(agencyId), POLL_INTERVAL_MS),
        clientCount: 0,
        vehiclePositions: [],
        alerts: [],
        feedUrls,
      };
      this.pollers.set(agencyId, poller);

      await this.poll(agencyId);
    }

    poller.clientCount++;
    return poller;
  }

  unsubscribe(agencyId: string): void {
    const poller = this.pollers.get(agencyId);
    if (!poller) return;

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
    if (!poller || poller.feedUrls.length === 0) return;

    try {
      const positions: VehiclePosition[] = [];
      const alerts: ServiceAlert[] = [];

      for (const feedUrl of poller.feedUrls) {
        const res = await fetch(feedUrl);
        if (!res.ok) continue;

        const buffer = Buffer.from(await res.arrayBuffer());
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buffer),
        );

        for (const entity of feed.entity) {
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
                timestamp: v.timestamp ?? Date.now() / 1000,
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
    } catch (err) {
      console.error(`Failed to poll realtime feed for agency ${agencyId}:`, err);
    }
  }
}
