import { Router } from 'express';
import { ElectionController } from './electionController';

export function createElectionRouter(controller: ElectionController): Router {
  const router = Router();

  router.post('/elections', controller.createElection);
  router.get('/elections/:id', controller.getElection);
  router.post('/elections/:id/votes', controller.submitVote);
  router.get('/elections/:id/tally', controller.getTally);
  router.get('/elections/:id/receipts/:hash', controller.getReceipt);

  return router;
}
