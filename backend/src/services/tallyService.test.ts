import { tallyVotes, TallyError } from './tallyService';
import type { Vote, TallyConfig } from './tallyService';

describe('Tally Service', () => {
  const simpleConfig: TallyConfig = {
    electionType: 'centro-academico',
    totalEligibleVoters: 10,
  };

  const quorumConfig: TallyConfig = {
    electionType: 'assembleia-condominio',
    totalEligibleVoters: 100,
    quorumFraction: 0.5,
  };

  describe('Simple tallying (unit weight)', () => {
    it('should tally simple votes correctly', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'slate-a' },
        { voterId: 'v2', optionId: 'slate-b' },
        { voterId: 'v3', optionId: 'slate-a' },
        { voterId: 'v4', optionId: 'slate-a' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.totalVotes).toBe(4);
      expect(result.totalWeightedVotes).toBe(4);
      expect(result.winners).toEqual(['slate-a']);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        optionId: 'slate-a',
        totalWeightedVotes: 3,
        percentage: 75,
      });
      expect(result.results[1]).toEqual({
        optionId: 'slate-b',
        totalWeightedVotes: 1,
        percentage: 25,
      });
    });

    it('should return empty winners when there are no votes', () => {
      const result = tallyVotes([], simpleConfig);

      expect(result.totalVotes).toBe(0);
      expect(result.totalWeightedVotes).toBe(0);
      expect(result.winners).toEqual([]);
      expect(result.results).toHaveLength(0);
    });

    it('should detect a tie and return multiple winners', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'slate-a' },
        { voterId: 'v2', optionId: 'slate-b' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.winners).toHaveLength(2);
      expect(result.winners).toContain('slate-a');
      expect(result.winners).toContain('slate-b');
    });
  });

  describe('Weighted tallying (condominium assembly)', () => {
    it('should apply fractional weights correctly', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'proposta-a', weight: 0.4 },
        { voterId: 'v2', optionId: 'proposta-b', weight: 0.4 },
        { voterId: 'v3', optionId: 'proposta-a', weight: 0.2 },
      ];

      const config: TallyConfig = {
        electionType: 'assembleia-condominio',
        totalEligibleVoters: 10,
      };

      const result = tallyVotes(votes, config);

      expect(result.totalVotes).toBe(3);
      expect(result.totalWeightedVotes).toBeCloseTo(1);
      expect(result.winners).toEqual(['proposta-a']);

      const propostaA = result.results.find((r) => r.optionId === 'proposta-a');
      const propostaB = result.results.find((r) => r.optionId === 'proposta-b');
      expect(propostaA?.totalWeightedVotes).toBeCloseTo(0.6);
      expect(propostaB?.totalWeightedVotes).toBeCloseTo(0.4);
    });

    it('should detect a tie even with fractional weights', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'proposta-a', weight: 0.1 },
        { voterId: 'v2', optionId: 'proposta-a', weight: 0.2 },
        { voterId: 'v3', optionId: 'proposta-b', weight: 0.3 },
      ];

      const config: TallyConfig = {
        electionType: 'assembleia-condominio',
        totalEligibleVoters: 10,
      };

      const result = tallyVotes(votes, config);

      // 0.1 + 0.2 pode não ser exatamente 0.3 em IEEE 754,
      // mas o epsilon garante que o empate é detectado.
      expect(result.winners).toHaveLength(2);
      expect(result.winners).toContain('proposta-a');
      expect(result.winners).toContain('proposta-b');
    });

    it('should default to weight 1 when weight is omitted', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-a', weight: 2 },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.totalWeightedVotes).toBe(3);
      const optA = result.results.find((r) => r.optionId === 'opt-a');
      expect(optA?.totalWeightedVotes).toBe(3);
    });
  });

  describe('Quorum and participation rate', () => {
    it('should report quorum reached when participation >= fraction', () => {
      const votes: Vote[] = Array.from({ length: 50 }, (_, i) => ({
        voterId: `v${i}`,
        optionId: i % 2 === 0 ? 'opt-a' : 'opt-b',
      }));

      const result = tallyVotes(votes, quorumConfig);

      expect(result.quorumReached).toBe(true);
      expect(result.participationRate).toBe(50);
    });

    it('should report quorum not reached when participation < fraction', () => {
      const votes: Vote[] = Array.from({ length: 49 }, (_, i) => ({
        voterId: `v${i}`,
        optionId: 'opt-a',
      }));

      const result = tallyVotes(votes, quorumConfig);

      expect(result.quorumReached).toBe(false);
      expect(result.participationRate).toBe(49);
    });

    it('should always reach quorum when quorumFraction is not set', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: 'opt-a' }];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.quorumReached).toBe(true);
    });

    it('should calculate participation rate as a percentage', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-b' },
        { voterId: 'v3', optionId: 'opt-a' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.participationRate).toBe(30);
    });
  });

  describe('Validation errors', () => {
    it('should throw on duplicate voter', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v1', optionId: 'opt-b' },
      ];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Voto duplicado detectado para o eleitor: v1'),
      );
    });

    it('should throw when totalEligibleVoters is zero', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: 0,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('O número de eleitores habilitados deve ser um inteiro positivo'),
      );
    });

    it('should throw when totalEligibleVoters is negative', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: -5,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('O número de eleitores habilitados deve ser um inteiro positivo'),
      );
    });

    it('should throw when totalEligibleVoters is NaN', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: NaN,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('O número de eleitores habilitados deve ser um inteiro positivo'),
      );
    });

    it('should throw when totalEligibleVoters is Infinity', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: Infinity,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('O número de eleitores habilitados deve ser um inteiro positivo'),
      );
    });

    it('should throw when totalEligibleVoters is fractional', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: 3.7,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('O número de eleitores habilitados deve ser um inteiro positivo'),
      );
    });

    it('should throw when quorumFraction is greater than 1', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: 10,
        quorumFraction: 1.5,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('A fração de quórum deve estar entre 0 e 1'),
      );
    });

    it('should throw when quorumFraction is negative', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: 10,
        quorumFraction: -0.1,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('A fração de quórum deve estar entre 0 e 1'),
      );
    });

    it('should throw when quorumFraction is NaN', () => {
      const config: TallyConfig = {
        electionType: 'centro-academico',
        totalEligibleVoters: 10,
        quorumFraction: NaN,
      };

      expect(() => tallyVotes([], config)).toThrow(
        new TallyError('A fração de quórum deve estar entre 0 e 1'),
      );
    });

    it('should throw when vote weight is zero', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: 'opt-a', weight: 0 }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Peso do voto deve ser um número finito maior que zero (eleitor: v1)'),
      );
    });

    it('should throw when vote weight is negative', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: 'opt-a', weight: -1 }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Peso do voto deve ser um número finito maior que zero (eleitor: v1)'),
      );
    });

    it('should throw when vote weight is NaN', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: 'opt-a', weight: NaN }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Peso do voto deve ser um número finito maior que zero (eleitor: v1)'),
      );
    });

    it('should throw when vote weight is Infinity', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: 'opt-a', weight: Infinity }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Peso do voto deve ser um número finito maior que zero (eleitor: v1)'),
      );
    });

    it('should throw when voterId is empty', () => {
      const votes: Vote[] = [{ voterId: '', optionId: 'opt-a' }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Cada voto deve ter voterId e optionId não vazios'),
      );
    });

    it('should throw when optionId is empty', () => {
      const votes: Vote[] = [{ voterId: 'v1', optionId: '' }];

      expect(() => tallyVotes(votes, simpleConfig)).toThrow(
        new TallyError('Cada voto deve ter voterId e optionId não vazios'),
      );
    });

    it('should throw when votes exceed eligible voters', () => {
      const tinyConfig: TallyConfig = { ...simpleConfig, totalEligibleVoters: 2 };
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-a' },
        { voterId: 'v3', optionId: 'opt-a' },
      ];

      expect(() => tallyVotes(votes, tinyConfig)).toThrow(
        new TallyError('O número de votos excede o número de eleitores habilitados'),
      );
    });
  });

  describe('Result ordering', () => {
    it('should sort results from most to least voted', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-c' },
        { voterId: 'v2', optionId: 'opt-a' },
        { voterId: 'v3', optionId: 'opt-a' },
        { voterId: 'v4', optionId: 'opt-b' },
        { voterId: 'v5', optionId: 'opt-a' },
        { voterId: 'v6', optionId: 'opt-b' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.results[0]?.optionId).toBe('opt-a');
      expect(result.results[0]?.totalWeightedVotes).toBe(3);
      expect(result.results[1]?.optionId).toBe('opt-b');
      expect(result.results[1]?.totalWeightedVotes).toBe(2);
      expect(result.results[2]?.optionId).toBe('opt-c');
      expect(result.results[2]?.totalWeightedVotes).toBe(1);
    });
  });

  describe('Percentage calculation', () => {
    it('should round percentages to 2 decimal places', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-b' },
        { voterId: 'v3', optionId: 'opt-c' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.results[0]?.percentage).toBe(33.33);
      expect(result.results[1]?.percentage).toBe(33.33);
      expect(result.results[2]?.percentage).toBe(33.33);
    });

    it('should report 100% for unanimous votes', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-a' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.percentage).toBe(100);
    });
  });

  describe('Result immutability', () => {
    it('should return frozen (immutable) results', () => {
      const votes: Vote[] = [
        { voterId: 'v1', optionId: 'opt-a' },
        { voterId: 'v2', optionId: 'opt-b' },
      ];

      const result = tallyVotes(votes, simpleConfig);

      expect(Object.isFrozen(result.results)).toBe(true);
      expect(Object.isFrozen(result.winners)).toBe(true);
    });
  });
});
