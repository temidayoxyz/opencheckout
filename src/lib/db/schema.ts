import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const merchants = sqliteTable("merchants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  privateKey: text("private_key").notNull(), // AES-256-GCM encrypted
  keyId: text("key_id").notNull(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  branding: text("branding", { mode: "json" }).$type<{
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  }>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.id),
    keyHash: text("key_hash").notNull(), // SHA-256 hash
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    revokedAt: text("revoked_at"), // NULL = active
  },
  (table) => [
    uniqueIndex("api_keys_key_hash_unique").on(table.keyHash),
    index("api_keys_merchant_id_idx").on(table.merchantId),
  ]
);

export const checkoutSessions = sqliteTable("checkout_sessions", {
  id: text("id").primaryKey(), // cs_xxx
  merchantId: text("merchant_id")
    .notNull()
    .references(() => merchants.id),
  mode: text("mode", { enum: ["payment"] }).notNull(),
  status: text("status", {
    enum: [
      "open",
      "preparing",
      "awaiting_approval",
      "processing",
      "completed",
      "expired",
      "canceled",
    ],
  })
    .notNull()
    .default("open"),
  amountTotal: integer("amount_total"),
  currency: text("currency").notNull(), // ISO 4217 lowercase
  lineItems: text("line_items", { mode: "json" }).$type<
    Array<{
      priceData: {
        currency: string;
        productData: { name: string; description?: string };
        unitAmount: number;
      };
      quantity: number;
    }>
  >(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, string>>(),
  successUrl: text("success_url").notNull(),
  cancelUrl: text("cancel_url").notNull(),
  url: text("url"),
  // Open Payments references
  incomingPaymentUrl: text("incoming_payment_url"),
  incomingPaymentId: text("incoming_payment_id"),
  quoteUrl: text("quote_url"),
  quoteId: text("quote_id"),
  outgoingPaymentUrl: text("outgoing_payment_url"),
  // Grant references
  continueAccessToken: text("continue_access_token"),
  continueUri: text("continue_uri"),
  interactRef: text("interact_ref"),
  grantClientNonce: text("grant_client_nonce"),
  grantServerNonce: text("grant_server_nonce"),
  grantAuthServerUrl: text("grant_auth_server_url"),
  grantInteractUrl: text("grant_interact_url"),
  // Lifecycle
  customerWallet: text("customer_wallet"),
  preparationStartedAt: text("preparation_started_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  index("checkout_sessions_merchant_created_idx").on(
    table.merchantId,
    table.createdAt
  ),
  index("checkout_sessions_status_expires_idx").on(table.status, table.expiresAt),
]);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(), // SHA-256 of merchant + Idempotency-Key
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.id),
    requestHash: text("request_hash").notNull(),
    sessionId: text("session_id"),
    response: text("response", { mode: "json" }).$type<Record<string, unknown>>(),
    statusCode: integer("status_code"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idempotency_keys_merchant_created_idx").on(
      table.merchantId,
      table.createdAt
    ),
  ]
);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id")
    .notNull()
    .references(() => merchants.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => checkoutSessions.id),
  eventType: text("event_type").notNull(), // checkout.session.completed, checkout.session.expired, etc.
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  attempts: integer("attempts").default(0),
  lastAttempt: text("last_attempt"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
