import type { ElectionType } from '../models/election';

export interface Voter {
  id: string;
  credentials: string;
  status?: string;
}

export interface ElectionContext {
  type: ElectionType;
  allowedStatuses?: string[];
  requiredCredentialsFormat?: RegExp;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface ValidationStrategy {
  validate(voter: Voter, context: ElectionContext): EligibilityResult;
}

export class AcademicCenterValidationStrategy implements ValidationStrategy {
  validate(voter: Voter, context: ElectionContext): EligibilityResult {
    const raPattern = context.requiredCredentialsFormat || /^\d{6}$/;
    if (!raPattern.test(voter.credentials)) {
      return { eligible: false, reason: 'RA invalido, precisa ter 6 digitos, todos numericos' };
    }
    return { eligible: true };
  }
}

export class CondoAssemblyValidationStrategy implements ValidationStrategy {
  validate(voter: Voter, context: ElectionContext): EligibilityResult {
    const cpfPattern = context.requiredCredentialsFormat || /^\d{11}$/;
    if (!cpfPattern.test(voter.credentials)) {
      return { eligible: false, reason: 'CPF invalido, precisa ter 11 digitos, todos numericos' };
    }
    return { eligible: true };
  }
}

export class MunicipalBudgetValidationStrategy implements ValidationStrategy {
  validate(voter: Voter): EligibilityResult {
    if (voter.credentials.trim() === '') {
      return { eligible: false, reason: 'credencial nao pode ser vazia' };
    }
    return { eligible: true };
  }
}

export const validationStrategies: Record<ElectionType, ValidationStrategy> = {
  'centro-academico': new AcademicCenterValidationStrategy(),
  'assembleia-condominio': new CondoAssemblyValidationStrategy(),
  'orcamento-municipal': new MunicipalBudgetValidationStrategy(),
};

export function validateVoterEligibility(voter: Voter, context: ElectionContext): EligibilityResult {
  if (!voter.id || !voter.credentials)
    return { eligible: false, reason: 'credenciais nao encontradas' };

  if (voter.status === 'blocked')
    return { eligible: false, reason: 'eleitor encontra-se bloqueado' };

  if (context.allowedStatuses && context.allowedStatuses.length > 0 &&
    (!voter.status || !context.allowedStatuses.includes(voter.status)))
    return { eligible: false, reason: `status do eleitor '${voter.status}' nao é valido para esta eleicao` };

  const strategy = validationStrategies[context.type];
  if (!strategy) {
    return { eligible: false, reason: 'Tipo de eleição não reconhecido' };
  }

  return strategy.validate(voter, context);
}
