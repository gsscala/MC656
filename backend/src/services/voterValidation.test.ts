import {
  validateVoterEligibility,
  Voter,
  ElectionContext,
  AcademicCenterValidationStrategy,
  CondoAssemblyValidationStrategy,
  MunicipalBudgetValidationStrategy,
  validationStrategies,
} from './voterValidation';

describe('Voter Validation Service', () => {
  const activeStudent: Voter = { id: 'v1', credentials: '123456', status: 'active' };
  const blockedVoter: Voter = { id: 'v2', credentials: '123456', status: 'blocked' };
  const condoOwner: Voter = { id: 'v3', credentials: '12345678901', status: 'active' };

  describe('Centro Acadêmico', () => {
    const caContext: ElectionContext = { type: 'centro-academico', allowedStatuses: ['active'] };

    it('should validate an active student with correct RA format', () => {
      const result = validateVoterEligibility(activeStudent, caContext);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return not eligible for invalid RA format', () => {
      const badStudent: Voter = { ...activeStudent, credentials: 'abc' };
      const result = validateVoterEligibility(badStudent, caContext);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('RA invalido, precisa ter 6 digitos, todos numericos');
    });

    it('should return ineligible for non-eligible status', () => {
      const graduatedStudent: Voter = { ...activeStudent, status: 'graduated' };
      const result = validateVoterEligibility(graduatedStudent, caContext);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("status do eleitor 'graduated' nao é valido para esta eleicao");
    });
  });

  describe('Assembleia de Condomínio', () => {
    const condoContext: ElectionContext = { type: 'assembleia-condominio' };

    it('should validate owner with correct CPF format', () => {
      const result = validateVoterEligibility(condoOwner, condoContext);
      expect(result.eligible).toBe(true);
    });

    it('should return ineligible for invalid CPF format', () => {
      const badOwner: Voter = { ...condoOwner, credentials: 'short' };
      const result = validateVoterEligibility(badOwner, condoContext);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('CPF invalido, precisa ter 11 digitos, todos numericos');
    });
  });

  describe('General Validations', () => {
    it('should return ineligible if voter is blocked', () => {
      const ctx: ElectionContext = { type: 'orcamento-municipal' };
      const result = validateVoterEligibility(blockedVoter, ctx);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('eleitor encontra-se bloqueado');
    });

    it('should return ineligible for missing ID', () => {
      const invalidVoter = { credentials: '123' } as Voter;
      const ctx: ElectionContext = { type: 'orcamento-municipal' };
      const result = validateVoterEligibility(invalidVoter, ctx);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('credenciais nao encontradas');
    });
  });
  describe('Orçamento Municipal', () => {
    const munContext: ElectionContext = { type: 'orcamento-municipal' };
    const validMunVoter: Voter = { id: 'v4', credentials: ' 123abc ' };

    it('should validate municipal voter with non-empty credentials', () => {
      const result = validateVoterEligibility(validMunVoter, munContext);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return ineligible if municipal credentials are empty', () => {
      const badMunVoter: Voter = { ...validMunVoter, credentials: '   ' };
      const result = validateVoterEligibility(badMunVoter, munContext);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('credencial nao pode ser vazia');
    });
  });

  describe('Unknown Election Type', () => {
    it('should return ineligible for unknown context type', () => {
      // @ts-expect-error: intencionalmente passando um tipo errado
      const unknownContext: ElectionContext = { type: 'outro-tipo' };
      const result = validateVoterEligibility(activeStudent, unknownContext);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Tipo de eleição não reconhecido');
    });
  });

  describe('Strategy Pattern classes (isolated)', () => {
    it('AcademicCenterValidationStrategy validates default 6-digit RA and custom format', () => {
      const strategy = new AcademicCenterValidationStrategy();
      const baseContext: ElectionContext = { type: 'centro-academico' };

      expect(strategy.validate({ id: 'v1', credentials: '123456' }, baseContext)).toEqual({
        eligible: true,
      });
      expect(strategy.validate({ id: 'v1', credentials: '12345' }, baseContext)).toEqual({
        eligible: false,
        reason: 'RA invalido, precisa ter 6 digitos, todos numericos',
      });

      const customContext: ElectionContext = {
        type: 'centro-academico',
        requiredCredentialsFormat: /^RA-\d{4}$/,
      };
      expect(strategy.validate({ id: 'v1', credentials: 'RA-2026' }, customContext)).toEqual({
        eligible: true,
      });
    });

    it('CondoAssemblyValidationStrategy validates default 11-digit CPF and custom format', () => {
      const strategy = new CondoAssemblyValidationStrategy();
      const baseContext: ElectionContext = { type: 'assembleia-condominio' };

      expect(strategy.validate({ id: 'v2', credentials: '12345678901' }, baseContext)).toEqual({
        eligible: true,
      });
      expect(strategy.validate({ id: 'v2', credentials: '123' }, baseContext)).toEqual({
        eligible: false,
        reason: 'CPF invalido, precisa ter 11 digitos, todos numericos',
      });

      const customContext: ElectionContext = {
        type: 'assembleia-condominio',
        requiredCredentialsFormat: /^APT-\d{3}$/,
      };
      expect(strategy.validate({ id: 'v2', credentials: 'APT-101' }, customContext)).toEqual({
        eligible: true,
      });
    });

    it('MunicipalBudgetValidationStrategy rejects blank strings and accepts non-empty credentials', () => {
      const strategy = new MunicipalBudgetValidationStrategy();
      expect(strategy.validate({ id: 'v3', credentials: 'mun-01' })).toEqual({
        eligible: true,
      });
      expect(strategy.validate({ id: 'v3', credentials: '   ' })).toEqual({
        eligible: false,
        reason: 'credencial nao pode ser vazia',
      });
    });

    it('validationStrategies maps each ElectionType to its concrete strategy instance', () => {
      expect(validationStrategies['centro-academico']).toBeInstanceOf(
        AcademicCenterValidationStrategy,
      );
      expect(validationStrategies['assembleia-condominio']).toBeInstanceOf(
        CondoAssemblyValidationStrategy,
      );
      expect(validationStrategies['orcamento-municipal']).toBeInstanceOf(
        MunicipalBudgetValidationStrategy,
      );
    });
  });
});
