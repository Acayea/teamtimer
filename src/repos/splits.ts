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

/** Append a new split for an entry. Returns the new split id and captured timestamp. */
export async function appendSplit(
  raceEntryId: string,
  lapIndex: number,
): Promise<{ id: string; capturedAt: number }> {
  const id = randomUUID();
  const capturedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.insert(splits).values({
      id,
      raceEntryId,
      lapIndex,
      capturedAt,
      edited: false,
    });
    const expectedLaps = await getExpectedLaps(tx, raceEntryId);
    if (lapIndex === expectedLaps - 1) {
      await tx
        .update(raceEntries)
        .set({ finishedAt: capturedAt })
        .where(eq(raceEntries.id, raceEntryId));
    }
  });
  return { id, capturedAt };
}

/** Remove the most recent split for an entry. */
export async function undoLastSplit(raceEntryId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const last = await tx
      .select()
      .from(splits)
      .where(eq(splits.raceEntryId, raceEntryId))
      .orderBy(desc(splits.lapIndex))
      .limit(1);
    if (last.length === 0) return;
    const removed = last[0];
    await tx.delete(splits).where(eq(splits.id, removed.id));
    const expectedLaps = await getExpectedLaps(tx, raceEntryId);
    if (removed.lapIndex === expectedLaps - 1) {
      await tx
        .update(raceEntries)
        .set({ finishedAt: null })
        .where(eq(raceEntries.id, raceEntryId));
    }
  });
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

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getExpectedLaps(runner: DbOrTx, raceEntryId: string): Promise<number> {
  const [entry] = await runner
    .select({ raceId: raceEntries.raceId })
    .from(raceEntries)
    .where(eq(raceEntries.id, raceEntryId));
  const [race] = await runner
    .select({ expectedLaps: races.expectedLaps })
    .from(races)
    .where(eq(races.id, entry.raceId));
  return race.expectedLaps;
}
