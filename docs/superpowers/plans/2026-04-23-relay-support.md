# Relay Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4-leg relay race support — per-leg athlete assignment at setup, a live RelayCell showing the current runner and leg timer, and a leg-grouped split review layout; no schema changes needed since `relay_legs` already exists.

**Architecture:** Two new repo query functions target the existing `relay_legs` table. A new `RelayCell` component (pure timing from props, no internal state) and a shared `ChangeAthleteModal` provide the relay UI primitives. The existing setup, live, and review screens each gain a relay branch gated on `race.kind === 'relay'`, leaving individual paths fully unchanged.

**Tech Stack:** Expo Router, React Native, Drizzle ORM + expo-sqlite, TypeScript strict, Jest + React Native Testing Library, expo-haptics

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/repos/races.ts` | Add `getRelayLegsForEntry`, `updateRelayLegAthlete` |
| Create | `src/components/ChangeAthleteModal.tsx` | Scrollable athlete picker bottom sheet |
| Create | `src/components/RelayCell.tsx` | Live relay team cell |
| Modify | `app/race/setup.tsx` | Relay team-builder branch in step 2, skip pacing |
| Modify | `app/race/[id]/live.tsx` | Relay data loading + RelayCell rendering |
| Modify | `app/race/[id]/review.tsx` | Relay data loading + leg-grouped rendering |
| Create | `tests/unit/relay-legs.test.ts` | Repo function unit tests |
| Create | `tests/component/RelayCell.test.tsx` | RelayCell timing + interaction tests |
| Create | `tests/component/RelaySetup.test.tsx` | Setup relay branch tests |
| Create | `tests/component/RelayLive.test.tsx` | Live screen relay rendering + Change button |
| Create | `tests/component/RelayReview.test.tsx` | Review screen leg dividers + split rows |

---

### Task 1: Relay Repo Functions

**Files:**
- Create: `tests/unit/relay-legs.test.ts`
- Modify: `src/repos/races.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/relay-legs.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/unit/relay-legs.test.ts
```

Expected: FAIL — `getRelayLegsForEntry is not a function` (or similar — the exports don't exist yet)

- [ ] **Step 3: Add `asc` and `RelayLeg` to imports in `src/repos/races.ts`**

In `src/repos/races.ts`, change line 2:
```typescript
// before
import { eq, desc } from 'drizzle-orm';
// after
import { eq, desc, asc } from 'drizzle-orm';
```

Change lines 4–11:
```typescript
// before
import {
  races,
  raceEntries,
  targetSplits,
  relayLegs,
  type Race,
  type RaceEntry,
} from '@/db/schema';
// after
import {
  races,
  raceEntries,
  targetSplits,
  relayLegs,
  type Race,
  type RaceEntry,
  type RelayLeg,
} from '@/db/schema';
```

- [ ] **Step 4: Append the two new functions to `src/repos/races.ts`**

After the last function (`getRaceEntries`) add:

```typescript
export async function getRelayLegsForEntry(raceEntryId: string): Promise<RelayLeg[]> {
  return db
    .select()
    .from(relayLegs)
    .where(eq(relayLegs.raceEntryId, raceEntryId))
    .orderBy(asc(relayLegs.legIndex));
}

export async function updateRelayLegAthlete(relayLegId: string, athleteId: string): Promise<void> {
  await db.update(relayLegs).set({ athleteId }).where(eq(relayLegs.id, relayLegId));
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/unit/relay-legs.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 6: Run full test suite and typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/repos/races.ts tests/unit/relay-legs.test.ts
git commit -m "feat: add getRelayLegsForEntry and updateRelayLegAthlete repo functions"
```

---

### Task 2: ChangeAthleteModal + RelayCell Components

**Files:**
- Create: `src/components/ChangeAthleteModal.tsx`
- Create: `src/components/RelayCell.tsx`
- Create: `tests/component/RelayCell.test.tsx`

- [ ] **Step 1: Write failing RelayCell tests**

Create `tests/component/RelayCell.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RelayCell } from '../../src/components/RelayCell';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const BASE_PROPS = {
  teamName: 'Team A',
  slotIndex: 0 as const,
  currentLegIndex: 1, // leg 2 running (0-based)
  legRunnerNames: ['Marcus', 'Jake', 'Sam', 'Dani'],
  capturedAts: [1_062_000, 1_124_000], // 2 splits: leg 1 complete
  startedAt: 1_000_000,
  elapsedMs: 200_000, // 200s since race start
  expectedLaps: 8,    // 4×800m → 2 laps per leg
  onTap: jest.fn(),
  onChangeLeg: jest.fn(),
  finished: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RelayCell', () => {
  it('shows current runner name', () => {
    render(<RelayCell {...BASE_PROPS} />);
    expect(screen.getByText('Jake')).toBeTruthy();
  });

  it('shows Leg N/4 header with team name', () => {
    render(<RelayCell {...BASE_PROPS} />);
    expect(screen.getByText('Leg 2/4 · Team A')).toBeTruthy();
  });

  it('derives leg time from capturedAts and startedAt', () => {
    // legStartEpoch = capturedAts[1*2-1] = capturedAts[1] = 1_124_000
    // legElapsedMs = 200_000 - (1_124_000 - 1_000_000) = 76_000 → "1:16.00"
    render(<RelayCell {...BASE_PROPS} />);
    expect(screen.getByText('1:16.00')).toBeTruthy();
  });

  it('shows completed leg chip for each finished leg', () => {
    // Leg 1 total = capturedAts[1] - startedAt = 124_000 → "2:04.00"
    render(<RelayCell {...BASE_PROPS} />);
    expect(screen.getByText('L1 Marcus 2:04.00')).toBeTruthy();
  });

  it('calls onTap when cell is pressed', () => {
    render(<RelayCell {...BASE_PROPS} />);
    fireEvent.press(screen.getByText('Jake'));
    expect(BASE_PROPS.onTap).toHaveBeenCalledTimes(1);
  });

  it('does not call onTap when finished', () => {
    const onTap = jest.fn();
    render(<RelayCell {...BASE_PROPS} onTap={onTap} finished={true} />);
    fireEvent.press(screen.getByText('DONE'));
    expect(onTap).not.toHaveBeenCalled();
  });

  it('calls onChangeLeg when Change button is pressed', () => {
    render(<RelayCell {...BASE_PROPS} />);
    fireEvent.press(screen.getByText('Change'));
    expect(BASE_PROPS.onChangeLeg).toHaveBeenCalledTimes(1);
  });

  it('shows DONE when finished', () => {
    render(<RelayCell {...BASE_PROPS} finished={true} />);
    expect(screen.getByText('DONE')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/component/RelayCell.test.tsx
```

Expected: FAIL — `Cannot find module '../../src/components/RelayCell'`

- [ ] **Step 3: Create `src/components/ChangeAthleteModal.tsx`**

```typescript
// src/components/ChangeAthleteModal.tsx
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';

type Props = {
  visible: boolean;
  athletes: Athlete[];
  onSelect: (athleteId: string) => void;
  onClose: () => void;
};

export function ChangeAthleteModal({ visible, athletes, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet}>
          <Text style={s.title}>Select Athlete</Text>
          <FlatList
            data={athletes}
            keyExtractor={(a) => a.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => { onSelect(item.id); onClose(); }}
              >
                <Text style={s.name}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    padding: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.textPrimary, fontSize: 16 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Create `src/components/RelayCell.tsx`**

```typescript
// src/components/RelayCell.tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatMs } from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  teamName: string;
  slotIndex: 0 | 1 | 2 | 3;
  currentLegIndex: number;    // 0–3; capped at 3 when finished
  legRunnerNames: string[];   // length 4, one name per leg by legIndex
  capturedAts: number[];      // all splits for this entry so far (ms epoch)
  startedAt: number;          // race.startedAt (ms epoch)
  elapsedMs: number;          // current elapsed from useRaceClock
  expectedLaps: number;       // e.g. 8 for 4×800
  onTap: () => void;
  onChangeLeg: () => void;
  finished: boolean;
};

export function RelayCell({
  teamName,
  slotIndex,
  currentLegIndex,
  legRunnerNames,
  capturedAts,
  startedAt,
  elapsedMs,
  expectedLaps,
  onTap,
  onChangeLeg,
  finished,
}: Props) {
  const lapsPerLeg = expectedLaps / 4;
  const legStartEpoch =
    currentLegIndex === 0 ? startedAt : capturedAts[currentLegIndex * lapsPerLeg - 1];
  const legElapsedMs = elapsedMs - (legStartEpoch - startedAt);
  const lapsInCurrentLeg = capturedAts.length - currentLegIndex * lapsPerLeg;

  const completedLegs = Array.from({ length: currentLegIndex }, (_, i) => {
    const legStart = i === 0 ? startedAt : capturedAts[i * lapsPerLeg - 1];
    const legEnd = capturedAts[(i + 1) * lapsPerLeg - 1];
    return { name: legRunnerNames[i] ?? '?', totalMs: legEnd - legStart };
  });

  const slotColor = SLOT_COLORS[slotIndex];

  const handlePress = () => {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap();
  };

  return (
    <TouchableOpacity
      style={[s.cell, { borderLeftColor: slotColor }, finished && s.cellFinished]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <Text style={s.headerText}>
          Leg {currentLegIndex + 1}/4 · {teamName}
        </Text>
        <TouchableOpacity style={s.changeBtn} onPress={onChangeLeg}>
          <Text style={s.changeBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {finished ? (
        <Text style={s.done}>DONE</Text>
      ) : (
        <Text style={s.runnerName}>{legRunnerNames[currentLegIndex] ?? '?'}</Text>
      )}

      <View style={s.stats}>
        <View>
          <Text style={s.statLabel}>Leg time</Text>
          <Text style={s.legTime}>{formatMs(legElapsedMs)}</Text>
        </View>
        <View>
          <Text style={s.statLabel}>Laps in leg</Text>
          <Text style={s.statValue}>{lapsInCurrentLeg} / {lapsPerLeg}</Text>
        </View>
        <View>
          <Text style={s.statLabel}>Total</Text>
          <Text style={s.statValue}>{formatMs(elapsedMs)}</Text>
        </View>
      </View>

      {completedLegs.length > 0 && (
        <View style={s.chips}>
          {completedLegs.map((leg, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>
                L{i + 1} {leg.name} {formatMs(leg.totalMs)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    margin: 4,
    padding: 14,
  },
  cellFinished: { opacity: 0.55 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerText: {
    color: colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBtnText: { color: colors.textSecondary, fontSize: 10 },
  runnerName: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 2 },
  done: { color: colors.textSecondary, fontSize: 18, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  statLabel: { color: colors.textDisabled, fontSize: 9, textTransform: 'uppercase' },
  legTime: { ...typography.splitTime, color: colors.warning },
  statValue: { ...typography.splitTime, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipText: { color: colors.textDisabled, fontSize: 9 },
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/component/RelayCell.test.tsx
```

Expected: PASS — 8 tests passing

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/ChangeAthleteModal.tsx src/components/RelayCell.tsx tests/component/RelayCell.test.tsx
git commit -m "feat: add RelayCell and ChangeAthleteModal components"
```

---

### Task 3: Relay Setup

**Files:**
- Modify: `app/race/setup.tsx`
- Create: `tests/component/RelaySetup.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/component/RelaySetup.test.tsx`:

```typescript
jest.mock('@/repos/athletes', () => ({ listAthletes: jest.fn() }));
jest.mock('@/repos/races', () => ({ createRace: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RaceSetupScreen from '../../app/race/setup';
import { listAthletes } from '@/repos/athletes';
import { createRace } from '@/repos/races';

const ATHLETES = [
  { id: 'a1', name: 'Marcus Webb', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a2', name: 'Jake Torres', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a3', name: 'Sam Rivera', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a4', name: 'Dani Kim', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  (listAthletes as jest.Mock).mockResolvedValue(ATHLETES);
  (createRace as jest.Mock).mockResolvedValue('race-relay-1');
});

// Helper: render and navigate to relay step 2
async function goToRelayStep2() {
  render(<RaceSetupScreen />);
  await waitFor(() => {}); // flush useEffect
  fireEvent.press(screen.getByText('Relay'));
  fireEvent.press(screen.getByText('Next: Athletes →'));
}

describe('RelaySetup', () => {
  it('shows team name input in relay step 2', async () => {
    await goToRelayStep2();
    expect(screen.getByPlaceholderText('Team name')).toBeTruthy();
  });

  it('shows 4 leg pickers for the expanded team', async () => {
    await goToRelayStep2();
    expect(screen.getByText('Leg 1')).toBeTruthy();
    expect(screen.getByText('Leg 2')).toBeTruthy();
    expect(screen.getByText('Leg 3')).toBeTruthy();
    expect(screen.getByText('Leg 4')).toBeTruthy();
  });

  it('does not show pacing step for relay races', async () => {
    await goToRelayStep2();
    expect(screen.queryByText(/Pacing Strategy/)).toBeNull();
  });

  it('Start Race button is disabled when team has no name or unassigned legs', async () => {
    await goToRelayStep2();
    // Button exists but disabled — pressing it should not call createRace
    fireEvent.press(screen.getByText('Start Race →'));
    expect(createRace).not.toHaveBeenCalled();
  });

  it('tapping a second team slot expands it and collapses the first', async () => {
    await goToRelayStep2();
    // Add a second team
    fireEvent.press(screen.getByText('+ Add Team'));
    // Tap the first team header to collapse it and see that its pickers are replaced by second team's
    fireEvent.press(screen.getByText('#2'));
    // Now team 2 is expanded (its pickers show), team 1 is collapsed
    // Each expanded team shows exactly one set of 4 Leg pickers
    expect(screen.getAllByText('Leg 1').length).toBe(1);
  });

  it('opens athlete picker modal when a leg row is tapped', async () => {
    await goToRelayStep2();
    fireEvent.press(screen.getByText('Leg 1'));
    await waitFor(() => expect(screen.getByText('Marcus Webb')).toBeTruthy());
  });

  it('assigns athlete to leg after selecting from modal', async () => {
    await goToRelayStep2();
    fireEvent.press(screen.getByText('Leg 1'));
    await waitFor(() => expect(screen.getByText('Marcus Webb')).toBeTruthy());
    fireEvent.press(screen.getByText('Marcus Webb'));
    // The leg now shows the athlete's name
    await waitFor(() => expect(screen.getByText('Marcus Webb')).toBeTruthy());
  });

  it('calls createRace with relay entries when all legs assigned and name set', async () => {
    await goToRelayStep2();

    // Set team name
    fireEvent.changeText(screen.getByPlaceholderText('Team name'), 'Team A');

    // Assign all 4 legs
    for (const [legLabel, athleteName] of [
      ['Leg 1', 'Marcus Webb'],
      ['Leg 2', 'Jake Torres'],
      ['Leg 3', 'Sam Rivera'],
      ['Leg 4', 'Dani Kim'],
    ]) {
      fireEvent.press(screen.getByText(legLabel));
      await waitFor(() => expect(screen.getByText(athleteName)).toBeTruthy());
      fireEvent.press(screen.getByText(athleteName));
    }

    await waitFor(() => expect(screen.getByText('Start Race →')).toBeTruthy());
    fireEvent.press(screen.getByText('Start Race →'));

    await waitFor(() => {
      expect(createRace).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'relay',
          entries: [
            expect.objectContaining({
              slotIndex: 0,
              teamName: 'Team A',
              legs: [
                { legIndex: 0, athleteId: 'a1' },
                { legIndex: 1, athleteId: 'a2' },
                { legIndex: 2, athleteId: 'a3' },
                { legIndex: 3, athleteId: 'a4' },
              ],
            }),
          ],
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/component/RelaySetup.test.tsx
```

Expected: FAIL — relay step 2 still shows individual athlete UI

- [ ] **Step 3: Add relay state and imports to `app/race/setup.tsx`**

Add `TextInput` to the React Native import list (line 7):
```typescript
// before
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
// after
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
```

After the existing imports block, add the ChangeAthleteModal import:
```typescript
import { ChangeAthleteModal } from '@/components/ChangeAthleteModal';
```

After the `const [goalMs, setGoalMs] = useState(240000);` line, add:
```typescript
type RelayTeam = { name: string; legs: (string | null)[] };
const [teams, setTeams] = useState<RelayTeam[]>([{ name: '', legs: [null, null, null, null] }]);
const [expandedTeam, setExpandedTeam] = useState(0);
const [pickingLeg, setPickingLeg] = useState<{ teamIdx: number; legIdx: number } | null>(null);

const relayReady =
  kind === 'relay' &&
  teams.length > 0 &&
  teams.every((t) => t.name.trim() !== '' && t.legs.every((l) => l !== null));

const relayOnStart = async () => {
  const raceId = await createRace({
    kind: 'relay',
    distanceM,
    lapDistanceM: lapDistM,
    expectedLaps: laps,
    entries: teams.map((team, slotIndex) => ({
      slotIndex,
      teamName: team.name,
      legs: team.legs.map((athleteId, legIndex) => ({
        legIndex,
        athleteId: athleteId!,
      })),
    })),
  });
  router.replace(`/race/${raceId}/live`);
};
```

- [ ] **Step 4: Add relay step 2 branch before the individual step 2**

Insert this block immediately before the `// Step 2: athlete assignment` comment:

```typescript
// Step 2 (relay): team builder
if (step === 2 && kind === 'relay') {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Teams</Text>

      {teams.map((team, teamIdx) => {
        const isExpanded = expandedTeam === teamIdx;
        const teamColor = colors.slot[teamIdx as 0 | 1 | 2 | 3];
        return (
          <View key={teamIdx} style={[s.slotRow, { borderLeftColor: teamColor }]}>
            <TouchableOpacity
              style={s.teamHeaderRow}
              onPress={() => setExpandedTeam(teamIdx)}
            >
              <Text style={[s.slotLabel, { color: teamColor }]}>#{teamIdx + 1}</Text>
              <Text style={s.slotAthlete}>{team.name || 'Team Name'}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={s.teamExpanded}>
                <TextInput
                  style={s.teamNameInput}
                  value={team.name}
                  onChangeText={(text) =>
                    setTeams((prev) =>
                      prev.map((t, i) => (i === teamIdx ? { ...t, name: text } : t)),
                    )
                  }
                  placeholder="Team name"
                  placeholderTextColor={colors.textDisabled}
                />
                {[0, 1, 2, 3].map((legIdx) => {
                  const assignedId = team.legs[legIdx];
                  const assignedAthlete = assignedId
                    ? athletes.find((a) => a.id === assignedId)
                    : null;
                  return (
                    <TouchableOpacity
                      key={legIdx}
                      style={s.legRow}
                      onPress={() => setPickingLeg({ teamIdx, legIdx })}
                    >
                      <Text style={[s.legLabel, { color: teamColor }]}>
                        Leg {legIdx + 1}
                      </Text>
                      <Text style={s.legAthlete}>
                        {assignedAthlete?.name ?? 'Pick athlete…'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {teams.length < 4 && (
        <TouchableOpacity
          style={s.addTeamBtn}
          onPress={() => {
            const newIdx = teams.length;
            setTeams((prev) => [
              ...prev,
              { name: '', legs: [null, null, null, null] },
            ]);
            setExpandedTeam(newIdx);
          }}
        >
          <Text style={s.addTeamText}>+ Add Team</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[s.next, s.go, !relayReady && s.nextDisabled]}
        onPress={relayOnStart}
        disabled={!relayReady}
      >
        <Text style={s.nextText}>Start Race →</Text>
      </TouchableOpacity>

      <ChangeAthleteModal
        visible={pickingLeg !== null}
        athletes={athletes}
        onSelect={(athleteId) => {
          if (!pickingLeg) return;
          const { teamIdx, legIdx } = pickingLeg;
          setTeams((prev) =>
            prev.map((t, i) =>
              i === teamIdx
                ? { ...t, legs: t.legs.map((l, j) => (j === legIdx ? athleteId : l)) }
                : t,
            ),
          );
          setPickingLeg(null);
        }}
        onClose={() => setPickingLeg(null)}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Add new style properties to the `StyleSheet.create` in `app/race/setup.tsx`**

Inside the `StyleSheet.create({...})` call (after the last existing style entry), add:

```typescript
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  teamExpanded: { marginTop: 8 },
  teamNameInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legLabel: { fontWeight: '700', fontSize: 13, width: 40 },
  legAthlete: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  addTeamBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addTeamText: { color: colors.textSecondary, fontSize: 14 },
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test tests/component/RelaySetup.test.tsx
```

Expected: PASS — 8 tests passing

- [ ] **Step 7: Run full suite and typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all pass, no errors

- [ ] **Step 8: Commit**

```bash
git add app/race/setup.tsx tests/component/RelaySetup.test.tsx
git commit -m "feat: add relay team builder to race setup (step 2, skip pacing)"
```

---

### Task 4: Live Screen Relay Rendering

**Files:**
- Modify: `app/race/[id]/live.tsx`
- Create: `tests/component/RelayLive.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/component/RelayLive.test.tsx`:

```typescript
jest.mock('@/repos/races', () => ({
  getRace: jest.fn(),
  getRaceEntries: jest.fn(),
  startRace: jest.fn(),
  endRace: jest.fn(),
  getRelayLegsForEntry: jest.fn(),
  updateRelayLegAthlete: jest.fn(),
}));
jest.mock('@/repos/athletes', () => ({
  getAthlete: jest.fn(),
  listAthletes: jest.fn(),
}));
jest.mock('@/repos/splits', () => ({
  appendSplit: jest.fn(),
  undoLastSplit: jest.fn(),
  getSplitsForEntry: jest.fn(),
  getTargetsForEntry: jest.fn(),
}));
jest.mock('@/hooks/useRaceClock', () => ({ useRaceClock: jest.fn().mockReturnValue(120_000) }));
jest.mock('@/hooks/useKeepAwake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'race-1' })),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LiveRaceScreen from '../../app/race/[id]/live';
import {
  getRace, getRaceEntries, getRelayLegsForEntry, updateRelayLegAthlete,
} from '@/repos/races';
import { getSplitsForEntry, getTargetsForEntry } from '@/repos/splits';
import { listAthletes, getAthlete } from '@/repos/athletes';

const RELAY_RACE = {
  id: 'race-1',
  kind: 'relay' as const,
  distanceM: 3200,
  lapDistanceM: 400,
  expectedLaps: 8,
  status: 'running' as const,
  startedAt: 1_000_000,
  endedAt: null,
  meetId: null,
  createdAt: 999_000,
};

const ENTRY = {
  id: 'e1',
  raceId: 'race-1',
  slotIndex: 0,
  athleteId: null,
  teamName: 'Team A',
  finishedAt: null,
};

const LEGS = [
  { id: 'l0', raceEntryId: 'e1', legIndex: 0, athleteId: 'a1' },
  { id: 'l1', raceEntryId: 'e1', legIndex: 1, athleteId: 'a2' },
  { id: 'l2', raceEntryId: 'e1', legIndex: 2, athleteId: 'a3' },
  { id: 'l3', raceEntryId: 'e1', legIndex: 3, athleteId: 'a4' },
];

const ATHLETES = [
  { id: 'a1', name: 'Marcus Webb', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a2', name: 'Jake Torres', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a3', name: 'Sam Rivera', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
  { id: 'a4', name: 'Dani Kim', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  (getRace as jest.Mock).mockResolvedValue(RELAY_RACE);
  (getRaceEntries as jest.Mock).mockResolvedValue([ENTRY]);
  (getSplitsForEntry as jest.Mock).mockResolvedValue([]);
  (getTargetsForEntry as jest.Mock).mockResolvedValue([]);
  (getRelayLegsForEntry as jest.Mock).mockResolvedValue(LEGS);
  (listAthletes as jest.Mock).mockResolvedValue(ATHLETES);
  (getAthlete as jest.Mock).mockResolvedValue(null);
  (updateRelayLegAthlete as jest.Mock).mockResolvedValue(undefined);
});

describe('RelayLive', () => {
  it('renders RelayCell (not AthleteCell) for relay race', async () => {
    render(<LiveRaceScreen />);
    await waitFor(() => expect(screen.getByText('Leg 1/4 · Team A')).toBeTruthy());
  });

  it('shows current runner name from relay legs', async () => {
    render(<LiveRaceScreen />);
    await waitFor(() => expect(screen.getByText('Marcus Webb')).toBeTruthy());
  });

  it('Change button opens athlete picker modal', async () => {
    render(<LiveRaceScreen />);
    await waitFor(() => expect(screen.getByText('Change')).toBeTruthy());
    fireEvent.press(screen.getByText('Change'));
    await waitFor(() => expect(screen.getByText('Jake Torres')).toBeTruthy());
  });

  it('selecting athlete from modal calls updateRelayLegAthlete', async () => {
    render(<LiveRaceScreen />);
    await waitFor(() => expect(screen.getByText('Change')).toBeTruthy());
    fireEvent.press(screen.getByText('Change'));
    await waitFor(() => expect(screen.getByText('Jake Torres')).toBeTruthy());
    fireEvent.press(screen.getByText('Jake Torres'));
    await waitFor(() => {
      expect(updateRelayLegAthlete).toHaveBeenCalledWith('l0', 'a2');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/component/RelayLive.test.tsx
```

Expected: FAIL — live screen still renders AthleteCell for relay races

- [ ] **Step 3: Add relay imports to `app/race/[id]/live.tsx`**

Change the existing races import (line 12):
```typescript
// before
import { getRace, getRaceEntries, startRace, endRace } from '@/repos/races';
// after
import {
  getRace,
  getRaceEntries,
  startRace,
  endRace,
  getRelayLegsForEntry,
  updateRelayLegAthlete,
} from '@/repos/races';
```

Change the athletes import (line 19):
```typescript
// before
import { getAthlete } from '@/repos/athletes';
// after
import { getAthlete, listAthletes } from '@/repos/athletes';
```

Change the schema type import (line 20):
```typescript
// before
import type { Race, RaceEntry, Split, TargetSplit } from '@/db/schema';
// after
import type { Race, RaceEntry, Split, TargetSplit, RelayLeg, Athlete } from '@/db/schema';
```

Add component imports after the `RaceClock` import:
```typescript
import { RelayCell } from '@/components/RelayCell';
import { ChangeAthleteModal } from '@/components/ChangeAthleteModal';
```

- [ ] **Step 4: Add relay state variables inside `LiveRaceScreen`**

After `const [lastTapEntry, setLastTapEntry] = useState<string | null>(null);`, add:

```typescript
const [relayLegsMap, setRelayLegsMap]       = useState<Record<string, RelayLeg[]>>({});
const [athleteNamesMap, setAthleteNamesMap] = useState<Record<string, string>>({});
const [changingEntryId, setChangingEntryId] = useState<string | null>(null);
const [allAthletes, setAllAthletes]         = useState<Athlete[]>([]);
```

- [ ] **Step 5: Extend `loadData` to fetch relay legs**

Inside `loadData`, after `setEntries(states.sort(...))`, add:

```typescript
if (r.kind === 'relay') {
  const allA = await listAthletes();
  setAllAthletes(allA);
  setAthleteNamesMap(Object.fromEntries(allA.map((a) => [a.id, a.name])));

  const legsMap: Record<string, RelayLeg[]> = Object.fromEntries(
    await Promise.all(
      rawEntries.map(async (entry) => [entry.id, await getRelayLegsForEntry(entry.id)]),
    ),
  );
  setRelayLegsMap(legsMap);
}
```

- [ ] **Step 6: Add `onChangeLeg` handler inside `LiveRaceScreen`**

After `onEndRace`, add:

```typescript
const onChangeLeg = async (entryId: string, newAthleteId: string) => {
  const legs = relayLegsMap[entryId] ?? [];
  const es = entries.find((e) => e.entry.id === entryId);
  const lapsPerLeg = race!.expectedLaps / 4;
  const currentLegIndex = Math.min(3, Math.floor((es?.splits.length ?? 0) / lapsPerLeg));
  const leg = legs[currentLegIndex];
  if (!leg) return;

  await updateRelayLegAthlete(leg.id, newAthleteId);
  const updatedLegs = await getRelayLegsForEntry(entryId);
  setRelayLegsMap((prev) => ({ ...prev, [entryId]: updatedLegs }));

  if (!athleteNamesMap[newAthleteId]) {
    const athlete = await getAthlete(newAthleteId);
    if (athlete) {
      setAthleteNamesMap((prev) => ({ ...prev, [athlete.id]: athlete.name }));
    }
  }
  setChangingEntryId(null);
};
```

- [ ] **Step 7: Replace the cell rendering in the RUNNING section**

Inside the `<View style={gridStyle}>` (which currently has `{entries.map((es, i) => ( <AthleteCell ... /> ))}`), replace the map body:

```typescript
{entries.map((es, i) => {
  if (race.kind === 'relay') {
    const lapsPerLeg = race.expectedLaps / 4;
    const currentLegIndex = Math.min(3, Math.floor(es.splits.length / lapsPerLeg));
    const legs = relayLegsMap[es.entry.id] ?? [];
    const legRunnerNames = [0, 1, 2, 3].map(
      (legIdx) => athleteNamesMap[legs[legIdx]?.athleteId ?? ''] ?? '?',
    );
    return (
      <RelayCell
        key={es.entry.id}
        teamName={es.entry.teamName ?? '?'}
        slotIndex={es.entry.slotIndex as 0 | 1 | 2 | 3}
        currentLegIndex={currentLegIndex}
        legRunnerNames={legRunnerNames}
        capturedAts={es.splits.map((sp) => sp.capturedAt)}
        startedAt={startedAt!}
        elapsedMs={elapsed}
        expectedLaps={race.expectedLaps}
        onTap={() => onTap(i)}
        onChangeLeg={() => setChangingEntryId(es.entry.id)}
        finished={es.splits.length >= race.expectedLaps}
      />
    );
  }
  return (
    <AthleteCell
      key={es.entry.id}
      name={es.athleteName}
      slotIndex={es.entry.slotIndex as 0 | 1 | 2 | 3}
      lapIndex={es.splits.length}
      expectedLaps={race.expectedLaps}
      capturedAts={es.splits.map((sp) => sp.capturedAt)}
      startedAt={startedAt!}
      {...(es.targets.length > 0
        ? { targetCumulativeMs: es.targets.map((t) => t.targetMs) }
        : {})}
      onTap={() => onTap(i)}
      finished={es.splits.length >= race.expectedLaps}
    />
  );
})}
```

After the closing `</View>` of `gridStyle` (before `<View style={s.controls}>`), add:

```typescript
{race.kind === 'relay' && (
  <ChangeAthleteModal
    visible={changingEntryId !== null}
    athletes={allAthletes}
    onSelect={(athleteId) => {
      if (changingEntryId) {
        void onChangeLeg(changingEntryId, athleteId);
      }
    }}
    onClose={() => setChangingEntryId(null)}
  />
)}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm test tests/component/RelayLive.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 9: Run full suite and typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all pass, no errors

- [ ] **Step 10: Commit**

```bash
git add app/race/[id]/live.tsx tests/component/RelayLive.test.tsx
git commit -m "feat: render RelayCell on live screen with Change athlete support"
```

---

### Task 5: Review Screen Relay Rendering

**Files:**
- Modify: `app/race/[id]/review.tsx`
- Create: `tests/component/RelayReview.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/component/RelayReview.test.tsx`:

```typescript
jest.mock('@/repos/races', () => ({
  getRace: jest.fn(),
  getRaceEntries: jest.fn(),
  discardRace: jest.fn(),
  getRelayLegsForEntry: jest.fn(),
}));
jest.mock('@/repos/splits', () => ({
  getSplitsForEntry: jest.fn(),
  getTargetsForEntry: jest.fn(),
  editSplit: jest.fn(),
}));
jest.mock('@/repos/athletes', () => ({ getAthlete: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'race-1' })),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RaceReviewScreen from '../../app/race/[id]/review';
import { getRace, getRaceEntries, getRelayLegsForEntry } from '@/repos/races';
import { getSplitsForEntry, getTargetsForEntry } from '@/repos/splits';
import { getAthlete } from '@/repos/athletes';

const RELAY_RACE = {
  id: 'race-1',
  kind: 'relay' as const,
  distanceM: 3200,
  lapDistanceM: 400,
  expectedLaps: 8,
  status: 'completed' as const,
  startedAt: 1_000_000,
  endedAt: 1_480_000,
  meetId: null,
  createdAt: 999_000,
};

const ENTRY = {
  id: 'e1',
  raceId: 'race-1',
  slotIndex: 0,
  athleteId: null,
  teamName: 'Team A',
  finishedAt: 1_480_000,
};

// 4×800m: 2 laps per leg, 8 laps total
// startedAt=1_000_000; one split every ~60s
const SPLITS = [
  { id: 's0', raceEntryId: 'e1', lapIndex: 0, capturedAt: 1_058_000, edited: false },
  { id: 's1', raceEntryId: 'e1', lapIndex: 1, capturedAt: 1_118_000, edited: false },
  { id: 's2', raceEntryId: 'e1', lapIndex: 2, capturedAt: 1_175_000, edited: false },
  { id: 's3', raceEntryId: 'e1', lapIndex: 3, capturedAt: 1_233_000, edited: false },
  { id: 's4', raceEntryId: 'e1', lapIndex: 4, capturedAt: 1_292_000, edited: false },
  { id: 's5', raceEntryId: 'e1', lapIndex: 5, capturedAt: 1_353_000, edited: false },
  { id: 's6', raceEntryId: 'e1', lapIndex: 6, capturedAt: 1_412_000, edited: false },
  { id: 's7', raceEntryId: 'e1', lapIndex: 7, capturedAt: 1_480_000, edited: false },
];

const LEGS = [
  { id: 'l0', raceEntryId: 'e1', legIndex: 0, athleteId: 'a1' },
  { id: 'l1', raceEntryId: 'e1', legIndex: 1, athleteId: 'a2' },
  { id: 'l2', raceEntryId: 'e1', legIndex: 2, athleteId: 'a3' },
  { id: 'l3', raceEntryId: 'e1', legIndex: 3, athleteId: 'a4' },
];

const ATHLETE_MAP: Record<string, string> = {
  a1: 'Marcus Webb',
  a2: 'Jake Torres',
  a3: 'Sam Rivera',
  a4: 'Dani Kim',
};

beforeEach(() => {
  jest.clearAllMocks();
  (getRace as jest.Mock).mockResolvedValue(RELAY_RACE);
  (getRaceEntries as jest.Mock).mockResolvedValue([ENTRY]);
  (getSplitsForEntry as jest.Mock).mockResolvedValue(SPLITS);
  (getTargetsForEntry as jest.Mock).mockResolvedValue([]);
  (getRelayLegsForEntry as jest.Mock).mockResolvedValue(LEGS);
  (getAthlete as jest.Mock).mockImplementation(
    (id: string) => Promise.resolve({ id, name: ATHLETE_MAP[id] ?? '?', dateOfBirth: null, notes: null, createdAt: 1000, archivedAt: null }),
  );
});

describe('RelayReview', () => {
  it('shows leg divider with runner name and leg total', async () => {
    render(<RaceReviewScreen />);
    // Leg 1: splits 0–1; Marcus Webb; total = capturedAts[1] - startedAt = 118_000 → "1:58.00"
    await waitFor(() => expect(screen.getByText('Leg 1 · Marcus Webb · 1:58.00')).toBeTruthy());
  });

  it('shows leg 2 divider with correct runner', async () => {
    render(<RaceReviewScreen />);
    // Leg 2: splits 2–3; Jake Torres; total = capturedAts[3] - capturedAts[1] = 115_000 → "1:55.00"
    await waitFor(() => expect(screen.getByText('Leg 2 · Jake Torres · 1:55.00')).toBeTruthy());
  });

  it('shows lap numbers globally (Lap 1 through Lap 8)', async () => {
    render(<RaceReviewScreen />);
    await waitFor(() => {
      expect(screen.getByText('Lap 1')).toBeTruthy();
      expect(screen.getByText('Lap 8')).toBeTruthy();
    });
  });

  it('tapping a split row opens the edit dialog', async () => {
    render(<RaceReviewScreen />);
    await waitFor(() => expect(screen.getByText('Lap 1')).toBeTruthy());
    fireEvent.press(screen.getByText('Lap 1'));
    await waitFor(() =>
      expect(screen.getByText('Edit split (cumulative time)')).toBeTruthy(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/component/RelayReview.test.tsx
```

Expected: FAIL — review screen doesn't fetch relay legs or show leg dividers

- [ ] **Step 3: Add relay imports to `app/race/[id]/review.tsx`**

Change the races import (line 14):
```typescript
// before
import { getRace, getRaceEntries, discardRace } from '@/repos/races';
// after
import { getRace, getRaceEntries, discardRace, getRelayLegsForEntry } from '@/repos/races';
```

Change the schema type import (line 17):
```typescript
// before
import type { Race, RaceEntry, Split, TargetSplit, Athlete } from '@/db/schema';
// after
import type { Race, RaceEntry, Split, TargetSplit, Athlete, RelayLeg } from '@/db/schema';
```

- [ ] **Step 4: Extend the `Row` type and `load` function**

Change the `Row` type (lines 27–32):
```typescript
// before
type Row = {
  entry: RaceEntry;
  athlete: Athlete | null;
  splits: Split[];
  targets: TargetSplit[];
};
// after
type Row = {
  entry: RaceEntry;
  athlete: Athlete | null;
  splits: Split[];
  targets: TargetSplit[];
  relayLegs?: RelayLeg[];
  legRunnerNames?: string[];
};
```

Inside the `load` callback, replace the `entries.map(async (entry) => {` block with:

```typescript
const loaded = await Promise.all(
  entries.map(async (entry) => {
    const [splitsData, targets] = await Promise.all([
      getSplitsForEntry(entry.id),
      getTargetsForEntry(entry.id),
    ]);
    const athlete = entry.athleteId ? await getAthlete(entry.athleteId) : null;

    let relayLegs: RelayLeg[] | undefined;
    let legRunnerNames: string[] | undefined;
    if (r.kind === 'relay') {
      const legs = await getRelayLegsForEntry(entry.id);
      relayLegs = legs;
      legRunnerNames = await Promise.all(
        legs.map(async (leg) => {
          const a = await getAthlete(leg.athleteId);
          return a?.name ?? '?';
        }),
      );
    }

    return { entry, athlete: athlete ?? null, splits: splitsData, targets, relayLegs, legRunnerNames };
  }),
);
```

- [ ] **Step 5: Add relay rendering and new styles to `app/race/[id]/review.tsx`**

Inside the `{rows.map((row) => {` block, after the `const startedAt = race.startedAt ?? 0;` line, replace the existing `return (` statement and its contents (the `<View key={row.entry.id}>` block) with:

```typescript
return (
  <View key={row.entry.id} style={[s.card, { borderLeftColor: slotColor }]}>
    <Text style={[s.cardName, { color: slotColor }]}>
      {row.athlete?.name ?? row.entry.teamName ?? '?'}
    </Text>

    {race.kind === 'relay' && row.relayLegs && row.legRunnerNames
      ? Array.from({ length: 4 }, (_, legIdx) => {
          const lapsPerLeg = race.expectedLaps / 4;
          const legSplits = row.splits.slice(legIdx * lapsPerLeg, (legIdx + 1) * lapsPerLeg);
          if (legSplits.length === 0) return null;

          const legStartAt =
            legIdx === 0 ? startedAt : capturedAts[legIdx * lapsPerLeg - 1];
          const legEndAt = capturedAts[(legIdx + 1) * lapsPerLeg - 1];
          const legMs = legEndAt - legStartAt;

          return (
            <View key={legIdx}>
              <View style={s.legDivider}>
                <Text style={s.legDividerText}>
                  Leg {legIdx + 1} · {row.legRunnerNames![legIdx] ?? '?'} · {formatMs(legMs)}
                </Text>
              </View>
              {legSplits.map((sp, i) => {
                const globalLapIdx = legIdx * lapsPerLeg + i;
                const lapMs = lapTimeMs(capturedAts, globalLapIdx, startedAt);
                const cumMs = cumulativeMs(capturedAts, globalLapIdx, startedAt);
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={s.splitRow}
                    onPress={() => setEditing({ split: sp, value: formatMs(cumMs) })}
                  >
                    <Text style={s.lapNum}>Lap {globalLapIdx + 1}</Text>
                    <Text style={s.lapMs}>{formatMs(lapMs)}</Text>
                    <Text style={s.cumMs}>{formatMs(cumMs)}</Text>
                    {sp.edited && <Text style={s.editedTag}>edited</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })
      : row.splits.map((sp, lapIdx) => {
          const lapMs = lapTimeMs(capturedAts, lapIdx, startedAt);
          const cumMs = cumulativeMs(capturedAts, lapIdx, startedAt);
          const delta = hasTargets
            ? deltaMs(capturedAts, lapIdx, startedAt, targetMs)
            : null;
          const deltaColor =
            delta === null
              ? colors.neutral
              : delta < 0
              ? colors.success
              : colors.danger;

          return (
            <TouchableOpacity
              key={sp.id}
              style={s.splitRow}
              onPress={() => setEditing({ split: sp, value: formatMs(cumMs) })}
            >
              <Text style={s.lapNum}>Lap {lapIdx + 1}</Text>
              <Text style={s.lapMs}>{formatMs(lapMs)}</Text>
              <Text style={s.cumMs}>{formatMs(cumMs)}</Text>
              {delta !== null && (
                <Text style={[s.delta, { color: deltaColor }]}>
                  {formatDeltaMs(delta)}
                </Text>
              )}
              {sp.edited && <Text style={s.editedTag}>edited</Text>}
            </TouchableOpacity>
          );
        })}

    {row.splits.length === 0 && (
      <Text style={s.noSplits}>No splits recorded</Text>
    )}
  </View>
);
```

Add these two styles inside the `StyleSheet.create({...})` call after the last existing entry:

```typescript
  legDivider: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 4,
  },
  legDividerText: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test tests/component/RelayReview.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 7: Run full test suite and typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: all tests pass, no type errors

- [ ] **Step 8: Commit**

```bash
git add app/race/[id]/review.tsx tests/component/RelayReview.test.tsx
git commit -m "feat: add leg-grouped relay rendering to race review screen"
```

---

## Self-Review

**Spec coverage:**
- ✅ `getRelayLegsForEntry` / `updateRelayLegAthlete` — Task 1
- ✅ Relay step 2 team builder with inline accordion — Task 3
- ✅ Pacing step skipped for relay — Task 3 (relay Next calls `relayOnStart` directly)
- ✅ `createRace` call with relay entries and legs — Task 3
- ✅ `RelayCell` with runner-first layout, leg time, laps, total, chips — Task 2
- ✅ `ChangeAthleteModal` shared component — Task 2
- ✅ Live screen loads relay legs + athlete names, renders RelayCell — Task 4
- ✅ Change button updates relay leg athlete — Task 4
- ✅ Tap logic unchanged (appendSplit identical) — Task 4 (no change to `onTap`)
- ✅ Review screen leg dividers with runner name and leg total — Task 5
- ✅ Per-lap splits under correct divider, global lap numbers — Task 5
- ✅ Tapping a split opens existing edit dialog — Task 5

**Type consistency:** All references to `RelayLeg` are imported from `@/db/schema` and match the Drizzle-inferred type `{ id: string; raceEntryId: string; legIndex: number; athleteId: string }`. `legRunnerNames` is `string[]` length 4 throughout — set in live.tsx and review.tsx before being consumed by RelayCell.

**No placeholders found.**
