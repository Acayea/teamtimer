// src/domain/distances.ts
export const STANDARD_DISTANCES = [400, 800, 1500, 1600, 3000, 3200, 5000, 10000] as const;
export type StandardDistance = (typeof STANDARD_DISTANCES)[number];

export function lapCount(distanceM: number, lapDistanceM: number): number {
  return Math.ceil(distanceM / lapDistanceM);
}

export function formatDistanceLabel(distanceM: number): string {
  return `${distanceM}m`;
}

export function isValidDistance(distanceM: number): boolean {
  return Number.isInteger(distanceM) && distanceM >= 100 && distanceM <= 42195;
}
