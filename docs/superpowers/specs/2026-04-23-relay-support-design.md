# Relay Support — Design Spec

**Date:** 2026-04-23
**Feature:** Phase 6 — Relay race support

---

## Overview

Add relay race support to TeamTimer. Relay races use the same core timing model as individual races (taps → splits, one entry per team) but require per-leg athlete assignment, a dedicated live cell showing the current runner, and a leg-grouped review layout. No schema changes are needed — `relay_legs` and all required columns already exist.

---

## Decisions

- **Legs:** Always 4 (4×400, 4×800, 4×1600, etc.)
- **Teams per race:** 1–4 (same as individual slots)
- **Athlete assignment:** Required at setup — each leg must have an athlete assigned before the race starts
- **Pacing/targets:** Not supported for relay in v1 — setup skips the pacing step entirely
- **Change button:** Pulls from the full athlete roster (not just preset team members), to support true last-minute substitutions
- **Review layout:** Flat list with divider rows at each leg boundary

---

## Data Layer

### No schema changes

`relay_legs` table already exists:
```
relay_legs
  id            TEXT PK
  race_entry_id TEXT NOT NULL FK race_entries.id
  leg_index     INTEGER NOT NULL   -- 0–3
  athlete_id    TEXT NOT NULL FK athletes.id
  UNIQUE (race_entry_id, leg_index)
```

`createRace()` in `src/repos/races.ts` already accepts and inserts the `legs` array in `CreateRaceInput`. No changes to `createRace`.

### New functions in `src/repos/races.ts`

```typescript
// RelayLeg is the Drizzle-inferred type from src/db/schema.ts:
// import { type RelayLeg } from '@/db/schema';

/** Returns all relay legs for an entry, sorted by legIndex ascending. */
export async function getRelayLegsForEntry(raceEntryId: string): Promise<RelayLeg[]>

/** Updates the athlete assignment for a single relay leg. */
export async function updateRelayLegAthlete(relayLegId: string, athleteId: string): Promise<void>
```

---

## Race Setup (`app/race/setup.tsx`)

### Kind selector

Unchanged — existing `individual | relay` chip selector on step 1.

### Step 2 — Teams (relay branch)

When `kind === 'relay'`, the athlete-slot UI is replaced with a team builder:

- Each slot has a **team name text input** and an **inline accordion** with 4 athlete pickers (Leg 1–4)
- Only one accordion is expanded at a time; tapping a collapsed slot collapses the current open one
- Athlete picker uses the same full-roster picker as individual setup
- "Next" is disabled until every added team has a name and all 4 legs assigned

### Step 3 — Pacing

Hidden entirely when `kind === 'relay'`. Step 2 "Next" goes straight to `createRace()` and navigates to the live screen.

### `createRace()` call (relay)

```typescript
await createRace({
  kind: 'relay',
  distanceM,
  lapDistanceM,
  meetId,
  entries: teams.map((team, slotIndex) => ({
    slotIndex,
    teamName: team.name,
    athleteId: null,
    legs: team.legs.map((athleteId, legIndex) => ({ legIndex, athleteId })),
  })),
});
```

---

## `RelayCell` Component (`src/components/RelayCell.tsx`)

### Props

```typescript
type RelayCellProps = {
  teamName: string;
  slotIndex: 0 | 1 | 2 | 3;
  currentLegIndex: number;          // 0–3; capped at 3 even when finished
  legRunnerNames: string[];         // length 4 — one name per leg, by legIndex
  capturedAts: number[];            // all splits for this entry so far
  startedAt: number;                // race.startedAt (ms epoch)
  expectedLaps: number;             // e.g. 8 for 4×800
  onTap: () => void;
  onChangeLeg: () => void;          // opens modal athlete picker for current leg
  finished: boolean;
};
```

### Layout (runner-first)

```
┌─────────────────────────────────────┐
│ Leg 2/4 · Team A          [Change]  │
│ Jake Torres                         │
│                                     │
│  Leg time    Laps     Total         │
│  1:23.4      1/2      3:21.8        │
│                                     │
│  L1 Marcus 1:58.4                   │
└─────────────────────────────────────┘
```

- Header: `Leg {N}/4 · {teamName}` (muted, small)
- Change button: top-right, opens athlete picker for current leg only
- Runner name: `legRunnerNames[currentLegIndex]`, large, white
- Leg time: gold (`colors.warning`), large — elapsed since last baton exchange
- Laps in current leg: `{lapsCompleted} / {lapsPerLeg}`
- Cumulative total: muted
- Completed leg chips at bottom: `L{n} {legRunnerNames[n-1]} {legTotal}` for each completed leg
- When `finished`: dims cell, shows "DONE" (same as `AthleteCell`)

### Timing derivation (all computed from props, no internal state)

```typescript
const lapsPerLeg = expectedLaps / 4;
const lapsInCurrentLeg = capturedAts.length - currentLegIndex * lapsPerLeg;
const legStartAt = currentLegIndex === 0
  ? startedAt
  : capturedAts[currentLegIndex * lapsPerLeg - 1];
// legElapsedMs = now - legStartAt  (passed from race clock ticker)
// completedLegMs[i] = capturedAts[(i+1)*lapsPerLeg - 1] - (i===0 ? startedAt : capturedAts[i*lapsPerLeg - 1])
```

---

## Live Screen Changes (`app/race/[id]/live.tsx`)

### Data loading (relay additions)

After loading entries, for each entry fetch relay legs in parallel:

```typescript
const relayLegsMap = race.kind === 'relay'
  ? Object.fromEntries(
      await Promise.all(
        entries.map(async e => [e.id, await getRelayLegsForEntry(e.id)])
      )
    )
  : {};
```

Athlete names for relay legs are resolved via `getAthlete(leg.athleteId)` at load time and stored in a lookup map.

### Rendering

- Same 1/2/2×2 grid layout as individual
- When `race.kind === 'relay'`: render `<RelayCell>` instead of `<AthleteCell>`
- `currentLegIndex = Math.min(3, Math.floor(entry.splits.length / lapsPerLeg))`
- `legRunnerNames` built from relay legs map + athlete name map (length-4 array, one name per leg)

### Change button

`onChangeLeg` opens a new `ChangeAthleteModal` — a `Modal` overlay with a scrollable `FlatList` of all non-archived athletes. On selection:
1. Calls `updateRelayLegAthlete(relayLeg.id, newAthleteId)`
2. Refreshes `legRunnerNames` in local state for this entry

Only the currently-active leg can be changed (legs already completed are locked).

### Tap logic

Unchanged — `appendSplit` is called identically. `RelayCell` derives leg transitions from split count automatically. No special baton-exchange action.

---

## Review Screen Changes (`app/race/[id]/review.tsx`)

### Data loading (relay addition)

For each entry, fetch relay legs alongside splits:
```typescript
if (race.kind === 'relay') {
  relayLegs = await getRelayLegsForEntry(entry.id);
}
```

### Relay rendering (flat list with leg dividers)

```
Leg 1 · Marcus Webb · 1:58.4          ← divider row
  Lap 1    58.2    0:58.2
  Lap 2    1:00.2  1:58.4
Leg 2 · Jake Torres · 1:56.1          ← divider row
  Lap 3    57.8    2:56.2
  Lap 4    58.3    3:54.5
...
Total: 7:54.1
```

- `lapsPerLeg = race.expectedLaps / 4`
- Divider row: `Leg {N} · {runnerName} · {legTotalTime}` (muted background, small caps)
- Split row: lap number (1-based, global), lap time, cumulative from race start
- Tapping a split row opens the existing edit dialog (unchanged)
- Individual branch: completely unchanged

---

## Files

| Action | Path |
|--------|-------|
| Modify | `src/repos/races.ts` — add `getRelayLegsForEntry`, `updateRelayLegAthlete` |
| Modify | `app/race/setup.tsx` — relay branch in step 2, skip pacing step |
| Modify | `app/race/[id]/live.tsx` — relay data loading + RelayCell rendering |
| Modify | `app/race/[id]/review.tsx` — relay data loading + leg-grouped rendering |
| Create | `src/components/RelayCell.tsx` |
| Create | `src/components/ChangeAthleteModal.tsx` — modal roster picker used by live screen Change button |
| Create | `tests/unit/relay-legs.test.ts` |
| Create | `tests/component/RelayCell.test.tsx` |
| Create | `tests/component/RelaySetup.test.tsx` |
| Create | `tests/component/RelayLive.test.tsx` |
| Create | `tests/component/RelayReview.test.tsx` |

---

## Tests

### Unit — `tests/unit/relay-legs.test.ts`
- `getRelayLegsForEntry` returns legs sorted by `legIndex` asc
- `updateRelayLegAthlete` updates the correct row

### Component — `tests/component/RelayCell.test.tsx`
- Displays current runner name and `Leg N/4` header
- Leg time derivation: `capturedAts` and `startedAt` produce correct elapsed
- Completed leg chips appear after baton exchanges
- `onTap` fires on press
- `onChangeLeg` fires on Change button press
- Shows "DONE" when `finished` is true

### Component — `tests/component/RelaySetup.test.tsx`
- Relay step 2 shows team name input + 4 leg pickers
- Pacing step is not rendered when `kind === 'relay'`
- "Next" disabled until all 4 legs assigned
- Accordion: tapping a slot collapses the previous and expands the new one

### Component — `tests/component/RelayLive.test.tsx`
- `RelayCell` rendered (not `AthleteCell`) when `race.kind === 'relay'`
- Change button calls `updateRelayLegAthlete` with new athlete id

### Component — `tests/component/RelayReview.test.tsx`
- Leg dividers show correct runner name and leg total time
- Per-lap splits are grouped under the correct divider
- Tapping a split row opens the edit dialog

---

## Out of Scope (v1)

- Relay leg times on the athlete improvement chart (deferred — relay legs use `relay_legs`, not direct `athlete_id` on `raceEntries`)
- Per-leg pacing targets
- Fewer than 4 legs (e.g. 2×800 sprint medley)
- Relay-specific disqualification tracking
