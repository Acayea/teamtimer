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
    expect(getRelayLegsForEntry).toHaveBeenCalledWith('e1');
    await waitFor(() => {
      expect(screen.queryByText('Jake Torres')).toBeNull();
    });
  });
});
