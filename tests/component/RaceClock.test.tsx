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

  it('renders large time correctly', () => {
    render(<RaceClock elapsedMs={620000} />);
    expect(screen.getByText('10:20.00')).toBeTruthy();
  });
});
