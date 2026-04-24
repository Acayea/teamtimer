# Athlete Improvement Charts — Design Spec

**Date:** 2026-04-23
**Feature:** Phase 5 — Athlete detail screen with per-distance improvement charts

---

## Overview

Replace the placeholder `app/(tabs)/athletes/[id].tsx` with a full athlete detail screen. The screen shows a per-athlete improvement trend for each distance they have run, with contextual PR display and a filterable race history list.

---

## Screen Structure

`app/(tabs)/athletes/[id].tsx` is a scrollable page with five zones, rendered top to bottom:

### 1. Header
- Athlete name (large)
- Subtitle: "N races recorded" (total completed races across all distances)
- Edit button (top-right) → navigates to existing `app/athletes/[id]/edit.tsx`

### 2. Distance tabs
- One tab per distance the athlete has at least one completed race at
- Sorted shortest distance first (e.g. 800m → 1600m → 3200m)
- Horizontally scrollable if many distances
- **Default selected tab = the distance of the athlete's most recent completed race**
- Switching tabs updates zones 3, 4, and 5

### 3. PR card
- Updates when the selected tab changes
- Shows: distance label, PR time (formatted `M:SS.hh`, gold `#EAB308`), meet name (or "Practice" if no meet), date of the PR race
- If the athlete has exactly one race at this distance, the PR card still shows — it is both their only time and their PR

### 4. Chart (`ImprovementChart` component)
- See Component section below
- Tapping any dot navigates to `app/race/[id]/review`

### 5. Race list
- Filtered to the selected distance only
- Sorted most recent first
- Each row: meet name (or "Practice"), date, lap count, final cumulative time
- PR row has a gold star (★) suffix on the time
- Tapping a row navigates to `app/race/[id]/review`

### Empty states
- **No completed races at any distance:** full-screen message — *"No completed races yet."*
- **Selected distance has exactly 1 race:** chart renders one dot (no line), with message below the chart — *"Complete one more [distance] race to see your trend."*

---

## Data Layer

### New query: `getAthleteRaces(athleteId: string)`

Location: `src/repos/athletes.ts`

Joins: `raceEntries → races → splits → meets`

Filters:
- `raceEntries.athlete_id = athleteId`
- `races.status = 'completed'`
- Excludes relay entries (`races.kind = 'relay'` entries where the athlete was a relay leg are out of scope for v1 charting)

Returns: `AthleteRaceResult[]` sorted by `races.started_at` ascending.

```typescript
type AthleteRaceResult = {
  raceId: string;
  raceEntryId: string;
  distanceM: number;
  meetName: string | null;   // null = ad-hoc / practice
  startedAt: number;         // ms epoch — used as x-axis date label
  finalCumulativeMs: number; // captured_at of last split − races.started_at
  lapCount: number;          // number of splits recorded for this entry
};
```

`finalCumulativeMs` is derived by finding the split with the highest `lap_index` for each `raceEntryId`, then computing `split.captured_at - race.started_at`.

### PR computation
No changes to `src/domain/timing.ts`. The screen derives PR per distance client-side using the existing `prMs(times: number[])` function applied to each distance group from `AthleteRaceResult[]`.

### No schema changes required.

---

## `ImprovementChart` Component

Location: `src/components/ImprovementChart.tsx`

### Props
```typescript
type ImprovementChartProps = {
  data: { raceId: string; startedAt: number; cumulativeMs: number }[];
  color: string;          // line/dot color; athlete detail screen passes '#3B82F6'
  prMs: number;           // cumulative time of the PR race for this distance
  onDotPress: (raceId: string) => void;
};
```

Data is passed pre-sorted by `startedAt` ascending.

### Dimensions
- Height: 160px fixed
- Width: full container width, measured via `onLayout`
- Left margin reserved for y-axis labels: 38px
- Bottom margin reserved for x-axis labels: 18px
- Drawable area: `(containerWidth - 38) × (160 - 18)`

### Y-axis (time)
- Auto-scales to `[min(cumulativeMs) - 2000, max(cumulativeMs) + 2000]` (2-second padding)
- 4 evenly-spaced gridlines and labels
- Labels formatted with `formatMs()` from `src/domain/timing.ts`
- Faster times are higher on the chart (lower y coordinate)

### X-axis (race sequence)
- **Evenly-spaced slots** — data points are placed at equal horizontal intervals regardless of calendar gaps between races
- N points → x positions: `leftPad + i * (drawableWidth / (N - 1))` for i = 0…N-1 (for N=1, center the single point)
- Labels: race date formatted as `MMM D` (e.g. "Apr 18"), rendered below the chart area

### Dot rendering (react-native-svg)
- Normal dot: `<Circle>` radius 5, fill = `color` prop, wrapped in `<G>` with `onPress`
- PR dot: `<Circle>` radius 7, fill `#EAB308`, with a concentric inner `<Circle>` radius 3, fill = background color `#0A0A0A`
- Line: `<Polyline>` connecting all points in order, stroke = `color` prop, strokeWidth 2.5

### Single-point state
- Renders one centered dot, no polyline, no axes
- Message rendered outside SVG (below): *"Complete one more [distance] race to see your trend."*

### Empty state (data.length === 0)
- Component renders nothing (`null`) — the parent screen handles the empty state message

---

## Files

| Action | Path |
|--------|------|
| Replace (currently placeholder) | `app/(tabs)/athletes/[id].tsx` |
| Create | `src/components/ImprovementChart.tsx` |
| Modify | `src/repos/athletes.ts` — add `getAthleteRaces` |
| Create | `tests/unit/athlete-races.test.ts` |
| Create | `tests/component/ImprovementChart.test.tsx` |
| Create | `tests/component/AthleteDetail.test.tsx` |

---

## Tests

### Unit — `tests/unit/athlete-races.test.ts`
- `getAthleteRaces` returns only completed races for the given athlete
- `getAthleteRaces` excludes entries belonging to other athletes in the same race
- `getAthleteRaces` returns `[]` when the athlete has no completed races
- `finalCumulativeMs` is computed correctly from the last split's `captured_at` minus `started_at`

### Component — `tests/component/ImprovementChart.test.tsx`
- Returns `null` when `data` is empty
- Renders one dot and no `<Polyline>` when `data` has a single entry
- PR dot fill is `#EAB308`; non-PR dots use the `color` prop
- `onDotPress` is called with the correct `raceId` when a dot is pressed

### Component — `tests/component/AthleteDetail.test.tsx`
- Defaults to the most-recently-raced distance tab on mount
- PR card shows the correct time and date for the selected distance
- Switching tabs updates the PR card and passes the correct data to `ImprovementChart`
- Race list shows only races for the selected distance
- Tapping a race row navigates to `race/[id]/review`
- Full empty state renders when the athlete has no completed races

---

## Out of Scope (v1)

- Relay leg times on the improvement chart (relay races use `relay_legs`, not direct `athlete_id` on `raceEntries` — deferred to v1.1)
- Filtering by date range or meet
- Comparing two athletes on the same chart
- Exporting chart data
