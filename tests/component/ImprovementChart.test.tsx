import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ImprovementChart } from '../../src/components/ImprovementChart';

// Mock react-native-svg — replace SVG primitives with testable RN equivalents
jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TouchableOpacity, View } = require('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: ({ children }: any) => React.createElement(View, { testID: 'svg' }, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Svg: ({ children }: any) => React.createElement(View, { testID: 'svg' }, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Circle: ({ onPress, testID, fill }: any) =>
      React.createElement(TouchableOpacity, { onPress, testID, accessibilityLabel: String(fill) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
