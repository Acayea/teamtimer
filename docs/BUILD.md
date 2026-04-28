# TeamTimer — Build Guide

A cross-platform iOS/Android app for track & field coaches to record per-athlete lap splits, track improvement over time, and get live pacing feedback during races.

## Prerequisites

- **Node.js** ≥ 20 (`node --version`)
- **pnpm** — install with `npm install -g pnpm`
- **Expo Go** — install on your phone from the App Store or Play Store
- **iOS Simulator** (macOS only) or **Android Emulator** — via Xcode / Android Studio

For device builds (TestFlight / Play Store):
- Apple Developer account ($99/yr)
- Google Play Console account ($25 one-time)
- `eas-cli` — install with `pnpm add -g eas-cli`, then `eas login`

## Local Setup

```bash
git clone <repo-url>
cd teamtimer
pnpm install
```

The database is created automatically when the app first runs. No manual setup needed.

## Run

```bash
pnpm start          # start Metro bundler (Expo dev server)
pnpm ios            # open iOS Simulator (macOS only)
pnpm android        # open Android Emulator
```

Scan the QR code in the terminal with **Expo Go** on your phone to run on a real device. No USB cable required.

## Check types / lint / test

```bash
pnpm typecheck      # TypeScript type checking (zero errors required)
pnpm lint           # ESLint
pnpm test           # Jest test suite (all must pass)
pnpm test:watch     # watch mode
```

## Database

Migrations run automatically on every app launch (`src/db/migrate.ts`). You do not need to run any migration commands manually when using the app.

**After changing the schema** (`src/db/schema.ts`):

```bash
pnpm db:generate    # generate new SQL migration in src/db/migrations/
```

Then relaunch the app to apply the migration.

## Project structure

```
app/                    Expo Router screens
  (tabs)/               Bottom-tab screens: Home, Athletes, History
  athletes/             Add / edit athlete modals
  race/                 Race setup, live race, review
src/
  db/                   Drizzle schema, client, migrations
  domain/               Pure functions: timing, pacing, distances
  repos/                Database access: athletes, races, splits
  hooks/                useRaceClock, useKeepAwake
  components/           AthleteCell, RaceClock
  theme/                colors, typography
tests/
  unit/                 Pure domain function tests (jest)
  component/            React Native component tests
docs/
  BUILD.md              This file
  superpowers/          Implementation plans and specs
```

## Build for device (EAS)

### First-time setup

```bash
eas login
eas build:configure   # creates eas.json if missing
```

### Preview build (install via QR / link, no App Store)

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

### Production build

```bash
eas build --platform all --profile production
```

Builds appear in [expo.dev](https://expo.dev) under your project. Download the `.ipa` (iOS) or `.apk`/`.aab` (Android).

### Submit to TestFlight / Play Store

```bash
eas submit --platform ios       # uploads to App Store Connect → TestFlight
eas submit --platform android   # uploads to Google Play Console
```

## Timing precision note

This app records splits using `Date.now()` (millisecond precision). The race clock derives elapsed time from the stored `startedAt` timestamp on every tick — it stays correct even if the app is briefly backgrounded.

Typical accuracy: ±1 ms capture precision, ±100–200 ms human reaction time. This is a **coaching stopwatch**, not a Fully Automatic Timing (FAT) system.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Metro bundler can't find `@/` imports | Confirm `metro.config.js` has `resolver.alias: { '@': path.resolve(__dirname, 'src') }` |
| EAS build fails with `Unable to resolve module ./XXXX_*.sql` | `metro.config.js` must include `config.resolver.sourceExts.push('sql')` so Drizzle migration files bundle correctly |
| `pnpm db:generate` errors | Ensure `drizzle-kit` is installed (`pnpm add -D drizzle-kit`) |
| App crashes on launch | Check Expo Go version matches SDK — update Expo Go or run `npx expo install --fix` |
| Screen dims during race | `expo-keep-awake` must be installed — check `package.json` |
| Tests fail with `act()` warnings | Pre-existing issue in the Expo template's `StyledText-test.js` — safe to ignore |
