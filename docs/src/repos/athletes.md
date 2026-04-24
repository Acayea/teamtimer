# athletes repo

`src/repos/athletes.ts`

This file contains the standard CRUD helpers for the `athletes` table as well as the race-history exports described below.

---

## `AthleteRaceResult` (type)

A single completed race result for one athlete, aggregated from multiple split rows.

```typescript
export type AthleteRaceResult = {
  raceId: string;            // PK of the races row
  raceEntryId: string;       // PK of the race_entries row for this athlete
  distanceM: number;         // Race distance in meters (e.g. 800, 1600)
  meetName: string | null;   // Name of the meet, or null when the race was a practice
  startedAt: number;         // Unix timestamp in ms (ms epoch) when the race started
  finalCumulativeMs: number; // Athlete's finish time in ms, computed as
                             //   last split capturedAt − races.startedAt
  lapCount: number;          // Number of laps completed (= number of splits rows)
};
```

All time values use milliseconds. `startedAt` is an ms-epoch timestamp (`Date.now()` scale). `finalCumulativeMs` and lap-split times are durations in ms. `distanceM` is in meters.

---

## `buildAthleteRaceResults(rows)`

Pure function — no database access, no side effects.

Groups a flat array of raw DB rows (one row per split) into one `AthleteRaceResult` per race entry, then sorts the results by `startedAt` ascending.

### Parameters

| Parameter | Type        | Description |
|-----------|-------------|-------------|
| `rows`    | `RawRow[]`  | Flat array of join-query rows. Each row has `raceId`, `raceEntryId`, `distanceM`, `meetName`, `startedAt`, `lapIndex`, and `capturedAt`. **Rows must be ordered by `lapIndex` asc within each race entry** so that the first row in a group represents lap 0 and the last row represents the final lap. |

### Returns

`AthleteRaceResult[]` — one element per unique `raceEntryId`, sorted by `startedAt` ascending (oldest race first).

### Algorithm

1. Groups rows by `raceEntryId` using a `Map`, preserving insertion order within each group.
2. For each group, takes `first.startedAt` as the race start time and `last.capturedAt` as the final split timestamp. `finalCumulativeMs = last.capturedAt - startedAt`.
3. Sorts the resulting array by `startedAt` ascending before returning.

### Usage

```typescript
const rows = await db.select({ ... }).from(raceEntries).innerJoin(splits, ...).orderBy(asc(splits.lapIndex));
const results = buildAthleteRaceResults(rows);
```

---

## `getAthleteRaces(athleteId)`

Async DB query. Returns all completed individual races for a single athlete, sorted by `startedAt` ascending.

### Parameters

| Parameter   | Type     | Description |
|-------------|----------|-------------|
| `athleteId` | `string` | The PK of the athlete row to query for |

### Joins

- `raceEntries` (base table) — filters `athleteId = athleteId`
- `races` (inner join on `raceEntries.raceId`) — filters `status = 'completed'`, `kind = 'individual'`, `startedAt IS NOT NULL`
- `meets` (left join on `races.meetId`) — provides `meetName`; nullable because practice races have no meet
- `splits` (inner join on `splits.raceEntryId`) — provides one row per lap

### Filters applied

| Column              | Condition            | Reason |
|---------------------|----------------------|--------|
| `raceEntries.athleteId` | `= athleteId`    | Scope to this athlete |
| `races.status`      | `= 'completed'`      | Exclude in-progress or discarded races |
| `races.kind`        | `= 'individual'`     | Exclude relay races (relay entries do not carry `athleteId` directly) |
| `races.startedAt`   | `IS NOT NULL`        | Ensures `finalCumulativeMs` can be computed; makes the `!` assertion in `buildAthleteRaceResults` safe |

### Ordering

Results are ordered `races.startedAt ASC, splits.lapIndex ASC` before being passed to `buildAthleteRaceResults`, which relies on `lapIndex` order to identify the final split. The returned `AthleteRaceResult[]` is also sorted by `startedAt` ascending.

### Returns

`Promise<AthleteRaceResult[]>` — oldest race first.

### Usage

```typescript
const results = await getAthleteRaces('athlete-uuid');
// results[results.length - 1] is the most recently raced result
```
