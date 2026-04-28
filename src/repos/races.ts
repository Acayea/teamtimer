// src/repos/races.ts
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  races,
  raceEntries,
  targetSplits,
  relayLegs,
  type Race,
  type RaceEntry,
  type RelayLeg,
} from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export type CreateRaceInput = {
  kind: 'individual' | 'relay';
  distanceM: number;
  lapDistanceM: number;
  expectedLaps: number;
  meetId?: string;
  entries: {
    slotIndex: number;
    athleteId?: string;
    teamName?: string;
    targetCumulativeMs?: number[];
    legs?: { legIndex: number; athleteId: string }[];
  }[];
};

export async function createRace(input: CreateRaceInput): Promise<string> {
  const raceId = randomUUID();
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.insert(races).values({
      id: raceId,
      kind: input.kind,
      distanceM: input.distanceM,
      lapDistanceM: input.lapDistanceM,
      expectedLaps: input.expectedLaps,
      meetId: input.meetId ?? null,
      status: 'setup',
      createdAt: now,
      startedAt: null,
      endedAt: null,
    });
    for (const e of input.entries) {
      const entryId = randomUUID();
      await tx.insert(raceEntries).values({
        id: entryId,
        raceId,
        slotIndex: e.slotIndex,
        athleteId: e.athleteId ?? null,
        teamName: e.teamName ?? null,
        finishedAt: null,
      });
      if (e.targetCumulativeMs) {
        for (let i = 0; i < e.targetCumulativeMs.length; i++) {
          await tx.insert(targetSplits).values({
            id: randomUUID(),
            raceEntryId: entryId,
            lapIndex: i,
            targetMs: e.targetCumulativeMs[i],
          });
        }
      }
      if (e.legs) {
        for (const leg of e.legs) {
          await tx.insert(relayLegs).values({
            id: randomUUID(),
            raceEntryId: entryId,
            legIndex: leg.legIndex,
            athleteId: leg.athleteId,
          });
        }
      }
    }
  });
  return raceId;
}

export async function startRace(raceId: string): Promise<number> {
  const now = Date.now();
  await db.update(races).set({ status: 'running', startedAt: now }).where(eq(races.id, raceId));
  return now;
}

export async function endRace(raceId: string): Promise<void> {
  await db
    .update(races)
    .set({ status: 'completed', endedAt: Date.now() })
    .where(eq(races.id, raceId));
}

export async function discardRace(raceId: string): Promise<void> {
  await db.update(races).set({ status: 'discarded' }).where(eq(races.id, raceId));
}

export async function getRunningRace(): Promise<Race | undefined> {
  const rows = await db.select().from(races).where(eq(races.status, 'running'));
  return rows[0];
}

export async function getRecentRaces(limit = 20): Promise<Race[]> {
  return db
    .select()
    .from(races)
    .where(eq(races.status, 'completed'))
    .orderBy(desc(races.createdAt))
    .limit(limit);
}

export async function getRace(id: string): Promise<Race | undefined> {
  const rows = await db.select().from(races).where(eq(races.id, id));
  return rows[0];
}

export async function getRaceEntries(raceId: string): Promise<RaceEntry[]> {
  return db.select().from(raceEntries).where(eq(raceEntries.raceId, raceId));
}

export async function getRelayLegsForEntry(raceEntryId: string): Promise<RelayLeg[]> {
  return db
    .select()
    .from(relayLegs)
    .where(eq(relayLegs.raceEntryId, raceEntryId))
    .orderBy(asc(relayLegs.legIndex));
}

export async function updateRelayLegAthlete(relayLegId: string, athleteId: string): Promise<void> {
  await db.update(relayLegs).set({ athleteId }).where(eq(relayLegs.id, relayLegId));
}
