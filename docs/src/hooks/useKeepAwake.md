# useKeepAwake

`src/hooks/useKeepAwake.ts`

## What it does

Prevents the device screen from sleeping while a race is active by calling `expo-keep-awake`. Activates keep-awake when `active` is `true` and deactivates it when `active` becomes `false` or the component unmounts.

Uses the tag `"TeamTimerRace"` to allow scoped activation/deactivation without interfering with other keep-awake consumers.

## Signature

```typescript
function useKeepAwake(active: boolean): void
```

## Parameters

| Parameter | Type      | Description                                       |
|-----------|-----------|---------------------------------------------------|
| active    | `boolean` | `true` while a race is running; `false` otherwise |

## Side effects

- Calls `activateKeepAwakeAsync("TeamTimerRace")` when `active` is `true`.
- Calls `deactivateKeepAwake("TeamTimerRace")` when `active` is `false` or on cleanup.

## Usage

```typescript
useKeepAwake(isRaceRunning);
```
