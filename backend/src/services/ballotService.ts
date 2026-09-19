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

export class BallotService {
  private readonly votedRecords: Set<string>;

  constructor() {
    this.votedRecords = new Set<string>();
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

    return {
      receiptHash,
      timestamp,
      electionId,
      voterId,
    };
  }

  reset(): void {
    this.votedRecords.clear();
  }
}
