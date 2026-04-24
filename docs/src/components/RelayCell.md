# RelayCell

`src/components/RelayCell.tsx`

## What it does

Displays the live-race timing cell for a relay team. All timing is derived from props (no internal state). Shows the current runner's name, live leg time, laps-in-leg progress, total elapsed time, and completed-leg chips for each finished leg. Triggers haptic feedback on tap and routes "Change" button presses to a separate callback.

## Props

| Prop              | Type                | Description                                                              |
|-------------------|---------------------|--------------------------------------------------------------------------|
| teamName          | `string`            | Relay team name shown in the header                                      |
| slotIndex         | `0 \| 1 \| 2 \| 3` | Slot position used to select the accent color from `SLOT_COLORS`         |
| currentLegIndex   | `number`            | 0-based index of the leg currently running (0–3)                         |
| legRunnerNames    | `string[]`          | Length-4 array mapping each leg index to its runner's name               |
| capturedAts       | `number[]`          | All split timestamps (ms epoch) captured for this entry so far           |
| startedAt         | `number`            | Race start timestamp (ms epoch)                                          |
| elapsedMs         | `number`            | Current elapsed time from `useRaceClock` (ms since race start)           |
| expectedLaps      | `number`            | Total laps for the relay (e.g. 8 for 4×800m → 2 laps per leg)           |
| onTap             | `() => void`        | Called when the cell body is pressed (no-op when `finished` is true)     |
| onChangeLeg       | `() => void`        | Called when the "Change" button is pressed                               |
| finished          | `boolean`           | When true, shows "DONE", dims the cell, and disables tap                 |

## Timing formulas

```
lapsPerLeg      = expectedLaps / 4
legStartEpoch   = currentLegIndex === 0
                    ? startedAt
                    : capturedAts[currentLegIndex * lapsPerLeg - 1]
legElapsedMs    = elapsedMs - (legStartEpoch - startedAt)
```

For each completed leg `i`:
```
legStart  = i === 0 ? startedAt : capturedAts[i * lapsPerLeg - 1]
legEnd    = capturedAts[(i + 1) * lapsPerLeg - 1]
totalMs   = legEnd - legStart
```

## Usage

```typescript
<RelayCell
  teamName="Team A"
  slotIndex={0}
  currentLegIndex={1}
  legRunnerNames={['Marcus', 'Jake', 'Sam', 'Dani']}
  capturedAts={capturedAts}
  startedAt={race.startedAt}
  elapsedMs={elapsed}
  expectedLaps={8}
  onTap={() => recordSplit(entryId)}
  onChangeLeg={() => openChangeModal(entryId, currentLegIndex)}
  finished={entry.finishedAt != null}
/>
```
