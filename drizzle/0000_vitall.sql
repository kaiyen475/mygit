CREATE TABLE `expeditions` (
 `id` text PRIMARY KEY NOT NULL, `title` text NOT NULL, `category` text NOT NULL,
 `date` text NOT NULL, `deadline` text NOT NULL, `location` text NOT NULL,
 `description` text NOT NULL, `meeting_places` text NOT NULL,
 `capacity` integer DEFAULT 0 NOT NULL, `status` text DEFAULT 'open' NOT NULL,
 `is_example` integer DEFAULT 0 NOT NULL, `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `applicants` (
 `id` text PRIMARY KEY NOT NULL, `event_id` text NOT NULL REFERENCES `expeditions`(`id`),
 `name` text NOT NULL, `phone` text NOT NULL, `binoculars` integer NOT NULL,
 `boots` integer NOT NULL, `meeting_place` text NOT NULL, `meal` integer NOT NULL,
 `idempotency_key` text NOT NULL, `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_request_unique` ON `applicants` (`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_person_unique` ON `applicants` (`event_id`,`name`,`phone`);
--> statement-breakpoint
CREATE INDEX `application_event_index` ON `applicants` (`event_id`);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (`token_hash` text PRIMARY KEY NOT NULL,`expires_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE `login_attempts` (`key` text PRIMARY KEY NOT NULL,`failures` integer DEFAULT 0 NOT NULL,`window_start` integer NOT NULL);
