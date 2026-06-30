CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`system_prompt` text NOT NULL,
	`tools_enabled` text DEFAULT '[]' NOT NULL,
	`model_provider` text DEFAULT 'openrouter' NOT NULL,
	`model_id` text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`channel_config` text,
	`api_keys` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_slug_unique` ON `agents` (`slug`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_slug` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`context` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_slug` text NOT NULL,
	`template_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`file_url` text,
	`field_values` text,
	`transaction_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_call` text,
	`tokens_used` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`document_type` text NOT NULL,
	`tier` text,
	`agent_slugs` text DEFAULT '[]' NOT NULL,
	`r2_key` text NOT NULL,
	`preview_url` text,
	`field_schema` text DEFAULT '[]' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`extraction_status` text DEFAULT 'pending' NOT NULL,
	`extraction_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_slug_unique` ON `templates` (`slug`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_slug` text NOT NULL,
	`provider` text DEFAULT 'mpesa' NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'KES' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`merchant_request_id` text,
	`checkout_request_id` text,
	`mpesa_receipt_number` text,
	`phone_number` text,
	`description` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`agent_slug` text,
	`is_registered` integer DEFAULT false NOT NULL,
	`is_blocked` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`hash` text NOT NULL,
	`contacts` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);
--> statement-breakpoint
CREATE TABLE `skus` (
  `id`                  TEXT PRIMARY KEY NOT NULL,
  `name`                TEXT NOT NULL,
  `slug`                TEXT NOT NULL,
  `description`         TEXT,
  `agent_slug`          TEXT NOT NULL,
  `template_type`       TEXT NOT NULL,
  `file_key`            TEXT NOT NULL,
  `preview_key`         TEXT,
  `markdown_preview`    TEXT,
  `price`               REAL NOT NULL DEFAULT 0,
  `currency`            TEXT NOT NULL DEFAULT 'KES',
  `field_schema`        TEXT NOT NULL DEFAULT '[]',
  `conversation_steps`  TEXT,
  `is_active`           INTEGER NOT NULL DEFAULT 0,
  `requires_review`     INTEGER NOT NULL DEFAULT 1,
  `version`             INTEGER NOT NULL DEFAULT 1,
  `created_at`          TEXT NOT NULL,
  `updated_at`          TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skus_slug_unique` ON `skus` (`slug`);
