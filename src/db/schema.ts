// src/db/schema.ts
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const athletes = sqliteTable('athletes', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  dateOfBirth: text('date_of_birth'),
  notes:       text('notes'),
  createdAt:   integer('created_at').notNull(),
  archivedAt:  integer('archived_at'),
});

export const meets = sqliteTable('meets', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  date:      text('date').notNull(),
  location:  text('location'),
  createdAt: integer('created_at').notNull(),
});

export const races = sqliteTable('races', {
  id:           text('id').primaryKey(),
  meetId:       text('meet_id').references(() => meets.id),
  kind:         text('kind', { enum: ['individual', 'relay'] }).notNull(),
  distanceM:    integer('distance_m').notNull(),
  lapDistanceM: integer('lap_distance_m').notNull().default(400),
  expectedLaps: integer('expected_laps').notNull(),
  startedAt:    integer('started_at'),
  endedAt:      integer('ended_at'),
  status:       text('status', {
    enum: ['setup', 'running', 'completed', 'discarded'],
  }).notNull().default('setup'),
  createdAt: integer('created_at').notNull(),
});

export const raceEntries = sqliteTable('race_entries', {
  id:         text('id').primaryKey(),
  raceId:     text('race_id').notNull().references(() => races.id),
  slotIndex:  integer('slot_index').notNull(),
  athleteId:  text('athlete_id').references(() => athletes.id),
  teamName:   text('team_name'),
  finishedAt: integer('finished_at'),
}, (t) => ({
  uniqueSlot: uniqueIndex('race_entries_race_slot_uidx').on(t.raceId, t.slotIndex),
}));

export const splits = sqliteTable('splits', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  lapIndex:     integer('lap_index').notNull(),
  capturedAt:   integer('captured_at').notNull(),
  edited:       integer('edited', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueLap: uniqueIndex('splits_entry_lap_uidx').on(t.raceEntryId, t.lapIndex),
}));

export const targetSplits = sqliteTable('target_splits', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  lapIndex:     integer('lap_index').notNull(),
  targetMs:     integer('target_ms').notNull(),
}, (t) => ({
  uniqueTarget: uniqueIndex('target_splits_entry_lap_uidx').on(t.raceEntryId, t.lapIndex),
}));

export const relayLegs = sqliteTable('relay_legs', {
  id:           text('id').primaryKey(),
  raceEntryId:  text('race_entry_id').notNull().references(() => raceEntries.id),
  legIndex:     integer('leg_index').notNull(),
  athleteId:    text('athlete_id').notNull().references(() => athletes.id),
}, (t) => ({
  uniqueLeg: uniqueIndex('relay_legs_entry_leg_uidx').on(t.raceEntryId, t.legIndex),
}));

export type Athlete     = typeof athletes.$inferSelect;
export type Meet        = typeof meets.$inferSelect;
export type Race        = typeof races.$inferSelect;
export type RaceEntry   = typeof raceEntries.$inferSelect;
export type Split       = typeof splits.$inferSelect;
export type TargetSplit = typeof targetSplits.$inferSelect;
export type RelayLeg    = typeof relayLegs.$inferSelect;
