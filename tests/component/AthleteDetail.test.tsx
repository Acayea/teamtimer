import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
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
  // useFocusEffect: implementation is set in beforeEach via mockImplementationOnce so it
  // fires cb() exactly once per test (on initial focus), not on every re-render. Firing on
  // every re-render would re-invoke the async load callback on each state update, creating
  // an infinite loop that prevents async act() from resolving.
  useFocusEffect: jest.fn(),
}));

jest.mock('../../src/components/ImprovementChart', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ImprovementChart: ({ onDotPress, data }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TouchableOpacity, Text } = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Import the mocked useFocusEffect to set mockImplementationOnce in beforeEach.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useFocusEffect: mockUseFocusEffect } = require('expo-router') as {
  useFocusEffect: jest.MockedFunction<(cb: () => void) => void>;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AthleteDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAthlete.mockResolvedValue(ATHLETE);
    // Fire cb() on the first call only. After that, useFocusEffect becomes a no-op for
    // subsequent re-renders. This matches real useFocusEffect semantics (fires once per
    // focus event) and allows await act(async () => {}) to drain microtasks cleanly.
    mockUseFocusEffect.mockImplementationOnce((cb: () => void) => { cb(); });
  });

  it('shows athlete name after load', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    expect(screen.getByText('Marcus Webb')).toBeTruthy();
  });

  it('defaults to the most recently raced distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    // race-3 is the most recent and is 800m — so 800m tab is active
    expect(screen.getByText('800m Races')).toBeTruthy();
  });

  it('shows the PR time and meet name for the selected distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    // PR is race-2: 118_400ms → 1:58.40, meetName 'County Champs'
    const prCard = screen.getByTestId('pr-card');
    expect(within(prCard).getByText('1:58.40')).toBeTruthy();
    expect(within(prCard).getByText('County Champs')).toBeTruthy();
  });

  it('switching tabs updates the race list to the new distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    screen.getByText('Marcus Webb');

    // Initially on 800m (most recent). Switch to 1600m.
    fireEvent.press(screen.getByText('1600m'));
    expect(screen.getByText('1600m Races')).toBeTruthy();
    // The 1600m race is "Invitational" — appears in PR card meta and race list row
    expect(screen.getAllByText('Invitational').length).toBeGreaterThanOrEqual(1);
  });

  it('switching tabs updates the PR card to the new distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    screen.getByText('Marcus Webb');

    // Initially on 800m tab. Switch to 1600m.
    fireEvent.press(screen.getByText('1600m'));

    // PR card should now show 1600m PR
    const prCard = screen.getByTestId('pr-card');
    expect(within(prCard).getByText('4:32.10')).toBeTruthy();
  });

  it('race list shows only races for the selected distance', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_MIXED);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    screen.getByText('Marcus Webb');

    // On 800m tab: "County Champs" and "Practice" are visible, "Invitational" is not
    expect(screen.queryByText('Invitational')).toBeNull();
    // "County Champs" appears in both the PR card meta and the race list row
    expect(screen.getAllByText('County Champs').length).toBeGreaterThanOrEqual(1);
  });

  it('tapping a race row navigates to race review', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    // "County Champs" now appears in both the PR card meta and the race list row
    expect(screen.getAllByText('County Champs').length).toBeGreaterThanOrEqual(1);
    // Press all occurrences — the race row is the pressable one
    screen.getAllByText('County Champs').forEach(el => fireEvent.press(el));
    expect(mockPush).toHaveBeenCalledWith('/race/race-2/review');
  });

  it('tapping a chart dot navigates to race review', async () => {
    mockGetAthleteRaces.mockResolvedValue(RACES_800);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('chart-dot-race-1'));
    expect(mockPush).toHaveBeenCalledWith('/race/race-1/review');
  });

  it('shows empty state when athlete has no completed races', async () => {
    mockGetAthleteRaces.mockResolvedValue([]);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    expect(screen.getByText('No completed races yet.')).toBeTruthy();
  });

  it('shows single-point hint when athlete has one race at a distance', async () => {
    mockGetAthleteRaces.mockResolvedValue([RACES_800[0]]); // only one 800m race
    render(<AthleteDetailScreen />);
    await act(async () => {});
    expect(screen.getByText(/Complete one more 800m race/)).toBeTruthy();
  });

  it('shows "Athlete not found" when athlete does not exist', async () => {
    mockGetAthlete.mockResolvedValue(undefined);
    mockGetAthleteRaces.mockResolvedValue([]);
    render(<AthleteDetailScreen />);
    await act(async () => {});
    expect(screen.getByText('Athlete not found.')).toBeTruthy();
  });
});
