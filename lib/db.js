import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { computeFiscalMonths, normalizeJinSection } from './pipeline.js';

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

    CREATE TABLE IF NOT EXISTS jin_date_rows (
      id TEXT PRIMARY KEY,
      year_term TEXT,
      target_month TEXT NOT NULL,
      branch TEXT NOT NULL,
      section TEXT NOT NULL,
      case_type TEXT,
      rank TEXT,
      staff_name TEXT,
      client_name TEXT,
      hope TEXT,
      tour_date TEXT,
      manager_name TEXT,
      selection TEXT,
      start_date TEXT,
      leave_date TEXT,
      rework TEXT,
      next_job TEXT,
      leave_reason TEXT,
      memo TEXT,
      status TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jin_date_month_branch ON jin_date_rows(target_month, branch);
    CREATE INDEX IF NOT EXISTS idx_jin_date_status ON jin_date_rows(status);

    CREATE VIEW IF NOT EXISTS v_map_rows AS
    SELECT
      branch,
      manager_name,
      client_name,
      staff_name,
      status,
      target_month
    FROM jin_date_rows
    WHERE status IN ('offer','active','leave_notice');
  `);

  seedJinDateRows(db);
}

function seedJinDateRows(db) {
  const exists = db.prepare('SELECT COUNT(*) AS c FROM jin_date_rows').get().c;
  if (exists > 0) return;

  const rows = db.prepare(`
    SELECT s.staff_id, s.branch, s.sales_name, s.staff_name, s.join_date, s.leave_date, a.client_name
    FROM staff s
    LEFT JOIN assignments a ON a.staff_id = s.staff_id
    ORDER BY s.branch, s.sales_name, s.staff_name
    LIMIT 500
  `).all();

  const fiscalMonths = computeFiscalMonths(new Date());
  const activeMonth = fiscalMonths[0];
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO jin_date_rows (
      id, year_term, target_month, branch, section, case_type, rank,
      staff_name, client_name, hope, tour_date, manager_name, selection,
      start_date, leave_date, rework, next_job, leave_reason, memo, status,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      @id, @year_term, @target_month, @branch, @section, @case_type, @rank,
      @staff_name, @client_name, @hope, @tour_date, @manager_name, @selection,
      @start_date, @leave_date, @rework, @next_job, @leave_reason, @memo, @status,
      @created_by, @updated_by, @created_at, @updated_at
    )
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      const status = r.leave_date ? 'left' : r.join_date ? 'active' : 'prospect';
      const target_month = (r.join_date || '').slice(0, 7) || activeMonth;
      insert.run({
        id: `seed-${r.staff_id || `${r.branch}-${r.staff_name}`}`,
        year_term: '第15期',
        target_month,
        branch: r.branch || '未設定',
        section: normalizeJinSection(status, target_month, activeMonth),
        case_type: '新規案件',
        rank: status === 'prospect' ? 'B' : null,
        staff_name: r.staff_name || '',
        client_name: r.client_name || '',
        hope: null,
        tour_date: null,
        manager_name: r.sales_name || '',
        selection: null,
        start_date: r.join_date || null,
        leave_date: r.leave_date || null,
        rework: null,
        next_job: null,
        leave_reason: null,
        memo: null,
        status,
        created_by: 'system-seed',
        updated_by: 'system-seed',
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();
}
