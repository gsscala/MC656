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
      throw new ElectionValidationError('Election title is required');
    }

    if (!ELECTION_TYPES.includes(config.type)) {
      throw new ElectionValidationError(`Unsupported election type: ${String(config.type)}`);
    }

    const startTimestamp = config.startDate.getTime();
    const endTimestamp = config.endDate.getTime();

    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      throw new ElectionValidationError('Election dates must be valid');
    }

    if (endTimestamp < startTimestamp) {
      throw new ElectionValidationError('Election end date cannot be before its start date');
    }

    if (config.options.length < 2) {
      throw new ElectionValidationError('Election must have at least two options');
    }

    const optionIds = new Set<string>();
    const options = config.options.map((option) => {
      const id = option.id.trim();
      const optionTitle = option.title.trim();

      if (!id || !optionTitle) {
        throw new ElectionValidationError('Election options require an id and title');
      }

      if (optionIds.has(id)) {
        throw new ElectionValidationError(`Election option id must be unique: ${id}`);
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
      throw new ElectionValidationError('Status date must be valid');
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
