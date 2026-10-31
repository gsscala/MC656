import { tallyVotes, type Vote, type TallyConfig } from './tallyService';

describe('Escopo 3 - TallyService.tallyVotes (Classes de Equivalencia)', () => {
  const defaultConfig: TallyConfig = {
    electionType: 'centro-academico',
    totalEligibleVoters: 20,
    quorumFraction: 0.2,
  };

  test('CE1 [Valida]: Vencedor unico estrito por maior pontuacao ponderada', () => {
    const votes: Vote[] = [
      { voterId: 'doc-1', optionId: 'chapa-a', weight: 3 },
      { voterId: 'doc-2', optionId: 'chapa-a', weight: 3 },
      { voterId: 'disc-1', optionId: 'chapa-b', weight: 1 },
      { voterId: 'func-1', optionId: 'chapa-b', weight: 2 },
    ];

    const result = tallyVotes(votes, defaultConfig);

    expect(result.totalVotes).toBe(4);
    expect(result.totalWeightedVotes).toBe(9);
    expect(result.winners).toEqual(['chapa-a']);
    expect(result.results).toEqual([
      { optionId: 'chapa-a', totalWeightedVotes: 6, percentage: 66.67 },
      { optionId: 'chapa-b', totalWeightedVotes: 3, percentage: 33.33 },
    ]);
  });

  test('CE2 [Valida]: Empate no topo entre multiplas opcoes com totais identicos', () => {
    const votes: Vote[] = [
      { voterId: 'doc-1', optionId: 'chapa-a', weight: 3 },
      { voterId: 'disc-1', optionId: 'chapa-a', weight: 1 },
      { voterId: 'func-1', optionId: 'chapa-b', weight: 2 },
      { voterId: 'func-2', optionId: 'chapa-b', weight: 2 },
      { voterId: 'disc-2', optionId: 'chapa-c', weight: 1 },
    ];

    const result = tallyVotes(votes, defaultConfig);

    expect(result.totalVotes).toBe(5);
    expect(result.totalWeightedVotes).toBe(9);
    expect(result.winners).toHaveLength(2);
    expect(result.winners).toEqual(expect.arrayContaining(['chapa-a', 'chapa-b']));
    expect(result.winners).not.toContain('chapa-c');
  });

  test('CE3 [Valida]: Urna vazia em eleicao sem cedulas retorna resultado zerado e sem vencedores', () => {
    const votes: Vote[] = [];

    const result = tallyVotes(votes, defaultConfig);

    expect(result.totalVotes).toBe(0);
    expect(result.totalWeightedVotes).toBe(0);
    expect(result.winners).toEqual([]);
    expect(result.results).toEqual([]);
    expect(result.participationRate).toBe(0);
    expect(result.quorumReached).toBe(false);
  });

  test('CE4 [Valida]: Pesos heterogeneos entre categorias (docente 3, funcionario 2, estudante 1) invertendo o resultado nominal', () => {
    // Nominalmente: chapa-estudantil recebe 4 cedulas e chapa-integrada recebe apenas 2 cedulas.
    // Ponderado: chapa-integrada soma 5 pontos (3 + 2) contra 4 pontos (1 + 1 + 1 + 1) da chapa-estudantil.
    const votes: Vote[] = [
      { voterId: 'disc-1', optionId: 'chapa-estudantil', weight: 1 },
      { voterId: 'disc-2', optionId: 'chapa-estudantil', weight: 1 },
      { voterId: 'disc-3', optionId: 'chapa-estudantil', weight: 1 },
      { voterId: 'disc-4', optionId: 'chapa-estudantil', weight: 1 },
      { voterId: 'doc-1', optionId: 'chapa-integrada', weight: 3 },
      { voterId: 'func-1', optionId: 'chapa-integrada', weight: 2 },
    ];

    const result = tallyVotes(votes, defaultConfig);

    expect(result.totalVotes).toBe(6);
    expect(result.totalWeightedVotes).toBe(9);
    expect(result.winners).toEqual(['chapa-integrada']);
    expect(result.results[0]).toEqual({
      optionId: 'chapa-integrada',
      totalWeightedVotes: 5,
      percentage: 55.56,
    });
    expect(result.results[1]).toEqual({
      optionId: 'chapa-estudantil',
      totalWeightedVotes: 4,
      percentage: 44.44,
    });
  });

  test('CE5 [Valida]: Unanimidade com 100% dos votos direcionados a uma unica opcao', () => {
    const votes: Vote[] = [
      { voterId: 'doc-1', optionId: 'chapa-unica', weight: 3 },
      { voterId: 'func-1', optionId: 'chapa-unica', weight: 2 },
      { voterId: 'disc-1', optionId: 'chapa-unica', weight: 1 },
      { voterId: 'disc-2', optionId: 'chapa-unica', weight: 1 },
    ];

    const result = tallyVotes(votes, defaultConfig);

    expect(result.totalVotes).toBe(4);
    expect(result.totalWeightedVotes).toBe(7);
    expect(result.winners).toEqual(['chapa-unica']);
    expect(result.results).toEqual([
      {
        optionId: 'chapa-unica',
        totalWeightedVotes: 7,
        percentage: 100,
      },
    ]);
  });
});
