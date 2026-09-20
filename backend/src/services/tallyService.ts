import type { ElectionType } from '../models/election';

/** Um voto individual submetido por um eleitor. */
export interface Vote {
  readonly voterId: string;
  readonly optionId: string;
  /** Peso do voto. Se omitido, assume‑se 1. */
  readonly weight?: number;
}

/** Configuração da apuração de uma eleição. */
export interface TallyConfig {
  /**
   * Tipo da eleição. Atualmente não influencia a lógica de apuração,
   * mas é mantido para extensão futura (ex: regras de desempate por tipo).
   */
  readonly electionType: ElectionType;
  /** Total de eleitores habilitados (universo). Usado para calcular o quórum. */
  readonly totalEligibleVoters: number;
  /**
   * Fração mínima de participação para a eleição ser válida (0–1).
   * Ex.: 0.5 → pelo menos metade dos eleitores precisa votar.
   * Se omitido, não há verificação de quórum.
   */
  readonly quorumFraction?: number;
}

/** Resultado individual de cada opção. */
export interface OptionResult {
  readonly optionId: string;
  readonly totalWeightedVotes: number;
  readonly percentage: number;
}

/** Resultado completo da apuração. */
export interface TallyResult {
  readonly totalVotes: number;
  readonly totalWeightedVotes: number;
  readonly results: readonly OptionResult[];
  readonly winners: readonly string[];
  readonly quorumReached: boolean;
  readonly participationRate: number;
}

export class TallyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TallyError';
  }
}

const EPSILON = 1e-9;

/**
 * Apura os votos de uma eleição, aplicando pesos quando necessário,
 * calculando a participação e verificando o quórum.
 */
export function tallyVotes(votes: readonly Vote[], config: TallyConfig): TallyResult {
  if (!Number.isFinite(config.totalEligibleVoters) || config.totalEligibleVoters <= 0 || !Number.isInteger(config.totalEligibleVoters)) {
    throw new TallyError('O número de eleitores habilitados deve ser um inteiro positivo');
  }

  if (config.quorumFraction !== undefined &&
    (!Number.isFinite(config.quorumFraction) || config.quorumFraction < 0 || config.quorumFraction > 1)) {
    throw new TallyError('A fração de quórum deve estar entre 0 e 1');
  }

  const seenVoters = new Set<string>();
  const weightedByOption = new Map<string, number>();
  let totalWeightedVotes = 0;

  if (votes.length > config.totalEligibleVoters) {
    throw new TallyError('O número de votos excede o número de eleitores habilitados');
  }

  for (const vote of votes) {
    if (!vote.voterId || !vote.optionId) {
      throw new TallyError('Cada voto deve ter voterId e optionId não vazios');
    }

    if (seenVoters.has(vote.voterId)) {
      throw new TallyError(`Voto duplicado detectado para o eleitor: ${vote.voterId}`);
    }
    seenVoters.add(vote.voterId);

    const weight = vote.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new TallyError(`Peso do voto deve ser um número finito maior que zero (eleitor: ${vote.voterId})`);
    }

    const current = weightedByOption.get(vote.optionId) ?? 0;
    weightedByOption.set(vote.optionId, current + weight);
    totalWeightedVotes += weight;
  }

  // Montar resultados por opção, ordenados do mais votado ao menos votado
  const results: OptionResult[] = Array.from(weightedByOption.entries())
    .map(([optionId, totalWV]) => ({
      optionId,
      totalWeightedVotes: totalWV,
      percentage: totalWeightedVotes > 0
        ? Math.round((totalWV / totalWeightedVotes) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes);

  // Determinar vencedores (pode haver empate — comparação com tolerância para floats)
  const maxVotes = results.length > 0 ? results[0]!.totalWeightedVotes : 0;
  const winners = results
    .filter((r) => Math.abs(r.totalWeightedVotes - maxVotes) < EPSILON && maxVotes > 0)
    .map((r) => r.optionId);

  // Calcular taxa de participação e quórum
  const participationRate =
    Math.round((votes.length / config.totalEligibleVoters) * 10000) / 100;

  const quorumFraction = config.quorumFraction ?? 0;
  const quorumReached = votes.length / config.totalEligibleVoters >= quorumFraction;

  return {
    totalVotes: votes.length,
    totalWeightedVotes,
    results: Object.freeze(results.map((r) => Object.freeze(r))),
    winners: Object.freeze(winners),
    quorumReached,
    participationRate,
  };
}
