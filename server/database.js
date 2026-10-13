import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Файловата SQLite база не изисква самостоятелен сървър или външен драйвер.
export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER NOT NULL CHECK(duration BETWEEN 5 AND 1440),
      status TEXT NOT NULL CHECK(status IN ('planned','in_progress','rejected','completed')),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks(date, time);
    PRAGMA user_version = 1;
  `);
  return db;
}
