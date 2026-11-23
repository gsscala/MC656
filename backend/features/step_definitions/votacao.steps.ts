import assert from 'node:assert/strict';
import { Before, Given, When, Then } from '@cucumber/cucumber';
import request, { Response } from 'supertest';
import { createApp } from '../../src/api/app';
import { ElectionController } from '../../src/api/electionController';

let controller: ElectionController;
let app: ReturnType<typeof createApp>;
let activeElectionId: string;
let lastResponse: Response;
let lastReceiptHash: string;

Before(() => {
  controller = new ElectionController();
  app = createApp(controller);
  activeElectionId = '';
  lastReceiptHash = '';
});

Given(
  'que existe uma eleição aberta {string} do tipo {string} com opções {string}, universo {int} e quórum {float}',
  async (
    electionId: string,
    type: string,
    optionsCsv: string,
    totalEligibleVoters: number,
    quorumFraction: number,
  ) => {
    activeElectionId = electionId;
    const options = optionsCsv.split(',').map((opt) => ({
      id: opt.trim(),
      title: opt.trim().toUpperCase(),
    }));

    const res = await request(app)
      .post('/api/elections')
      .send({
        id: electionId,
        title: `Eleição BDD ${electionId}`,
        type,
        startDate: new Date(Date.now() - 3600_000).toISOString(),
        endDate: new Date(Date.now() + 3600_000).toISOString(),
        options,
        totalEligibleVoters,
        quorumFraction,
      });

    assert.equal(res.status, 201);
  },
);

When(
  'o eleitor {string} com credencial {string}, status {string} e peso {float} vota na opção {string}',
  async (voterId: string, credentials: string, voterStatus: string, weight: number, optionId: string) => {
    lastResponse = await request(app)
      .post(`/api/elections/${activeElectionId}/votes`)
      .send({
        voterId,
        credentials,
        voterStatus,
        weight,
        optionId,
      });

    if (lastResponse.status === 201 && typeof lastResponse.body.receiptHash === 'string') {
      lastReceiptHash = lastResponse.body.receiptHash;
    }
  },
);

When('consulto a apuração parcial da eleição {string}', async (electionId: string) => {
  lastResponse = await request(app).get(`/api/elections/${electionId}/tally?force=true`);
});

When('consulto o log de auditoria da eleição {string}', async (electionId: string) => {
  lastResponse = await request(app).get(`/api/elections/${electionId}/audit`);
});

Then('a resposta HTTP deve ter status {int}', (expectedStatus: number) => {
  assert.equal(lastResponse.status, expectedStatus);
});

Then('um recibo SHA-256 válido deve ser emitido para o eleitor {string}', (voterId: string) => {
  assert.match(String(lastResponse.body.receiptHash), /^[a-f0-9]{64}$/);
  assert.equal(lastResponse.body.voterId, voterId);
});

Then(
  'ao consultar a verificação desse recibo na eleição {string} o status deve ser {int} e verified verdadeiro',
  async (electionId: string, expectedStatus: number) => {
    const res = await request(app).get(`/api/elections/${electionId}/receipts/${lastReceiptHash}`);
    assert.equal(res.status, expectedStatus);
    assert.equal(res.body.verified, true);
    assert.equal(res.body.receiptHash, lastReceiptHash);
  },
);

Then(
  'a apuração deve apontar {int} votos nominais, vencedor {string} e quórum atingido',
  (expectedVotes: number, expectedWinner: string) => {
    assert.equal(lastResponse.body.tally.totalVotes, expectedVotes);
    assert.deepEqual(lastResponse.body.tally.winners, [expectedWinner]);
    assert.equal(lastResponse.body.tally.quorumReached, true);
  },
);

Then('o contador de comparecimento deve registrar {int} votos', (expectedCount: number) => {
  assert.equal(lastResponse.body.turnoutCount, expectedCount);
});

Then('o log de auditoria deve conter {int} recibos sem expor a opção escolhida', (expectedCount: number) => {
  const logs = lastResponse.body.auditLogs as Array<Record<string, unknown>>;
  assert.equal(logs.length, expectedCount);
  for (const entry of logs) {
    assert.match(String(entry.receiptHash), /^[a-f0-9]{64}$/);
    assert.equal('optionId' in entry, false);
  }
});
