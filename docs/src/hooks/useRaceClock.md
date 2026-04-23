# useRaceClock

`src/hooks/useRaceClock.ts`

## What it does

Returns elapsed milliseconds since a given start timestamp, updating at ~10 Hz (every 100 ms). Each tick derives elapsed time from `startedAt` using `Date.now()`, so the value stays accurate even if the JS thread is briefly paused or delayed.

## Signature

```typescript
function useRaceClock(startedAt: number | null): number
```

## Parameters

| Parameter  | Type             | Description                                                                 |
|------------|------------------|-----------------------------------------------------------------------------|
| startedAt  | `number \| null` | Unix timestamp (ms) when the race started. Pass `null` to reset to 0.      |

## Return value

Elapsed milliseconds as a `number`. Returns `0` when `startedAt` is `null`.

## Side effects

- Starts a `setInterval` at 100 ms when `startedAt` is non-null.
- Clears the interval on unmount or when `startedAt` changes.

## Usage

```typescript
const elapsed = useRaceClock(race.startedAt);
// elapsed updates ~10× per second while startedAt is set
```
