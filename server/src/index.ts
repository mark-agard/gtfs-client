import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { MobilityDbService } from './services/mobility-db.service.js';
import { GtfsStaticService } from './services/gtfs-static.service.js';
import { GtfsRealtimeService } from './services/gtfs-realtime.service.js';
import { healthRoutes } from './routes/health.routes.js';
import { agencyRoutes } from './routes/agency.routes.js';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

const mobilityDb = new MobilityDbService();
const gtfsStatic = new GtfsStaticService(mobilityDb);
const gtfsRealtime = new GtfsRealtimeService(mobilityDb);

await app.register(cors, { origin: true });
await app.register(websocket);

await healthRoutes(app);
await agencyRoutes(app, { mobilityDb, gtfsStatic, gtfsRealtime });

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
