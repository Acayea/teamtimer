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

  it('does not call onChangeLeg when finished', () => {
    render(<RelayCell {...BASE_PROPS} finished={true} />);
    fireEvent.press(screen.getByText('Change'));
    expect(BASE_PROPS.onChangeLeg).not.toHaveBeenCalled();
  });

  it('shows DONE when finished', () => {
    render(<RelayCell {...BASE_PROPS} finished={true} />);
    expect(screen.getByText('DONE')).toBeTruthy();
  });
});
