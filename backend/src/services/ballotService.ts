import { createHash } from 'crypto';

export interface Vote {
  voterId: string;
  electionId: string;
  optionId: string;
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

  constructor() {
    this.votedRecords = new Set<string>();
    this.observers = [];
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

  submitVote(vote: Vote): BallotReceipt {
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

    if (this.hasVoted(electionId, voterId)) {
      throw new DuplicateVoteError(`Eleitor '${voterId}' já votou na eleição '${electionId}'`);
    }

    const timestamp = new Date();
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
  }
}
