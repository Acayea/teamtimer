// src/repos/splits.ts
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  splits,
  raceEntries,
  targetSplits,
  races,
  type Split,
  type TargetSplit,
} from '@/db/schema';
import { randomUUID } from 'expo-crypto';

/** Append a new split for an entry. Returns the captured timestamp. */
export async function appendSplit(raceEntryId: string, lapIndex: number): Promise<number> {
  const capturedAt = Date.now();
  await db.insert(splits).values({
    id: randomUUID(),
    raceEntryId,
    lapIndex,
    capturedAt,
    edited: false,
  });
  const expectedLaps = await getExpectedLaps(raceEntryId);
  if (lapIndex === expectedLaps - 1) {
    await db
      .update(raceEntries)
      .set({ finishedAt: capturedAt })
      .where(eq(raceEntries.id, raceEntryId));
  }
  return capturedAt;
}

/** Remove the most recent split for an entry. */
export async function undoLastSplit(raceEntryId: string): Promise<void> {
  const last = await db
    .select()
    .from(splits)
    .where(eq(splits.raceEntryId, raceEntryId))
    .orderBy(desc(splits.lapIndex))
    .limit(1);
  if (last.length === 0) return;
  await db.delete(splits).where(eq(splits.id, last[0].id));
  await db
    .update(raceEntries)
    .set({ finishedAt: null })
    .where(eq(raceEntries.id, raceEntryId));
}

/** Get all splits for an entry, ordered by lap index. */
export async function getSplitsForEntry(raceEntryId: string): Promise<Split[]> {
  return db
    .select()
    .from(splits)
    .where(eq(splits.raceEntryId, raceEntryId))
    .orderBy(splits.lapIndex);
}

/** Edit a split's capturedAt value (post-race correction). */
export async function editSplit(splitId: string, capturedAt: number): Promise<void> {
  await db.update(splits).set({ capturedAt, edited: true }).where(eq(splits.id, splitId));
}

/** Get target splits for an entry, ordered by lap index. */
export async function getTargetsForEntry(raceEntryId: string): Promise<TargetSplit[]> {
  return db
    .select()
    .from(targetSplits)
    .where(eq(targetSplits.raceEntryId, raceEntryId))
    .orderBy(targetSplits.lapIndex);
}

async function getExpectedLaps(raceEntryId: string): Promise<number> {
  const [entry] = await db
    .select({ raceId: raceEntries.raceId })
    .from(raceEntries)
    .where(eq(raceEntries.id, raceEntryId));
  const [race] = await db
    .select({ expectedLaps: races.expectedLaps })
    .from(races)
    .where(eq(races.id, entry.raceId));
  return race.expectedLaps;
}
