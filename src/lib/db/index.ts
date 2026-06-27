import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { encryptStoredSecret } from "@/lib/crypto/keys";

let _db: ReturnType<typeof drizzle> | undefined;

function initDb() {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_URL ?? "data/opencheckout.db";
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrateLegacySecrets(sqlite);
  _db = drizzle(sqlite, { schema });
  return _db;
}

function migrateLegacySecrets(sqlite: Database.Database) {
  if (!process.env.ENCRYPTION_KEY) return;

  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  const tableNames = new Set(tables.map((table) => table.name));

  if (tableNames.has("merchants")) {
    const merchants = sqlite
      .prepare(
        "SELECT id, webhook_secret AS webhookSecret FROM merchants WHERE webhook_secret IS NOT NULL"
      )
      .all() as Array<{ id: string; webhookSecret: string }>;
    const updateMerchant = sqlite.prepare(
      "UPDATE merchants SET webhook_secret = ? WHERE id = ?"
    );
    for (const merchant of merchants) {
      if (!merchant.webhookSecret.startsWith("enc:v1:")) {
        updateMerchant.run(
          encryptStoredSecret(merchant.webhookSecret),
          merchant.id
        );
      }
    }
  }

  if (tableNames.has("checkout_sessions")) {
    const checkoutColumns = new Set(
      (
        sqlite.prepare("PRAGMA table_info(checkout_sessions)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name)
    );
    const completedClearFields = [
      "continue_access_token = NULL",
      "continue_uri = NULL",
      ...(checkoutColumns.has("grant_interact_url")
        ? ["grant_interact_url = NULL"]
        : []),
    ];
    sqlite
      .prepare(
        `UPDATE checkout_sessions SET ${completedClearFields.join(
          ", "
        )} WHERE status = 'completed'`
      )
      .run();
    const sessions = sqlite
      .prepare(
        "SELECT id, continue_access_token AS token, continue_uri AS uri FROM checkout_sessions WHERE continue_access_token IS NOT NULL OR continue_uri IS NOT NULL"
      )
      .all() as Array<{ id: string; token: string | null; uri: string | null }>;
    const updateSession = sqlite.prepare(
      "UPDATE checkout_sessions SET continue_access_token = ?, continue_uri = ? WHERE id = ?"
    );
    for (const session of sessions) {
      const token = session.token
        ? session.token.startsWith("enc:v1:")
          ? session.token
          : encryptStoredSecret(session.token)
        : null;
      const uri = session.uri
        ? session.uri.startsWith("enc:v1:")
          ? session.uri
          : encryptStoredSecret(session.uri)
        : null;
      if (token !== session.token || uri !== session.uri) {
        updateSession.run(token, uri, session.id);
      }
    }
  }
}

/**
 * Lazy-initialized database instance.
 * Only connects on first access — safe for build environments.
 */
function getDb() {
  return initDb();
}

export { getDb, schema };
