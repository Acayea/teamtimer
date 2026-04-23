CREATE TABLE `athletes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date_of_birth` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `meets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`location` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `race_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`slot_index` integer NOT NULL,
	`athlete_id` text,
	`team_name` text,
	`finished_at` integer,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `race_entries_race_slot_uidx` ON `race_entries` (`race_id`,`slot_index`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` text PRIMARY KEY NOT NULL,
	`meet_id` text,
	`kind` text NOT NULL,
	`distance_m` integer NOT NULL,
	`lap_distance_m` integer DEFAULT 400 NOT NULL,
	`expected_laps` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`status` text DEFAULT 'setup' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`meet_id`) REFERENCES `meets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relay_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`race_entry_id` text NOT NULL,
	`leg_index` integer NOT NULL,
	`athlete_id` text NOT NULL,
	FOREIGN KEY (`race_entry_id`) REFERENCES `race_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relay_legs_entry_leg_uidx` ON `relay_legs` (`race_entry_id`,`leg_index`);--> statement-breakpoint
CREATE TABLE `splits` (
	`id` text PRIMARY KEY NOT NULL,
	`race_entry_id` text NOT NULL,
	`lap_index` integer NOT NULL,
	`captured_at` integer NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`race_entry_id`) REFERENCES `race_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `splits_entry_lap_uidx` ON `splits` (`race_entry_id`,`lap_index`);--> statement-breakpoint
CREATE TABLE `target_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`race_entry_id` text NOT NULL,
	`lap_index` integer NOT NULL,
	`target_ms` integer NOT NULL,
	FOREIGN KEY (`race_entry_id`) REFERENCES `race_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `target_splits_entry_lap_uidx` ON `target_splits` (`race_entry_id`,`lap_index`);