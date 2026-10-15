CREATE TABLE `expedition_photos` (
 `id` text PRIMARY KEY NOT NULL,
 `event_id` text NOT NULL REFERENCES `expeditions`(`id`),
 `content_type` text NOT NULL,
 `data` blob NOT NULL,
 `sha256` text NOT NULL,
 `size` integer NOT NULL,
 `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expedition_photo_event_index` ON `expedition_photos` (`event_id`);
