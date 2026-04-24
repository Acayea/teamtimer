// src/repos/athletes.ts
import { and, eq, isNull, isNotNull, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { athletes, races, raceEntries, meets, splits, type Athlete } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export async function listAthletes(): Promise<Athlete[]> {
  return db.select().from(athletes).where(isNull(athletes.archivedAt)).orderBy(asc(athletes.name));
}

export async function getAthlete(id: string): Promise<Athlete | undefined> {
  const rows = await db.select().from(athletes).where(eq(athletes.id, id));
  return rows[0];
}

export async function createAthlete(
  data: Pick<Athlete, 'name' | 'dateOfBirth' | 'notes'>,
): Promise<Athlete> {
  const id = randomUUID();
  const now = Date.now();
  await db.insert(athletes).values({ id, createdAt: now, archivedAt: null, ...data });
  return (await getAthlete(id))!;
}

export async function updateAthlete(
  id: string,
  data: Partial<Pick<Athlete, 'name' | 'dateOfBirth' | 'notes'>>,
): Promise<void> {
  await db.update(athletes).set(data).where(eq(athletes.id, id));
}

export async function archiveAthlete(id: string): Promise<void> {
  await db.update(athletes).set({ archivedAt: Date.now() }).where(eq(athletes.id, id));
}

// ─── Athlete race history ────────────────────────────────────────────────────

export type AthleteRaceResult = {
  raceId: string;
  raceEntryId: string;
  distanceM: number;
  meetName: string | null;
  startedAt: number;
  finalCumulativeMs: number;
  lapCount: number;
};

type RawRow = {
  raceId: string;
  raceEntryId: string;
  distanceM: number;
  meetName: string | null;
  startedAt: number | null;
  lapIndex: number;
  capturedAt: number;
};

/** Pure helper — groups flat DB rows (one per split) into one result per race entry. */
export function buildAthleteRaceResults(rows: RawRow[]): AthleteRaceResult[] {
  const entryMap = new Map<string, RawRow[]>();
  for (const row of rows) {
    if (!entryMap.has(row.raceEntryId)) entryMap.set(row.raceEntryId, []);
    entryMap.get(row.raceEntryId)!.push(row);
  }

  const results: AthleteRaceResult[] = [];
  for (const [raceEntryId, entryRows] of entryMap) {
    const first = entryRows[0];
    const last = entryRows[entryRows.length - 1]; // highest lapIndex (rows are ordered by lapIndex asc)
    const startedAt = first.startedAt!; // safe: getAthleteRaces filters isNotNull(races.startedAt)
    results.push({
      raceId: first.raceId,
      raceEntryId,
      distanceM: first.distanceM,
      meetName: first.meetName,
      startedAt,
      finalCumulativeMs: last.capturedAt - startedAt,
      lapCount: entryRows.length,
    });
  }

  results.sort((a, b) => a.startedAt - b.startedAt);
  return results;
}

/**
 * Returns all completed individual races for an athlete, sorted by startedAt ascending.
 * Relay races are excluded (athlete_id is not set on relay raceEntries directly).
 */
export async function getAthleteRaces(athleteId: string): Promise<AthleteRaceResult[]> {
  const rows = await db
    .select({
      raceId: races.id,
      raceEntryId: raceEntries.id,
      distanceM: races.distanceM,
      meetName: meets.name,
      startedAt: races.startedAt,
      lapIndex: splits.lapIndex,
      capturedAt: splits.capturedAt,
    })
    .from(raceEntries)
    .innerJoin(races, eq(raceEntries.raceId, races.id))
    .leftJoin(meets, eq(races.meetId, meets.id))
    .innerJoin(splits, eq(splits.raceEntryId, raceEntries.id))
    .where(
      and(
        eq(raceEntries.athleteId, athleteId),
        eq(races.status, 'completed'),
        eq(races.kind, 'individual'),
        isNotNull(races.startedAt),
      ),
    )
    .orderBy(asc(races.startedAt), asc(splits.lapIndex));

  return buildAthleteRaceResults(rows);
}
