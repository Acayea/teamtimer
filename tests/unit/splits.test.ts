jest.mock('../../src/db/client', () => {
  const txState = { lastFn: null as unknown };
  const tx = {
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
    delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    select: jest.fn(),
  };
  const db = {
    __tx: tx,
    __state: txState,
    transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => {
      txState.lastFn = fn;
      await fn(tx);
    }),
  };
  return { db };
});

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'fixed-uuid'),
}));

import { appendSplit, undoLastSplit } from '../../src/repos/splits';
import { db } from '../../src/db/client';

type MockTx = {
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  select: jest.Mock;
};
type MockDb = { __tx: MockTx; transaction: jest.Mock };

const mockDb = db as unknown as MockDb;
const tx = mockDb.__tx;

beforeEach(() => {
  jest.clearAllMocks();
  // re-wire default chain mocks since clearAllMocks resets implementations
  tx.insert.mockImplementation(() => ({ values: jest.fn().mockResolvedValue(undefined) }));
  tx.update.mockImplementation(() => ({
    set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  }));
  tx.delete.mockImplementation(() => ({ where: jest.fn().mockResolvedValue(undefined) }));
});

function mockExpectedLaps(expectedLaps: number) {
  // First select call: raceEntries → returns [{ raceId }]
  // Second select call: races → returns [{ expectedLaps }]
  let call = 0;
  tx.select.mockImplementation(() => ({
    from: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(
        call++ === 0 ? [{ raceId: 'race-1' }] : [{ expectedLaps }],
      ),
    })),
  }));
}

function mockLastSplit(lapIndex: number | null) {
  // First select: last split (orderBy + limit)
  // Then expectedLaps lookups (two more selects)
  let call = 0;
  tx.select.mockImplementation(() => {
    const idx = call++;
    if (idx === 0) {
      return {
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest
                .fn()
                .mockResolvedValue(
                  lapIndex === null
                    ? []
                    : [{ id: 'split-x', lapIndex, raceEntryId: 'entry-1', capturedAt: 0, edited: false }],
                ),
            })),
          })),
        })),
      };
    }
    return {
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(
          idx === 1 ? [{ raceId: 'race-1' }] : [{ expectedLaps: 4 }],
        ),
      })),
    };
  });
}

describe('appendSplit', () => {
  it('returns { id, capturedAt } with the inserted UUID and a timestamp', async () => {
    mockExpectedLaps(4);
    const before = Date.now();
    const result = await appendSplit('entry-1', 0);
    const after = Date.now();
    expect(result.id).toBe('fixed-uuid');
    expect(result.capturedAt).toBeGreaterThanOrEqual(before);
    expect(result.capturedAt).toBeLessThanOrEqual(after);
  });

  it('sets finishedAt on raceEntries when on the final lap', async () => {
    mockExpectedLaps(4);
    await appendSplit('entry-1', 3);
    expect(tx.update).toHaveBeenCalled();
  });

  it('does NOT set finishedAt when not on the final lap', async () => {
    mockExpectedLaps(4);
    await appendSplit('entry-1', 2);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('runs inside a single db.transaction', async () => {
    mockExpectedLaps(4);
    await appendSplit('entry-1', 0);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('undoLastSplit', () => {
  it('does nothing when entry has no splits', async () => {
    mockLastSplit(null);
    await undoLastSplit('entry-1');
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('clears finishedAt when removing the final lap', async () => {
    mockLastSplit(3); // expectedLaps=4, so 3 is the final lap
    await undoLastSplit('entry-1');
    expect(tx.delete).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
  });

  it('does NOT clear finishedAt when removing a non-final lap', async () => {
    mockLastSplit(2); // expectedLaps=4, so 2 is NOT final
    await undoLastSplit('entry-1');
    expect(tx.delete).toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('runs inside a single db.transaction', async () => {
    mockLastSplit(0);
    await undoLastSplit('entry-1');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});
