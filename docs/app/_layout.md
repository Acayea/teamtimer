# app/_layout.tsx

Root layout for the Expo Router navigation tree. Runs database migrations before rendering any screens.

## What it does

1. On mount, calls `runMigrations()` to apply any pending SQLite migrations.
2. Shows a full-screen `ActivityIndicator` (using `colors.accent`) while migrations run.
3. Once ready, renders the `Stack` navigator with pre-configured screen options and routes.

## Screen configuration

| Route | Options |
|---|---|
| `(tabs)` | `headerShown: false` — the tab bar handles its own header |
| `race/setup` | Modal presentation, title "New Race" |
| `race/[id]/live` | `headerShown: false` — full-screen live race view |
| `race/[id]/review` | Title "Race Review" |
| `athletes/new` | Modal presentation, title "Add Athlete" |
| `athletes/[id]/edit` | Title "Edit Athlete" |

## Notes

- Migration is awaited synchronously at startup so no screen ever renders against an unmigrated schema.
- The loading indicator background color uses `colors.background` to avoid a white flash on dark-themed devices.
- `unstable_settings` and `ErrorBoundary` re-exports from the previous scaffold were removed; add them back if error boundary support is needed.
