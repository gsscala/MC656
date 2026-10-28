import request from 'supertest';
import { createApp } from './app';
import { ElectionController } from './electionController';

describe('ElectionController Smoke Test (Baseline C_anterior)', () => {
  let controller: ElectionController;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    controller = new ElectionController();
    app = createApp(controller);
  });

  it('deve criar uma eleicao basica com sucesso (smoke test inicial)', async () => {
    const payload = {
      id: 'eleicao-smoke',
      title: 'Eleicao Inicial Smoke',
      type: 'centro-academico',
      startDate: new Date(Date.now() - 10000).toISOString(),
      endDate: new Date(Date.now() + 100000).toISOString(),
      options: [
        { id: 'chapa-1', title: 'Chapa Uniao' },
        { id: 'chapa-2', title: 'Chapa Renovacao' },
      ],
      totalEligibleVoters: 50,
      quorumFraction: 0.5,
    };

    const response = await request(app)
      .post('/api/elections')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('eleicao-smoke');
    expect(response.body.title).toBe('Eleicao Inicial Smoke');
  });
});
