import { Request, Response } from 'express';
import {
  Election,
  ElectionConfig,
  ElectionValidationError,
  ElectionType,
  ElectionOption,
} from '../models/election';
import {
  BallotService,
  BallotReceipt,
  AuditLogObserver,
  DuplicateVoteError,
  InvalidVoteError,
} from '../services/ballotService';
import {
  tallyVotes,
  Vote as TallyVote,
  TallyConfig,
} from '../services/tallyService';
import { validateVoterEligibility } from '../services/voterValidation';

export interface StoredElection {
  readonly id: string;
  readonly model: Election;
  readonly config: ElectionConfig;
  readonly totalEligibleVoters: number;
  readonly quorumFraction?: number;
}

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return typeof val === 'string' ? val : '';
}

export class ElectionController {
  private readonly elections: Map<string, StoredElection>;
  private readonly votesByElection: Map<string, TallyVote[]>;
  private readonly receiptsByHash: Map<string, BallotReceipt>;
  private readonly ballotService: BallotService;
  private readonly auditLog: AuditLogObserver;

  constructor() {
    this.elections = new Map<string, StoredElection>();
    this.votesByElection = new Map<string, TallyVote[]>();
    this.receiptsByHash = new Map<string, BallotReceipt>();
    this.ballotService = new BallotService();
    this.auditLog = new AuditLogObserver();
    this.ballotService.addObserver(this.auditLog);
  }

  reset(): void {
    this.elections.clear();
    this.votesByElection.clear();
    this.receiptsByHash.clear();
    this.auditLog.logs.length = 0;
  }

  createElection = (req: Request, res: Response): void => {
    const { id, title, type, startDate, endDate, options, totalEligibleVoters, quorumFraction } = req.body;

    if (!id || typeof id !== 'string' || !id.trim()) {
      res.status(400).json({ error: 'O identificador da eleição (id) é obrigatório' });
      return;
    }

    const electionId = id.trim();
    if (this.elections.has(electionId)) {
      res.status(409).json({ error: `Já existe uma eleição cadastrada com o id '${electionId}'` });
      return;
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'O título da eleição é obrigatório' });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'As datas de início e término são obrigatórias' });
      return;
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      res.status(400).json({ error: 'Formato de data inválido' });
      return;
    }

    if (!Array.isArray(options) || options.length < 2) {
      res.status(400).json({ error: 'A eleição deve ter pelo menos duas opções cadastradas' });
      return;
    }

    const parsedOptions: ElectionOption[] = [];
    for (const opt of options) {
      if (!opt || typeof opt.id !== 'string' || typeof opt.title !== 'string') {
        res.status(400).json({ error: 'Cada opção deve possuir id e title como strings' });
        return;
      }
      parsedOptions.push({ id: opt.id.trim(), title: opt.title.trim() });
    }

    const config: ElectionConfig = {
      title: title.trim(),
      type: type as ElectionType,
      startDate: parsedStart,
      endDate: parsedEnd,
      options: parsedOptions,
    };

    try {
      const model = new Election(config);
      const eligibleCount = typeof totalEligibleVoters === 'number' && totalEligibleVoters > 0
        ? totalEligibleVoters
        : 100;

      const stored: StoredElection = {
        id: electionId,
        model,
        config,
        totalEligibleVoters: eligibleCount,
        ...(typeof quorumFraction === 'number' ? { quorumFraction } : {}),
      };

      this.elections.set(electionId, stored);
      this.votesByElection.set(electionId, []);

      res.status(201).json({
        id: electionId,
        title: model.title,
        type: model.type,
        startDate: model.startDate.toISOString(),
        endDate: model.endDate.toISOString(),
        options: model.options,
        status: model.statusAt(new Date()),
      });
    } catch (err: unknown) {
      const message = err instanceof ElectionValidationError ? err.message : 'Erro ao validar configuração da eleição';
      res.status(400).json({ error: message });
    }
  };

  getElection = (req: Request, res: Response): void => {
    const electionId = getParam(req, 'id');
    const stored = this.elections.get(electionId);

    if (!stored) {
      res.status(404).json({ error: `Eleição '${electionId}' não encontrada` });
      return;
    }

    res.status(200).json({
      id: stored.id,
      title: stored.model.title,
      type: stored.model.type,
      startDate: stored.model.startDate.toISOString(),
      endDate: stored.model.endDate.toISOString(),
      options: stored.model.options,
      status: stored.model.statusAt(new Date()),
    });
  };

  submitVote = (req: Request, res: Response): void => {
    const electionId = getParam(req, 'id');
    const stored = this.elections.get(electionId);

    if (!stored) {
      res.status(404).json({ error: `Eleição '${electionId}' não encontrada` });
      return;
    }

    const { voterId, credentials, voterStatus, optionId, weight, simulatedTime } = req.body;

    if (!voterId || typeof voterId !== 'string' || !voterId.trim()) {
      res.status(400).json({ error: 'Identificador do eleitor (voterId) é obrigatório' });
      return;
    }

    if (!optionId || typeof optionId !== 'string' || !optionId.trim()) {
      res.status(400).json({ error: 'Identificador da opção de voto (optionId) é obrigatório' });
      return;
    }

    const voteTime = simulatedTime ? new Date(simulatedTime) : new Date();
    if (isNaN(voteTime.getTime())) {
      res.status(400).json({ error: 'Timestamp de simulação inválido' });
      return;
    }

    const electionStatus = stored.model.statusAt(voteTime);
    if (electionStatus === 'scheduled') {
      res.status(400).json({ error: 'A eleição ainda não foi iniciada' });
      return;
    }
    if (electionStatus === 'closed') {
      res.status(400).json({ error: 'A eleição já foi encerrada' });
      return;
    }

    const optionExists = stored.model.options.some((opt) => opt.id === optionId.trim());
    if (!optionExists) {
      res.status(400).json({ error: `Opção de voto '${optionId}' não cadastrada para esta eleição` });
      return;
    }

    const eligibility = validateVoterEligibility(
      {
        id: voterId.trim(),
        credentials: typeof credentials === 'string' ? credentials : '',
        status: voterStatus,
      },
      { type: stored.model.type }
    );

    if (!eligibility.eligible) {
      res.status(403).json({ error: eligibility.reason || 'Eleitor não elegível para votar nesta eleição' });
      return;
    }

    try {
      const receipt = this.ballotService.submitVote({
        electionId,
        voterId: voterId.trim(),
        optionId: optionId.trim(),
      });

      this.receiptsByHash.set(receipt.receiptHash, receipt);

      const parsedWeight = typeof weight === 'number' && weight > 0 ? weight : 1;
      const votes = this.votesByElection.get(electionId) ?? [];
      votes.push({
        voterId: voterId.trim(),
        optionId: optionId.trim(),
        weight: parsedWeight,
      });
      this.votesByElection.set(electionId, votes);

      res.status(201).json({
        receiptHash: receipt.receiptHash,
        timestamp: receipt.timestamp.toISOString(),
        electionId: receipt.electionId,
        voterId: receipt.voterId,
      });
    } catch (err: unknown) {
      if (err instanceof DuplicateVoteError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof InvalidVoteError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno ao processar voto' });
    }
  };

  getTally = (req: Request, res: Response): void => {
    const electionId = getParam(req, 'id');
    const stored = this.elections.get(electionId);

    if (!stored) {
      res.status(404).json({ error: `Eleição '${electionId}' não encontrada` });
      return;
    }

    const force = req.query.force === 'true';
    const currentStatus = stored.model.statusAt(new Date());

    if (currentStatus !== 'closed' && !force) {
      res.status(400).json({
        error: 'A apuração oficial só está disponível após o encerramento da eleição. Use force=true para apuração parcial.',
      });
      return;
    }

    const votes = this.votesByElection.get(electionId) ?? [];
    const tallyConfig: TallyConfig = {
      electionType: stored.model.type,
      totalEligibleVoters: stored.totalEligibleVoters,
      ...(typeof stored.quorumFraction === 'number' ? { quorumFraction: stored.quorumFraction } : {}),
    };

    try {
      const tally = tallyVotes(votes, tallyConfig);
      res.status(200).json({
        electionId: stored.id,
        title: stored.model.title,
        status: currentStatus,
        tally,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro na apuração';
      res.status(400).json({ error: message });
    }
  };

  getReceipt = (req: Request, res: Response): void => {
    const id = getParam(req, 'id');
    const hash = getParam(req, 'hash');
    const stored = this.elections.get(id);

    if (!stored) {
      res.status(404).json({ error: `Eleição '${id}' não encontrada` });
      return;
    }

    const receipt = this.receiptsByHash.get(hash);
    if (!receipt || receipt.electionId !== id) {
      res.status(404).json({ error: `Recibo '${hash}' não encontrado para a eleição '${id}'` });
      return;
    }

    res.status(200).json({
      receiptHash: receipt.receiptHash,
      electionId: receipt.electionId,
      voterId: receipt.voterId,
      timestamp: receipt.timestamp.toISOString(),
      verified: true,
    });
  };
}
