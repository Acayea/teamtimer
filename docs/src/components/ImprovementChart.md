# ImprovementChart

`src/components/ImprovementChart.tsx`

## What it does

Renders a line chart using `react-native-svg` to show an athlete's performance improvement over time for a single distance. Each data point represents a race result; the Y-axis shows cumulative time (faster = lower, downward trend = improvement), and the X-axis places points at even intervals labeled with formatted dates.

The PR (personal record) dot is rendered in gold (`colors.warning = '#EAB308'`) with a concentric inner circle in the background color. All other dots use the `color` prop.

Container width is measured via `onLayout`; the SVG is not rendered until width > 0.

## Props

| Prop         | Type                              | Description                                                              |
|--------------|-----------------------------------|--------------------------------------------------------------------------|
| `data`       | `DataPoint[]`                     | Array of race results sorted by date (see DataPoint below)               |
| `color`      | `string`                          | Hex color for non-PR dots and the connecting line                        |
| `prMs`       | `number`                          | The PR cumulative time in ms — the dot matching this value gets gold styling |
| `onDotPress` | `(raceId: string) => void`        | Called when the user taps any dot; receives the `raceId` of that point   |

### DataPoint

```typescript
type DataPoint = {
  raceId: string;       // unique race identifier
  startedAt: number;    // Unix timestamp in ms (used for x-axis date label)
  cumulativeMs: number; // athlete's finish time in ms (used for y position)
};
```

## Behavior

- **Empty data (`data.length === 0`):** returns `null` — the parent is responsible for the empty state.
- **Single point (`data.length === 1`):** renders one centered dot with no line and no axes. The parent is responsible for any single-point message.
- **Multiple points:** renders a full chart with a polyline, grid lines, Y-axis time labels, and X-axis date labels.

### Y-axis scaling

Auto-scales to `[min(cumulativeMs) - 2000ms, max(cumulativeMs) + 2000ms]`. A smaller (faster) time maps to a lower Y position on the chart (SVG Y increases downward, so faster times appear lower on screen). A downward trend over time represents improvement.

### X-axis spacing

Data points are placed at equal intervals regardless of calendar distance between races. Labels show the race date formatted as `Mon D` (e.g. `Jan 5`).

## Side effects

None. Reads layout width via `onLayout` to compute drawable area.

## Usage

```typescript
<ImprovementChart
  data={raceResults}        // DataPoint[] sorted oldest → newest
  color={slotColor}         // e.g. '#3B82F6'
  prMs={athletePrMs}        // e.g. 118_400
  onDotPress={(raceId) => router.push(`/race/${raceId}/review`)}
/>
```
