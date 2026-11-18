import { Request, Response } from 'express';
import { ElectionController } from './electionController';

function invokeSync(
  handler: (req: Request, res: Response) => void,
  body: Record<string, unknown>,
  params: Record<string, string>,
): void {
  const req = { body, params, query: {} } as unknown as Request;
  const res = {
    status: () => res,
    json: () => res,
  } as unknown as Response;
  handler(req, res);
}

/**
 * Popula o controlador em memória com três eleições de demonstração
 * correspondentes aos cenários institucionais do sistema.
 */
export function seedDemoElections(controller: ElectionController): void {
  const now = Date.now();
  const startDate = new Date(now - 2 * 3600_000).toISOString();
  const endDate = new Date(now + 24 * 3600_000).toISOString();

  const elections: Array<Record<string, unknown>> = [
    {
      id: 'ca-computacao-2026',
      title: 'Eleição Centro Acadêmico da Computação 2026',
      type: 'centro-academico',
      startDate,
      endDate,
      options: [
        { id: 'chapa-integracao', title: 'Chapa 1: Integração Estudantil' },
        { id: 'chapa-inovacao', title: 'Chapa 2: Inovação Aberta' },
      ],
      totalEligibleVoters: 200,
      quorumFraction: 0.25,
    },
    {
      id: 'condominio-solar-2026',
      title: 'Assembleia Geral Extraordinária - Condomínio Solar',
      type: 'assembleia-condominio',
      startDate,
      endDate,
      options: [
        { id: 'reforma-fachada', title: 'Aprovar Reforma da Fachada (Cota Extra)' },
        { id: 'manutencao-basica', title: 'Apenas Manutenção Preventiva' },
      ],
      totalEligibleVoters: 20,
      quorumFraction: 0.5,
    },
    {
      id: 'orcamento-campinas-2026',
      title: 'Orçamento Participativo Municipal 2026',
      type: 'orcamento-municipal',
      startDate,
      endDate,
      options: [
        { id: 'ciclovia-central', title: 'Expansão da Malha Cicloviária Central' },
        { id: 'reforma-ubs', title: 'Ampliação e Reforma das UBS' },
        { id: 'iluminacao-led', title: 'Iluminação Pública em LED nos Bairros' },
      ],
      totalEligibleVoters: 500,
      quorumFraction: 0.1,
    },
  ];

  for (const payload of elections) {
    invokeSync(controller.createElection, payload, {});
  }

  const initialVotes: Array<{ electionId: string; body: Record<string, unknown> }> = [
    {
      electionId: 'ca-computacao-2026',
      body: {
        voterId: 'disc-281210',
        credentials: '281210',
        voterStatus: 'active',
        optionId: 'chapa-integracao',
        weight: 1,
      },
    },
    {
      electionId: 'ca-computacao-2026',
      body: {
        voterId: 'disc-281827',
        credentials: '281827',
        voterStatus: 'active',
        optionId: 'chapa-inovacao',
        weight: 1,
      },
    },
    {
      electionId: 'condominio-solar-2026',
      body: {
        voterId: 'apt-101',
        credentials: '11122233344',
        voterStatus: 'active',
        optionId: 'reforma-fachada',
        weight: 0.45,
      },
    },
    {
      electionId: 'condominio-solar-2026',
      body: {
        voterId: 'apt-201',
        credentials: '55566677788',
        voterStatus: 'active',
        optionId: 'manutencao-basica',
        weight: 0.2,
      },
    },
    {
      electionId: 'condominio-solar-2026',
      body: {
        voterId: 'apt-202',
        credentials: '99988877766',
        voterStatus: 'active',
        optionId: 'manutencao-basica',
        weight: 0.15,
      },
    },
    {
      electionId: 'orcamento-campinas-2026',
      body: {
        voterId: 'cidadao-01',
        credentials: 'REG-2026-001',
        voterStatus: 'active',
        optionId: 'ciclovia-central',
        weight: 1,
      },
    },
  ];

  for (const vote of initialVotes) {
    invokeSync(controller.submitVote, vote.body, { id: vote.electionId });
  }
}
