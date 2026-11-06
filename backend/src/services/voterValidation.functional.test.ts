import type { ElectionType } from '../models/election';
import {
  validateVoterEligibility,
  type Voter,
  type ElectionContext,
} from './voterValidation';

describe('Escopo 1 - VoterValidationService (Classes de Equivalencia)', () => {
  const studentContext: ElectionContext = {
    type: 'centro-academico',
    allowedStatuses: ['active'],
    requiredCredentialsFormat: /^\d{6}$/,
  };

  const facultyContext: ElectionContext = {
    type: 'centro-academico',
    allowedStatuses: ['active'],
    requiredCredentialsFormat: /^[a-z]+\.[a-z]+$/,
  };

  const staffContext: ElectionContext = {
    type: 'centro-academico',
    allowedStatuses: ['active'],
    requiredCredentialsFormat: /^STF-\d{4}$/,
  };

  test('CE1 [Valida]: RA discente com 6 digitos numericos e status ativo deve ser elegivel', () => {
    const voter: Voter = {
      id: 'disc-01',
      credentials: '281827',
      status: 'active',
    };

    const result = validateVoterEligibility(voter, studentContext);

    expect(result).toEqual({ eligible: true });
  });

  test('CE2 [Invalida]: RA discente com caracteres nao numericos deve ser rejeitado', () => {
    const voter: Voter = {
      id: 'disc-02',
      credentials: '28A82B',
      status: 'active',
    };

    const result = validateVoterEligibility(voter, studentContext);

    expect(result.eligible).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('CE3 [Invalida]: RA discente com tamanho diferente de 6 digitos deve ser rejeitado', () => {
    const shortRaVoter: Voter = {
      id: 'disc-03a',
      credentials: '12345',
      status: 'active',
    };
    const longRaVoter: Voter = {
      id: 'disc-03b',
      credentials: '1234567',
      status: 'active',
    };

    const shortResult = validateVoterEligibility(shortRaVoter, studentContext);
    const longResult = validateVoterEligibility(longRaVoter, studentContext);

    expect(shortResult.eligible).toBe(false);
    expect(shortResult.reason).toBeDefined();
    expect(longResult.eligible).toBe(false);
    expect(longResult.reason).toBeDefined();
  });

  test('CE4 [Invalida]: Discente inativo no sistema deve ser rejeitado', () => {
    const inactiveVoter: Voter = {
      id: 'disc-04a',
      credentials: '281827',
      status: 'inactive',
    };
    const blockedVoter: Voter = {
      id: 'disc-04b',
      credentials: '281827',
      status: 'blocked',
    };

    const inactiveResult = validateVoterEligibility(inactiveVoter, studentContext);
    const blockedResult = validateVoterEligibility(blockedVoter, studentContext);

    expect(inactiveResult.eligible).toBe(false);
    expect(inactiveResult.reason).toContain('inactive');
    expect(blockedResult.eligible).toBe(false);
    expect(blockedResult.reason).toBe('eleitor encontra-se bloqueado');
  });

  test('CE5 [Valida]: Credencial docente no formato usuario.sobrenome em minusculas deve ser elegivel', () => {
    const facultyVoter: Voter = {
      id: 'doc-01',
      credentials: 'maria.oliveira',
      status: 'active',
    };

    const result = validateVoterEligibility(facultyVoter, facultyContext);

    expect(result).toEqual({ eligible: true });
  });

  test('CE6 [Invalida]: Credencial docente sem ponto ou com digitos e maiusculas deve ser rejeitada', () => {
    const noDotFaculty: Voter = {
      id: 'doc-02a',
      credentials: 'mariaoliveira',
      status: 'active',
    };
    const upperAndDigitsFaculty: Voter = {
      id: 'doc-02b',
      credentials: 'Maria.Oliveira2',
      status: 'active',
    };

    expect(validateVoterEligibility(noDotFaculty, facultyContext).eligible).toBe(false);
    expect(validateVoterEligibility(upperAndDigitsFaculty, facultyContext).eligible).toBe(false);
  });

  test('CE7 [Valida]: Credencial de funcionario com prefixo STF- seguido de 4 digitos deve ser elegivel', () => {
    const staffVoter: Voter = {
      id: 'func-01',
      credentials: 'STF-1042',
      status: 'active',
    };

    const result = validateVoterEligibility(staffVoter, staffContext);

    expect(result).toEqual({ eligible: true });
  });

  test('CE8 [Invalida]: Credencial de funcionario com prefixo ou digitos divergentes deve ser rejeitada', () => {
    const wrongPrefixStaff: Voter = {
      id: 'func-02a',
      credentials: 'ADM-1042',
      status: 'active',
    };
    const wrongDigitsStaff: Voter = {
      id: 'func-02b',
      credentials: 'STF-99',
      status: 'active',
    };

    expect(validateVoterEligibility(wrongPrefixStaff, staffContext).eligible).toBe(false);
    expect(validateVoterEligibility(wrongDigitsStaff, staffContext).eligible).toBe(false);
  });

  test('CE9 [Invalida]: Tipo de eleitor ou contexto nao reconhecido pelo sistema deve ser rejeitado', () => {
    const voter: Voter = {
      id: 'ext-01',
      credentials: '281827',
      status: 'active',
    };
    const unknownContext: ElectionContext = {
      type: 'categoria-desconhecida' as unknown as ElectionType,
    };

    const result = validateVoterEligibility(voter, unknownContext);

    expect(result).toEqual({
      eligible: false,
      reason: 'Tipo de eleição não reconhecido',
    });
  });
});
