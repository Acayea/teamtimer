// src/db/migrate.ts
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './client';
import migrations from './migrations/migrations';

export async function runMigrations(): Promise<void> {
  await migrate(db, migrations);
}
