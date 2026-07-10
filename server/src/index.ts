import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import { MobilityDbService } from './services/mobility-db.service.js';
import { GtfsStaticService } from './services/gtfs-static.service.js';
import { GtfsRealtimeService } from './services/gtfs-realtime.service.js';
import { healthRoutes } from './routes/health.routes.js';
import { agencyRoutes } from './routes/agency.routes.js';

dotenv.config({ path: resolve(process.cwd(), '..', '.env') });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST ?? '0.0.0.0';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:4200';

const app = Fastify({ logger: true });

const mobilityDb = new MobilityDbService();
const gtfsStatic = new GtfsStaticService(mobilityDb);
const gtfsRealtime = new GtfsRealtimeService(mobilityDb, app.log);

await app.register(cors, { origin: [CLIENT_URL] });
await app.register(websocket);

await healthRoutes(app);
await agencyRoutes(app, { mobilityDb, gtfsStatic, gtfsRealtime });

const clientDist = resolve(process.cwd(), 'public');
if (existsSync(clientDist)) {
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: '/',
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.status(404).send({ error: 'Not found' });
    } else {
      reply.sendFile('index.html');
    }
  });
}

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`);
  await app.close();
  mobilityDb.dispose();
  gtfsStatic.dispose();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
