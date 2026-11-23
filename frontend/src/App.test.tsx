import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import type { ElectionSummary, TallyResponse, AuditResponse } from './api';

const mockElections: ElectionSummary[] = [
  {
    id: 'ca-computacao-2026',
    title: 'Eleição Centro Acadêmico da Computação 2026',
    type: 'centro-academico',
    startDate: '2026-11-18T10:00:00.000Z',
    endDate: '2026-11-19T10:00:00.000Z',
    options: [
      { id: 'chapa-integracao', title: 'Chapa 1: Integração Estudantil' },
      { id: 'chapa-inovacao', title: 'Chapa 2: Inovação Aberta' },
    ],
    status: 'open',
    totalEligibleVoters: 200,
    quorumFraction: 0.25,
    turnoutCount: 2,
  },
  {
    id: 'condominio-solar-2026',
    title: 'Assembleia Geral Extraordinária - Condomínio Solar',
    type: 'assembleia-condominio',
    startDate: '2026-11-18T10:00:00.000Z',
    endDate: '2026-11-19T10:00:00.000Z',
    options: [
      { id: 'reforma-fachada', title: 'Aprovar Reforma da Fachada (Cota Extra)' },
      { id: 'manutencao-basica', title: 'Apenas Manutenção Preventiva' },
    ],
    status: 'open',
    totalEligibleVoters: 20,
    quorumFraction: 0.5,
    turnoutCount: 3,
  },
  {
    id: 'orcamento-campinas-2026',
    title: 'Orçamento Participativo Municipal 2026',
    type: 'orcamento-municipal',
    startDate: '2026-11-18T10:00:00.000Z',
    endDate: '2026-11-19T10:00:00.000Z',
    options: [
      { id: 'ciclovia-central', title: 'Expansão da Malha Cicloviária Central' },
      { id: 'reforma-ubs', title: 'Ampliação e Reforma das UBS' },
    ],
    status: 'open',
    totalEligibleVoters: 500,
    quorumFraction: 0.1,
    turnoutCount: 1,
  },
];

const VALID_HASH = 'a'.repeat(64);

function makeJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

describe('App - Sistema de Votação Eletrônica Auditável', () => {
  let electionsState: ElectionSummary[];
  let fetchMock: jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

  beforeEach(() => {
    electionsState = mockElections.map((e) => ({ ...e }));

    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/elections' && method === 'GET') {
        return makeJsonResponse(electionsState);
      }

      if (url === '/api/elections' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          id: string;
          title: string;
          type: ElectionSummary['type'];
          startDate: string;
          endDate: string;
          options: ElectionSummary['options'];
          totalEligibleVoters: number;
          quorumFraction: number;
        };
        const created: ElectionSummary = {
          ...body,
          status: 'open',
          turnoutCount: 0,
        };
        electionsState.push(created);
        return makeJsonResponse(created, 201);
      }

      if (url === '/api/elections/ca-computacao-2026/votes' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          voterId: string;
          credentials: string;
        };
        if (!/^\d{6}$/.test(body.credentials)) {
          return makeJsonResponse(
            { error: 'RA invalido, precisa ter 6 digitos, todos numericos' },
            403,
          );
        }
        electionsState[0] = {
          ...electionsState[0]!,
          turnoutCount: electionsState[0]!.turnoutCount + 1,
        };
        return makeJsonResponse(
          {
            receiptHash: VALID_HASH,
            timestamp: '2026-11-18T12:00:00.000Z',
            electionId: 'ca-computacao-2026',
            voterId: body.voterId,
          },
          201,
        );
      }

      if (url.startsWith('/api/elections/condominio-solar-2026/tally')) {
        const tallyRes: TallyResponse = {
          electionId: 'condominio-solar-2026',
          title: 'Assembleia Geral Extraordinária - Condomínio Solar',
          status: 'open',
          tally: {
            totalVotes: 3,
            totalWeightedVotes: 0.8,
            participationRate: 15,
            quorumReached: false,
            winners: ['reforma-fachada'],
            results: [
              { optionId: 'reforma-fachada', totalWeightedVotes: 0.45, percentage: 56.25 },
              { optionId: 'manutencao-basica', totalWeightedVotes: 0.35, percentage: 43.75 },
            ],
          },
        };
        return makeJsonResponse(tallyRes);
      }

      if (url.endsWith('/audit')) {
        const auditRes: AuditResponse = {
          electionId: 'ca-computacao-2026',
          turnoutCount: 3,
          totalEligibleVoters: 200,
          auditLogs: [
            {
              receiptHash: VALID_HASH,
              electionId: 'ca-computacao-2026',
              voterId: 'aluno-demo',
              timestamp: '2026-11-18T12:00:00.000Z',
            },
          ],
        };
        return makeJsonResponse(auditRes);
      }

      if (url === `/api/elections/ca-computacao-2026/receipts/${VALID_HASH}`) {
        return makeJsonResponse({
          receiptHash: VALID_HASH,
          electionId: 'ca-computacao-2026',
          voterId: 'aluno-demo',
          timestamp: '2026-11-18T12:00:00.000Z',
          verified: true,
        });
      }

      if (url.includes('/receipts/hash-invalido')) {
        return makeJsonResponse(
          { error: "Recibo 'hash-invalido' não encontrado para a eleição 'ca-computacao-2026'" },
          404,
        );
      }

      return makeJsonResponse({ error: 'Rota não mockada' }, 404);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('carrega as eleições dos três cenários institucionais e permite alternar entre elas', async () => {
    render(<App />);

    const sidebar = await screen.findByLabelText('Lista de Eleições');
    expect(
      await within(sidebar).findByText('Eleição Centro Acadêmico da Computação 2026'),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByText('Assembleia Geral Extraordinária - Condomínio Solar'),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByText('Orçamento Participativo Municipal 2026'),
    ).toBeInTheDocument();

    expect(screen.getByText(/AcademicCenterValidationStrategy/i)).toBeInTheDocument();

    fireEvent.click(
      within(sidebar).getByText('Assembleia Geral Extraordinária - Condomínio Solar'),
    );

    expect(screen.getByText(/CondoAssemblyValidationStrategy/i)).toBeInTheDocument();
  });

  it('registra voto válido, exibe recibo SHA-256 e permite verificar na aba de auditoria', async () => {
    render(<App />);

    await screen.findByLabelText('Cabine de Votação');

    fireEvent.change(screen.getByLabelText(/Identificador do Eleitor/i), {
      target: { value: 'aluno-demo' },
    });
    fireEvent.change(screen.getByLabelText(/Credencial/i), {
      target: { value: '281210' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar Voto/i }));

    const hashCode = await screen.findByTestId('generated-receipt-hash');
    expect(hashCode).toHaveTextContent(VALID_HASH);

    fireEvent.click(screen.getByRole('button', { name: /Verificar este recibo na Auditoria/i }));

    expect(await screen.findByText(/Recibo Autêntico e Verificado/i)).toBeInTheDocument();
    expect(screen.getByText(/TurnoutCounterObserver:/i)).toBeInTheDocument();
    expect(screen.getAllByText('aluno-demo').length).toBeGreaterThanOrEqual(1);
  });

  it('exibe erro retornado pelo backend quando a credencial é rejeitada pela Strategy', async () => {
    render(<App />);

    await screen.findByLabelText('Cabine de Votação');

    fireEvent.change(screen.getByLabelText(/Identificador do Eleitor/i), {
      target: { value: 'aluno-invalido' },
    });
    fireEvent.change(screen.getByLabelText(/Credencial/i), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar Voto/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('RA invalido, precisa ter 6 digitos, todos numericos');
  });

  it('exibe apuração ponderada, percentuais, quórum e vencedor na aba de Apuração', async () => {
    render(<App />);

    const sidebar = await screen.findByLabelText('Lista de Eleições');
    const condoOption = await within(sidebar).findByText(
      'Assembleia Geral Extraordinária - Condomínio Solar',
    );
    fireEvent.click(condoOption);

    fireEvent.click(screen.getByRole('button', { name: /Apuração e Quórum/i }));

    expect(await screen.findByText('0.8')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('Não atingido')).toBeInTheDocument();
    expect(screen.getByText(/0.45 pts \(56.25%\)/)).toBeInTheDocument();
    expect(screen.getByText(/0.35 pts \(43.75%\)/)).toBeInTheDocument();
  });

  it('exibe erro 404 ao consultar um hash de recibo inexistente na Auditoria', async () => {
    render(<App />);

    await screen.findByLabelText('Cabine de Votação');
    fireEvent.click(screen.getByRole('button', { name: /Auditoria e Observadores/i }));

    const input = await screen.findByLabelText('Hash do Recibo');
    fireEvent.change(input, { target: { value: 'hash-invalido' } });
    fireEvent.click(screen.getByRole('button', { name: /Verificar Recibo/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Recibo 'hash-invalido' não encontrado");
  });

  it('permite cadastrar uma nova eleição pelo formulário e selecioná-la', async () => {
    render(<App />);

    await screen.findByLabelText('Cabine de Votação');
    fireEvent.click(screen.getByRole('button', { name: /\+ Nova Eleição/i }));

    const createPanel = screen.getByLabelText('Criar Nova Eleição');
    fireEvent.change(within(createPanel).getByLabelText('ID da Eleição'), {
      target: { value: 'ca-novo-2026' },
    });
    fireEvent.change(within(createPanel).getByLabelText('Título'), {
      target: { value: 'Nova Eleição CA Teste' },
    });
    fireEvent.click(within(createPanel).getByRole('button', { name: /Cadastrar Eleição/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Criar Nova Eleição')).not.toBeInTheDocument();
    });

    const sidebar = screen.getByLabelText('Lista de Eleições');
    expect(within(sidebar).getByText('Nova Eleição CA Teste')).toBeInTheDocument();
  });
});
