import type { FastifyInstance } from 'fastify';
import type { MobilityDbService } from '../services/mobility-db.service.js';
import type { GtfsStaticService } from '../services/gtfs-static.service.js';
import type { GtfsRealtimeService } from '../services/gtfs-realtime.service.js';
import type { VehiclePosition, ServiceAlert } from '@shared/models/vehicle-position.model';

interface AgencyRouteContext {
  mobilityDb: MobilityDbService;
  gtfsStatic: GtfsStaticService;
  gtfsRealtime: GtfsRealtimeService;
}

export async function agencyRoutes(
  app: FastifyInstance,
  ctx: AgencyRouteContext,
): Promise<void> {
  const { mobilityDb, gtfsStatic, gtfsRealtime } = ctx;

  app.get<{ Querystring: { page?: string; pageSize?: string; search?: string } }>(
    '/api/agencies',
    async (request, reply) => {
      try {
        const page = parseInt(request.query.page ?? '1', 10);
        const pageSize = parseInt(request.query.pageSize ?? '50', 10);
        const search = request.query.search;
        const result = await mobilityDb.listUsAgencies(page, pageSize, search);
        return result;
      } catch (err) {
        app.log.error(err);
        reply.status(502);
        return { error: 'Failed to fetch agencies' };
      }
    },
  );

  app.get<{ Params: { id: string } }>('/api/agencies/:id', async (request, reply) => {
    try {
      const detail = await mobilityDb.getAgencyDetail(request.params.id);
      return detail;
    } catch (err) {
      app.log.error(err);
      reply.status(404);
      return { error: 'Agency not found' };
    }
  });

  app.get<{ Params: { id: string } }>('/api/agencies/:id/routes', async (request, reply) => {
    try {
      return await gtfsStatic.getRoutes(request.params.id);
    } catch (err) {
      app.log.error(err);
      reply.status(502);
      return { error: 'Failed to load routes' };
    }
  });

  app.get<{ Params: { id: string } }>('/api/agencies/:id/stops', async (request, reply) => {
    try {
      return await gtfsStatic.getStops(request.params.id);
    } catch (err) {
      app.log.error(err);
      reply.status(502);
      return { error: 'Failed to load stops' };
    }
  });

  app.get<{ Params: { id: string } }>('/api/agencies/:id/shapes', async (request, reply) => {
    try {
      return await gtfsStatic.getShapes(request.params.id);
    } catch (err) {
      app.log.error(err);
      reply.status(502);
      return { error: 'Failed to load shapes' };
    }
  });

  app.get<{ Params: { id: string } }>('/api/agencies/:id/trips', async (request, reply) => {
    try {
      return await gtfsStatic.getTrips(request.params.id);
    } catch (err) {
      app.log.error(err);
      reply.status(502);
      return { error: 'Failed to load trips' };
    }
  });

  app.get<{ Params: { id: string } }>('/api/agencies/:id/alerts', async (request, reply) => {
    try {
      const snapshot = gtfsRealtime.getSnapshot(request.params.id);
      return { alerts: snapshot?.alerts ?? [] };
    } catch (err) {
      app.log.error(err);
      reply.status(502);
      return { error: 'Failed to load alerts' };
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/agencies/:id/realtime',
    { websocket: true },
    async (socket, request) => {
      const agencyId = request.params.id;
      app.log.info(`WebSocket connected for agency ${agencyId}`);

      const listener = (positions: VehiclePosition[], alerts: ServiceAlert[]) => {
        if (positions.length > 0) {
          socket.send(JSON.stringify({ type: 'update', positions }));
        }
        if (alerts.length > 0) {
          socket.send(JSON.stringify({ type: 'alerts', alerts }));
        }
      };

      try {
        await gtfsRealtime.subscribe(agencyId, listener);

        const snapshot = gtfsRealtime.getSnapshot(agencyId);
        if (snapshot) {
          socket.send(JSON.stringify({ type: 'snapshot', positions: snapshot.positions }));
          if (snapshot.alerts.length > 0) {
            socket.send(JSON.stringify({ type: 'alerts', alerts: snapshot.alerts }));
          }
        }

        socket.on('message', (raw: Buffer) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong' }));
            }
          } catch {
            // Ignore malformed messages
          }
        });

        socket.on('close', () => {
          gtfsRealtime.unsubscribe(agencyId, listener);
          app.log.info(`WebSocket disconnected for agency ${agencyId}`);
        });
      } catch (err) {
        app.log.error(err);
        socket.close();
      }
    },
  );
}
