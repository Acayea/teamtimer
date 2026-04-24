// src/components/ImprovementChart.tsx
import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent, StyleSheet } from 'react-native';
import { Svg, Polyline, Circle, Line } from 'react-native-svg';
import { formatMs } from '@/domain/timing';
import { colors } from '@/theme/colors';

const CHART_HEIGHT = 142; // drawable height (excludes x-axis label row)
const X_LABEL_HEIGHT = 18;
const Y_LABEL_WIDTH = 38;
const PAD_MS = 2_000;
const DOT_RADIUS = 5;
const PR_DOT_RADIUS = 7;
const PR_INNER_RADIUS = 3;
const GRID_COUNT = 4;

type DataPoint = { raceId: string; startedAt: number; cumulativeMs: number };

type Props = {
  data: DataPoint[];
  color: string;
  prMs: number;
  onDotPress: (raceId: string) => void;
};

export function ImprovementChart({ data, color, prMs, onDotPress }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  if (data.length === 0) return null;

  const drawableWidth = Math.max(0, containerWidth - Y_LABEL_WIDTH);

  // ── Single-point: centred dot, no axes, no line ──────────────────────────
  if (data.length === 1) {
    const point = data[0];
    const isPR = point.cumulativeMs === prMs;
    return (
      <View testID="chart-container" onLayout={onLayout} style={s.singleContainer}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={CHART_HEIGHT}>
            <Circle
              cx={containerWidth / 2}
              cy={CHART_HEIGHT / 2}
              r={isPR ? PR_DOT_RADIUS : DOT_RADIUS}
              fill={isPR ? colors.warning : color}
              onPress={() => onDotPress(point.raceId)}
              testID={`dot-${point.raceId}`}
            />
          </Svg>
        )}
      </View>
    );
  }

  // ── Multi-point chart ─────────────────────────────────────────────────────
  const minMs = Math.min(...data.map(d => d.cumulativeMs));
  const maxMs = Math.max(...data.map(d => d.cumulativeMs));
  const yMin = minMs - PAD_MS;
  const yMax = maxMs + PAD_MS;
  const yRange = yMax - yMin;

  const toY = (ms: number): number =>
    CHART_HEIGHT - ((ms - yMin) / yRange) * CHART_HEIGHT;

  const toX = (i: number): number =>
    (i / (data.length - 1)) * drawableWidth;

  const polylinePoints = data
    .map((d, i) => `${toX(i)},${toY(d.cumulativeMs)}`)
    .join(' ');

  const gridLabels = Array.from({ length: GRID_COUNT }, (_, i) => {
    const ms = yMin + (yRange * i) / (GRID_COUNT - 1);
    return { y: toY(ms), label: formatMs(ms) };
  });

  const formatDate = (ms: number): string =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View testID="chart-container" onLayout={onLayout}>
      {containerWidth > 0 && (
        <>
          <View style={s.row}>
            {/* Y-axis labels */}
            <View style={{ width: Y_LABEL_WIDTH, height: CHART_HEIGHT }}>
              {gridLabels.map((gl, i) => (
                <Text
                  key={i}
                  style={[s.axisLabel, { position: 'absolute', top: gl.y - 7, right: 4 }]}
                >
                  {gl.label}
                </Text>
              ))}
            </View>
            {/* SVG */}
            <Svg width={drawableWidth} height={CHART_HEIGHT}>
              {gridLabels.map((gl, i) => (
                <Line
                  key={i}
                  x1={0} y1={gl.y}
                  x2={drawableWidth} y2={gl.y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                testID="chart-line"
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {data.map((d, i) => {
                const cx = toX(i);
                const cy = toY(d.cumulativeMs);
                const isPR = d.cumulativeMs === prMs;
                return (
                  <React.Fragment key={d.raceId}>
                    <Circle
                      cx={cx} cy={cy}
                      r={isPR ? PR_DOT_RADIUS : DOT_RADIUS}
                      fill={isPR ? colors.warning : color}
                      onPress={() => onDotPress(d.raceId)}
                      testID={isPR ? 'dot-pr' : `dot-${d.raceId}`}
                    />
                    {isPR && (
                      <Circle
                        cx={cx} cy={cy}
                        r={PR_INNER_RADIUS}
                        fill={colors.background}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          {/* X-axis labels */}
          <View style={[s.row, { marginLeft: Y_LABEL_WIDTH, height: X_LABEL_HEIGHT }]}>
            {data.map((d, i) => (
              <Text
                key={d.raceId}
                style={[
                  s.axisLabel,
                  { position: 'absolute', left: toX(i) - 16, width: 32, textAlign: 'center' },
                ]}
              >
                {formatDate(d.startedAt)}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  singleContainer: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  axisLabel: { fontSize: 9, color: colors.textDisabled },
});
