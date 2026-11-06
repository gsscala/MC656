import express, { Express } from 'express';
import { ElectionController } from './electionController';
import { createElectionRouter } from './electionRoutes';

export function createApp(controller = new ElectionController()): Express {
  const app = express();
  app.use(express.json());

  const router = createElectionRouter(controller);
  app.use('/api', router);

  return app;
}
