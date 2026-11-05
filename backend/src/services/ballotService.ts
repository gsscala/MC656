import { createHash } from 'crypto';
import type { Election } from '../models/election';

export interface Vote {
  voterId: string;
  electionId: string;
  optionId: string;
  timestamp?: Date;
}

export interface BallotReceipt {
  receiptHash: string;
  timestamp: Date;
  electionId: string;
  voterId: string;
}

export class DuplicateVoteError extends Error {
  constructor(message = 'Eleitor já votou nesta eleição') {
    super(message);
    this.name = 'DuplicateVoteError';
  }
}

export class InvalidVoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVoteError';
  }
}

export class ElectionNotStartedError extends Error {
  constructor(message = 'A eleição ainda não foi iniciada') {
    super(message);
    this.name = 'ElectionNotStartedError';
  }
}

export class ElectionEndedError extends Error {
  constructor(message = 'A eleição já foi encerrada') {
    super(message);
    this.name = 'ElectionEndedError';
  }
}

export interface ElectionOptionLike {
  readonly id: string;
  readonly title?: string;
}

export interface ElectionLike {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly options: readonly ElectionOptionLike[];
}

export interface BallotValidationContext {
  election?: Election | ElectionLike;
  currentTime?: Date;
}

export interface BallotObserver {
  onVoteSubmitted(receipt: BallotReceipt): void;
}

export class AuditLogObserver implements BallotObserver {
  readonly logs: BallotReceipt[] = [];

  onVoteSubmitted(receipt: BallotReceipt): void {
    this.logs.push(receipt);
  }
}

export class TurnoutCounterObserver implements BallotObserver {
  private readonly counts = new Map<string, number>();

  onVoteSubmitted(receipt: BallotReceipt): void {
    const current = this.counts.get(receipt.electionId) ?? 0;
    this.counts.set(receipt.electionId, current + 1);
  }

  getCount(electionId: string): number {
    return this.counts.get(electionId) ?? 0;
  }
}

export class BallotService {
  private readonly votedRecords: Set<string>;
  private readonly observers: BallotObserver[];
  private readonly registeredElections: Map<string, Election | ElectionLike>;

  constructor() {
    this.votedRecords = new Set<string>();
    this.observers = [];
    this.registeredElections = new Map<string, Election | ElectionLike>();
  }

  registerElection(electionId: string, election: Election | ElectionLike): void {
    if (!electionId || !electionId.trim()) {
      throw new Error('Identificador da eleição é obrigatório para registro');
    }
    if (!election) {
      throw new Error('Objeto da eleição é obrigatório para registro');
    }
    this.registeredElections.set(electionId.trim(), election);
  }

  getElection(electionId: string): Election | ElectionLike | undefined {
    if (!electionId) {
      return undefined;
    }
    return this.registeredElections.get(electionId.trim());
  }

  addObserver(observer: BallotObserver): void {
    if (!observer) {
      throw new Error('Observador invalido');
    }
    this.observers.push(observer);
  }

  removeObserver(observer: BallotObserver): void {
    const index = this.observers.indexOf(observer);
    if (index >= 0) {
      this.observers.splice(index, 1);
    }
  }

  clearObservers(): void {
    this.observers.length = 0;
  }

  private notifyObservers(receipt: BallotReceipt): void {
    for (const observer of this.observers) {
      observer.onVoteSubmitted(receipt);
    }
  }

  private getRecordKey(electionId: string, voterId: string): string {
    return `${electionId}:${voterId}`;
  }

  hasVoted(electionId: string, voterId: string): boolean {
    if (!electionId || !voterId) {
      return false;
    }
    return this.votedRecords.has(this.getRecordKey(electionId.trim(), voterId.trim()));
  }

  submitVote(vote: Vote, context?: BallotValidationContext): BallotReceipt {
    if (!vote) {
      throw new InvalidVoteError('Dados do voto não foram informados');
    }

    const voterId = vote.voterId ? vote.voterId.trim() : '';
    const electionId = vote.electionId ? vote.electionId.trim() : '';
    const optionId = vote.optionId ? vote.optionId.trim() : '';

    if (!voterId) {
      throw new InvalidVoteError('Identificador do eleitor (voterId) é obrigatório');
    }
    if (!electionId) {
      throw new InvalidVoteError('Identificador da eleição (electionId) é obrigatório');
    }
    if (!optionId) {
      throw new InvalidVoteError('Identificador da opção de voto (optionId) é obrigatório');
    }

    const election = context?.election ?? this.registeredElections.get(electionId);
    if (!election && this.registeredElections.size > 0 && !context?.election) {
      throw new InvalidVoteError(`Eleição '${electionId}' não encontrada no sistema`);
    }

    const voteTime = vote.timestamp ?? context?.currentTime ?? new Date();

    if (election) {
      const optionExists = election.options.some((opt) => opt.id === optionId);
      if (!optionExists) {
        throw new InvalidVoteError(`Opção de voto '${optionId}' não cadastrada para esta eleição`);
      }

      const voteTimestamp = voteTime.getTime();
      if (voteTimestamp < election.startDate.getTime()) {
        throw new ElectionNotStartedError('A eleição ainda não foi iniciada');
      }
      if (voteTimestamp > election.endDate.getTime()) {
        throw new ElectionEndedError('A eleição já foi encerrada');
      }
    }

    if (this.hasVoted(electionId, voterId)) {
      throw new DuplicateVoteError(`Eleitor '${voterId}' já votou na eleição '${electionId}'`);
    }

    const timestamp = voteTime;
    const hashPayload = `${electionId}:${voterId}:${optionId}:${timestamp.getTime()}`;
    const receiptHash = createHash('sha256').update(hashPayload).digest('hex');

    this.votedRecords.add(this.getRecordKey(electionId, voterId));

    const receipt: BallotReceipt = {
      receiptHash,
      timestamp,
      electionId,
      voterId,
    };

    this.notifyObservers(receipt);

    return receipt;
  }

  reset(): void {
    this.votedRecords.clear();
    this.registeredElections.clear();
  }
}
