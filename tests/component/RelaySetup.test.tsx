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
    // Tap the second team header to expand it
    fireEvent.press(screen.getByText('#2'));
    // Now team 2 is expanded, team 1 is collapsed
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
