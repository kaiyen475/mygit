ALTER TABLE `applicants` ADD `message` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `deleted_examples` (`id` text PRIMARY KEY NOT NULL,`created_at` text NOT NULL);
