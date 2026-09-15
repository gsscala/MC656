import { Election, ElectionValidationError } from './election';
import type { ElectionConfig } from './election';

const validConfig: ElectionConfig = {
  title: 'Student council election',
  type: 'centro-academico',
  startDate: new Date('2026-10-01T12:00:00.000Z'),
  endDate: new Date('2026-10-02T12:00:00.000Z'),
  options: [
    { id: 'slate-a', title: 'Slate A' },
    { id: 'slate-b', title: 'Slate B' },
  ],
};

describe('Election', () => {
  it('creates a valid election and preserves an immutable configuration snapshot', () => {
    const startDate = new Date(validConfig.startDate);
    const options = validConfig.options.map((option) => ({ ...option }));
    const election = new Election({ ...validConfig, startDate, options });

    startDate.setUTCFullYear(2030);
    options[0]!.title = 'Changed externally';

    expect(election).toMatchObject({
      title: 'Student council election',
      type: 'centro-academico',
      options: validConfig.options,
    });
    expect(election.startDate).toEqual(validConfig.startDate);
    expect(election.endDate).toEqual(validConfig.endDate);
  });

  it('rejects a blank title', () => {
    expect(() => new Election({ ...validConfig, title: '   ' })).toThrow(
      new ElectionValidationError('Election title is required'),
    );
  });

  it('rejects unsupported election types at runtime boundaries', () => {
    const unsupportedType = 'private-poll' as ElectionConfig['type'];

    expect(() => new Election({ ...validConfig, type: unsupportedType })).toThrow(
      new ElectionValidationError('Unsupported election type: private-poll'),
    );
  });

  it('rejects an end date before the start date', () => {
    expect(
      () =>
        new Election({
          ...validConfig,
          startDate: new Date('2026-10-03T12:00:00.000Z'),
          endDate: new Date('2026-10-02T12:00:00.000Z'),
        }),
    ).toThrow(new ElectionValidationError('Election end date cannot be before its start date'));
  });

  it('rejects invalid dates instead of accepting an unordered election', () => {
    expect(
      () => new Election({ ...validConfig, endDate: new Date('invalid') }),
    ).toThrow(new ElectionValidationError('Election dates must be valid'));
  });

  it('requires at least two voting options', () => {
    expect(
      () => new Election({ ...validConfig, options: [{ id: 'only', title: 'Only option' }] }),
    ).toThrow(new ElectionValidationError('Election must have at least two options'));
  });

  it('requires every option to have an identifier and title', () => {
    expect(
      () =>
        new Election({
          ...validConfig,
          options: [
            { id: '', title: 'Slate A' },
            { id: 'slate-b', title: 'Slate B' },
          ],
        }),
    ).toThrow(new ElectionValidationError('Election options require an id and title'));
  });

  it('rejects duplicate option identifiers', () => {
    expect(
      () =>
        new Election({
          ...validConfig,
          options: [
            { id: 'same-id', title: 'Slate A' },
            { id: 'same-id', title: 'Slate B' },
          ],
        }),
    ).toThrow(new ElectionValidationError('Election option id must be unique: same-id'));
  });

  it('reports scheduled, open, and closed across lifecycle boundaries', () => {
    const election = new Election(validConfig);

    expect(election.statusAt(new Date('2026-10-01T11:59:59.999Z'))).toBe('scheduled');
    expect(election.statusAt(new Date('2026-10-01T12:00:00.000Z'))).toBe('open');
    expect(election.statusAt(new Date('2026-10-02T11:59:59.999Z'))).toBe('open');
    expect(election.statusAt(new Date('2026-10-02T12:00:00.000Z'))).toBe('closed');
  });

  it('rejects an invalid date when calculating lifecycle status', () => {
    const election = new Election(validConfig);

    expect(() => election.statusAt(new Date('invalid'))).toThrow(
      new ElectionValidationError('Status date must be valid'),
    );
  });
});
