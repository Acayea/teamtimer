// The athletes module imports db at module level; mock it so this
// pure-function test can import without a real SQLite connection.
jest.mock('../../src/db/client', () => ({
  db: {},
}));

import { buildAthleteRaceResults } from '../../src/repos/athletes';

const BASE = {
  raceId: 'race-1',
  raceEntryId: 'entry-1',
  distanceM: 800,
  meetName: 'County Champs' as string | null,
  startedAt: 1_000_000 as number | null,
};

describe('buildAthleteRaceResults', () => {
  it('returns empty array for empty input', () => {
    expect(buildAthleteRaceResults([])).toEqual([]);
  });

  it('computes finalCumulativeMs from the last split', () => {
    const rows = [
      { ...BASE, lapIndex: 0, capturedAt: 1_062_000 },
      { ...BASE, lapIndex: 1, capturedAt: 1_124_000 },
    ];
    const results = buildAthleteRaceResults(rows);
    expect(results).toHaveLength(1);
    expect(results[0].finalCumulativeMs).toBe(124_000); // 1_124_000 - 1_000_000
  });

  it('counts laps correctly', () => {
    const rows = [
      { ...BASE, lapIndex: 0, capturedAt: 1_062_000 },
      { ...BASE, lapIndex: 1, capturedAt: 1_124_000 },
      { ...BASE, lapIndex: 2, capturedAt: 1_188_000 },
      { ...BASE, lapIndex: 3, capturedAt: 1_252_000 },
    ];
    expect(buildAthleteRaceResults(rows)[0].lapCount).toBe(4);
  });

  it('separates rows from different race entries into separate results', () => {
    const rows = [
      { ...BASE, raceId: 'race-1', raceEntryId: 'entry-1', startedAt: 1_000_000, lapIndex: 0, capturedAt: 1_062_000 },
      { ...BASE, raceId: 'race-1', raceEntryId: 'entry-1', startedAt: 1_000_000, lapIndex: 1, capturedAt: 1_124_000 },
      { raceId: 'race-2', raceEntryId: 'entry-2', distanceM: 800, meetName: null, startedAt: 2_000_000, lapIndex: 0, capturedAt: 2_061_000 },
      { raceId: 'race-2', raceEntryId: 'entry-2', distanceM: 800, meetName: null, startedAt: 2_000_000, lapIndex: 1, capturedAt: 2_121_000 },
    ];
    const results = buildAthleteRaceResults(rows);
    expect(results).toHaveLength(2);
    expect(results[0].finalCumulativeMs).toBe(124_000);
    expect(results[1].finalCumulativeMs).toBe(121_000);
  });

  it('sorts results by startedAt ascending', () => {
    const rows = [
      { raceId: 'race-2', raceEntryId: 'entry-2', distanceM: 800, meetName: null, startedAt: 2_000_000, lapIndex: 0, capturedAt: 2_062_000 },
      { raceId: 'race-1', raceEntryId: 'entry-1', distanceM: 800, meetName: null, startedAt: 1_000_000, lapIndex: 0, capturedAt: 1_062_000 },
    ];
    const results = buildAthleteRaceResults(rows);
    expect(results[0].raceId).toBe('race-1');
    expect(results[1].raceId).toBe('race-2');
  });

  it('preserves meetName (including null)', () => {
    const rows = [{ ...BASE, meetName: null, lapIndex: 0, capturedAt: 1_062_000 }];
    expect(buildAthleteRaceResults(rows)[0].meetName).toBeNull();
  });
});
