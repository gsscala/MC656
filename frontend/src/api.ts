export type ElectionType =
  | 'centro-academico'
  | 'assembleia-condominio'
  | 'orcamento-municipal';

export type ElectionStatus = 'scheduled' | 'open' | 'closed';

export interface ElectionOption {
  id: string;
  title: string;
}

export interface ElectionSummary {
  id: string;
  title: string;
  type: ElectionType;
  startDate: string;
  endDate: string;
  options: ElectionOption[];
  status: ElectionStatus;
  totalEligibleVoters: number;
  quorumFraction?: number;
  turnoutCount: number;
}

export interface CreateElectionPayload {
  id: string;
  title: string;
  type: ElectionType;
  startDate: string;
  endDate: string;
  options: ElectionOption[];
  totalEligibleVoters?: number;
  quorumFraction?: number;
}

export interface SubmitVotePayload {
  voterId: string;
  credentials: string;
  voterStatus: string;
  optionId: string;
  weight: number;
}

export interface VoteReceiptResponse {
  receiptHash: string;
  timestamp: string;
  electionId: string;
  voterId: string;
}

export interface OptionResult {
  optionId: string;
  totalWeightedVotes: number;
  percentage: number;
}

export interface TallyResult {
  totalVotes: number;
  totalWeightedVotes: number;
  results: OptionResult[];
  winners: string[];
  quorumReached: boolean;
  participationRate: number;
}

export interface TallyResponse {
  electionId: string;
  title: string;
  status: ElectionStatus;
  tally: TallyResult;
}

export interface AuditLogEntry {
  receiptHash: string;
  electionId: string;
  voterId: string;
  timestamp: string;
}

export interface AuditResponse {
  electionId: string;
  turnoutCount: number;
  totalEligibleVoters: number;
  auditLogs: AuditLogEntry[];
}

export interface VerifyReceiptResponse {
  receiptHash: string;
  electionId: string;
  voterId: string;
  timestamp: string;
  verified: boolean;
}

const API_BASE = '/api';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }

  return payload as T;
}

export function fetchElections(): Promise<ElectionSummary[]> {
  return requestJson<ElectionSummary[]>('/elections');
}

export function createElection(payload: CreateElectionPayload): Promise<ElectionSummary> {
  return requestJson<ElectionSummary>('/elections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function submitVote(
  electionId: string,
  payload: SubmitVotePayload,
): Promise<VoteReceiptResponse> {
  return requestJson<VoteReceiptResponse>(`/elections/${encodeURIComponent(electionId)}/votes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchTally(electionId: string, force: boolean): Promise<TallyResponse> {
  const suffix = force ? '?force=true' : '';
  return requestJson<TallyResponse>(`/elections/${encodeURIComponent(electionId)}/tally${suffix}`);
}

export function fetchAudit(electionId: string): Promise<AuditResponse> {
  return requestJson<AuditResponse>(`/elections/${encodeURIComponent(electionId)}/audit`);
}

export function verifyReceipt(electionId: string, hash: string): Promise<VerifyReceiptResponse> {
  return requestJson<VerifyReceiptResponse>(
    `/elections/${encodeURIComponent(electionId)}/receipts/${encodeURIComponent(hash)}`,
  );
}
