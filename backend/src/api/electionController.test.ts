import request from 'supertest';
import { createApp } from './app';
import { ElectionController } from './electionController';
import { InvalidVoteError } from '../services/ballotService';
import * as tallyModule from '../services/tallyService';

describe('ElectionController - Suíte de Testes Estruturais (Critério C3)', () => {
  let controller: ElectionController;
  let app: ReturnType<typeof createApp>;

  const validElectionPayload = {
    id: 'eleicao-ca-2026',
    title: 'Eleição Centro Acadêmico 2026',
    type: 'centro-academico',
    startDate: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás (aberta)
    endDate: new Date(Date.now() + 3600000).toISOString(),   // 1 hora no futuro
    options: [
      { id: 'chapa-a', title: 'Chapa A - Avançar' },
      { id: 'chapa-b', title: 'Chapa B - Renovar' },
    ],
    totalEligibleVoters: 200,
    quorumFraction: 0.25,
  };

  beforeEach(() => {
    controller = new ElectionController();
    app = createApp(controller);
  });

  describe('createApp Factory', () => {
    it('deve instanciar app com controller padrão caso nenhum seja fornecido', () => {
      const defaultApp = createApp();
      expect(defaultApp).toBeDefined();
    });
  });

  describe('POST /api/elections (Criação de Eleições)', () => {
    it('deve criar uma eleição com sucesso (201 Created)', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send(validElectionPayload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('eleicao-ca-2026');
      expect(res.body.title).toBe(validElectionPayload.title);
      expect(res.body.type).toBe('centro-academico');
      expect(res.body.status).toBe('open');
      expect(res.body.options).toHaveLength(2);
    });

    it('deve usar totalEligibleVoters padrão (100) quando não especificado', async () => {
      const payload = {
        ...validElectionPayload,
        id: 'eleicao-padrao-eleitores',
        totalEligibleVoters: undefined,
        quorumFraction: undefined,
      };

      const res = await request(app)
        .post('/api/elections')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('eleicao-padrao-eleitores');
    });

    it('deve retornar 400 se id não for informado ou for vazio', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('identificador da eleição (id) é obrigatório');
    });

    it('deve retornar 409 se já existir eleição com o mesmo id', async () => {
      await request(app).post('/api/elections').send(validElectionPayload);

      const res = await request(app)
        .post('/api/elections')
        .send(validElectionPayload);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Já existe uma eleição cadastrada');
    });

    it('deve retornar 400 se título não for informado ou for vazio', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: 'eleicao-sem-titulo', title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('título da eleição é obrigatório');
    });

    it('deve retornar 400 se startDate ou endDate estiverem ausentes', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: 'eleicao-sem-datas', startDate: undefined });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('datas de início e término são obrigatórias');
    });

    it('deve retornar 400 se datas forem em formato inválido', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: 'eleicao-data-invalida', startDate: 'data-errada' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Formato de data inválido');
    });

    it('deve retornar 400 se options não for um array ou tiver menos de 2 opções', async () => {
      const res1 = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: 'eleicao-sem-opcoes', options: [] });

      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('pelo menos duas opções');

      const res2 = await request(app)
        .post('/api/elections')
        .send({ ...validElectionPayload, id: 'eleicao-opcoes-nao-array', options: 'opcoes' });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('pelo menos duas opções');
    });

    it('deve retornar 400 se alguma opção possuir formato inválido (sem id ou sem title)', async () => {
      const res = await request(app)
        .post('/api/elections')
        .send({
          ...validElectionPayload,
          id: 'eleicao-opcao-malformatada',
          options: [{ id: 'chapa-1' }, { id: 'chapa-2', title: 'Chapa 2' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cada opção deve possuir id e title');
    });

    it('deve retornar 400 com mensagem de ElectionValidationError quando modelo rejeitar configuração', async () => {
      // Data de término anterior à de início
      const res = await request(app)
        .post('/api/elections')
        .send({
          ...validElectionPayload,
          id: 'eleicao-datas-invertidas',
          startDate: new Date('2026-10-20').toISOString(),
          endDate: new Date('2026-10-10').toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('A data de término não pode ser anterior à data de início');
    });
  });

  describe('GET /api/elections/:id (Consulta de Eleição)', () => {
    it('deve retornar os dados da eleição cadastrada (200 OK)', async () => {
      await request(app).post('/api/elections').send(validElectionPayload);

      const res = await request(app).get('/api/elections/eleicao-ca-2026');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('eleicao-ca-2026');
      expect(res.body.title).toBe(validElectionPayload.title);
    });

    it('deve retornar 404 quando a eleição não existir', async () => {
      const res = await request(app).get('/api/elections/eleicao-inexistente');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('não encontrada');
    });
  });

  describe('POST /api/elections/:id/votes (Submissão de Votos)', () => {
    beforeEach(async () => {
      await request(app).post('/api/elections').send(validElectionPayload);
    });

    it('deve registrar voto válido com sucesso e retornar recibo (201 Created)', async () => {
      const votePayload = {
        voterId: 'aluno-1',
        credentials: '123456', // RA com 6 dígitos
        optionId: 'chapa-a',
        weight: 2,
      };

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send(votePayload);

      expect(res.status).toBe(201);
      expect(res.body.receiptHash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.electionId).toBe('eleicao-ca-2026');
      expect(res.body.voterId).toBe('aluno-1');
    });

    it('deve retornar 404 se eleição informada na URL não existir', async () => {
      const res = await request(app)
        .post('/api/elections/eleicao-fantasma/votes')
        .send({ voterId: 'aluno-1', optionId: 'chapa-a' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('não encontrada');
    });

    it('deve retornar 400 se voterId ou optionId forem omitidos ou vazios', async () => {
      const res1 = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: '', optionId: 'chapa-a' });

      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('voterId) é obrigatório');

      const res2 = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'aluno-1', optionId: '   ' });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('optionId) é obrigatório');
    });

    it('deve retornar 400 se simulatedTime for inválido', async () => {
      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-1',
          credentials: '123456',
          optionId: 'chapa-a',
          simulatedTime: 'hora-invalida',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Timestamp de simulação inválido');
    });

    it('deve retornar 400 se a eleição ainda estiver no status scheduled', async () => {
      const timeBeforeStart = new Date(Date.now() - 7200000).toISOString(); // 2h atrás

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-1',
          credentials: '123456',
          optionId: 'chapa-a',
          simulatedTime: timeBeforeStart,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ainda não foi iniciada');
    });

    it('deve retornar 400 se a eleição já estiver encerrada (closed)', async () => {
      const timeAfterEnd = new Date(Date.now() + 7200000).toISOString(); // 2h à frente

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-1',
          credentials: '123456',
          optionId: 'chapa-a',
          simulatedTime: timeAfterEnd,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('já foi encerrada');
    });

    it('deve retornar 400 se optionId não fizer parte das opções da eleição', async () => {
      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-1',
          credentials: '123456',
          optionId: 'chapa-inexistente',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('não cadastrada para esta eleição');
    });

    it('deve retornar 403 Forbidden se o eleitor não for elegível pela estratégia', async () => {
      // RA inválido (apenas 5 dígitos)
      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-invalido',
          credentials: '12345',
          optionId: 'chapa-a',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('RA invalido');
    });

    it('deve retornar 403 Forbidden se eleitor estiver bloqueado', async () => {
      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({
          voterId: 'aluno-bloqueado',
          credentials: '123456',
          voterStatus: 'blocked',
          optionId: 'chapa-a',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('bloqueado');
    });

    it('deve retornar 409 Conflict em caso de voto duplicado do mesmo eleitor', async () => {
      const vote = {
        voterId: 'aluno-repetido',
        credentials: '123456',
        optionId: 'chapa-a',
      };

      const firstVote = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send(vote);
      expect(firstVote.status).toBe(201);

      const secondVote = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send(vote);
      expect(secondVote.status).toBe(409);
      expect(secondVote.body.error).toContain('já votou');
    });

    it('deve retornar 400 se o BallotService lançar InvalidVoteError', async () => {
      const internalCtrl = controller as unknown as { ballotService: { submitVote: () => never } };
      jest.spyOn(internalCtrl.ballotService, 'submitVote').mockImplementationOnce(() => {
        throw new InvalidVoteError('Erro de voto invalido simulado');
      });

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'aluno-inv', credentials: '123456', optionId: 'chapa-a' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Erro de voto invalido simulado');
    });

    it('deve retornar 500 se o BallotService lançar um erro inesperado', async () => {
      const internalCtrl = controller as unknown as { ballotService: { submitVote: () => never } };
      jest.spyOn(internalCtrl.ballotService, 'submitVote').mockImplementationOnce(() => {
        throw new Error('Falha catastrófica de infraestrutura');
      });

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'aluno-500', credentials: '123456', optionId: 'chapa-a' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Erro interno');
    });
  });

  describe('GET /api/elections/:id/tally (Apuração de Resultados)', () => {
    beforeEach(async () => {
      await request(app).post('/api/elections').send(validElectionPayload);

      // Submete votos válidos
      await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'v1', credentials: '111111', optionId: 'chapa-a', weight: 1 });
      await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'v2', credentials: '222222', optionId: 'chapa-a', weight: 1 });
      await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'v3', credentials: '333333', optionId: 'chapa-b', weight: 1 });
    });

    it('deve retornar 404 se a eleição não existir', async () => {
      const res = await request(app).get('/api/elections/inexistente/tally');
      expect(res.status).toBe(404);
    });

    it('deve retornar 400 se eleição ainda estiver aberta e force não for informado', async () => {
      const res = await request(app).get('/api/elections/eleicao-ca-2026/tally');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('A apuração oficial só está disponível após o encerramento');
    });

    it('deve realizar apuração parcial quando force=true em eleição aberta', async () => {
      const res = await request(app).get('/api/elections/eleicao-ca-2026/tally?force=true');

      expect(res.status).toBe(200);
      expect(res.body.tally.totalVotes).toBe(3);
      expect(res.body.tally.winners).toEqual(['chapa-a']);
    });

    it('deve realizar apuração oficial quando a eleição estiver closed', async () => {
      // Cria eleição já fechada
      const closedPayload = {
        ...validElectionPayload,
        id: 'eleicao-fechada',
        startDate: new Date(Date.now() - 7200000).toISOString(),
        endDate: new Date(Date.now() - 3600000).toISOString(),
      };
      await request(app).post('/api/elections').send(closedPayload);

      const res = await request(app).get('/api/elections/eleicao-fechada/tally');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('closed');
      expect(res.body.tally.totalVotes).toBe(0);
    });

    it('deve retornar 400 se ocorrer um erro durante o processamento da apuracao', async () => {
      jest.spyOn(tallyModule, 'tallyVotes').mockImplementationOnce(() => {
        throw new tallyModule.TallyError('Erro forcado no motor de apuracao');
      });

      const res = await request(app).get('/api/elections/eleicao-ca-2026/tally?force=true');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Erro forcado no motor de apuracao');
    });
  });

  describe('GET /api/elections/:id/receipts/:hash (Consulta e Verificação de Recibo)', () => {
    let receiptHash: string;

    beforeEach(async () => {
      await request(app).post('/api/elections').send(validElectionPayload);

      const res = await request(app)
        .post('/api/elections/eleicao-ca-2026/votes')
        .send({ voterId: 'v-recibo', credentials: '654321', optionId: 'chapa-b' });

      receiptHash = res.body.receiptHash;
    });

    it('deve retornar 200 OK e verificar o recibo existente', async () => {
      const res = await request(app)
        .get(`/api/elections/eleicao-ca-2026/receipts/${receiptHash}`);

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.receiptHash).toBe(receiptHash);
      expect(res.body.voterId).toBe('v-recibo');
    });

    it('deve retornar 404 se a eleição não existir', async () => {
      const res = await request(app)
        .get(`/api/elections/eleicao-inexistente/receipts/${receiptHash}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('não encontrada');
    });

    it('deve retornar 404 se o hash do recibo não existir', async () => {
      const res = await request(app)
        .get('/api/elections/eleicao-ca-2026/receipts/hash-falso-1234');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Recibo');
    });

    it('deve retornar 404 se o recibo pertencer a outra eleição', async () => {
      // Cria uma segunda eleição
      await request(app).post('/api/elections').send({
        ...validElectionPayload,
        id: 'eleicao-outra-2026',
      });

      // Tenta buscar o recibo da primeira eleição usando a rota da segunda
      const res = await request(app)
        .get(`/api/elections/eleicao-outra-2026/receipts/${receiptHash}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Recibo');
    });
  });

  describe('controller.reset()', () => {
    it('deve limpar todas as eleições e votos armazenados', async () => {
      await request(app).post('/api/elections').send(validElectionPayload);
      controller.reset();

      const res = await request(app).get('/api/elections/eleicao-ca-2026');
      expect(res.status).toBe(404);
    });
  });
});
