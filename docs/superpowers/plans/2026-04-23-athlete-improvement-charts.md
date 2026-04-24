# Athlete Improvement Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder athlete detail screen with a scrollable page showing a per-distance PR card, SVG improvement chart, and filtered race list.

**Architecture:** Three tasks in dependency order: (1) data layer — add `getAthleteRaces` query and the pure `buildAthleteRaceResults` helper; (2) `ImprovementChart` component using react-native-svg with auto-scaled y-axis and evenly-spaced x-axis; (3) the athlete detail screen that wires them together. No schema changes required — all the data is already in the DB.

**Tech Stack:** Expo Router · TypeScript strict · expo-sqlite + Drizzle ORM · react-native-svg · Jest + React Native Testing Library

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/repos/athletes.ts` | Add `AthleteRaceResult` type, `buildAthleteRaceResults` pure helper, `getAthleteRaces` query |
| Create | `tests/unit/athlete-races.test.ts` | Unit tests for `buildAthleteRaceResults` |
| Create | `src/components/ImprovementChart.tsx` | SVG line chart; auto-scaled y, evenly-spaced x, tappable dots |
| Create | `tests/component/ImprovementChart.test.tsx` | Component tests for chart rendering and interaction |
| Replace | `app/(tabs)/athletes/[id].tsx` | Full athlete detail screen (was placeholder) |
| Create | `tests/component/AthleteDetail.test.tsx` | Component tests for screen logic and navigation |

---

## Task 1: `getAthleteRaces` query + `buildAthleteRaceResults` helper

**Files:**
- Modify: `src/repos/athletes.ts`
- Create: `tests/unit/athlete-races.test.ts`

### Background for implementer

`src/repos/athletes.ts` currently exports five functions (`listAthletes`, `getAthlete`, `createAthlete`, `updateAthlete`, `archiveAthlete`). You will add a new exported type, a new pure exported helper, and a new async query function. Do not modify existing functions.

The DB schema relevant here:
- `raceEntries`: `id`, `race_id`, `athlete_id` (nullable), `slot_index`
- `races`: `id`, `meet_id` (nullable FK → meets), `kind` (`'individual'|'relay'`), `distance_m`, `started_at`, `status` (`'completed'` etc.)
- `meets`: `id`, `name`
- `splits`: `id`, `race_entry_id`, `lap_index`, `captured_at`

The query joins these four tables to get every completed individual race for one athlete, with all split rows. The pure helper `buildAthleteRaceResults` groups the flat rows by `raceEntryId`, picks the last split (highest `lap_index`) per entry, and computes `finalCumulativeMs = lastSplit.capturedAt - race.startedAt`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/athlete-races.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/code/teamtimer && pnpm test tests/unit/athlete-races.test.ts --forceExit
```

Expected: FAIL — `buildAthleteRaceResults` is not exported from `src/repos/athletes`.

- [ ] **Step 3: Implement `buildAthleteRaceResults`, `AthleteRaceResult`, and `getAthleteRaces`**

Replace the full content of `src/repos/athletes.ts` with:

```typescript
// src/repos/athletes.ts
import { and, eq, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { athletes, races, raceEntries, meets, splits, type Athlete } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export async function listAthletes(): Promise<Athlete[]> {
  return db.select().from(athletes).where(isNull(athletes.archivedAt)).orderBy(asc(athletes.name));
}

export async function getAthlete(id: string): Promise<Athlete | undefined> {
  const rows = await db.select().from(athletes).where(eq(athletes.id, id));
  return rows[0];
}

export async function createAthlete(
  data: Pick<Athlete, 'name' | 'dateOfBirth' | 'notes'>,
): Promise<Athlete> {
  const id = randomUUID();
  const now = Date.now();
  await db.insert(athletes).values({ id, createdAt: now, archivedAt: null, ...data });
  return (await getAthlete(id))!;
}

export async function updateAthlete(
  id: string,
  data: Partial<Pick<Athlete, 'name' | 'dateOfBirth' | 'notes'>>,
): Promise<void> {
  await db.update(athletes).set(data).where(eq(athletes.id, id));
}

export async function archiveAthlete(id: string): Promise<void> {
  await db.update(athletes).set({ archivedAt: Date.now() }).where(eq(athletes.id, id));
}

// ─── Athlete race history ────────────────────────────────────────────────────

export type AthleteRaceResult = {
  raceId: string;
  raceEntryId: string;
  distanceM: number;
  meetName: string | null;
  startedAt: number;
  finalCumulativeMs: number;
  lapCount: number;
};

type RawRow = {
  raceId: string;
  raceEntryId: string;
  distanceM: number;
  meetName: string | null;
  startedAt: number | null;
  lapIndex: number;
  capturedAt: number;
};

/** Pure helper — groups flat DB rows (one per split) into one result per race entry. */
export function buildAthleteRaceResults(rows: RawRow[]): AthleteRaceResult[] {
  const entryMap = new Map<string, RawRow[]>();
  for (const row of rows) {
    if (!entryMap.has(row.raceEntryId)) entryMap.set(row.raceEntryId, []);
    entryMap.get(row.raceEntryId)!.push(row);
  }

  const results: AthleteRaceResult[] = [];
  for (const [raceEntryId, entryRows] of entryMap) {
    const first = entryRows[0];
    const last = entryRows[entryRows.length - 1]; // highest lapIndex (rows are ordered by lapIndex asc)
    const startedAt = first.startedAt!;
    results.push({
      raceId: first.raceId,
      raceEntryId,
      distanceM: first.distanceM,
      meetName: first.meetName,
      startedAt,
      finalCumulativeMs: last.capturedAt - startedAt,
      lapCount: entryRows.length,
    });
  }

  results.sort((a, b) => a.startedAt - b.startedAt);
  return results;
}

/**
 * Returns all completed individual races for an athlete, sorted by startedAt ascending.
 * Relay races are excluded (athlete_id is not set on relay raceEntries directly).
 */
export async function getAthleteRaces(athleteId: string): Promise<AthleteRaceResult[]> {
  const rows = await db
    .select({
      raceId: races.id,
      raceEntryId: raceEntries.id,
      distanceM: races.distanceM,
      meetName: meets.name,
      startedAt: races.startedAt,
      lapIndex: splits.lapIndex,
      capturedAt: splits.capturedAt,
    })
    .from(raceEntries)
    .innerJoin(races, eq(raceEntries.raceId, races.id))
    .leftJoin(meets, eq(races.meetId, meets.id))
    .innerJoin(splits, eq(splits.raceEntryId, raceEntries.id))
    .where(
      and(
        eq(raceEntries.athleteId, athleteId),
        eq(races.status, 'completed'),
        eq(races.kind, 'individual'),
      ),
    )
    .orderBy(asc(races.startedAt), asc(splits.lapIndex));

  return buildAthleteRaceResults(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/code/teamtimer && pnpm test tests/unit/athlete-races.test.ts --forceExit
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
cd /root/code/teamtimer && pnpm test --forceExit
```

Expected: all previously passing tests still pass.

---

## Task 2: `ImprovementChart` component

**Files:**
- Create: `src/components/ImprovementChart.tsx`
- Create: `tests/component/ImprovementChart.test.tsx`

### Background for implementer

This component renders a line chart using `react-native-svg` (already installed at `^15.15.4`). It is used on the athlete detail screen to show improvement over time for a single distance.

Key design decisions:
- **Y-axis auto-scales** to `[min(cumulativeMs) - 2000ms, max(cumulativeMs) + 2000ms]`. Faster (smaller) times appear higher on the chart.
- **X-axis is evenly spaced** — data points are placed at equal intervals regardless of calendar distance between races, labeled with formatted dates.
- The dot for the PR race is rendered in gold (`colors.warning = '#EAB308'`) with a concentric inner circle in the background color. All other dots use the `color` prop.
- When `data.length === 0`, the component returns `null` (parent handles the empty state).
- When `data.length === 1`, the component renders one centered dot with no line and no axes (parent renders the single-point message).
- Container width is measured via `onLayout`; the SVG is not rendered until width > 0.

Color constants: `colors.warning = '#EAB308'`, `colors.background = '#0A0A0A'`, `colors.border = '#2E2E2E'` (from `src/theme/colors.ts`).

- [ ] **Step 1: Write failing component tests**

Create `tests/component/ImprovementChart.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ImprovementChart } from '../../src/components/ImprovementChart';

// Mock react-native-svg — replace SVG primitives with testable RN equivalents
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { TouchableOpacity, View } = require('react-native');
  return {
    default: ({ children }: any) => React.createElement(View, { testID: 'svg' }, children),
    Svg: ({ children }: any) => React.createElement(View, { testID: 'svg' }, children),
    Circle: ({ onPress, testID, fill }: any) =>
      React.createElement(TouchableOpacity, { onPress, testID, accessibilityLabel: String(fill) }),
    Polyline: ({ testID }: any) =>
      React.createElement(View, { testID: testID ?? 'polyline' }),
    Line: () => null,
  };
});

const onDotPress = jest.fn();

const TWO_POINTS = [
  { raceId: 'r1', startedAt: 1_000_000, cumulativeMs: 124_000 },
  { raceId: 'r2', startedAt: 2_000_000, cumulativeMs: 118_400 },
];

function triggerLayout(getByTestId: (id: string) => any) {
  act(() => {
    fireEvent(getByTestId('chart-container'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 160, x: 0, y: 0 } },
    });
  });
}

describe('ImprovementChart', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when data is empty', () => {
    const { toJSON } = render(
      <ImprovementChart data={[]} color="#3B82F6" prMs={0} onDotPress={onDotPress} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders one dot and no polyline when data has a single entry', () => {
    const { getByTestId, queryByTestId } = render(
      <ImprovementChart
        data={[{ raceId: 'r1', startedAt: 1_000_000, cumulativeMs: 124_000 }]}
        color="#3B82F6"
        prMs={124_000}
        onDotPress={onDotPress}
      />,
    );
    triggerLayout(getByTestId);
    expect(getByTestId('dot-r1')).toBeTruthy();
    expect(queryByTestId('chart-line')).toBeNull();
  });

  it('renders a polyline when data has multiple entries', () => {
    const { getByTestId } = render(
      <ImprovementChart data={TWO_POINTS} color="#3B82F6" prMs={118_400} onDotPress={onDotPress} />,
    );
    triggerLayout(getByTestId);
    expect(getByTestId('chart-line')).toBeTruthy();
  });

  it('PR dot accessibilityLabel is colors.warning (#EAB308)', () => {
    const { getByTestId } = render(
      <ImprovementChart data={TWO_POINTS} color="#3B82F6" prMs={118_400} onDotPress={onDotPress} />,
    );
    triggerLayout(getByTestId);
    expect(getByTestId('dot-pr').props.accessibilityLabel).toBe('#EAB308');
  });

  it('non-PR dot accessibilityLabel matches color prop', () => {
    const { getByTestId } = render(
      <ImprovementChart data={TWO_POINTS} color="#3B82F6" prMs={118_400} onDotPress={onDotPress} />,
    );
    triggerLayout(getByTestId);
    expect(getByTestId('dot-r1').props.accessibilityLabel).toBe('#3B82F6');
  });

  it('calls onDotPress with the correct raceId when a dot is pressed', () => {
    const { getByTestId } = render(
      <ImprovementChart data={TWO_POINTS} color="#3B82F6" prMs={118_400} onDotPress={onDotPress} />,
    );
    triggerLayout(getByTestId);
    fireEvent.press(getByTestId('dot-r1'));
    expect(onDotPress).toHaveBeenCalledWith('r1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/code/teamtimer && pnpm test tests/component/ImprovementChart.test.tsx --forceExit
```

Expected: FAIL — `ImprovementChart` module not found.

- [ ] **Step 3: Implement `ImprovementChart`**

Create `src/components/ImprovementChart.tsx`:

```typescript
// src/components/ImprovementChart.tsx
import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { formatMs } from '@/domain/timing';
import { colors } from '@/theme/colors';

const CHART_HEIGHT = 142; // drawable height (excludes x-axis label row)
const X_LABEL_HEIGHT = 18;
const Y_LABEL_WIDTH = 38;
const PAD_MS = 2_000;
const DOT_RADIUS = 5;
const PR_DOT_RADIUS = 7;
const PR_INNER_RADIUS = 3;
const GRID_COUNT = 4;

type DataPoint = { raceId: string; startedAt: number; cumulativeMs: number };

type Props = {
  data: DataPoint[];
  color: string;
  prMs: number;
  onDotPress: (raceId: string) => void;
};

export function ImprovementChart({ data, color, prMs, onDotPress }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  if (data.length === 0) return null;

  const drawableWidth = Math.max(0, containerWidth - Y_LABEL_WIDTH);

  // ── Single-point: centred dot, no axes, no line ──────────────────────────
  if (data.length === 1) {
    const point = data[0];
    const isPR = point.cumulativeMs === prMs;
    return (
      <View testID="chart-container" onLayout={onLayout} style={s.singleContainer}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={CHART_HEIGHT}>
            <Circle
              cx={containerWidth / 2}
              cy={CHART_HEIGHT / 2}
              r={isPR ? PR_DOT_RADIUS : DOT_RADIUS}
              fill={isPR ? colors.warning : color}
              onPress={() => onDotPress(point.raceId)}
              testID={`dot-${point.raceId}`}
            />
          </Svg>
        )}
      </View>
    );
  }

  // ── Multi-point chart ─────────────────────────────────────────────────────
  const minMs = Math.min(...data.map(d => d.cumulativeMs));
  const maxMs = Math.max(...data.map(d => d.cumulativeMs));
  const yMin = minMs - PAD_MS;
  const yMax = maxMs + PAD_MS;
  const yRange = yMax - yMin;

  const toY = (ms: number): number =>
    CHART_HEIGHT - ((ms - yMin) / yRange) * CHART_HEIGHT;

  const toX = (i: number): number =>
    (i / (data.length - 1)) * drawableWidth;

  const polylinePoints = data
    .map((d, i) => `${toX(i)},${toY(d.cumulativeMs)}`)
    .join(' ');

  const gridLabels = Array.from({ length: GRID_COUNT }, (_, i) => {
    const ms = yMin + (yRange * i) / (GRID_COUNT - 1);
    return { y: toY(ms), label: formatMs(ms) };
  });

  const formatDate = (ms: number): string =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View testID="chart-container" onLayout={onLayout}>
      {containerWidth > 0 && (
        <>
          <View style={s.row}>
            {/* Y-axis labels */}
            <View style={{ width: Y_LABEL_WIDTH, height: CHART_HEIGHT }}>
              {gridLabels.map((gl, i) => (
                <Text
                  key={i}
                  style={[s.axisLabel, { position: 'absolute', top: gl.y - 7, right: 4 }]}
                >
                  {gl.label}
                </Text>
              ))}
            </View>
            {/* SVG */}
            <Svg width={drawableWidth} height={CHART_HEIGHT}>
              {gridLabels.map((gl, i) => (
                <Line
                  key={i}
                  x1={0} y1={gl.y}
                  x2={drawableWidth} y2={gl.y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                testID="chart-line"
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const cx = toX(i);
                const cy = toY(d.cumulativeMs);
                const isPR = d.cumulativeMs === prMs;
                return (
                  <React.Fragment key={d.raceId}>
                    <Circle
                      cx={cx} cy={cy}
                      r={isPR ? PR_DOT_RADIUS : DOT_RADIUS}
                      fill={isPR ? colors.warning : color}
                      onPress={() => onDotPress(d.raceId)}
                      testID={isPR ? 'dot-pr' : `dot-${d.raceId}`}
                    />
                    {isPR && (
                      <Circle
                        cx={cx} cy={cy}
                        r={PR_INNER_RADIUS}
                        fill={colors.background}
                        onPress={() => onDotPress(d.raceId)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          {/* X-axis labels */}
          <View style={[s.row, { marginLeft: Y_LABEL_WIDTH, height: X_LABEL_HEIGHT }]}>
            {data.map((d, i) => (
              <Text
                key={d.raceId}
                style={[
                  s.axisLabel,
                  { position: 'absolute', left: toX(i) - 16, width: 32, textAlign: 'center' },
                ]}
              >
                {formatDate(d.startedAt)}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  singleContainer: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  axisLabel: { fontSize: 9, color: colors.textDisabled },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/code/teamtimer && pnpm test tests/component/ImprovementChart.test.tsx --forceExit
```

Expected: 5 tests PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
cd /root/code/teamtimer && pnpm test --forceExit
```

Expected: all previously passing tests still pass.

---

## Task 3: Athlete detail screen

**Files:**
- Replace: `app/(tabs)/athletes/[id].tsx`
- Create: `tests/component/AthleteDetail.test.tsx`

### Background for implementer

The current file is a placeholder — replace it entirely. The screen:

1. Calls `getAthlete(id)` and `getAthleteRaces(id)` in parallel via `useFocusEffect`.
2. Groups results by `distanceM` using a local pure function `groupByDistance`, sorted shortest-first.
3. Default selected tab = the `distanceM` of the last element in the race results array (which is sorted by `startedAt` asc, so last = most recently raced).
4. Renders the PR card and chart only when a distance tab is selected and that group has races.
5. Race list is the selected group's races in reverse order (most recent first). A race is the PR if `finalCumulativeMs === group.prMs`.
6. Tapping a race row or chart dot navigates to `/race/${raceId}/review`.
7. The "no completed races" empty state is shown when `groups.length === 0` (after load).
8. Single-point hint is shown below the chart when `selectedGroup.races.length === 1`.

Navigation: `router.push('/athletes/${id}/edit')` for the Edit button, `router.push('/race/${raceId}/review')` for row/dot taps.

Important: `useFocusEffect` from expo-router receives a stable callback (wrapped in `useCallback`). The pattern in this codebase is:

```typescript
useFocusEffect(load); // where load = useCallback(async () => {...}, [id])
```

- [ ] **Step 1: Write failing component tests**

Create `tests/component/AthleteDetail.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AthleteDetailScreen from '../../app/(tabs)/athletes/[id]';
import * as athletesRepo from '../../src/repos/athletes';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/repos/athletes', () => ({
  getAthlete: jest.fn(),
  getAthleteRaces: jest.fn(),
  // keep other exports as-is (not used by this screen)
  listAthletes: jest.fn(),
  createAthlete: jest.fn(),
  updateAthlete: jest.fn(),
  archiveAthlete: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'athlete-1' })),
  useRouter: jest.fn(() => ({ push: mockPush })),
  useFocusEffect: jest.fn((cb: () => void) => { cb(); }),
}));

jest.mock('../../src/components/ImprovementChart', () => ({
  ImprovementChart: ({ onDotPress, data }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return data.map((d: any) =>
      React.createElement(TouchableOpacity, { key: d.raceId, testID: `chart-dot-${d.raceId}`, onPress: () => onDotPress(d.raceId) },
        React.createElement(Text, null, d.raceId),
      ),
    );
  },
}));

jest.mock('react-native-svg', () => ({ default: () => null, Svg: () => null }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ATHLETE = { id: 'athlete-1', name: 'Marcus Webb', dateOfBirth: null, notes: null, createdAt: 1_000_000, archivedAt: null };

const RACES_800 = [
  { raceId: 'race-1', raceEntryId: 'entry-1', distanceM: 800, meetName: 'Practice',      startedAt: 1_700_000_000_000, finalCumulativeMs: 127_300, lapCount: 2 },
  { raceId: 'race-2', raceEntryId: 'entry-2', distanceM: 800, meetName: 'County Champs', startedAt: 1_700_600_000_000, finalCumulativeMs: 118_400, lapCount: 2 }, // PR
];

const RACES_MIXED = [
  { raceId: 'race-1', raceEntryId: 'entry-1', distanceM: 800,  meetName: 'Practice',      startedAt: 1_700_000_000_000, finalCumulativeMs: 127_300, lapCount: 2 },
  { raceId: 'race-2', raceEntryId: 'entry-2', distanceM: 1600, meetName: 'Invitational',  startedAt: 1_700_300_000_000, finalCumulativeMs: 272_100, lapCount: 4 },
  { raceId: 'race-3', raceEntryId: 'entry-3', distanceM: 800,  meetName: 'County Champs', startedAt: 1_700_600_000_000, finalCumulativeMs: 118_400, lapCount: 2 }, // most recent → default tab
];

const mockGetAthlete = athletesRepo.getAthlete as jest.MockedFunction<typeof athletesRepo.getAthlete>;
const mockGetAthleteRaces = athletesRepo.getAthleteRaces as jest.MockedFunction<typeof athletesRepo.getAthleteRaces>;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AthleteDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAthlete.mockResolvedValue(ATHLETE);
  });

  it('shows athlete name after load', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await waitFor(() => expect(screen.getByText('Marcus Webb')).toBeTruthy());
  });

  it('defaults to the most recently raced distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    // race-3 is the most recent and is 800m — so 800m tab is active
    await waitFor(() => expect(screen.getByText('800m Races')).toBeTruthy());
  });

  it('shows the PR time for the selected distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    // PR is 118_400ms → 1:58.40
    await waitFor(() => expect(screen.getByText('1:58.40')).toBeTruthy());
  });

  it('switching tabs updates the race list to the new distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await waitFor(() => screen.getByText('Marcus Webb'));

    // Initially on 800m (most recent). Switch to 1600m.
    fireEvent.press(screen.getByText('1600m'));
    expect(screen.getByText('1600m Races')).toBeTruthy();
    // The 1600m race is "Invitational"
    expect(screen.getByText('Invitational')).toBeTruthy();
  });

  it('race list shows only races for the selected distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await waitFor(() => screen.getByText('Marcus Webb'));

    // On 800m tab: "County Champs" and "Practice" are visible, "Invitational" is not
    expect(screen.queryByText('Invitational')).toBeNull();
    expect(screen.getByText('County Champs')).toBeTruthy();
  });

  it('tapping a race row navigates to race review', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await waitFor(() => screen.getByText('County Champs'));
    fireEvent.press(screen.getByText('County Champs'));
    expect(mockPush).toHaveBeenCalledWith('/race/race-2/review');
  });

  it('tapping a chart dot navigates to race review', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await waitFor(() => screen.getByTestId('chart-dot-race-1'));
    fireEvent.press(screen.getByTestId('chart-dot-race-1'));
    expect(mockPush).toHaveBeenCalledWith('/race/race-1/review');
  });

  it('shows empty state when athlete has no completed races', async () => {
    mockGetAthleteRaces.mockResolvedValue([]);
    render(<AthleteDetailScreen />);
    await waitFor(() => expect(screen.getByText('No completed races yet.')).toBeTruthy());
  });

  it('shows single-point hint when athlete has one race at a distance', async () => {
    mockGetAthleteRaces.mockResolvedValue([RACES_800[0]]); // only one 800m race
    render(<AthleteDetailScreen />);
    await waitFor(() => expect(screen.getByText(/Complete one more 800m race/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/code/teamtimer && pnpm test tests/component/AthleteDetail.test.tsx --forceExit
```

Expected: FAIL — screen is a placeholder, none of the expected elements exist.

- [ ] **Step 3: Implement the athlete detail screen**

Replace all content of `app/(tabs)/athletes/[id].tsx` with:

```typescript
// app/(tabs)/athletes/[id].tsx
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getAthlete, getAthleteRaces, type AthleteRaceResult } from '@/repos/athletes';
import type { Athlete } from '@/db/schema';
import { formatMs } from '@/domain/timing';
import { ImprovementChart } from '@/components/ImprovementChart';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const CHART_COLOR = '#3B82F6';

type DistanceGroup = {
  distanceM: number;
  races: AthleteRaceResult[]; // sorted by startedAt asc
  prMs: number;
  prRace: AthleteRaceResult;
};

function groupByDistance(raceResults: AthleteRaceResult[]): DistanceGroup[] {
  const map = new Map<number, AthleteRaceResult[]>();
  for (const r of raceResults) {
    if (!map.has(r.distanceM)) map.set(r.distanceM, []);
    map.get(r.distanceM)!.push(r);
  }
  return Array.from(map.entries())
    .map(([distanceM, distanceRaces]) => {
      const pr = Math.min(...distanceRaces.map(r => r.finalCumulativeMs));
      const prRace = distanceRaces.find(r => r.finalCumulativeMs === pr)!;
      return { distanceM, races: distanceRaces, prMs: pr, prRace };
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [groups, setGroups] = useState<DistanceGroup[]>([]);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, raceResults] = await Promise.all([getAthlete(id), getAthleteRaces(id)]);
    setAthlete(a ?? null);
    const g = groupByDistance(raceResults);
    setGroups(g);
    if (raceResults.length > 0) {
      // Default tab = distance of the most recently raced (last element, sorted by startedAt asc)
      setSelectedDistanceM(raceResults[raceResults.length - 1].distanceM);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(load);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!athlete) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>Athlete not found.</Text>
      </View>
    );
  }

  const totalRaces = groups.reduce((sum, g) => sum + g.races.length, 0);
  const selectedGroup = groups.find(g => g.distanceM === selectedDistanceM) ?? null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.name}>{athlete.name}</Text>
          <Text style={s.subtitle}>
            {totalRaces} race{totalRaces !== 1 ? 's' : ''} recorded
          </Text>
        </View>
        <TouchableOpacity
          style={s.editBtn}
          onPress={() => router.push(`/athletes/${id}/edit`)}
        >
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <Text style={s.empty}>No completed races yet.</Text>
      ) : (
        <>
          {/* Distance tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContent}
          >
            {groups.map(g => (
              <TouchableOpacity
                key={g.distanceM}
                style={[s.tab, selectedDistanceM === g.distanceM && s.tabActive]}
                onPress={() => setSelectedDistanceM(g.distanceM)}
              >
                <Text
                  style={[
                    s.tabText,
                    selectedDistanceM === g.distanceM && s.tabTextActive,
                  ]}
                >
                  {g.distanceM}m
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedGroup && (
            <>
              {/* PR card */}
              <View style={s.prCard}>
                <View>
                  <Text style={s.prLabel}>
                    {selectedGroup.distanceM}m Personal Record
                  </Text>
                  <Text style={s.prTime}>{formatMs(selectedGroup.prMs)}</Text>
                </View>
                <View style={s.prMeta}>
                  <Text style={s.prMetaText}>
                    {selectedGroup.prRace.meetName ?? 'Practice'}
                  </Text>
                  <Text style={s.prMetaText}>
                    {new Date(selectedGroup.prRace.startedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              {/* Chart */}
              <View style={s.chartCard}>
                <Text style={s.sectionLabel}>
                  Improvement · {selectedGroup.distanceM}m
                </Text>
                <ImprovementChart
                  data={selectedGroup.races.map(r => ({
                    raceId: r.raceId,
                    startedAt: r.startedAt,
                    cumulativeMs: r.finalCumulativeMs,
                  }))}
                  color={CHART_COLOR}
                  prMs={selectedGroup.prMs}
                  onDotPress={raceId => router.push(`/race/${raceId}/review`)}
                />
                {selectedGroup.races.length === 1 && (
                  <Text style={s.singleHint}>
                    Complete one more {selectedGroup.distanceM}m race to see your trend.
                  </Text>
                )}
              </View>

              {/* Race list */}
              <Text style={s.sectionLabel}>
                {selectedGroup.distanceM}m Races
              </Text>
              <View style={s.raceList}>
                {[...selectedGroup.races].reverse().map((r, i, arr) => {
                  const isPR = r.finalCumulativeMs === selectedGroup.prMs;
                  return (
                    <TouchableOpacity
                      key={r.raceId}
                      style={[s.raceRow, i < arr.length - 1 && s.raceRowBorder]}
                      onPress={() => router.push(`/race/${r.raceId}/review`)}
                    >
                      <View>
                        <Text style={s.raceName}>
                          {r.meetName ?? 'Practice'}
                        </Text>
                        <Text style={s.raceMeta}>
                          {new Date(r.startedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })} · {r.lapCount} lap{r.lapCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[s.raceTime, isPR && s.raceTimePR]}>
                        {formatMs(r.finalCumulativeMs)}{isPR ? ' ★' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editBtn: { backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  editBtnText: { fontSize: 13, color: colors.textSecondary },
  empty: { textAlign: 'center', marginTop: 48, color: colors.textSecondary, fontSize: 16 },
  tabsScroll: { marginBottom: 12 },
  tabsContent: { gap: 8 },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: CHART_COLOR },
  tabText: { fontSize: 13, color: colors.textDisabled },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  prCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  prTime: { ...typography.lapTime, color: colors.warning },
  prMeta: { alignItems: 'flex-end' },
  prMetaText: { fontSize: 12, color: colors.textSecondary },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  singleHint: { fontSize: 12, color: colors.textDisabled, textAlign: 'center', marginTop: 8 },
  raceList: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  raceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  raceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  raceName: { fontSize: 14, color: colors.textPrimary },
  raceMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  raceTime: { ...typography.splitTime, color: colors.textPrimary },
  raceTimePR: { color: colors.warning },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/code/teamtimer && pnpm test tests/component/AthleteDetail.test.tsx --forceExit
```

Expected: 8 tests PASS.

- [ ] **Step 5: Run full test suite and typecheck**

```bash
cd /root/code/teamtimer && pnpm test --forceExit && pnpm typecheck
```

Expected: all tests pass, zero TypeScript errors.
