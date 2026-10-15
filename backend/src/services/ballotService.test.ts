import {
  BallotService,
  DuplicateVoteError,
  InvalidVoteError,
  Vote,
  BallotObserver,
  AuditLogObserver,
  TurnoutCounterObserver,
} from './ballotService';

describe('BallotService', () => {
  let service: BallotService;

  beforeEach(() => {
    service = new BallotService();
  });

  describe('submitVote', () => {
    const validVote: Vote = {
      voterId: 'voter-123',
      electionId: 'election-456',
      optionId: 'option-789',
    };

    it('should successfully submit a vote and return receipt hash and timestamp', () => {
      const receipt = service.submitVote(validVote);

      expect(receipt).toBeDefined();
      expect(receipt.electionId).toBe(validVote.electionId);
      expect(receipt.voterId).toBe(validVote.voterId);
      expect(receipt.timestamp).toBeInstanceOf(Date);
      expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
      expect(service.hasVoted(validVote.electionId, validVote.voterId)).toBe(true);
    });

    it('should prevent duplicate votes from the same voter in the same election', () => {
      service.submitVote(validVote);

      expect(() => service.submitVote(validVote)).toThrow(DuplicateVoteError);
      expect(() => service.submitVote(validVote)).toThrow(
        "Eleitor 'voter-123' já votou na eleição 'election-456'"
      );
    });

    it('should allow the same voter to vote in different elections', () => {
      const voteElectionA: Vote = {
        voterId: 'voter-123',
        electionId: 'election-A',
        optionId: 'option-1',
      };
      const voteElectionB: Vote = {
        voterId: 'voter-123',
        electionId: 'election-B',
        optionId: 'option-2',
      };

      const receiptA = service.submitVote(voteElectionA);
      const receiptB = service.submitVote(voteElectionB);

      expect(receiptA.electionId).toBe('election-A');
      expect(receiptB.electionId).toBe('election-B');
      expect(service.hasVoted('election-A', 'voter-123')).toBe(true);
      expect(service.hasVoted('election-B', 'voter-123')).toBe(true);
    });

    it('should allow different voters to vote in the same election', () => {
      const voteVoter1: Vote = {
        voterId: 'voter-1',
        electionId: 'election-shared',
        optionId: 'option-1',
      };
      const voteVoter2: Vote = {
        voterId: 'voter-2',
        electionId: 'election-shared',
        optionId: 'option-2',
      };

      const receipt1 = service.submitVote(voteVoter1);
      const receipt2 = service.submitVote(voteVoter2);

      expect(receipt1.voterId).toBe('voter-1');
      expect(receipt2.voterId).toBe('voter-2');
    });

    it('should generate different receipt hashes for distinct votes', () => {
      const vote1: Vote = {
        voterId: 'voter-1',
        electionId: 'election-1',
        optionId: 'option-1',
      };
      const vote2: Vote = {
        voterId: 'voter-2',
        electionId: 'election-1',
        optionId: 'option-2',
      };

      const receipt1 = service.submitVote(vote1);
      const receipt2 = service.submitVote(vote2);

      expect(receipt1.receiptHash).not.toBe(receipt2.receiptHash);
    });

    it('should throw InvalidVoteError if vote object is not provided', () => {
      // @ts-expect-error: testing missing vote parameter
      expect(() => service.submitVote(null)).toThrow(InvalidVoteError);
      // @ts-expect-error: testing missing vote parameter
      expect(() => service.submitVote(null)).toThrow('Dados do voto não foram informados');
    });

    it('should throw InvalidVoteError if voterId is missing or empty', () => {
      const voteWithoutVoter = { electionId: 'e-1', optionId: 'o-1' } as Vote;
      const voteWithBlankVoter: Vote = { voterId: '   ', electionId: 'e-1', optionId: 'o-1' };

      expect(() => service.submitVote(voteWithoutVoter)).toThrow(InvalidVoteError);
      expect(() => service.submitVote(voteWithoutVoter)).toThrow(
        'Identificador do eleitor (voterId) é obrigatório'
      );
      expect(() => service.submitVote(voteWithBlankVoter)).toThrow(InvalidVoteError);
    });

    it('should throw InvalidVoteError if electionId is missing or empty', () => {
      const voteWithoutElection = { voterId: 'v-1', optionId: 'o-1' } as Vote;
      const voteWithBlankElection: Vote = { voterId: 'v-1', electionId: '   ', optionId: 'o-1' };

      expect(() => service.submitVote(voteWithoutElection)).toThrow(InvalidVoteError);
      expect(() => service.submitVote(voteWithoutElection)).toThrow(
        'Identificador da eleição (electionId) é obrigatório'
      );
      expect(() => service.submitVote(voteWithBlankElection)).toThrow(InvalidVoteError);
    });

    it('should throw InvalidVoteError if optionId is missing or empty', () => {
      const voteWithoutOption = { voterId: 'v-1', electionId: 'e-1' } as Vote;
      const voteWithBlankOption: Vote = { voterId: 'v-1', electionId: 'e-1', optionId: '   ' };

      expect(() => service.submitVote(voteWithoutOption)).toThrow(InvalidVoteError);
      expect(() => service.submitVote(voteWithoutOption)).toThrow(
        'Identificador da opção de voto (optionId) é obrigatório'
      );
      expect(() => service.submitVote(voteWithBlankOption)).toThrow(InvalidVoteError);
    });
  });

  describe('hasVoted', () => {
    it('should return false if voter has not voted in the given election', () => {
      expect(service.hasVoted('election-1', 'voter-1')).toBe(false);
    });

    it('should return false if electionId or voterId is falsy', () => {
      expect(service.hasVoted('', 'voter-1')).toBe(false);
      expect(service.hasVoted('election-1', '')).toBe(false);
      expect(service.hasVoted('', '')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear vote records and allow voting again', () => {
      const vote: Vote = {
        voterId: 'voter-1',
        electionId: 'election-1',
        optionId: 'option-1',
      };

      service.submitVote(vote);
      expect(service.hasVoted('election-1', 'voter-1')).toBe(true);

      service.reset();
      expect(service.hasVoted('election-1', 'voter-1')).toBe(false);

      expect(() => service.submitVote(vote)).not.toThrow();
    });
  });

  describe('Observer Pattern', () => {
    it('should notify an attached observer when a vote is submitted', () => {
      const mockObserver: BallotObserver = {
        onVoteSubmitted: jest.fn(),
      };

      service.addObserver(mockObserver);

      const vote: Vote = {
        voterId: 'voter-obs-1',
        electionId: 'election-obs-1',
        optionId: 'option-obs-1',
      };

      const receipt = service.submitVote(vote);

      expect(mockObserver.onVoteSubmitted).toHaveBeenCalledTimes(1);
      expect(mockObserver.onVoteSubmitted).toHaveBeenCalledWith(receipt);
    });

    it('should notify multiple observers when a vote is submitted', () => {
      const observerA: BallotObserver = { onVoteSubmitted: jest.fn() };
      const observerB: BallotObserver = { onVoteSubmitted: jest.fn() };

      service.addObserver(observerA);
      service.addObserver(observerB);

      const vote: Vote = {
        voterId: 'voter-multi',
        electionId: 'election-multi',
        optionId: 'option-1',
      };

      const receipt = service.submitVote(vote);

      expect(observerA.onVoteSubmitted).toHaveBeenCalledWith(receipt);
      expect(observerB.onVoteSubmitted).toHaveBeenCalledWith(receipt);
    });

    it('should allow removing an observer so it receives no further notifications', () => {
      const observer: BallotObserver = { onVoteSubmitted: jest.fn() };

      service.addObserver(observer);
      service.removeObserver(observer);

      service.submitVote({
        voterId: 'voter-rem',
        electionId: 'election-rem',
        optionId: 'option-1',
      });

      expect(observer.onVoteSubmitted).not.toHaveBeenCalled();
    });

    it('should ignore removal of an observer that is not registered', () => {
      const registered: BallotObserver = { onVoteSubmitted: jest.fn() };
      const unregistered: BallotObserver = { onVoteSubmitted: jest.fn() };

      service.addObserver(registered);
      expect(() => service.removeObserver(unregistered)).not.toThrow();

      service.submitVote({
        voterId: 'voter-unreg',
        electionId: 'election-unreg',
        optionId: 'option-1',
      });

      expect(registered.onVoteSubmitted).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when adding a falsy observer', () => {
      // @ts-expect-error testing invalid argument
      expect(() => service.addObserver(null)).toThrow('Observador invalido');
    });

    it('should clear all observers when clearObservers is called', () => {
      const observer: BallotObserver = { onVoteSubmitted: jest.fn() };

      service.addObserver(observer);
      service.clearObservers();

      service.submitVote({
        voterId: 'voter-clear',
        electionId: 'election-clear',
        optionId: 'option-1',
      });

      expect(observer.onVoteSubmitted).not.toHaveBeenCalled();
    });

    it('should correctly accumulate audit receipts with AuditLogObserver', () => {
      const auditLog = new AuditLogObserver();
      service.addObserver(auditLog);

      const vote1: Vote = { voterId: 'v-1', electionId: 'elec-audit', optionId: 'opt-1' };
      const vote2: Vote = { voterId: 'v-2', electionId: 'elec-audit', optionId: 'opt-2' };

      const r1 = service.submitVote(vote1);
      const r2 = service.submitVote(vote2);

      expect(auditLog.logs).toHaveLength(2);
      expect(auditLog.logs[0]).toEqual(r1);
      expect(auditLog.logs[1]).toEqual(r2);
    });

    it('should correctly track voter turnout counts with TurnoutCounterObserver', () => {
      const turnout = new TurnoutCounterObserver();
      service.addObserver(turnout);

      service.submitVote({ voterId: 'v-1', electionId: 'elec-turnout-A', optionId: 'opt-1' });
      service.submitVote({ voterId: 'v-2', electionId: 'elec-turnout-A', optionId: 'opt-2' });
      service.submitVote({ voterId: 'v-3', electionId: 'elec-turnout-B', optionId: 'opt-1' });

      expect(turnout.getCount('elec-turnout-A')).toBe(2);
      expect(turnout.getCount('elec-turnout-B')).toBe(1);
      expect(turnout.getCount('elec-turnout-C')).toBe(0);
    });
  });

  describe('Error classes', () => {
    it('should use default message when DuplicateVoteError is instantiated without arguments', () => {
      const error = new DuplicateVoteError();
      expect(error.message).toBe('Eleitor já votou nesta eleição');
      expect(error.name).toBe('DuplicateVoteError');
    });
  });
});
