// src/repos/athletes.ts
import { eq, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { athletes, type Athlete } from '@/db/schema';
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
