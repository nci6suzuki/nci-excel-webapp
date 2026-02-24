import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.sqlite');

export function getDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  init(db);
  return db;
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      kind TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      staff_id TEXT PRIMARY KEY,
      branch TEXT,
      sales_name TEXT,
      staff_name TEXT,
      gender TEXT,
      employment_type TEXT,
      retire_risk TEXT,
      join_date TEXT,
      leave_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_staff_branch_sales ON staff(branch, sales_name);
    CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(staff_name);

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id TEXT NOT NULL,
      client_name TEXT,
      branch TEXT,
      sales_name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(staff_id, client_name, branch, sales_name)
    );

    CREATE INDEX IF NOT EXISTS idx_assign_branch_sales_client ON assignments(branch, sales_name, client_name);

    CREATE TABLE IF NOT EXISTS performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch TEXT,
      month TEXT,
      sales_name TEXT,
      staff_name TEXT,
      staff_id TEXT,
      metric_key TEXT,
      metric_value REAL,
      raw_row_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_perf_branch_month_sales ON performance(branch, month, sales_name);

    CREATE TABLE IF NOT EXISTS headcount_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT,
      branch TEXT,
      metric_key TEXT,
      metric_value REAL,
      raw_row_json TEXT
    );
  `);
}
