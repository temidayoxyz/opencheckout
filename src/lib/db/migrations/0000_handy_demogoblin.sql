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
	`customer_wallet` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
