// src/domain/pacing.ts

export function evenPaceTargets(laps: number, goalMs: number): number[] {
  const lapMs = goalMs / laps;
  const result = Array.from({ length: laps }, (_, i) => Math.round(lapMs * (i + 1)));
  result[laps - 1] = goalMs;
  return result;
}

export function negativeSplitTargets(
  laps: number,
  goalMs: number,
  splitFraction: number,
): number[] {
  const half      = Math.floor(laps / 2);
  const avgLapMs  = goalMs / laps;
  const slowLapMs = avgLapMs * (1 + splitFraction / 2);
  const fastLapMs = avgLapMs * (1 - splitFraction / 2);

  const result: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < laps; i++) {
    cumulative += i < half ? slowLapMs : fastLapMs;
    result.push(Math.round(cumulative));
  }
  result[laps - 1] = goalMs;
  return result;
}

export function validateCustomTargets(targets: number[], laps: number): string | null {
  if (targets.length !== laps) return `Expected ${laps} targets, got ${targets.length}`;
  for (let i = 1; i < targets.length; i++) {
    if (targets[i] <= targets[i - 1]) return `Target at lap ${i + 1} must be greater than lap ${i}`;
  }
  return null;
}
