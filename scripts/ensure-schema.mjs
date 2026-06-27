import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export function ensureSchema(dbPath = process.env.DATABASE_URL ?? "data/opencheckout.db") {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  private_key TEXT NOT NULL,
  key_id TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT,
  branding TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT DEFAULT 'open' NOT NULL,
  amount_total INTEGER,
  currency TEXT NOT NULL,
  line_items TEXT,
  metadata TEXT,
  success_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,
  url TEXT,
  incoming_payment_url TEXT,
  incoming_payment_id TEXT,
  quote_url TEXT,
  quote_id TEXT,
  outgoing_payment_url TEXT,
  continue_access_token TEXT,
  continue_uri TEXT,
  interact_ref TEXT,
  grant_client_nonce TEXT,
  grant_server_nonce TEXT,
  grant_auth_server_url TEXT,
  grant_interact_url TEXT,
  customer_wallet TEXT,
  preparation_started_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key_hash TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  session_id TEXT,
  response TEXT,
  status_code INTEGER,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempt TEXT,
  delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (session_id) REFERENCES checkout_sessions(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_unique ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_merchant_id_idx ON api_keys (merchant_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_merchant_created_idx ON checkout_sessions (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS checkout_sessions_status_expires_idx ON checkout_sessions (status, expires_at);
CREATE INDEX IF NOT EXISTS idempotency_keys_merchant_created_idx ON idempotency_keys (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS webhook_events_session_idx ON webhook_events (session_id);
`);

  const checkoutColumns = db
    .prepare("PRAGMA table_info(checkout_sessions)")
    .all()
    .map((column) => column.name);

  for (const [name, ddl] of [
    ["grant_client_nonce", "ALTER TABLE checkout_sessions ADD COLUMN grant_client_nonce TEXT"],
    ["grant_server_nonce", "ALTER TABLE checkout_sessions ADD COLUMN grant_server_nonce TEXT"],
    ["grant_auth_server_url", "ALTER TABLE checkout_sessions ADD COLUMN grant_auth_server_url TEXT"],
    ["grant_interact_url", "ALTER TABLE checkout_sessions ADD COLUMN grant_interact_url TEXT"],
    ["preparation_started_at", "ALTER TABLE checkout_sessions ADD COLUMN preparation_started_at TEXT"],
  ]) {
    if (!checkoutColumns.includes(name)) {
      db.exec(ddl);
    }
  }

  let idempotencyColumns = db
    .prepare("PRAGMA table_info(idempotency_keys)")
    .all();

  const needsIdempotencyRebuild = idempotencyColumns.some(
    (column) =>
      (column.name === "session_id" || column.name === "status_code") &&
      column.notnull === 1
  );

  if (needsIdempotencyRebuild) {
    db.exec(`
ALTER TABLE idempotency_keys RENAME TO idempotency_keys_old;
CREATE TABLE idempotency_keys (
  key_hash TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  session_id TEXT,
  response TEXT,
  status_code INTEGER,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);
INSERT INTO idempotency_keys (
  key_hash, merchant_id, request_hash, session_id, response, status_code, created_at
)
SELECT
  key_hash,
  merchant_id,
  key_hash,
  session_id,
  response,
  status_code,
  created_at
FROM idempotency_keys_old;
DROP TABLE idempotency_keys_old;
`);
    idempotencyColumns = db.prepare("PRAGMA table_info(idempotency_keys)").all();
  }

  const idempotencyColumnNames = idempotencyColumns.map((column) => column.name);

  if (!idempotencyColumnNames.includes("request_hash")) {
    db.exec("ALTER TABLE idempotency_keys ADD COLUMN request_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!idempotencyColumnNames.includes("session_id")) {
    db.exec("ALTER TABLE idempotency_keys ADD COLUMN session_id TEXT");
  }
  if (idempotencyColumnNames.includes("status_code")) {
    db.exec("UPDATE idempotency_keys SET request_hash = key_hash WHERE request_hash = ''");
  }

  db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_unique ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_merchant_id_idx ON api_keys (merchant_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_merchant_created_idx ON checkout_sessions (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS checkout_sessions_status_expires_idx ON checkout_sessions (status, expires_at);
CREATE INDEX IF NOT EXISTS idempotency_keys_merchant_created_idx ON idempotency_keys (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS webhook_events_session_idx ON webhook_events (session_id);
`);

  db.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureSchema();
}
