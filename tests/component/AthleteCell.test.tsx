import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AthleteCell } from '../../src/components/AthleteCell';

// Mock expo-haptics so it doesn't error in test environment
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const BASE_PROPS = {
  name: 'Sarah',
  slotIndex: 0 as const,
  lapIndex: 1,
  expectedLaps: 4,
  capturedAts: [1000000 + 62100], // one tap at 62.1s
  startedAt: 1000000,
  targetCumulativeMs: [62000, 124000, 186000, 248000],
  onTap: jest.fn(),
  finished: false,
};

describe('AthleteCell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders athlete name', () => {
    render(<AthleteCell {...BASE_PROPS} />);
    expect(screen.getByText('Sarah')).toBeTruthy();
  });

  it('shows lap progress', () => {
    render(<AthleteCell {...BASE_PROPS} />);
    expect(screen.getByText('Lap 1 / 4')).toBeTruthy();
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

  it('shows DONE when finished', () => {
    render(<AthleteCell {...BASE_PROPS} finished={true} />);
    expect(screen.getByText('DONE')).toBeTruthy();
  });
});
