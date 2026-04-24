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
