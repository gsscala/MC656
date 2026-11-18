import { useCallback, useEffect, useState } from 'react';
import {
  createElection,
  fetchAudit,
  fetchElections,
  fetchTally,
  submitVote,
  verifyReceipt,
} from './api';
import type {
  AuditResponse,
  ElectionStatus,
  ElectionSummary,
  ElectionType,
  TallyResponse,
  VerifyReceiptResponse,
  VoteReceiptResponse,
} from './api';
import './App.css';

type ActiveTab = 'vote' | 'tally' | 'audit';

interface StrategyMetadata {
  label: string;
  strategyName: string;
  ruleDescription: string;
  credentialPlaceholder: string;
}

const ELECTION_TYPE_META: Record<ElectionType, StrategyMetadata> = {
  'centro-academico': {
    label: 'Centro Acadêmico',
    strategyName: 'AcademicCenterValidationStrategy',
    ruleDescription:
      'Exige RA numérico com exatamente 6 dígitos (ex.: 281210) e status ativo.',
    credentialPlaceholder: 'Ex.: 281210 (6 dígitos)',
  },
  'assembleia-condominio': {
    label: 'Assembleia de Condomínio',
    strategyName: 'CondoAssemblyValidationStrategy',
    ruleDescription:
      'Exige CPF numérico com exatamente 11 dígitos (ex.: 12345678901). Aceita peso proporcional (fração ideal).',
    credentialPlaceholder: 'Ex.: 12345678901 (11 dígitos)',
  },
  'orcamento-municipal': {
    label: 'Orçamento Municipal',
    strategyName: 'MunicipalBudgetValidationStrategy',
    ruleDescription:
      'Exige credencial cidadã não vazia (ex.: REG-2026-001) e status não bloqueado.',
    credentialPlaceholder: 'Ex.: REG-2026-001',
  },
};

const STATUS_LABEL: Record<ElectionStatus, string> = {
  open: 'Aberta',
  scheduled: 'Agendada',
  closed: 'Encerrada',
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('pt-BR');
}

function App() {
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('vote');
  const [loadingElections, setLoadingElections] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string>('');

  // Create election form state
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newId, setNewId] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<ElectionType>('centro-academico');
  const [newEligibleVoters, setNewEligibleVoters] = useState<string>('100');
  const [newQuorum, setNewQuorum] = useState<string>('0.25');
  const [newStartDate, setNewStartDate] = useState<string>(() =>
    toLocalInputValue(new Date(Date.now() - 3600_000)),
  );
  const [newEndDate, setNewEndDate] = useState<string>(() =>
    toLocalInputValue(new Date(Date.now() + 24 * 3600_000)),
  );
  const [newOptionsText, setNewOptionsText] = useState<string>(
    'chapa-a: Chapa A\nchapa-b: Chapa B',
  );
  const [createError, setCreateError] = useState<string>('');

  // Vote form state
  const [voterId, setVoterId] = useState<string>('');
  const [credentials, setCredentials] = useState<string>('');
  const [voterStatus, setVoterStatus] = useState<string>('active');
  const [weight, setWeight] = useState<string>('1');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [voteSubmitting, setVoteSubmitting] = useState<boolean>(false);
  const [voteError, setVoteError] = useState<string>('');
  const [lastReceipt, setLastReceipt] = useState<VoteReceiptResponse | null>(null);

  // Tally tab state
  const [tallyData, setTallyData] = useState<TallyResponse | null>(null);
  const [tallyError, setTallyError] = useState<string>('');
  const [tallyLoading, setTallyLoading] = useState<boolean>(false);

  // Audit tab state
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [auditError, setAuditError] = useState<string>('');
  const [hashInput, setHashInput] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<VerifyReceiptResponse | null>(null);
  const [verifyError, setVerifyError] = useState<string>('');

  const selectedElection = elections.find((e) => e.id === selectedId) ?? null;

  const refreshElections = useCallback(async (preferredId?: string) => {
    try {
      const list = await fetchElections();
      setElections(list);
      setGlobalError('');
      setSelectedId((prev) => {
        if (preferredId && list.some((e) => e.id === preferredId)) {
          return preferredId;
        }
        if (prev && list.some((e) => e.id === prev)) {
          return prev;
        }
        return list[0]?.id ?? '';
      });
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Erro ao carregar eleições.');
    } finally {
      setLoadingElections(false);
    }
  }, []);

  const loadTally = useCallback(async (election: ElectionSummary) => {
    setTallyLoading(true);
    setTallyError('');
    try {
      const data = await fetchTally(election.id, election.status !== 'closed');
      setTallyData(data);
    } catch (err: unknown) {
      setTallyData(null);
      setTallyError(err instanceof Error ? err.message : 'Erro ao carregar apuração.');
    } finally {
      setTallyLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async (electionId: string) => {
    setAuditError('');
    try {
      const data = await fetchAudit(electionId);
      setAuditData(data);
    } catch (err: unknown) {
      setAuditData(null);
      setAuditError(err instanceof Error ? err.message : 'Erro ao carregar auditoria.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialElections() {
      try {
        const list = await fetchElections();
        if (cancelled) {
          return;
        }
        setElections(list);
        setGlobalError('');
        setSelectedId((prev) =>
          prev && list.some((e) => e.id === prev) ? prev : (list[0]?.id ?? ''),
        );
      } catch (err: unknown) {
        if (!cancelled) {
          setGlobalError(err instanceof Error ? err.message : 'Erro ao carregar eleições.');
        }
      } finally {
        if (!cancelled) {
          setLoadingElections(false);
        }
      }
    }

    void loadInitialElections();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedElection) {
      return;
    }

    let cancelled = false;

    async function syncElectionDetails(election: ElectionSummary) {
      if (activeTab === 'tally') {
        try {
          const data = await fetchTally(election.id, election.status !== 'closed');
          if (!cancelled) {
            setTallyData(data);
            setTallyError('');
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setTallyData(null);
            setTallyError(err instanceof Error ? err.message : 'Erro ao carregar apuração.');
          }
        }
      } else if (activeTab === 'audit') {
        try {
          const data = await fetchAudit(election.id);
          if (!cancelled) {
            setAuditData(data);
            setAuditError('');
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setAuditData(null);
            setAuditError(err instanceof Error ? err.message : 'Erro ao carregar auditoria.');
          }
        }
      }
    }

    void syncElectionDetails(selectedElection);

    return () => {
      cancelled = true;
    };
  }, [selectedElection, activeTab]);

  const handleSelectElection = (election: ElectionSummary) => {
    setSelectedId(election.id);
    setSelectedOptionId(election.options[0]?.id ?? '');
    setVoteError('');
    setLastReceipt(null);
    setVerifyResult(null);
    setVerifyError('');
    setTallyData(null);
    setAuditData(null);
  };

  const handleVoteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedElection) {
      return;
    }

    const optionToSend = selectedOptionId || selectedElection.options[0]?.id || '';
    const parsedWeight = Number(weight);

    setVoteSubmitting(true);
    setVoteError('');
    setLastReceipt(null);

    try {
      const receipt = await submitVote(selectedElection.id, {
        voterId: voterId.trim(),
        credentials: credentials.trim(),
        voterStatus,
        optionId: optionToSend,
        weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
      });
      setLastReceipt(receipt);
      setVoterId('');
      setCredentials('');
      await refreshElections(selectedElection.id);
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : 'Erro ao registrar voto.');
    } finally {
      setVoteSubmitting(false);
    }
  };

  const handleVerifyReceipt = async (hashToVerify: string) => {
    if (!selectedElection || !hashToVerify.trim()) {
      return;
    }

    setVerifyError('');
    setVerifyResult(null);

    try {
      const verified = await verifyReceipt(selectedElection.id, hashToVerify.trim());
      setVerifyResult(verified);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Recibo não encontrado.');
    }
  };

  const handleJumpToVerify = async (receiptHash: string) => {
    setHashInput(receiptHash);
    setActiveTab('audit');
    await handleVerifyReceipt(receiptHash);
  };

  const handleCreateElection = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');

    const parsedOptions = newOptionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [rawId, ...rest] = line.split(':');
        const id = (rawId ?? '').trim();
        const title = rest.join(':').trim() || id;
        return { id, title };
      });

    try {
      const created = await createElection({
        id: newId.trim(),
        title: newTitle.trim(),
        type: newType,
        startDate: new Date(newStartDate).toISOString(),
        endDate: new Date(newEndDate).toISOString(),
        options: parsedOptions,
        totalEligibleVoters: Number(newEligibleVoters) || 100,
        quorumFraction: Number(newQuorum),
      });

      setShowCreateForm(false);
      setNewId('');
      setNewTitle('');
      await refreshElections(created.id);
      setSelectedOptionId(created.options[0]?.id ?? '');
      setActiveTab('vote');
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar eleição.');
    }
  };

  const optionTitleMap = new Map(
    (selectedElection?.options ?? []).map((opt) => [opt.id, opt.title]),
  );

  const effectiveOptionId =
    selectedOptionId && selectedElection?.options.some((o) => o.id === selectedOptionId)
      ? selectedOptionId
      : (selectedElection?.options[0]?.id ?? '');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MC656 | Engenharia de Software</p>
          <h1>Sistema de Votação Eletrônica Auditável</h1>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? 'Fechar Formulário' : '+ Nova Eleição'}
        </button>
      </header>

      {globalError && (
        <div role="alert" className="alert alert-error">
          {globalError}
        </div>
      )}

      {showCreateForm && (
        <section className="panel create-panel" aria-label="Criar Nova Eleição">
          <h2>Criar Nova Eleição</h2>
          <form className="form-grid" onSubmit={(e) => void handleCreateElection(e)}>
            <label className="field">
              <span>ID da Eleição</span>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="ex.: ca-2026-2"
                required
              />
            </label>
            <label className="field">
              <span>Título</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ex.: Eleição Diretoria CA"
                required
              />
            </label>
            <label className="field">
              <span>Tipo / Cenário Institucional</span>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ElectionType)}
              >
                <option value="centro-academico">Centro Acadêmico</option>
                <option value="assembleia-condominio">Assembleia de Condomínio</option>
                <option value="orcamento-municipal">Orçamento Municipal</option>
              </select>
            </label>
            <label className="field">
              <span>Eleitores Habilitados</span>
              <input
                type="number"
                min="1"
                value={newEligibleVoters}
                onChange={(e) => setNewEligibleVoters(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Quórum Mínimo (0 a 1)</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={newQuorum}
                onChange={(e) => setNewQuorum(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Início da Votação</span>
              <input
                type="datetime-local"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Término da Votação</span>
              <input
                type="datetime-local"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                required
              />
            </label>
            <label className="field field-full">
              <span>Opções (uma por linha, formato id: título)</span>
              <textarea
                rows={3}
                value={newOptionsText}
                onChange={(e) => setNewOptionsText(e.target.value)}
                required
              />
            </label>

            {createError && (
              <div role="alert" className="alert alert-error field-full">
                {createError}
              </div>
            )}

            <div className="field-full form-actions">
              <button type="submit" className="btn-primary">
                Cadastrar Eleição
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="workspace-grid">
        <aside className="sidebar" aria-label="Lista de Eleições">
          <h2>Eleições Disponíveis</h2>
          {loadingElections ? (
            <p className="muted">Carregando eleições...</p>
          ) : elections.length === 0 ? (
            <p className="muted">Nenhuma eleição cadastrada.</p>
          ) : (
            <ul className="election-list">
              {elections.map((election) => {
                const isActive = election.id === selectedElection?.id;
                const meta = ELECTION_TYPE_META[election.type];
                return (
                  <li key={election.id}>
                    <button
                      type="button"
                      className={`election-card ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectElection(election)}
                    >
                      <div className="card-badges">
                        <span className="badge badge-type">{meta.label}</span>
                        <span className={`badge badge-status status-${election.status}`}>
                          {STATUS_LABEL[election.status]}
                        </span>
                      </div>
                      <strong className="card-title">{election.title}</strong>
                      <span className="card-meta">
                        Comparecimento: {election.turnoutCount} / {election.totalEligibleVoters}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="main-content">
          {!selectedElection ? (
            <div className="panel">
              <p className="muted">Selecione ou crie uma eleição para iniciar.</p>
            </div>
          ) : (
            <>
              <section className="panel election-banner">
                <div className="banner-header">
                  <div>
                    <span className="badge badge-type">
                      {ELECTION_TYPE_META[selectedElection.type].label}
                    </span>
                    <h2>{selectedElection.title}</h2>
                  </div>
                  <div className="turnout-pill">
                    <span>Votos registrados</span>
                    <strong>
                      {selectedElection.turnoutCount} / {selectedElection.totalEligibleVoters}
                    </strong>
                  </div>
                </div>
                <p className="banner-dates">
                  ID: <code>{selectedElection.id}</code> | Janela:{' '}
                  {formatDateTime(selectedElection.startDate)} até{' '}
                  {formatDateTime(selectedElection.endDate)}
                </p>

                <nav className="tabs" aria-label="Seções da Eleição">
                  <button
                    type="button"
                    className={`tab ${activeTab === 'vote' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vote')}
                  >
                    Cabine de Votação
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === 'tally' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tally')}
                  >
                    Apuração e Quórum
                  </button>
                  <button
                    type="button"
                    className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                  >
                    Auditoria e Observadores
                  </button>
                </nav>
              </section>

              {activeTab === 'vote' && (
                <section className="panel" aria-label="Cabine de Votação">
                  <div className="strategy-box">
                    <strong>
                      Estratégia ativa: {ELECTION_TYPE_META[selectedElection.type].strategyName}
                    </strong>
                    <p>{ELECTION_TYPE_META[selectedElection.type].ruleDescription}</p>
                  </div>

                  <form className="form-grid" onSubmit={(e) => void handleVoteSubmit(e)}>
                    <label className="field" htmlFor="voter-id">
                      <span>Identificador do Eleitor (voterId)</span>
                      <input
                        id="voter-id"
                        type="text"
                        value={voterId}
                        onChange={(e) => setVoterId(e.target.value)}
                        placeholder="ex.: aluno-01"
                        required
                      />
                    </label>

                    <label className="field" htmlFor="voter-credentials">
                      <span>Credencial</span>
                      <input
                        id="voter-credentials"
                        type="text"
                        value={credentials}
                        onChange={(e) => setCredentials(e.target.value)}
                        placeholder={ELECTION_TYPE_META[selectedElection.type].credentialPlaceholder}
                        required
                      />
                    </label>

                    <label className="field" htmlFor="voter-status">
                      <span>Status do Eleitor</span>
                      <select
                        id="voter-status"
                        value={voterStatus}
                        onChange={(e) => setVoterStatus(e.target.value)}
                      >
                        <option value="active">Ativo (active)</option>
                        <option value="blocked">Bloqueado (blocked)</option>
                      </select>
                    </label>

                    <label className="field" htmlFor="voter-weight">
                      <span>Peso do Voto</span>
                      <input
                        id="voter-weight"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                      />
                    </label>

                    <fieldset className="field field-full options-fieldset">
                      <legend>Escolha uma opção</legend>
                      <div className="options-grid">
                        {selectedElection.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={`option-card ${
                              effectiveOptionId === opt.id ? 'selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="vote-option"
                              value={opt.id}
                              checked={effectiveOptionId === opt.id}
                              onChange={() => setSelectedOptionId(opt.id)}
                            />
                            <div>
                              <strong>{opt.title}</strong>
                              <small>{opt.id}</small>
                            </div>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {voteError && (
                      <div role="alert" className="alert alert-error field-full">
                        {voteError}
                      </div>
                    )}

                    <div className="field-full form-actions">
                      <button type="submit" className="btn-primary" disabled={voteSubmitting}>
                        {voteSubmitting ? 'Registrando...' : 'Registrar Voto'}
                      </button>
                    </div>
                  </form>

                  {lastReceipt && (
                    <div className="receipt-card" role="status">
                      <h3>Comprovante Criptográfico de Votação (SHA-256)</h3>
                      <p>
                        <strong>Eleitor:</strong> {lastReceipt.voterId} |{' '}
                        <strong>Horário:</strong> {formatDateTime(lastReceipt.timestamp)}
                      </p>
                      <p className="hash-row">
                        <strong>Hash do Recibo:</strong>{' '}
                        <code data-testid="generated-receipt-hash">{lastReceipt.receiptHash}</code>
                      </p>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void handleJumpToVerify(lastReceipt.receiptHash)}
                      >
                        Verificar este recibo na Auditoria
                      </button>
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'tally' && (
                <section className="panel" aria-label="Apuração e Quórum">
                  <div className="section-toolbar">
                    <h3>Resultado da Apuração Ponderada</h3>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void loadTally(selectedElection)}
                    >
                      Atualizar Apuração
                    </button>
                  </div>

                  {tallyLoading && <p className="muted">Calculando apuração...</p>}
                  {tallyError && (
                    <div role="alert" className="alert alert-error">
                      {tallyError}
                    </div>
                  )}

                  {tallyData && (
                    <>
                      <div className="metrics-grid">
                        <div className="metric-box">
                          <span>Votos Nominais</span>
                          <strong>{tallyData.tally.totalVotes}</strong>
                        </div>
                        <div className="metric-box">
                          <span>Soma Ponderada</span>
                          <strong>{Number(tallyData.tally.totalWeightedVotes.toFixed(4))}</strong>
                        </div>
                        <div className="metric-box">
                          <span>Participação</span>
                          <strong>{tallyData.tally.participationRate}%</strong>
                        </div>
                        <div className="metric-box">
                          <span>Quórum</span>
                          <strong>
                            {tallyData.tally.quorumReached ? 'Atingido' : 'Não atingido'}
                          </strong>
                        </div>
                      </div>

                      <div className="winner-banner">
                        {tallyData.tally.winners.length === 0 ? (
                          <span>Nenhum voto registrado até o momento.</span>
                        ) : tallyData.tally.winners.length === 1 ? (
                          <span>
                            <strong>Vencedor:</strong>{' '}
                            {optionTitleMap.get(tallyData.tally.winners[0] ?? '') ??
                              tallyData.tally.winners[0]}
                          </span>
                        ) : (
                          <span>
                            <strong>Empate técnico:</strong>{' '}
                            {tallyData.tally.winners
                              .map((id) => optionTitleMap.get(id) ?? id)
                              .join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="results-list">
                        {tallyData.tally.results.map((item) => (
                          <div key={item.optionId} className="result-row">
                            <div className="result-row-head">
                              <span>
                                <strong>{optionTitleMap.get(item.optionId) ?? item.optionId}</strong>{' '}
                                <small>({item.optionId})</small>
                              </span>
                              <span>
                                {Number(item.totalWeightedVotes.toFixed(4))} pts ({item.percentage}%)
                              </span>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${Math.min(100, item.percentage)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              {activeTab === 'audit' && (
                <section className="panel" aria-label="Auditoria e Observadores">
                  <div className="audit-verify-box">
                    <h3>Verificador Individual de Recibo</h3>
                    <form
                      className="verify-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleVerifyReceipt(hashInput);
                      }}
                    >
                      <input
                        id="receipt-hash-input"
                        type="text"
                        value={hashInput}
                        onChange={(e) => setHashInput(e.target.value)}
                        placeholder="Cole o hash SHA-256 do recibo para validar"
                        aria-label="Hash do Recibo"
                      />
                      <button type="submit" className="btn-primary">
                        Verificar Recibo
                      </button>
                    </form>

                    {verifyResult && (
                      <div className="alert alert-success" role="status">
                        <strong>Recibo Autêntico e Verificado</strong>
                        <p>
                          Eleitor: <code>{verifyResult.voterId}</code> | Registrado em:{' '}
                          {formatDateTime(verifyResult.timestamp)}
                        </p>
                      </div>
                    )}

                    {verifyError && (
                      <div role="alert" className="alert alert-error">
                        {verifyError}
                      </div>
                    )}
                  </div>

                  <div className="observer-section">
                    <div className="section-toolbar">
                      <h3>Observadores de Votação (Observer Pattern)</h3>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void loadAudit(selectedElection.id)}
                      >
                        Atualizar Auditoria
                      </button>
                    </div>

                    {auditError && (
                      <div role="alert" className="alert alert-error">
                        {auditError}
                      </div>
                    )}

                    {auditData && (
                      <>
                        <p className="muted">
                          <strong>TurnoutCounterObserver:</strong> {auditData.turnoutCount} de{' '}
                          {auditData.totalEligibleVoters} eleitores votaram. O sigilo do voto é
                          preservado: o <strong>AuditLogObserver</strong> não registra a opção
                          escolhida.
                        </p>

                        {auditData.auditLogs.length === 0 ? (
                          <p className="muted">Nenhum recibo registrado para esta eleição.</p>
                        ) : (
                          <div className="table-wrap">
                            <table className="audit-table">
                              <thead>
                                <tr>
                                  <th>Eleitor</th>
                                  <th>Timestamp</th>
                                  <th>Hash do Recibo (SHA-256)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auditData.auditLogs.map((entry) => (
                                  <tr key={entry.receiptHash}>
                                    <td>{entry.voterId}</td>
                                    <td>{formatDateTime(entry.timestamp)}</td>
                                    <td>
                                      <code>{entry.receiptHash}</code>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
