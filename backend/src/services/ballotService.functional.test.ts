import {
  BallotService,
  DuplicateVoteError,
  InvalidVoteError,
  ElectionNotStartedError,
  ElectionEndedError,
  type Vote,
  type ElectionLike,
} from './ballotService';

describe('Escopo 2 - BallotService.submitVote (Analise de Valor Limite Temporal)', () => {
  let service: BallotService;

  // Janela temporal controlada: 15/10/2026 das 08:00:00.000Z às 18:00:00.000Z
  const T_start = new Date('2026-10-15T08:00:00.000Z');
  const T_end = new Date('2026-10-15T18:00:00.000Z');
  const T_start_ms = T_start.getTime();
  const T_end_ms = T_end.getTime();

  const electionConfig: ElectionLike = {
    startDate: T_start,
    endDate: T_end,
    options: [
      { id: 'chapa-alpha', title: 'Chapa Alpha' },
      { id: 'chapa-beta', title: 'Chapa Beta' },
    ],
  };

  beforeEach(() => {
    service = new BallotService();
    service.registerElection('eleicao-avl', electionConfig);
  });

  test('AVL-1 [Limite Inferior]: submissao em T_start - 1ms deve falhar com ElectionNotStartedError', () => {
    const vote: Vote = {
      voterId: 'voter-avl-1',
      electionId: 'eleicao-avl',
      optionId: 'chapa-alpha',
      timestamp: new Date(T_start_ms - 1),
    };

    expect(() => service.submitVote(vote)).toThrow(ElectionNotStartedError);
    expect(() => service.submitVote(vote)).toThrow('A eleição ainda não foi iniciada');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-1')).toBe(false);
  });

  test('AVL-2 [Limite Inferior]: submissao exatamente em T_start deve ser aceita e emitir recibo', () => {
    const vote: Vote = {
      voterId: 'voter-avl-2',
      electionId: 'eleicao-avl',
      optionId: 'chapa-alpha',
      timestamp: new Date(T_start_ms),
    };

    const receipt = service.submitVote(vote);

    expect(receipt).toBeDefined();
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.timestamp.getTime()).toBe(T_start_ms);
    expect(receipt.voterId).toBe('voter-avl-2');
    expect(receipt.electionId).toBe('eleicao-avl');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-2')).toBe(true);
  });

  test('AVL-3 [Limite Inferior]: submissao em T_start + 1ms deve ser aceita e emitir recibo', () => {
    const vote: Vote = {
      voterId: 'voter-avl-3',
      electionId: 'eleicao-avl',
      optionId: 'chapa-beta',
      timestamp: new Date(T_start_ms + 1),
    };

    const receipt = service.submitVote(vote);

    expect(receipt).toBeDefined();
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.timestamp.getTime()).toBe(T_start_ms + 1);
    expect(receipt.voterId).toBe('voter-avl-3');
    expect(receipt.electionId).toBe('eleicao-avl');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-3')).toBe(true);
  });

  test('AVL-4 [Limite Superior]: submissao em T_end - 1ms deve ser aceita e emitir recibo', () => {
    const vote: Vote = {
      voterId: 'voter-avl-4',
      electionId: 'eleicao-avl',
      optionId: 'chapa-beta',
      timestamp: new Date(T_end_ms - 1),
    };

    const receipt = service.submitVote(vote);

    expect(receipt).toBeDefined();
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.timestamp.getTime()).toBe(T_end_ms - 1);
    expect(receipt.voterId).toBe('voter-avl-4');
    expect(receipt.electionId).toBe('eleicao-avl');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-4')).toBe(true);
  });

  test('AVL-5 [Limite Superior]: submissao exatamente em T_end deve ser aceita e emitir recibo', () => {
    const vote: Vote = {
      voterId: 'voter-avl-5',
      electionId: 'eleicao-avl',
      optionId: 'chapa-alpha',
      timestamp: new Date(T_end_ms),
    };

    const receipt = service.submitVote(vote);

    expect(receipt).toBeDefined();
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.timestamp.getTime()).toBe(T_end_ms);
    expect(receipt.voterId).toBe('voter-avl-5');
    expect(receipt.electionId).toBe('eleicao-avl');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-5')).toBe(true);
  });

  test('AVL-6 [Limite Superior]: submissao em T_end + 1ms deve falhar com ElectionEndedError', () => {
    const vote: Vote = {
      voterId: 'voter-avl-6',
      electionId: 'eleicao-avl',
      optionId: 'chapa-alpha',
      timestamp: new Date(T_end_ms + 1),
    };

    expect(() => service.submitVote(vote)).toThrow(ElectionEndedError);
    expect(() => service.submitVote(vote)).toThrow('A eleição já foi encerrada');
    expect(service.hasVoted('eleicao-avl', 'voter-avl-6')).toBe(false);
  });
});

describe('Escopo 2 - BallotService.submitVote (Classes de Equivalencia)', () => {
  let service: BallotService;

  const T_start = new Date('2026-10-15T08:00:00.000Z');
  const T_end = new Date('2026-10-15T18:00:00.000Z');

  const electionConfig: ElectionLike = {
    startDate: T_start,
    endDate: T_end,
    options: [
      { id: 'opcao-1', title: 'Chapa Renovacao' },
      { id: 'opcao-2', title: 'Chapa Continuacao' },
    ],
  };

  beforeEach(() => {
    service = new BallotService();
    service.registerElection('eleicao-ce-01', electionConfig);
  });

  test('CE1 [Valida]: Voto valido dentro do periodo com eleitor apto e opcao cadastrada', () => {
    const validVote: Vote = {
      voterId: 'disc-244784',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-1',
      timestamp: new Date('2026-10-15T12:00:00.000Z'),
    };

    const receipt = service.submitVote(validVote);

    expect(receipt).toBeDefined();
    expect(receipt.receiptHash).toHaveLength(64);
    expect(receipt.voterId).toBe('disc-244784');
    expect(receipt.electionId).toBe('eleicao-ce-01');
    expect(service.hasVoted('eleicao-ce-01', 'disc-244784')).toBe(true);
  });

  test('CE2 [Invalida]: Voto antes do periodo legal de votacao', () => {
    const earlyVote: Vote = {
      voterId: 'disc-244784',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-1',
      timestamp: new Date('2026-10-15T07:00:00.000Z'), // 1 hora antes de T_start
    };

    expect(() => service.submitVote(earlyVote)).toThrow(ElectionNotStartedError);
    expect(() => service.submitVote(earlyVote)).toThrow('A eleição ainda não foi iniciada');
    expect(service.hasVoted('eleicao-ce-01', 'disc-244784')).toBe(false);
  });

  test('CE3 [Invalida]: Voto apos o encerramento do periodo legal', () => {
    const lateVote: Vote = {
      voterId: 'disc-244784',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-1',
      timestamp: new Date('2026-10-15T19:00:00.000Z'), // 1 hora após T_end
    };

    expect(() => service.submitVote(lateVote)).toThrow(ElectionEndedError);
    expect(() => service.submitVote(lateVote)).toThrow('A eleição já foi encerrada');
    expect(service.hasVoted('eleicao-ce-01', 'disc-244784')).toBe(false);
  });

  test('CE4 [Invalida]: Tentativa de voto duplicado pelo mesmo eleitor na mesma eleicao', () => {
    const firstVote: Vote = {
      voterId: 'disc-dup-01',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-1',
      timestamp: new Date('2026-10-15T10:00:00.000Z'),
    };
    const duplicateVote: Vote = {
      voterId: 'disc-dup-01',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-2',
      timestamp: new Date('2026-10-15T14:00:00.000Z'),
    };

    const receipt = service.submitVote(firstVote);
    expect(receipt).toBeDefined();
    expect(service.hasVoted('eleicao-ce-01', 'disc-dup-01')).toBe(true);

    expect(() => service.submitVote(duplicateVote)).toThrow(DuplicateVoteError);
    expect(() => service.submitVote(duplicateVote)).toThrow(
      "Eleitor 'disc-dup-01' já votou na eleição 'eleicao-ce-01'"
    );
  });

  test('CE5 [Invalida]: Opcao de voto nao cadastrada na eleicao', () => {
    const voteWrongOption: Vote = {
      voterId: 'disc-244784',
      electionId: 'eleicao-ce-01',
      optionId: 'opcao-inexistente',
      timestamp: new Date('2026-10-15T12:00:00.000Z'),
    };

    expect(() => service.submitVote(voteWrongOption)).toThrow(InvalidVoteError);
    expect(() => service.submitVote(voteWrongOption)).toThrow(
      "Opção de voto 'opcao-inexistente' não cadastrada para esta eleição"
    );
    expect(service.hasVoted('eleicao-ce-01', 'disc-244784')).toBe(false);
  });

  test('CE6 [Invalida]: Identificador de eleicao inexistente no sistema', () => {
    const voteUnknownElection: Vote = {
      voterId: 'disc-244784',
      electionId: 'eleicao-inexistente-xyz',
      optionId: 'opcao-1',
      timestamp: new Date('2026-10-15T12:00:00.000Z'),
    };

    expect(() => service.submitVote(voteUnknownElection)).toThrow(InvalidVoteError);
    expect(() => service.submitVote(voteUnknownElection)).toThrow(
      "Eleição 'eleicao-inexistente-xyz' não encontrada no sistema"
    );
    expect(service.hasVoted('eleicao-inexistente-xyz', 'disc-244784')).toBe(false);
  });
});

describe('BallotService - Registro e Consulta de Eleições', () => {
  let service: BallotService;

  beforeEach(() => {
    service = new BallotService();
  });

  test('deve registrar e consultar uma eleição corretamente', () => {
    const config: ElectionLike = {
      startDate: new Date('2026-10-15T08:00:00.000Z'),
      endDate: new Date('2026-10-15T18:00:00.000Z'),
      options: [{ id: 'opt-1' }, { id: 'opt-2' }],
    };

    service.registerElection('elec-teste', config);
    expect(service.getElection('elec-teste')).toEqual(config);
    expect(service.getElection('nao-registrada')).toBeUndefined();
    expect(service.getElection('')).toBeUndefined();
  });

  test('deve falhar ao registrar eleição com identificador ou objeto inválido', () => {
    const config: ElectionLike = {
      startDate: new Date('2026-10-15T08:00:00.000Z'),
      endDate: new Date('2026-10-15T18:00:00.000Z'),
      options: [{ id: 'opt-1' }],
    };

    expect(() => service.registerElection('', config)).toThrow(
      'Identificador da eleição é obrigatório para registro'
    );
    // @ts-expect-error teste com parâmetro ausente
    expect(() => service.registerElection('elec-1', null)).toThrow(
      'Objeto da eleição é obrigatório para registro'
    );
  });

  test('reset deve limpar as eleições registradas', () => {
    const config: ElectionLike = {
      startDate: new Date('2026-10-15T08:00:00.000Z'),
      endDate: new Date('2026-10-15T18:00:00.000Z'),
      options: [{ id: 'opt-1' }],
    };

    service.registerElection('elec-reset', config);
    expect(service.getElection('elec-reset')).toBeDefined();

    service.reset();
    expect(service.getElection('elec-reset')).toBeUndefined();
  });

  test('classes de erro devem suportar mensagem padrao quando instanciadas sem parametros', () => {
    const notStarted = new ElectionNotStartedError();
    expect(notStarted.name).toBe('ElectionNotStartedError');
    expect(notStarted.message).toBe('A eleição ainda não foi iniciada');

    const ended = new ElectionEndedError();
    expect(ended.name).toBe('ElectionEndedError');
    expect(ended.message).toBe('A eleição já foi encerrada');
  });
});
