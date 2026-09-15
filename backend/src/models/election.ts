export const ELECTION_TYPES = [
  'centro-academico',
  'assembleia-condominio',
  'orcamento-municipal',
] as const;

export type ElectionType = (typeof ELECTION_TYPES)[number];

export type ElectionStatus = 'scheduled' | 'open' | 'closed';

export interface ElectionOption {
  readonly id: string;
  readonly title: string;
}

export interface ElectionConfig {
  readonly title: string;
  readonly type: ElectionType;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly options: readonly ElectionOption[];
}

export class ElectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElectionValidationError';
  }
}

export class Election {
  readonly title: string;
  readonly type: ElectionType;
  readonly options: readonly ElectionOption[];

  private readonly startTimestamp: number;
  private readonly endTimestamp: number;

  constructor(config: ElectionConfig) {
    const title = config.title.trim();
    if (!title) {
      throw new ElectionValidationError('O título da eleição é obrigatório');
    }

    if (!ELECTION_TYPES.includes(config.type)) {
      throw new ElectionValidationError(`Tipo de eleição não suportado: ${String(config.type)}`);
    }

    const startTimestamp = config.startDate.getTime();
    const endTimestamp = config.endDate.getTime();

    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      throw new ElectionValidationError('As datas da eleição devem ser válidas');
    }

    if (endTimestamp < startTimestamp) {
      throw new ElectionValidationError('A data de término não pode ser anterior à data de início');
    }

    if (config.options.length < 2) {
      throw new ElectionValidationError('A eleição deve ter no mínimo duas opções');
    }

    const optionIds = new Set<string>();
    const options = config.options.map((option) => {
      const id = option.id.trim();
      const optionTitle = option.title.trim();

      if (!id || !optionTitle) {
        throw new ElectionValidationError('Cada opção deve ter um identificador e um título');
      }

      if (optionIds.has(id)) {
        throw new ElectionValidationError(`O identificador da opção deve ser único: ${id}`);
      }

      optionIds.add(id);
      return Object.freeze({ id, title: optionTitle });
    });

    this.title = title;
    this.type = config.type;
    this.startTimestamp = startTimestamp;
    this.endTimestamp = endTimestamp;
    this.options = Object.freeze(options);
  }

  statusAt(date: Date): ElectionStatus {
    const timestamp = date.getTime();
    if (!Number.isFinite(timestamp)) {
      throw new ElectionValidationError('A data informada deve ser válida');
    }

    if (timestamp < this.startTimestamp) {
      return 'scheduled';
    }

    if (timestamp >= this.endTimestamp) {
      return 'closed';
    }

    return 'open';
  }

  get startDate(): Date {
    return new Date(this.startTimestamp);
  }

  get endDate(): Date {
    return new Date(this.endTimestamp);
  }
}
