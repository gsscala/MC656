import express, { Express, Request, Response, NextFunction } from 'express';
import { ElectionController } from './electionController';
import { createElectionRouter } from './electionRoutes';

export function createApp(controller = new ElectionController()): Express {
  const app = express();

  app.use((req: Request, res: Response, next: NextFunction): void => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json());

  const router = createElectionRouter(controller);
  app.use('/api', router);

  return app;
}
