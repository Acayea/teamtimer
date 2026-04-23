# RaceClock

`src/components/RaceClock.tsx`

## What it does

Displays a formatted race time string in the large monospace clock style defined by `typography.raceClock`. Formats the elapsed milliseconds using `formatMs` from the timing domain.

## Props

| Prop       | Type     | Description                              |
|------------|----------|------------------------------------------|
| elapsedMs  | `number` | Elapsed race time in milliseconds to display |

## Output format

Uses `formatMs` which produces `M:SS.cs` (minutes, zero-padded seconds, centiseconds):

- `0` → `"0:00.00"`
- `62100` → `"1:02.10"`
- `620000` → `"10:20.00"`

## Usage

```typescript
const elapsed = useRaceClock(race.startedAt);
<RaceClock elapsedMs={elapsed} />
```
