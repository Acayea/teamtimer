# ChangeAthleteModal

`src/components/ChangeAthleteModal.tsx`

## What it does

A bottom-sheet modal for selecting an athlete from a list. Used in two places: relay setup (to assign runners to legs) and the live race screen (for mid-race substitutions). Renders a `FlatList` of athletes and calls back with the selected athlete's ID. Pressing an athlete row calls `onSelect` then `onClose`. Pressing the overlay or Cancel calls `onClose` only.

## Props

| Prop       | Type                            | Description                                              |
|------------|---------------------------------|----------------------------------------------------------|
| visible    | `boolean`                       | Controls modal visibility                                |
| athletes   | `Athlete[]`                     | List of athletes to display (typically non-archived)     |
| onSelect   | `(athleteId: string) => void`   | Called with the selected athlete's ID                    |
| onClose    | `() => void`                    | Called to dismiss the modal                              |

## Side effects

Calls both `onSelect(id)` and `onClose()` when a row is tapped. Only calls `onClose()` when the overlay or Cancel button is tapped.

## Usage

```typescript
<ChangeAthleteModal
  visible={modalVisible}
  athletes={activeAthletes}
  onSelect={(id) => assignLeg(legIndex, id)}
  onClose={() => setModalVisible(false)}
/>
```
