import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

let _db: ReturnType<typeof drizzle> | undefined;

function initDb() {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_URL ?? "data/opencheckout.db";
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = drizzle(sqlite, { schema });
  return _db;
}

/**
 * Lazy-initialized database instance.
 * Only connects on first access — safe for build environments.
 */
function getDb() {
  return initDb();
}

export { getDb, schema };
