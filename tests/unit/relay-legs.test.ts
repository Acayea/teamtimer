jest.mock('../../src/db/client', () => ({ db: {} }));

import { getRelayLegsForEntry, updateRelayLegAthlete } from '../../src/repos/races';
import { db } from '../../src/db/client';

const mockDb = db as { select: jest.Mock; update: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getRelayLegsForEntry', () => {
  it('returns legs sorted by legIndex ascending', async () => {
    const sorted = [
      { id: 'l0', raceEntryId: 'e1', legIndex: 0, athleteId: 'a1' },
      { id: 'l1', raceEntryId: 'e1', legIndex: 1, athleteId: 'a2' },
      { id: 'l2', raceEntryId: 'e1', legIndex: 2, athleteId: 'a3' },
    ];
    const orderBy = jest.fn().mockResolvedValue(sorted);
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    mockDb.select = jest.fn(() => ({ from }));

    const result = await getRelayLegsForEntry('e1');

    expect(result).toHaveLength(3);
    expect(result[0].legIndex).toBe(0);
    expect(result[1].legIndex).toBe(1);
    expect(result[2].legIndex).toBe(2);
  });

  it('calls where with the raceEntryId filter', async () => {
    const orderBy = jest.fn().mockResolvedValue([]);
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    mockDb.select = jest.fn(() => ({ from }));

    await getRelayLegsForEntry('entry-xyz');

    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });
});

describe('updateRelayLegAthlete', () => {
  it('calls db.update with the new athleteId', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn(() => ({ where }));
    mockDb.update = jest.fn(() => ({ set }));

    await updateRelayLegAthlete('leg-1', 'athlete-5');

    expect(mockDb.update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({ athleteId: 'athlete-5' });
    expect(where).toHaveBeenCalled();
  });

  it('resolves without error on valid input', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn(() => ({ where }));
    mockDb.update = jest.fn(() => ({ set }));

    await expect(updateRelayLegAthlete('leg-2', 'athlete-9')).resolves.toBeUndefined();
  });
});
