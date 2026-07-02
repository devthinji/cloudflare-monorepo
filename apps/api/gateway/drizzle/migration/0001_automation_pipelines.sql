CREATE TABLE `automation_pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`agent_slug` text DEFAULT 'default' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`input` text,
	`output` text,
	`logs` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_automation_runs_pipeline` ON `automation_runs` (`pipeline_id`);
