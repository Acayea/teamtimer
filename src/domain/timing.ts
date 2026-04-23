// src/domain/timing.ts

export function lapTimeMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
): number {
  const prev = lapIndex === 0 ? startedAt : capturedAts[lapIndex - 1];
  return capturedAts[lapIndex] - prev;
}

export function cumulativeMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
): number {
  return capturedAts[lapIndex] - startedAt;
}

export function deltaMs(
  capturedAts: number[],
  lapIndex: number,
  startedAt: number,
  targetCumulativeMs: number[],
): number {
  return cumulativeMs(capturedAts, lapIndex, startedAt) - targetCumulativeMs[lapIndex];
}

export function formatMs(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10);
  const cs     = totalCentiseconds % 100;
  const totalS = Math.floor(totalCentiseconds / 100);
  const s      = totalS % 60;
  const m      = Math.floor(totalS / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatDeltaMs(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const abs  = Math.abs(ms);
  const s    = (abs / 1000).toFixed(2);
  return `${sign}${s}`;
}

export function prMs(
  races: { capturedAts: number[]; startedAt: number }[],
): number | null {
  if (races.length === 0) return null;
  const times = races.map((r) => r.capturedAts[r.capturedAts.length - 1] - r.startedAt);
  return Math.min(...times);
}
