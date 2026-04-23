# TeamTimer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform iOS/Android coach's split-tracking app with local SQLite storage, live per-athlete pacing feedback, relay support, and improvement history.

**Architecture:** Expo Router (file-based navigation) · Drizzle ORM + expo-sqlite (local-only DB) · Zustand for live-race UI state · pure domain functions for all timing math · no backend, no auth.

**Tech Stack:** Expo (React Native) · TypeScript strict · Expo Router · expo-sqlite + drizzle-orm · drizzle-kit · Zustand · expo-haptics · expo-keep-awake · react-native-svg · jest-expo · @testing-library/react-native

---

## File Map

```
app/
  _layout.tsx                  # root layout — DB init, QueryClientProvider, theme
  +not-found.tsx
  (tabs)/
    _layout.tsx                # bottom tab bar: Home | Athletes | History
    index.tsx                  # Home: resume-race banner + recent races list + New Race button
    athletes/
      index.tsx                # athlete list (name, PR badge, archive action)
      [id].tsx                 # athlete detail: race history per distance + line chart
    history/
      index.tsx                # all completed races, filterable by distance
  athletes/
    new.tsx                    # add athlete modal
    [id]/
      edit.tsx                 # edit athlete form
  race/
    setup.tsx                  # pick kind/distance/athletes/target splits → creates race row
    [id]/
      live.tsx                 # THE race screen: clock + per-athlete cells + GO button
      review.tsx               # post-race split grid with edit + discard

src/
  db/
    client.ts                  # drizzle + openDatabaseSync
    schema.ts                  # all table definitions
    migrate.ts                 # run migrations on app start
  repos/
    athletes.ts                # CRUD + archive
    meets.ts                   # CRUD (lightweight)
    races.ts                   # CRUD + status transitions
    splits.ts                  # append / undo / edit
  domain/
    timing.ts                  # pure: lapTime, cumulativeMs, deltaMs, formatMs, prForEntries
    pacing.ts                  # pure: evenPace, negativeSplit, custom → TargetSplit[]
    distances.ts               # STANDARD_DISTANCES, lapCount, validateDistance
  hooks/
    useRaceClock.ts            # 10 Hz ticker derived from startedAt
    useKeepAwake.ts            # expo-keep-awake wrapper
  components/
    AthleteCell.tsx            # big tap cell (individual race)
    RelayCell.tsx              # big tap cell (relay team)
    RaceClock.tsx              # monospace MM:SS.hh display
    ImprovementChart.tsx       # react-native-svg line chart
  store/
    raceStore.ts               # zustand: active race ephemeral state
  theme/
    colors.ts                  # slot colors + semantic tokens
    typography.ts              # monospace font refs + scale

tests/
  unit/
    timing.test.ts
    pacing.test.ts
    distances.test.ts
  component/
    AthleteCell.test.tsx
    RaceClock.test.tsx

docs/
  BUILD.md                     # local setup, run, build, deploy
drizzle.config.ts
```

---

## Task 1: Scaffold Expo project

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc`, `drizzle.config.ts`

- [ ] **Step 1: Initialize Expo project with tabs template**

```bash
cd /root/code/teamtimer
npx create-expo-app@latest . --template tabs
```

When prompted about existing files, allow overwrite. The tabs template uses Expo Router + TypeScript.

- [ ] **Step 2: Verify scaffold compiles**

```bash
pnpm typecheck
```

Expected: zero errors (template ships clean).

- [ ] **Step 3: Enable TypeScript strict mode**

Edit `tsconfig.json` — add `"strict": true` and `"exactOptionalPropertyTypes": true` inside `compilerOptions`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Configure ESLint**

Replace `.eslintrc.js` contents:

```js
module.exports = {
  extends: ['expo', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

- [ ] **Step 5: Configure Prettier**

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Add pnpm scripts to package.json**

Ensure these scripts exist in `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest --watchAll=false",
    "test:watch": "jest --watchAll",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push"
  }
}
```

- [ ] **Step 7: Configure drizzle-kit**

Create `drizzle.config.ts`:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

- [ ] **Step 8: Verify lint passes**

```bash
pnpm lint
```

Expected: 0 errors (fix any template warnings that appear).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo project with TypeScript strict + drizzle config"
```

---

## Task 2: Install dependencies

**Files:** `package.json` (modified by installs)

- [ ] **Step 1: Install Expo-managed packages**

```bash
npx expo install expo-sqlite expo-haptics expo-keep-awake expo-font
```

- [ ] **Step 2: Install non-Expo npm packages**

```bash
pnpm add drizzle-orm zustand react-native-svg
pnpm add -D drizzle-kit @types/react-native-svg
```

- [ ] **Step 3: Install test dependencies**

```bash
pnpm add -D jest jest-expo @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 4: Configure jest in package.json**

Add jest config to `package.json`:

```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterFramework": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 5: Verify app still starts**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install drizzle, zustand, expo-sqlite, haptics, keep-awake, test deps"
```

---

## Task 3: Theme

**Files:**
- Create: `src/theme/colors.ts`
- Create: `src/theme/typography.ts`

- [ ] **Step 1: Write colors.ts**

```typescript
// src/theme/colors.ts

// Per-slot colors: one distinct high-contrast color per athlete position
export const SLOT_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308'] as const;

export const colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2E2E2E',
  textPrimary: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textDisabled: '#525252',
  accent: '#6366F1',        // indigo — buttons, active states
  success: '#22C55E',       // athlete ahead of target
  danger: '#EF4444',        // athlete behind target
  warning: '#EAB308',       // close to target (within 0.5s)
  neutral: '#737373',       // no target set
  slot: SLOT_COLORS,
} as const;

export type Colors = typeof colors;
```

- [ ] **Step 2: Write typography.ts**

```typescript
// src/theme/typography.ts
import { Platform } from 'react-native';

export const monoFont = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  raceClock: { fontFamily: monoFont, fontSize: 48, fontWeight: '700' as const, letterSpacing: 2 },
  lapTime:   { fontFamily: monoFont, fontSize: 28, fontWeight: '600' as const },
  splitTime: { fontFamily: monoFont, fontSize: 18, fontWeight: '400' as const },
  delta:     { fontFamily: monoFont, fontSize: 16, fontWeight: '500' as const },
  label:     { fontSize: 14, fontWeight: '500' as const },
  caption:   { fontSize: 12, fontWeight: '400' as const },
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/theme/
git commit -m "feat: add theme — high-contrast colors + monospace typography scale"
```

---

## Task 4: Database schema

**Files:**
- Create: `src/db/schema.ts`

- [ ] **Step 1: Write schema.ts**

```typescript
// src/db/schema.ts
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const athletes = sqliteTable('athletes', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  dateOfBirth: text('date_of_birth'),          // ISO date string, optional
  notes:       text('notes'),
  createdAt:   integer('created_at').notNull(), // ms epoch
  archivedAt:  integer('archived_at'),          // ms epoch; null = active
});

export const meets = sqliteTable('meets', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  date:      text('date').notNull(),            // ISO date string
  location:  text('location'),
  createdAt: integer('created_at').notNull(),
});

export const races = sqliteTable('races', {
  id:           text('id').primaryKey(),
  meetId:       text('meet_id').references(() => meets.id),
  kind:         text('kind', { enum: ['individual', 'relay'] }).notNull(),
  distanceM:    integer('distance_m').notNull(),
  lapDistanceM: integer('lap_distance_m').notNull().default(400),
  expectedLaps: integer('expected_laps').notNull(),
  startedAt:    integer('started_at'),          // ms epoch; null until GO
  endedAt:      integer('ended_at'),            // ms epoch; null until finished
  status:       text('status', {
    enum: ['setup', 'running', 'completed', 'discarded'],
  }).notNull().default('setup'),
  createdAt: integer('created_at').notNull(),
});

export const raceEntries = sqliteTable('race_entries', {
  id:         text('id').primaryKey(),
  raceId:     text('race_id').notNull().references(() => races.id),
  slotIndex:  integer('slot_index').notNull(),  // 0–3
  athleteId:  text('athlete_id').references(() => athletes.id), // null for relay
  teamName:   text('team_name'),                // relay team label
  finishedAt: integer('finished_at'),           // ms epoch of final tap
}, (t) => ({
  uniqueSlot: uniqueIndex('race_entries_race_slot_uidx').on(t.raceId, t.slotIndex),
}));

export const splits = sqliteTable('splits', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  lapIndex:     integer('lap_index').notNull(),  // 0-based
  capturedAt:   integer('captured_at').notNull(), // ms epoch
  edited:       integer('edited', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueLap: uniqueIndex('splits_entry_lap_uidx').on(t.raceEntryId, t.lapIndex),
}));

export const targetSplits = sqliteTable('target_splits', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  lapIndex:     integer('lap_index').notNull(),
  targetMs:     integer('target_ms').notNull(), // cumulative ms at end of this lap
}, (t) => ({
  uniqueTarget: uniqueIndex('target_splits_entry_lap_uidx').on(t.raceEntryId, t.lapIndex),
}));

export const relayLegs = sqliteTable('relay_legs', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  legIndex:     integer('leg_index').notNull(),   // 0–3
  athleteId:    text('athlete_id').notNull().references(() => athletes.id),
}, (t) => ({
  uniqueLeg: uniqueIndex('relay_legs_entry_leg_uidx').on(t.raceEntryId, t.legIndex),
}));

export type Athlete    = typeof athletes.$inferSelect;
export type Meet       = typeof meets.$inferSelect;
export type Race       = typeof races.$inferSelect;
export type RaceEntry  = typeof raceEntries.$inferSelect;
export type Split      = typeof splits.$inferSelect;
export type TargetSplit = typeof targetSplits.$inferSelect;
export type RelayLeg   = typeof relayLegs.$inferSelect;
```

- [ ] **Step 2: Generate initial migration**

```bash
pnpm db:generate
```

Expected: creates `src/db/migrations/0000_initial.sql` and `meta/` files.

- [ ] **Step 3: Verify typecheck still passes**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/migrations/ drizzle.config.ts
git commit -m "feat: define SQLite schema — athletes, meets, races, entries, splits, targets, relays"
```

---

## Task 5: Database client + migrations

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`

- [ ] **Step 1: Write client.ts**

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('teamtimer.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });
export type DB = typeof db;
```

- [ ] **Step 2: Write migrate.ts**

```typescript
// src/db/migrate.ts
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './client';
import migrations from './migrations/index';

export async function runMigrations(): Promise<void> {
  await migrate(db, migrations);
}
```

- [ ] **Step 3: Update app/_layout.tsx to run migrations on start**

Replace root layout with:

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { runMigrations } from '@/db/migrate';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    runMigrations().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="race/setup" options={{ title: 'New Race', presentation: 'modal' }} />
      <Stack.Screen name="race/[id]/live" options={{ headerShown: false }} />
      <Stack.Screen name="race/[id]/review" options={{ title: 'Race Review' }} />
      <Stack.Screen name="athletes/new" options={{ title: 'Add Athlete', presentation: 'modal' }} />
      <Stack.Screen name="athletes/[id]/edit" options={{ title: 'Edit Athlete' }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Verify app boots without crash**

```bash
pnpm typecheck && pnpm start
```

Open in Expo Go or simulator. App should boot to the default tabs home screen.

- [ ] **Step 5: Commit**

```bash
git add src/db/client.ts src/db/migrate.ts app/_layout.tsx
git commit -m "feat: wire up drizzle client and run migrations on app start"
```

---

## Task 6: Domain — distances, timing, pacing

**Files:**
- Create: `src/domain/distances.ts`
- Create: `src/domain/timing.ts`
- Create: `src/domain/pacing.ts`
- Create: `tests/unit/distances.test.ts`
- Create: `tests/unit/timing.test.ts`
- Create: `tests/unit/pacing.test.ts`

- [ ] **Step 1: Write failing tests for distances.ts**

```typescript
// tests/unit/distances.test.ts
import { STANDARD_DISTANCES, lapCount, formatDistanceLabel } from '../../src/domain/distances';

describe('distances', () => {
  it('includes standard track distances', () => {
    expect(STANDARD_DISTANCES).toContain(800);
    expect(STANDARD_DISTANCES).toContain(1600);
    expect(STANDARD_DISTANCES).toContain(3200);
  });

  it('computes lap count correctly', () => {
    expect(lapCount(800, 400)).toBe(2);
    expect(lapCount(1600, 400)).toBe(4);
    expect(lapCount(3200, 400)).toBe(8);
    expect(lapCount(800, 200)).toBe(4);
  });

  it('formats distance label', () => {
    expect(formatDistanceLabel(1600)).toBe('1600m');
    expect(formatDistanceLabel(5000)).toBe('5000m');
  });
});
```

- [ ] **Step 2: Run distances test — expect FAIL**

```bash
pnpm test tests/unit/distances.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement distances.ts**

```typescript
// src/domain/distances.ts
export const STANDARD_DISTANCES = [400, 800, 1500, 1600, 3000, 3200, 5000, 10000] as const;
export type StandardDistance = (typeof STANDARD_DISTANCES)[number];

export function lapCount(distanceM: number, lapDistanceM: number): number {
  return Math.ceil(distanceM / lapDistanceM);
}

export function formatDistanceLabel(distanceM: number): string {
  return `${distanceM}m`;
}

export function isValidDistance(distanceM: number): boolean {
  return Number.isInteger(distanceM) && distanceM >= 100 && distanceM <= 42195;
}
```

- [ ] **Step 4: Run distances test — expect PASS**

```bash
pnpm test tests/unit/distances.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing tests for timing.ts**

```typescript
// tests/unit/timing.test.ts
import {
  lapTimeMs,
  cumulativeMs,
  deltaMs,
  formatMs,
} from '../../src/domain/timing';

const START = 1000000;
const TAPS  = [1062100, 1124500, 1188200, 1252000]; // 62.1s, 62.4s, 63.7s, 63.8s laps

describe('lapTimeMs', () => {
  it('returns time from start for first lap', () => {
    expect(lapTimeMs(TAPS, 0, START)).toBe(62100);
  });
  it('returns diff from previous tap for subsequent laps', () => {
    expect(lapTimeMs(TAPS, 1, START)).toBe(62400); // 1124500 - 1062100
  });
});

describe('cumulativeMs', () => {
  it('returns elapsed from start to tap', () => {
    expect(cumulativeMs(TAPS, 2, START)).toBe(188200); // 1188200 - 1000000
  });
});

describe('deltaMs', () => {
  it('returns positive when behind target', () => {
    const targets = [62000, 124000, 186000, 248000]; // 62s even splits
    expect(deltaMs(TAPS, 2, START, targets)).toBe(2200); // 188200 - 186000
  });
  it('returns negative when ahead of target', () => {
    const targets = [62000, 124000, 186000, 248000];
    expect(deltaMs(TAPS, 0, START, targets)).toBe(100); // 62100 - 62000
  });
});

describe('formatMs', () => {
  it('formats sub-minute', () => {
    expect(formatMs(62100)).toBe('1:02.10');
  });
  it('formats over 10 minutes', () => {
    expect(formatMs(620000)).toBe('10:20.00');
  });
  it('formats zero', () => {
    expect(formatMs(0)).toBe('0:00.00');
  });
});
```

- [ ] **Step 6: Run timing test — expect FAIL**

```bash
pnpm test tests/unit/timing.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement timing.ts**

```typescript
// src/domain/timing.ts

/** Elapsed ms for lap at lapIndex (capturedAt[lapIndex] - prev tap or startedAt). */
export function lapTimeMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
): number {
  const prev = lapIndex === 0 ? startedAt : capturedAts[lapIndex - 1];
  return capturedAts[lapIndex] - prev;
}

/** Cumulative ms from startedAt to the tap at lapIndex. */
export function cumulativeMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
): number {
  return capturedAts[lapIndex] - startedAt;
}

/**
 * Delta from target at lapIndex. Positive = behind (slower). Negative = ahead.
 * targetCumulativeMs is the array of cumulative targets (e.g. [62000, 124000, …]).
 */
export function deltaMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
  targetCumulativeMs: number[],
): number {
  return cumulativeMs(capturedAts, lapIndex, startedAt) - targetCumulativeMs[lapIndex];
}

/**
 * Formats a duration in milliseconds as M:SS.hh
 * e.g. 62100 → "1:02.10"
 */
export function formatMs(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10);
  const cs      = totalCentiseconds % 100;
  const totalS  = Math.floor(totalCentiseconds / 100);
  const s       = totalS % 60;
  const m       = Math.floor(totalS / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Formats a signed delta as "+X.XX" or "-X.XX" seconds.
 */
export function formatDeltaMs(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const abs  = Math.abs(ms);
  const s    = (abs / 1000).toFixed(2);
  return `${sign}${s}`;
}

/**
 * Returns the best (lowest) cumulative finish time across an array of
 * { capturedAts, startedAt } race records, or null if no completed races.
 */
export function prMs(
  races: Array<{ capturedAts: number[]; startedAt: number }>,
): number | null {
  if (races.length === 0) return null;
  const times = races.map((r) => r.capturedAts[r.capturedAts.length - 1] - r.startedAt);
  return Math.min(...times);
}
```

- [ ] **Step 8: Run timing test — expect PASS**

```bash
pnpm test tests/unit/timing.test.ts
```

Expected: PASS.

- [ ] **Step 9: Write failing tests for pacing.ts**

```typescript
// tests/unit/pacing.test.ts
import { evenPaceTargets, negativeSplitTargets } from '../../src/domain/pacing';

describe('evenPaceTargets', () => {
  it('generates evenly spaced cumulative targets', () => {
    // 4-lap race, 4:00 total = 60s per lap
    const targets = evenPaceTargets(4, 240000);
    expect(targets).toHaveLength(4);
    expect(targets[0]).toBe(60000);
    expect(targets[1]).toBe(120000);
    expect(targets[3]).toBe(240000);
  });
});

describe('negativeSplitTargets', () => {
  it('first half is slower than second half by the split margin', () => {
    // 4-lap race, 4:00 total, 2% negative split
    const targets = negativeSplitTargets(4, 240000, 0.02);
    // first 2 laps slower, last 2 faster
    const lap1 = targets[0];
    const lap3 = targets[2] - targets[1];
    expect(lap1).toBeGreaterThan(lap3);
    // total still equals goalMs
    expect(targets[3]).toBe(240000);
  });
});
```

- [ ] **Step 10: Run pacing test — expect FAIL**

```bash
pnpm test tests/unit/pacing.test.ts
```

- [ ] **Step 11: Implement pacing.ts**

```typescript
// src/domain/pacing.ts

/**
 * Generates cumulative target times for an even-pace strategy.
 * Returns an array of length `laps` where each element is the
 * expected cumulative ms at the end of that lap.
 */
export function evenPaceTargets(laps: number, goalMs: number): number[] {
  const lapMs = goalMs / laps;
  return Array.from({ length: laps }, (_, i) => Math.round(lapMs * (i + 1)));
}

/**
 * Generates cumulative targets with a negative split:
 * the second half of laps is faster by `splitFraction` of the average lap pace.
 * e.g. splitFraction=0.02 means second half ~2% faster than first half.
 */
export function negativeSplitTargets(
  laps: number,
  goalMs: number,
  splitFraction: number,
): number[] {
  const half       = Math.floor(laps / 2);
  const avgLapMs   = goalMs / laps;
  const slowLapMs  = avgLapMs * (1 + splitFraction / 2);
  const fastLapMs  = avgLapMs * (1 - splitFraction / 2);

  const result: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < laps; i++) {
    cumulative += i < half ? slowLapMs : fastLapMs;
    result.push(Math.round(cumulative));
  }
  // clamp last to goalMs to avoid rounding drift
  result[laps - 1] = goalMs;
  return result;
}

/**
 * Validates a custom array of per-lap cumulative target times.
 * Must be strictly increasing and have exactly `laps` entries.
 */
export function validateCustomTargets(targets: number[], laps: number): string | null {
  if (targets.length !== laps) return `Expected ${laps} targets, got ${targets.length}`;
  for (let i = 1; i < targets.length; i++) {
    if (targets[i] <= targets[i - 1]) return `Target at lap ${i + 1} must be greater than lap ${i}`;
  }
  return null;
}
```

- [ ] **Step 12: Run all domain tests — expect PASS**

```bash
pnpm test tests/unit/
```

- [ ] **Step 13: Commit**

```bash
git add src/domain/ tests/unit/
git commit -m "feat: domain functions — distances, timing, pacing with full unit tests"
```

---

## Task 7: Athlete repository

**Files:**
- Create: `src/repos/athletes.ts`

- [ ] **Step 1: Implement athletes.ts**

```typescript
// src/repos/athletes.ts
import { eq, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { athletes, type Athlete } from '@/db/schema';
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
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/repos/athletes.ts
git commit -m "feat: athlete repository — CRUD + archive"
```

---

## Task 8: Athlete screens

**Files:**
- Modify: `app/(tabs)/athletes/index.tsx`
- Create: `app/athletes/new.tsx`
- Create: `app/athletes/[id]/edit.tsx`
- Create: `app/(tabs)/athletes/[id].tsx` (placeholder — full detail in Task 15)

- [ ] **Step 1: Implement athlete list screen**

```typescript
// app/(tabs)/athletes/index.tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { listAthletes, archiveAthlete } from '@/repos/athletes';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';

export default function AthletesScreen() {
  const [data, setData] = useState<Athlete[]>([]);
  const router = useRouter();

  const load = () => listAthletes().then(setData);
  useEffect(() => { load(); }, []);

  const onArchive = (a: Athlete) => {
    Alert.alert('Archive athlete?', `${a.name} will be hidden but their race history is preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => archiveAthlete(a.id).then(load) },
    ]);
  };

  return (
    <View style={s.container}>
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => router.push(`/athletes/${item.id}`)}>
            <Text style={s.name}>{item.name}</Text>
            <TouchableOpacity onPress={() => onArchive(item)}>
              <Text style={s.archive}>Archive</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No athletes yet. Tap + to add one.</Text>}
      />
      <Link href="/athletes/new" asChild>
        <TouchableOpacity style={s.fab}><Text style={s.fabText}>+</Text></TouchableOpacity>
      </Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 17, color: colors.textPrimary },
  archive: { fontSize: 14, color: colors.danger },
  empty: { textAlign: 'center', marginTop: 48, color: colors.textSecondary, fontSize: 16 },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
```

- [ ] **Step 2: Implement add athlete screen**

```typescript
// app/athletes/new.tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { createAthlete } from '@/repos/athletes';
import { colors } from '@/theme/colors';

export default function NewAthleteScreen() {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createAthlete({ name: trimmed, notes: notes.trim() || null, dateOfBirth: null });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={s.label}>Name *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Athlete name" placeholderTextColor={colors.textDisabled} autoFocus />
      <Text style={s.label}>Notes</Text>
      <TextInput style={[s.input, s.multiline]} value={notes} onChangeText={setNotes} placeholder="Optional notes" placeholderTextColor={colors.textDisabled} multiline numberOfLines={3} />
      <TouchableOpacity style={[s.btn, !name.trim() && s.btnDisabled]} onPress={onSave} disabled={!name.trim()}>
        <Text style={s.btnText}>Save Athlete</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  label: { color: colors.textSecondary, marginTop: 16, marginBottom: 4, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  multiline: { height: 80, textAlignVertical: 'top' },
  btn: { marginTop: 32, backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Implement edit athlete screen**

```typescript
// app/athletes/[id]/edit.tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAthlete, updateAthlete } from '@/repos/athletes';
import { colors } from '@/theme/colors';

export default function EditAthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  useEffect(() => {
    getAthlete(id).then((a) => {
      if (a) { setName(a.name); setNotes(a.notes ?? ''); }
    });
  }, [id]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateAthlete(id, { name: trimmed, notes: notes.trim() || null });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={s.label}>Name *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={colors.textDisabled} />
      <Text style={s.label}>Notes</Text>
      <TextInput style={[s.input, s.multiline]} value={notes} onChangeText={setNotes} placeholderTextColor={colors.textDisabled} multiline numberOfLines={3} />
      <TouchableOpacity style={[s.btn, !name.trim() && s.btnDisabled]} onPress={onSave} disabled={!name.trim()}>
        <Text style={s.btnText}>Save Changes</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  label: { color: colors.textSecondary, marginTop: 16, marginBottom: 4, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  multiline: { height: 80, textAlignVertical: 'top' },
  btn: { marginTop: 32, backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Add placeholder athlete detail screen**

```typescript
// app/(tabs)/athletes/[id].tsx
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={s.container}>
      <Text style={s.text}>Athlete history coming in Phase 5 (id: {id})</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.textSecondary },
});
```

- [ ] **Step 5: Verify athlete flow on device/simulator**

Launch the app. Navigate to Athletes tab. Add an athlete. Edit it. Archive it. Verify data persists across restart.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: athlete list, add, edit screens — CRUD with local persistence"
```

---

## Task 9: Races + splits repositories

**Files:**
- Create: `src/repos/races.ts`
- Create: `src/repos/splits.ts`

- [ ] **Step 1: Implement races.ts**

```typescript
// src/repos/races.ts
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { races, raceEntries, targetSplits, relayLegs, type Race, type RaceEntry } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export type CreateRaceInput = {
  kind: 'individual' | 'relay';
  distanceM: number;
  lapDistanceM: number;
  expectedLaps: number;
  meetId?: string;
  entries: Array<{
    slotIndex: number;
    athleteId?: string;
    teamName?: string;
    targetCumulativeMs?: number[];  // one per lap
    legs?: Array<{ legIndex: number; athleteId: string }>; // relay only
  }>;
};

export async function createRace(input: CreateRaceInput): Promise<string> {
  const raceId = randomUUID();
  const now = Date.now();
  await db.insert(races).values({
    id: raceId,
    kind: input.kind,
    distanceM: input.distanceM,
    lapDistanceM: input.lapDistanceM,
    expectedLaps: input.expectedLaps,
    meetId: input.meetId ?? null,
    status: 'setup',
    createdAt: now,
    startedAt: null,
    endedAt: null,
  });
  for (const e of input.entries) {
    const entryId = randomUUID();
    await db.insert(raceEntries).values({
      id: entryId,
      raceId,
      slotIndex: e.slotIndex,
      athleteId: e.athleteId ?? null,
      teamName: e.teamName ?? null,
      finishedAt: null,
    });
    if (e.targetCumulativeMs) {
      for (let i = 0; i < e.targetCumulativeMs.length; i++) {
        await db.insert(targetSplits).values({
          id: randomUUID(),
          raceEntryId: entryId,
          lapIndex: i,
          targetMs: e.targetCumulativeMs[i],
        });
      }
    }
    if (e.legs) {
      for (const leg of e.legs) {
        await db.insert(relayLegs).values({
          id: randomUUID(),
          raceEntryId: entryId,
          legIndex: leg.legIndex,
          athleteId: leg.athleteId,
        });
      }
    }
  }
  return raceId;
}

export async function startRace(raceId: string): Promise<number> {
  const now = Date.now();
  await db.update(races).set({ status: 'running', startedAt: now }).where(eq(races.id, raceId));
  return now;
}

export async function endRace(raceId: string): Promise<void> {
  await db.update(races).set({ status: 'completed', endedAt: Date.now() }).where(eq(races.id, raceId));
}

export async function discardRace(raceId: string): Promise<void> {
  await db.update(races).set({ status: 'discarded' }).where(eq(races.id, raceId));
}

export async function getRunningRace(): Promise<Race | undefined> {
  const rows = await db.select().from(races).where(eq(races.status, 'running'));
  return rows[0];
}

export async function getRecentRaces(limit = 20): Promise<Race[]> {
  return db.select().from(races)
    .where(eq(races.status, 'completed'))
    .orderBy(desc(races.createdAt))
    .limit(limit);
}

export async function getRace(id: string): Promise<Race | undefined> {
  const rows = await db.select().from(races).where(eq(races.id, id));
  return rows[0];
}

export async function getRaceEntries(raceId: string): Promise<RaceEntry[]> {
  return db.select().from(raceEntries).where(eq(raceEntries.raceId, raceId));
}
```

- [ ] **Step 2: Implement splits.ts**

```typescript
// src/repos/splits.ts
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { splits, raceEntries, targetSplits, type Split, type TargetSplit } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

/** Append a new split for an entry. Returns the captured timestamp. */
export async function appendSplit(raceEntryId: string, lapIndex: number): Promise<number> {
  const capturedAt = Date.now();
  await db.insert(splits).values({ id: randomUUID(), raceEntryId, lapIndex, capturedAt, edited: false });
  if (lapIndex === (await getExpectedLaps(raceEntryId)) - 1) {
    await db.update(raceEntries).set({ finishedAt: capturedAt }).where(eq(raceEntries.id, raceEntryId));
  }
  return capturedAt;
}

/** Remove the most recent split for an entry. */
export async function undoLastSplit(raceEntryId: string): Promise<void> {
  const last = await db.select()
    .from(splits)
    .where(eq(splits.raceEntryId, raceEntryId))
    .orderBy(desc(splits.lapIndex))
    .limit(1);
  if (last.length === 0) return;
  await db.delete(splits).where(eq(splits.id, last[0].id));
  await db.update(raceEntries).set({ finishedAt: null }).where(eq(raceEntries.id, raceEntryId));
}

/** Get all splits for an entry, ordered by lap. */
export async function getSplitsForEntry(raceEntryId: string): Promise<Split[]> {
  return db.select().from(splits).where(eq(splits.raceEntryId, raceEntryId));
}

/** Edit a split's capturedAt value (post-race correction). */
export async function editSplit(splitId: string, capturedAt: number): Promise<void> {
  await db.update(splits).set({ capturedAt, edited: true }).where(eq(splits.id, splitId));
}

/** Get target splits for an entry. */
export async function getTargetsForEntry(raceEntryId: string): Promise<TargetSplit[]> {
  return db.select().from(targetSplits).where(eq(targetSplits.raceEntryId, raceEntryId));
}

async function getExpectedLaps(raceEntryId: string): Promise<number> {
  const [entry] = await db.select({ raceId: raceEntries.raceId }).from(raceEntries).where(eq(raceEntries.id, raceEntryId));
  // import inline to avoid circular dep
  const { races } = await import('@/db/schema');
  const { eq: eqOp } = await import('drizzle-orm');
  const [race] = await db.select({ expectedLaps: races.expectedLaps }).from(races).where(eqOp(races.id, entry.raceId));
  return race.expectedLaps;
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/repos/
git commit -m "feat: races + splits repositories — create, start, end, append split, undo"
```

---

## Task 10: Race setup screen

**Files:**
- Create: `app/race/setup.tsx`

- [ ] **Step 1: Implement race setup screen**

This screen has 3 steps: (1) pick kind + distance, (2) assign athletes/teams, (3) set target splits.

```typescript
// app/race/setup.tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { listAthletes } from '@/repos/athletes';
import { createRace } from '@/repos/races';
import { evenPaceTargets, negativeSplitTargets } from '@/domain/pacing';
import { STANDARD_DISTANCES, lapCount } from '@/domain/distances';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';
import { formatMs } from '@/domain/timing';

type PacingStrategy = 'none' | 'even' | 'negative';

export default function RaceSetupScreen() {
  const router = useRouter();
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [kind, setKind]             = useState<'individual' | 'relay'>('individual');
  const [distanceM, setDistanceM]   = useState(1600);
  const [lapDistM, setLapDistM]     = useState(400);
  const [athletes, setAthletes]     = useState<Athlete[]>([]);
  const [selected, setSelected]     = useState<(Athlete | null)[]>([null, null, null, null]);
  const [strategy, setStrategy]     = useState<PacingStrategy>('none');
  const [goalMs, setGoalMs]         = useState(240000); // 4:00 default

  useEffect(() => { listAthletes().then(setAthletes); }, []);

  const laps = lapCount(distanceM, lapDistM);

  const toggleAthlete = (slot: number, athlete: Athlete) => {
    setSelected((prev) => {
      const next = [...prev];
      next[slot] = next[slot]?.id === athlete.id ? null : athlete;
      return next;
    });
  };

  const onStart = async () => {
    const activeSlots = selected
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a !== null);
    if (activeSlots.length === 0) return;

    let targetCumulativeMs: number[] | undefined;
    if (strategy === 'even') targetCumulativeMs = evenPaceTargets(laps, goalMs);
    if (strategy === 'negative') targetCumulativeMs = negativeSplitTargets(laps, goalMs, 0.02);

    const raceId = await createRace({
      kind,
      distanceM,
      lapDistanceM: lapDistM,
      expectedLaps: laps,
      entries: activeSlots.map(({ a, i }) => ({
        slotIndex: i,
        athleteId: a!.id,
        targetCumulativeMs,
      })),
    });

    router.replace(`/race/${raceId}/live`);
  };

  // Step 1: distance picker
  if (step === 1) return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Race Type</Text>
      <View style={s.row}>
        {(['individual', 'relay'] as const).map((k) => (
          <TouchableOpacity key={k} style={[s.chip, kind === k && s.chipActive]} onPress={() => setKind(k)}>
            <Text style={[s.chipText, kind === k && s.chipTextActive]}>{k === 'individual' ? 'Individual' : 'Relay'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.heading}>Distance</Text>
      <View style={s.row}>
        {STANDARD_DISTANCES.map((d) => (
          <TouchableOpacity key={d} style={[s.chip, distanceM === d && s.chipActive]} onPress={() => setDistanceM(d)}>
            <Text style={[s.chipText, distanceM === d && s.chipTextActive]}>{d}m</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.hint}>{laps} laps × {lapDistM}m</Text>
      <TouchableOpacity style={s.next} onPress={() => setStep(2)}>
        <Text style={s.nextText}>Next: Athletes →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Step 2: athlete assignment (1–4 slots)
  if (step === 2) return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Assign Athletes (tap to assign to slot 1–4)</Text>
      {[0, 1, 2, 3].map((slot) => (
        <View key={slot} style={[s.slotRow, { borderLeftColor: colors.slot[slot] }]}>
          <Text style={[s.slotLabel, { color: colors.slot[slot] }]}>Slot {slot + 1}</Text>
          <Text style={s.slotAthlete}>{selected[slot]?.name ?? '—'}</Text>
        </View>
      ))}
      <Text style={s.subheading}>Athletes</Text>
      {athletes.map((a) => (
        <TouchableOpacity key={a.id} style={s.athleteRow} onPress={() => {
          const nextEmpty = selected.findIndex((x) => x === null);
          if (nextEmpty !== -1) toggleAthlete(nextEmpty, a);
        }}>
          <Text style={s.athleteName}>{a.name}</Text>
          {selected.some((x) => x?.id === a.id) && <Text style={s.check}>✓</Text>}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={s.next} onPress={() => setStep(3)}>
        <Text style={s.nextText}>Next: Targets →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Step 3: pacing strategy
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Pacing Strategy (optional)</Text>
      {(['none', 'even', 'negative'] as PacingStrategy[]).map((strat) => (
        <TouchableOpacity key={strat} style={[s.chip, strategy === strat && s.chipActive]} onPress={() => setStrategy(strat)}>
          <Text style={[s.chipText, strategy === strat && s.chipTextActive]}>
            {strat === 'none' ? 'None (no targets)' : strat === 'even' ? 'Even pace' : 'Negative split (−2%)'}
          </Text>
        </TouchableOpacity>
      ))}
      {strategy !== 'none' && (
        <View>
          <Text style={s.hint}>Goal time: {formatMs(goalMs)}</Text>
          <View style={s.row}>
            {[180000, 210000, 240000, 270000, 300000].map((t) => (
              <TouchableOpacity key={t} style={[s.chip, goalMs === t && s.chipActive]} onPress={() => setGoalMs(t)}>
                <Text style={[s.chipText, goalMs === t && s.chipTextActive]}>{formatMs(t)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <TouchableOpacity style={[s.next, s.go]} onPress={onStart}>
        <Text style={s.nextText}>Start Race →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  heading: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  subheading: { color: colors.textSecondary, fontSize: 13, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderLeftWidth: 4, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 8 },
  slotLabel: { fontWeight: '700', width: 60, fontSize: 14 },
  slotAthlete: { color: colors.textPrimary, fontSize: 16 },
  athleteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  athleteName: { color: colors.textPrimary, fontSize: 16 },
  check: { color: colors.success, fontSize: 18 },
  next: { marginTop: 32, backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  go: { backgroundColor: colors.success },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/race/setup.tsx
git commit -m "feat: race setup screen — distance, athlete assignment, pacing strategy"
```

---

## Task 11: Live race hooks + RaceClock component

**Files:**
- Create: `src/hooks/useRaceClock.ts`
- Create: `src/hooks/useKeepAwake.ts`
- Create: `src/components/RaceClock.tsx`
- Create: `tests/component/RaceClock.test.tsx`

- [ ] **Step 1: Write failing test for RaceClock**

```typescript
// tests/component/RaceClock.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RaceClock } from '../../src/components/RaceClock';

describe('RaceClock', () => {
  it('renders formatted time', () => {
    render(<RaceClock elapsedMs={62100} />);
    expect(screen.getByText('1:02.10')).toBeTruthy();
  });
  it('renders zero state', () => {
    render(<RaceClock elapsedMs={0} />);
    expect(screen.getByText('0:00.00')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test tests/component/RaceClock.test.tsx
```

- [ ] **Step 3: Implement useRaceClock.ts**

```typescript
// src/hooks/useRaceClock.ts
import { useEffect, useRef, useState } from 'react';

/**
 * Returns the elapsed milliseconds since startedAt.
 * Updates at ~10 Hz. Derived from startedAt, not an accumulator,
 * so it stays correct even if the JS thread is suspended briefly.
 * Pass null startedAt to pause (returns 0).
 */
export function useRaceClock(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - startedAt);
    tick(); // immediate first tick
    intervalRef.current = setInterval(tick, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  return elapsed;
}
```

- [ ] **Step 4: Implement useKeepAwake.ts**

```typescript
// src/hooks/useKeepAwake.ts
import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'TeamTimerRace';

export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (active) {
      activateKeepAwakeAsync(TAG);
    } else {
      deactivateKeepAwake(TAG);
    }
    return () => { deactivateKeepAwake(TAG); };
  }, [active]);
}
```

- [ ] **Step 5: Implement RaceClock.tsx**

```typescript
// src/components/RaceClock.tsx
import { Text, StyleSheet } from 'react-native';
import { formatMs } from '@/domain/timing';
import { typography } from '@/theme/typography';
import { colors } from '@/theme/colors';

interface Props {
  elapsedMs: number;
}

export function RaceClock({ elapsedMs }: Props) {
  return <Text style={s.clock}>{formatMs(elapsedMs)}</Text>;
}

const s = StyleSheet.create({
  clock: {
    ...typography.raceClock,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
```

- [ ] **Step 6: Run RaceClock test — expect PASS**

```bash
pnpm test tests/component/RaceClock.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/ src/components/RaceClock.tsx tests/component/RaceClock.test.tsx
git commit -m "feat: useRaceClock hook + RaceClock display component with tests"
```

---

## Task 12: AthleteCell component

**Files:**
- Create: `src/components/AthleteCell.tsx`
- Create: `tests/component/AthleteCell.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/component/AthleteCell.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AthleteCell } from '../../src/components/AthleteCell';

const BASE_PROPS = {
  name: 'Sarah',
  slotIndex: 0,
  lapIndex: 1,
  expectedLaps: 4,
  capturedAts: [1062100 + 1000000],
  startedAt: 1000000,
  targetCumulativeMs: [62000, 124000, 186000, 248000],
  onTap: jest.fn(),
  finished: false,
};

describe('AthleteCell', () => {
  it('renders athlete name', () => {
    render(<AthleteCell {...BASE_PROPS} />);
    expect(screen.getByText('Sarah')).toBeTruthy();
  });

  it('shows lap progress', () => {
    render(<AthleteCell {...BASE_PROPS} />);
    expect(screen.getByText('Lap 2 / 4')).toBeTruthy();
  });

  it('calls onTap when pressed', () => {
    const onTap = jest.fn();
    render(<AthleteCell {...BASE_PROPS} onTap={onTap} />);
    fireEvent.press(screen.getByText('Sarah'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('does not call onTap when finished', () => {
    const onTap = jest.fn();
    render(<AthleteCell {...BASE_PROPS} onTap={onTap} finished={true} />);
    fireEvent.press(screen.getByText('Sarah'));
    expect(onTap).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test tests/component/AthleteCell.test.tsx
```

- [ ] **Step 3: Implement AthleteCell.tsx**

```typescript
// src/components/AthleteCell.tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatMs, formatDeltaMs, lapTimeMs, cumulativeMs, deltaMs } from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface Props {
  name: string;
  slotIndex: number;           // 0–3; determines accent color
  lapIndex: number;            // number of laps completed so far
  expectedLaps: number;
  capturedAts: number[];       // ms epoch for each completed lap (length === lapIndex)
  startedAt: number;
  targetCumulativeMs?: number[];
  onTap: () => void;
  finished: boolean;
}

export function AthleteCell({
  name, slotIndex, lapIndex, expectedLaps,
  capturedAts, startedAt, targetCumulativeMs,
  onTap, finished,
}: Props) {
  const slotColor = SLOT_COLORS[slotIndex];
  const lastLapMs  = lapIndex > 0 ? lapTimeMs(capturedAts, lapIndex - 1, startedAt) : null;
  const cumMs      = lapIndex > 0 ? cumulativeMs(capturedAts, lapIndex - 1, startedAt) : null;
  const delta      = (lapIndex > 0 && targetCumulativeMs)
    ? deltaMs(capturedAts, lapIndex - 1, startedAt, targetCumulativeMs)
    : null;

  const deltaColor =
    delta === null ? colors.neutral :
    Math.abs(delta) <= 500 ? colors.warning :
    delta < 0 ? colors.success : colors.danger;

  const handlePress = () => {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap();
  };

  return (
    <TouchableOpacity
      style={[s.cell, { borderColor: slotColor }, finished && s.cellFinished]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible
      accessibilityLabel={`${name}, lap ${lapIndex} of ${expectedLaps}. Tap to record next lap.`}
    >
      <View style={[s.colorBar, { backgroundColor: slotColor }]} />
      <View style={s.body}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.progress}>Lap {lapIndex} / {expectedLaps}</Text>
        {lastLapMs !== null && (
          <Text style={s.lapTime}>{formatMs(lastLapMs)}</Text>
        )}
        {cumMs !== null && (
          <Text style={s.cumTime}>{formatMs(cumMs)}</Text>
        )}
        {delta !== null && (
          <Text style={[s.delta, { color: deltaColor }]}>{formatDeltaMs(delta)}</Text>
        )}
        {finished && <Text style={[s.done, { color: slotColor }]}>DONE</Text>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    margin: 4,
  },
  cellFinished: { opacity: 0.55 },
  colorBar: { height: 4, width: '100%' },
  body: { padding: 12 },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  progress: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  lapTime: { ...typography.lapTime, color: colors.textPrimary, marginTop: 6 },
  cumTime: { ...typography.splitTime, color: colors.textSecondary, marginTop: 2 },
  delta: { ...typography.delta, marginTop: 4 },
  done: { fontSize: 13, fontWeight: '700', marginTop: 6, letterSpacing: 1 },
});
```

- [ ] **Step 4: Run AthleteCell tests — expect PASS**

```bash
pnpm test tests/component/AthleteCell.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AthleteCell.tsx tests/component/AthleteCell.test.tsx
git commit -m "feat: AthleteCell component — per-lap tap, pacing delta, haptics"
```

---

## Task 13: Live race screen

**Files:**
- Create: `app/race/[id]/live.tsx`

- [ ] **Step 1: Implement live.tsx**

```typescript
// app/race/[id]/live.tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRace, getRaceEntries, startRace, endRace } from '@/repos/races';
import { appendSplit, undoLastSplit, getSplitsForEntry, getTargetsForEntry } from '@/repos/splits';
import type { Race, RaceEntry, Split, TargetSplit } from '@/db/schema';
import { useRaceClock } from '@/hooks/useRaceClock';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { AthleteCell } from '@/components/AthleteCell';
import { RaceClock } from '@/components/RaceClock';
import { colors } from '@/theme/colors';

type EntryState = {
  entry: RaceEntry;
  splits: Split[];
  targets: TargetSplit[];
  athleteName: string;
};

export default function LiveRaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [race, setRace]         = useState<Race | null>(null);
  const [entries, setEntries]   = useState<EntryState[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [phase, setPhase]       = useState<'pre' | 'running' | 'done'>('pre');
  const [lastTap, setLastTap]   = useState<{ entryId: string; lapIndex: number } | null>(null);

  const elapsed = useRaceClock(phase === 'running' ? startedAt : null);
  useKeepAwake(phase === 'running');

  const loadData = useCallback(async () => {
    const r = await getRace(id);
    if (!r) return;
    setRace(r);

    // recover in-progress race
    if (r.status === 'running' && r.startedAt) {
      setStartedAt(r.startedAt);
      setPhase('running');
    }
    if (r.status === 'completed') setPhase('done');

    const rawEntries = await getRaceEntries(id);
    const states = await Promise.all(rawEntries.map(async (entry) => {
      const splits = await getSplitsForEntry(entry.id);
      const targets = await getTargetsForEntry(entry.id);
      // For now use athleteId as name placeholder; Phase 8 pulls real name
      return { entry, splits, targets, athleteName: entry.athleteId ?? entry.teamName ?? '?' };
    }));
    setEntries(states.sort((a, b) => a.entry.slotIndex - b.entry.slotIndex));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Preload athlete names
  useEffect(() => {
    import('@/repos/athletes').then(({ getAthlete }) => {
      entries.forEach(async (es, i) => {
        if (es.entry.athleteId) {
          const a = await getAthlete(es.entry.athleteId);
          if (a) setEntries((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], athleteName: a.name };
            return next;
          });
        }
      });
    });
  }, [entries.length]);

  const onGo = async () => {
    const ts = await startRace(id);
    setStartedAt(ts);
    setPhase('running');
  };

  const onTap = async (entryIndex: number) => {
    const es = entries[entryIndex];
    if (!race || !startedAt) return;
    const lapIndex = es.splits.length;
    if (lapIndex >= race.expectedLaps) return;
    const capturedAt = await appendSplit(es.entry.id, lapIndex);
    setLastTap({ entryId: es.entry.id, lapIndex });
    setEntries((prev) => {
      const next = [...prev];
      next[entryIndex] = {
        ...next[entryIndex],
        splits: [...next[entryIndex].splits, { id: '', raceEntryId: es.entry.id, lapIndex, capturedAt, edited: false }],
      };
      return next;
    });
    // auto-end if all athletes finished
    const allDone = entries.every((e, i) =>
      i === entryIndex
        ? lapIndex + 1 >= race.expectedLaps
        : e.splits.length >= race.expectedLaps
    );
    if (allDone) { await endRace(id); setPhase('done'); }
  };

  const onUndo = async () => {
    if (!lastTap) return;
    await undoLastSplit(lastTap.entryId);
    setLastTap(null);
    await loadData();
  };

  const onEndRace = () => {
    Alert.alert('End race?', 'This will stop the clock for all athletes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Race', style: 'destructive', onPress: async () => {
        await endRace(id);
        setPhase('done');
      }},
    ]);
  };

  const onReview = () => router.replace(`/race/${id}/review`);

  const gridStyle = entries.length <= 2 ? s.grid1col : s.grid2col;

  if (!race) return null;

  // PRE-RACE OVERLAY
  if (phase === 'pre') return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <Text style={s.raceTitle}>{race.distanceM}m — {race.expectedLaps} Laps</Text>
      <Text style={s.goHint}>Tap GO when the gun fires.</Text>
      <Text style={s.goWarning}>Keep the app open — screen will stay on.</Text>
      <TouchableOpacity style={s.goBtn} onPress={onGo} accessibilityLabel="Start race">
        <Text style={s.goBtnText}>GO</Text>
      </TouchableOpacity>
    </View>
  );

  // DONE OVERLAY
  if (phase === 'done') return (
    <View style={s.container}>
      <Text style={s.raceTitle}>Race Complete</Text>
      <TouchableOpacity style={[s.goBtn, { backgroundColor: colors.accent }]} onPress={onReview}>
        <Text style={s.goBtnText}>Review →</Text>
      </TouchableOpacity>
    </View>
  );

  // RUNNING
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <RaceClock elapsedMs={elapsed} />
      <View style={gridStyle}>
        {entries.map((es, i) => (
          <AthleteCell
            key={es.entry.id}
            name={es.athleteName}
            slotIndex={es.entry.slotIndex}
            lapIndex={es.splits.length}
            expectedLaps={race.expectedLaps}
            capturedAts={es.splits.map((s) => s.capturedAt)}
            startedAt={startedAt!}
            targetCumulativeMs={es.targets.length > 0 ? es.targets.map((t) => t.targetMs) : undefined}
            onTap={() => onTap(i)}
            finished={es.splits.length >= race.expectedLaps}
          />
        ))}
      </View>
      <View style={s.controls}>
        <TouchableOpacity style={s.undoBtn} onPress={onUndo} disabled={!lastTap}>
          <Text style={[s.undoBtnText, !lastTap && s.disabled]}>↩ Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.endBtn} onLongPress={onEndRace} delayLongPress={2000}>
          <Text style={s.endBtnText}>End Race (hold)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 48, paddingHorizontal: 8 },
  raceTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  goHint: { color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  goWarning: { color: colors.warning, textAlign: 'center', fontSize: 13, marginBottom: 32 },
  goBtn: { alignSelf: 'center', width: 180, height: 180, borderRadius: 90, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  goBtnText: { color: '#fff', fontSize: 52, fontWeight: '900' },
  grid1col: { flex: 1, flexDirection: 'column', padding: 4 },
  grid2col: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 24, paddingTop: 8 },
  undoBtn: { padding: 12 },
  undoBtnText: { color: colors.textSecondary, fontSize: 15 },
  endBtn: { padding: 12 },
  endBtnText: { color: colors.danger, fontSize: 15 },
  disabled: { opacity: 0.3 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Manual verification on device/simulator**

Launch app → New Race → 1600m → assign 2 athletes → Start Race → tap GO → tap athletes through 4 laps each → confirm race ends → review screen placeholder shows.

Kill the app mid-race; reopen. Verify "resume" race is detected (status = 'running' race loads back to live screen).

- [ ] **Step 4: Commit**

```bash
git add app/race/[id]/live.tsx
git commit -m "feat: live race screen — GO button, per-athlete tap grid, pacing deltas, undo, crash recovery"
```

---

## Task 14: Race review screen

**Files:**
- Create: `app/race/[id]/review.tsx`

- [ ] **Step 1: Implement review.tsx**

```typescript
// app/race/[id]/review.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRace, getRaceEntries, discardRace } from '@/repos/races';
import { getSplitsForEntry, getTargetsForEntry, editSplit } from '@/repos/splits';
import { getAthlete } from '@/repos/athletes';
import type { Race, RaceEntry, Split, TargetSplit, Athlete } from '@/db/schema';
import { formatMs, formatDeltaMs, lapTimeMs, cumulativeMs, deltaMs } from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';

type Row = { entry: RaceEntry; athlete: Athlete | null; splits: Split[]; targets: TargetSplit[] };

export default function RaceReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [race, setRace]   = useState<Race | null>(null);
  const [rows, setRows]   = useState<Row[]>([]);
  const [editing, setEditing] = useState<{ split: Split; value: string } | null>(null);

  const load = async () => {
    const r = await getRace(id);
    if (!r) return;
    setRace(r);
    const entries = await getRaceEntries(id);
    const loaded = await Promise.all(entries.map(async (entry) => {
      const splits  = await getSplitsForEntry(entry.id);
      const targets = await getTargetsForEntry(entry.id);
      const athlete = entry.athleteId ? await getAthlete(entry.athleteId) : null;
      return { entry, athlete, splits, targets };
    }));
    setRows(loaded.sort((a, b) => a.entry.slotIndex - b.entry.slotIndex));
  };

  useEffect(() => { load(); }, [id]);

  const onDiscard = () => {
    Alert.alert('Discard race?', 'This race will be marked discarded and hidden from history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        await discardRace(id);
        router.replace('/');
      }},
    ]);
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    // parse "M:SS.hh" back to ms
    const match = editing.value.match(/^(\d+):(\d{2})\.(\d{2})$/);
    if (!match) { Alert.alert('Invalid format', 'Enter time as M:SS.hh (e.g. 1:02.50)'); return; }
    const ms = (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000 + parseInt(match[3]) * 10;
    const newCapturedAt = race!.startedAt! + ms;
    await editSplit(editing.split.id, newCapturedAt);
    setEditing(null);
    await load();
  };

  if (!race) return null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{race.distanceM}m · {race.expectedLaps} Laps</Text>

      {rows.map((row) => {
        const slotColor = SLOT_COLORS[row.entry.slotIndex];
        const capturedAts = row.splits.map((sp) => sp.capturedAt);
        const targets = row.targets.map((t) => t.targetMs);
        return (
          <View key={row.entry.id} style={[s.card, { borderLeftColor: slotColor }]}>
            <Text style={[s.cardName, { color: slotColor }]}>{row.athlete?.name ?? row.entry.teamName ?? '?'}</Text>
            {row.splits.map((sp, lapIdx) => {
              const lapMs = lapTimeMs(capturedAts, lapIdx, race.startedAt!);
              const cumMs = cumulativeMs(capturedAts, lapIdx, race.startedAt!);
              const delta = targets.length > 0 ? deltaMs(capturedAts, lapIdx, race.startedAt!, targets) : null;
              const deltaColor = delta === null ? colors.neutral : delta < 0 ? colors.success : colors.danger;
              return (
                <TouchableOpacity key={sp.id} style={s.splitRow} onPress={() => setEditing({ split: sp, value: formatMs(cumMs) })}>
                  <Text style={s.lapNum}>Lap {lapIdx + 1}</Text>
                  <Text style={s.lapMs}>{formatMs(lapMs)}</Text>
                  <Text style={s.cumMs}>{formatMs(cumMs)}</Text>
                  {delta !== null && <Text style={[s.delta, { color: deltaColor }]}>{formatDeltaMs(delta)}</Text>}
                  {sp.edited && <Text style={s.editedTag}>edited</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      <TouchableOpacity style={s.discardBtn} onPress={onDiscard}>
        <Text style={s.discardText}>Discard Race</Text>
      </TouchableOpacity>

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Edit split (cumulative time)</Text>
            <TextInput
              style={s.dialogInput}
              value={editing?.value ?? ''}
              onChangeText={(v) => setEditing((e) => e ? { ...e, value: v } : null)}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={s.dialogHint}>Format: M:SS.hh (e.g. 1:02.50)</Text>
            <View style={s.dialogActions}>
              <TouchableOpacity onPress={() => setEditing(null)}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={onSaveEdit}><Text style={s.save}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 10, borderLeftWidth: 4, marginBottom: 20, padding: 14 },
  cardName: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  lapNum: { color: colors.textSecondary, width: 50, fontSize: 13 },
  lapMs: { color: colors.textPrimary, fontSize: 16, fontFamily: 'monospace', width: 80 },
  cumMs: { color: colors.textSecondary, fontSize: 14, fontFamily: 'monospace', width: 80 },
  delta: { fontSize: 14, fontFamily: 'monospace', width: 60 },
  editedTag: { color: colors.warning, fontSize: 11, marginLeft: 4 },
  discardBtn: { marginTop: 24, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' },
  discardText: { color: colors.danger, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 32 },
  dialog: { backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 24 },
  dialogTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dialogInput: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: 12, fontSize: 20, fontFamily: 'monospace', textAlign: 'center', borderWidth: 1, borderColor: colors.border },
  dialogHint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancel: { color: colors.textSecondary, fontSize: 16, padding: 8 },
  save: { color: colors.accent, fontSize: 16, fontWeight: '700', padding: 8 },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Manual verification**

Complete a race. Navigate to review. Confirm all splits display. Tap a split to edit. Discard a test race and confirm it disappears from history.

- [ ] **Step 4: Commit**

```bash
git add app/race/[id]/review.tsx
git commit -m "feat: race review screen — split grid, inline edit, discard"
```

---

## Task 15: Home screen + history tab

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/history/index.tsx`

- [ ] **Step 1: Implement Home screen with resume banner**

```typescript
// app/(tabs)/index.tsx
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { getRunningRace, getRecentRaces } from '@/repos/races';
import type { Race } from '@/db/schema';
import { formatMs } from '@/domain/timing';
import { colors } from '@/theme/colors';

export default function HomeScreen() {
  const [runningRace, setRunningRace] = useState<Race | null>(null);
  const [recent, setRecent]           = useState<Race[]>([]);
  const router = useRouter();

  const load = useCallback(() => {
    getRunningRace().then(setRunningRace);
    getRecentRaces(10).then(setRecent);
  }, []);

  useFocusEffect(load);

  return (
    <View style={s.container}>
      {runningRace && (
        <TouchableOpacity style={s.resumeBanner} onPress={() => router.push(`/race/${runningRace.id}/live`)}>
          <Text style={s.resumeText}>⚡ Race in progress — tap to resume</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={recent}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={<Text style={s.sectionHeader}>Recent Races</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.raceRow} onPress={() => router.push(`/race/${item.id}/review`)}>
            <Text style={s.raceDist}>{item.distanceM}m</Text>
            <Text style={s.raceDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No races yet. Create one below.</Text>}
      />
      <Link href="/race/setup" asChild>
        <TouchableOpacity style={s.newRaceBtn}>
          <Text style={s.newRaceBtnText}>+ New Race</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  resumeBanner: { backgroundColor: colors.warning, padding: 14, margin: 12, borderRadius: 10 },
  resumeText: { color: '#000', fontWeight: '700', textAlign: 'center' },
  sectionHeader: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, padding: 16, paddingBottom: 8 },
  raceRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  raceDist: { color: colors.textPrimary, fontSize: 16 },
  raceDate: { color: colors.textSecondary, fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
  newRaceBtn: { position: 'absolute', bottom: 32, alignSelf: 'center', backgroundColor: colors.success, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30 },
  newRaceBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
```

- [ ] **Step 2: Implement history screen**

```typescript
// app/(tabs)/history/index.tsx
import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getRecentRaces } from '@/repos/races';
import type { Race } from '@/db/schema';
import { colors } from '@/theme/colors';

export default function HistoryScreen() {
  const [races, setRaces] = useState<Race[]>([]);
  const router = useRouter();

  useFocusEffect(useCallback(() => { getRecentRaces(100).then(setRaces); }, []));

  return (
    <View style={s.container}>
      <FlatList
        data={races}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => router.push(`/race/${item.id}/review`)}>
            <Text style={s.dist}>{item.distanceM}m</Text>
            <Text style={s.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No completed races yet.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  dist: { color: colors.textPrimary, fontSize: 16 },
  date: { color: colors.textSecondary, fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
});
```

- [ ] **Step 3: Verify full flow**

Complete end-to-end: Home → New Race → Live → Review → Home shows it in recent list.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/index.tsx app/(tabs)/history/
git commit -m "feat: home screen with resume banner + history tab"
```

---

## Task 16: docs/BUILD.md

**Files:**
- Create: `docs/BUILD.md`

- [ ] **Step 1: Write BUILD.md**

```markdown
# TeamTimer — Build Guide

## Prerequisites

- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)
- Expo CLI (`pnpm add -g expo-cli`)
- [Expo Go](https://expo.dev/client) installed on your phone, OR an iOS Simulator / Android Emulator

For device builds (TestFlight / Play Store):
- Apple Developer account ($99/yr) with Xcode installed
- Google Play Console account ($25 one-time)
- EAS CLI (`pnpm add -g eas-cli`) + `eas login`

## Local Setup

```bash
git clone <repo-url>
cd teamtimer
pnpm install
```

## Run

```bash
pnpm start          # start Expo dev server
pnpm ios            # open in iOS Simulator
pnpm android        # open in Android Emulator
```

Scan the QR code with Expo Go on your phone to run on a real device.

## Type check / lint / test

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:watch     # watch mode
```

## Database

Migrations run automatically on app start (via `src/db/migrate.ts`).

To re-generate migrations after a schema change:

```bash
pnpm db:generate
```

Review `src/db/migrations/` for the generated SQL, then relaunch the app to apply.

## Build for device (EAS)

```bash
# iOS (requires Apple Developer account)
eas build --platform ios --profile preview

# Android APK
eas build --platform android --profile preview

# Both
eas build --platform all --profile preview
```

Builds appear in [expo.dev](https://expo.dev) under your project. Download + install the `.ipa` / `.apk`.

For TestFlight distribution:

```bash
eas submit --platform ios
```

## Timing note

This app uses `Date.now()` to capture split timestamps. Precision is coaching-grade (~±1ms capture, ~±150ms human reaction variance). It is not a FAT (Fully Automatic Timing) system. Race clock derives elapsed from the stored `startedAt` timestamp — it stays correct even if the app is briefly backgrounded.
```

- [ ] **Step 2: Commit**

```bash
git add docs/BUILD.md
git commit -m "docs: BUILD.md — setup, run, test, deploy guide"
```

---

## Phases 4–8 (Subsequent Plans)

These phases are described in the approved spec at `/root/.claude/plans/fancy-shimmying-karp.md`. Each should be planned in detail when Phases 0–3 are stable on device.

**Phase 5 — Athlete detail + improvement chart**
- `app/(tabs)/athletes/[id].tsx` full implementation
- `src/components/ImprovementChart.tsx` (react-native-svg line chart)
- PR computation from `timing.prMs()`

**Phase 6 — Relay support**
- Race setup relay branch (team name + 4-athlete ordered legs)
- `src/components/RelayCell.tsx`
- Live screen relay cell rendering
- Review: per-leg times attributed to athletes

**Phase 7 — Polish**
- Dark/light theme system toggle
- Accessibility: VoiceOver / TalkBack labels on all interactive elements
- Empty states for every list
- App icon + splash screen (update `app.json`)

**Phase 8 — Ship**
- `eas.json` with preview + production profiles
- Apple provisioning walkthrough
- TestFlight + Play Internal Testing build verification

---

## Self-Review

**Spec coverage:**
- ✅ Athletes CRUD + archive (Tasks 7–8)
- ✅ Individual race creation with distance + pacing (Tasks 9–10)
- ✅ Live tap screen: GO button, per-athlete cells, haptics, undo, keep-awake (Tasks 11–13)
- ✅ Pacing deltas live in race (AthleteCell, Tasks 6 + 12)
- ✅ Crash recovery: every tap persists, running race detected on relaunch (Task 13)
- ✅ Post-race review + split edit (Task 14)
- ✅ Home resume banner + history (Task 15)
- ✅ Relay deferred to Phase 6 (noted above)
- ✅ Athlete improvement chart deferred to Phase 5 (noted above)

**Type consistency:**
- `formatMs` defined in `timing.ts` Task 6, used in Tasks 12–15 ✓
- `lapTimeMs`, `cumulativeMs`, `deltaMs` all defined in Task 6, imported in Tasks 12 + 14 ✓
- `SLOT_COLORS` exported from `colors.ts` Task 3, imported in Tasks 12 + 14 ✓
- `appendSplit(raceEntryId, lapIndex)` defined in Task 9, called in Task 13 ✓
- `getRace` / `getRaceEntries` defined in Task 9, called in Tasks 13–14 ✓
```
