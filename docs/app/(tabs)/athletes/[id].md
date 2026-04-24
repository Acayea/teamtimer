# AthleteDetailScreen

`app/(tabs)/athletes/[id].tsx`

Displays a single athlete's full race history, grouped by distance. Accessed via the dynamic route `/athletes/:id`.

---

## What the screen shows

1. **Header** — athlete name, total race count across all distances, and an Edit button that navigates to `/athletes/:id/edit`.
2. **Distance tabs** — one tab per unique `distanceM` found in the athlete's race history, sorted ascending (e.g. 800m, 1600m). Tapping a tab filters the content below to that distance.
3. **PR card** (`testID="pr-card"`) — shows the personal record time (`prMs`), the meet name (or "Practice"), and the date for the selected distance.
4. **Improvement chart** — `ImprovementChart` component showing time trend over races for the selected distance.
5. **Race list** — chronologically reversed list (newest first) of all races at the selected distance. Each row shows meet name, date, lap count, and finish time. PR races are highlighted with `colors.warning` and a ★ suffix. Tapping a row navigates to `/race/:raceId/review`. Tapping a dot on the improvement chart also navigates to `/race/:raceId/review` for that race.

---

## Default-tab selection

When data loads, the default selected distance is set to:

```typescript
raceResults[raceResults.length - 1].distanceM
```

This relies on `getAthleteRaces` returning results sorted by `startedAt` ascending, so the last element is the athlete's most recently raced distance. This means the screen opens on the distance the athlete most recently competed in.

---

## `useFocusEffect(load)` pattern

The load function is wrapped in `useFocusEffect` (from `expo-router`) rather than a plain `useEffect`. This means data is refreshed every time the tab comes into focus — for example, when the user navigates back from the edit screen after updating the athlete's name.

`load` is memoized with `useCallback` keyed on `id` so it is stable across re-renders unless the athlete ID changes.

---

## Data flow

```
useFocusEffect(load)
  └─ Promise.all([getAthlete(id), getAthleteRaces(id)])
       ├─ setAthlete(a ?? null)
       ├─ groupByDistance(raceResults) → setGroups(g)
       ├─ setSelectedDistanceM(raceResults[last].distanceM)  // most-recently-raced default
       └─ setLoading(false)
```

### `groupByDistance`

Local pure helper. Groups a flat `AthleteRaceResult[]` by `distanceM`, computes the PR time (`Math.min(...finalCumulativeMs)`), finds the PR race, and returns an array of `DistanceGroup` objects sorted by `distanceM` ascending.

**Tiebreak:** if two races share the same minimum `finalCumulativeMs`, `distanceRaces.find` returns the first one in `startedAt`-ascending order (i.e. the earlier race).

---

## Loading / error states

- **Loading:** renders a centered `ActivityIndicator` while `loading === true`.
- **Athlete not found:** renders "Athlete not found." if `getAthlete` returns `undefined`.
- **No completed races:** renders "No completed races yet." if `groups.length === 0`.
- **Single race at a distance:** renders a hint below the chart — "Complete one more Xm race to see your trend."
