CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`wallet_address` text NOT NULL,
	`private_key` text NOT NULL,
	`key_id` text NOT NULL,
	`webhook_url` text,
	`webhook_secret` text,
	`branding` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`amount_total` integer,
	`currency` text NOT NULL,
	`line_items` text,
	`metadata` text,
	`success_url` text NOT NULL,
	`cancel_url` text NOT NULL,
	`url` text,
	`incoming_payment_url` text,
	`incoming_payment_id` text,
	`quote_url` text,
	`quote_id` text,
	`outgoing_payment_url` text,
	`continue_access_token` text,
	`continue_uri` text,
	`interact_ref` text,
	`grant_client_nonce` text,
	`grant_server_nonce` text,
	`grant_auth_server_url` text,
	`customer_wallet` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`session_id` text,
	`response` text,
	`status_code` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text,
	`attempts` integer DEFAULT 0,
	`last_attempt` text,
	`delivered_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `checkout_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
--> statement-breakpoint
CREATE INDEX `api_keys_merchant_id_idx` ON `api_keys` (`merchant_id`);
--> statement-breakpoint
CREATE INDEX `checkout_sessions_merchant_created_idx` ON `checkout_sessions` (`merchant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `checkout_sessions_status_expires_idx` ON `checkout_sessions` (`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `idempotency_keys_merchant_created_idx` ON `idempotency_keys` (`merchant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `webhook_events_session_idx` ON `webhook_events` (`session_id`);
