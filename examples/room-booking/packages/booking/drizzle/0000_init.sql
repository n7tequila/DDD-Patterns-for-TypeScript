CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`organizer` text NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bookings_room_time` ON `bookings` (`room_id`,`start_ms`,`end_ms`);--> statement-breakpoint
CREATE TABLE `booking_outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`sent_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_outbox_event_id_unique` ON `booking_outbox` (`event_id`);