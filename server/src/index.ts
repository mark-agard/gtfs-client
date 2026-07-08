import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await app.register(websocket);

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

app.get('/api/agencies', async () => {
  // TODO: Proxy to Mobility Database API
  return { agencies: [], total: 0 };
});

app.get('/api/agencies/:id', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Fetch agency detail from Mobility Database
  return { id, message: 'Not implemented' };
});

app.get('/api/agencies/:id/routes', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Return GeoJSON routes for agency
  return { id, type: 'FeatureCollection', features: [] };
});

app.get('/api/agencies/:id/stops', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Return GeoJSON stops for agency
  return { id, type: 'FeatureCollection', features: [] };
});

app.get('/api/agencies/:id/shapes', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Return GeoJSON shapes for agency
  return { id, type: 'FeatureCollection', features: [] };
});

app.get('/api/agencies/:id/trips', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Return trip_id -> route_id mapping
  return { id, trips: {} };
});

app.get('/api/agencies/:id/alerts', async (request) => {
  const { id } = request.params as { id: string };
  // TODO: Return service alerts for agency
  return { id, alerts: [] };
});

app.get('/api/agencies/:id/realtime', { websocket: true }, (socket, request) => {
  const { id } = request.params as { id: string };
  app.log.info(`WebSocket connected for agency ${id}`);

  socket.on('close', () => {
    app.log.info(`WebSocket disconnected for agency ${id}`);
  });

  // TODO: Start polling GTFS-RT feed and push updates
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
