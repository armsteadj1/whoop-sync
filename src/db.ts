import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'fitness.db');

export function initDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      sport_name TEXT,
      sport_id INTEGER,
      start TEXT,
      end TEXT,
      strain REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      zone_zero_ms INTEGER,
      zone_one_ms INTEGER,
      zone_two_ms INTEGER,
      zone_three_ms INTEGER,
      zone_four_ms INTEGER,
      zone_five_ms INTEGER,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sleep (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      start TEXT,
      end TEXT,
      sleep_performance_pct REAL,
      hrv_rmssd REAL,
      resting_hr INTEGER,
      total_in_bed_ms INTEGER,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      start TEXT,
      end TEXT,
      strain REAL,
      kilojoule REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS recovery (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      cycle_id INTEGER,
      created_at TEXT,
      recovery_score REAL,
      hrv_rmssd_milli REAL,
      resting_heart_rate REAL,
      spo2_percentage REAL,
      skin_temp_celsius REAL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return db;
}
