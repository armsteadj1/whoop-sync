import Database from 'better-sqlite3';
import { fetchWorkouts, fetchSleep, fetchCycles } from './whoop';

const NOW = new Date().toISOString();

function getSyncState(db: Database.Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

function setSyncState(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run(key, value);
}

function upsertWorkout(db: Database.Database, w: any): void {
  const score = w.score ?? {};
  const zones = score.zone_duration ?? {};
  db.prepare(`
    INSERT OR REPLACE INTO workouts
      (id, user_id, sport_name, sport_id, start, end, strain, avg_hr, max_hr,
       zone_zero_ms, zone_one_ms, zone_two_ms, zone_three_ms, zone_four_ms, zone_five_ms, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(w.id), w.user_id, w.sport_name ?? null, w.sport_id ?? null,
    w.start, w.end,
    score.strain ?? null, score.average_heart_rate ?? null, score.max_heart_rate ?? null,
    zones.zone_zero_milli_seconds ?? null,
    zones.zone_one_milli_seconds ?? null,
    zones.zone_two_milli_seconds ?? null,
    zones.zone_three_milli_seconds ?? null,
    zones.zone_four_milli_seconds ?? null,
    zones.zone_five_milli_seconds ?? null,
    NOW
  );
}

function upsertSleep(db: Database.Database, s: any): void {
  const score = s.score ?? {};
  db.prepare(`
    INSERT OR REPLACE INTO sleep
      (id, user_id, start, end, sleep_performance_pct, hrv_rmssd, resting_hr, total_in_bed_ms, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(s.id), s.user_id,
    s.start, s.end,
    score.sleep_performance_percentage ?? null,
    score.hrv_rmssd_milli ?? null,
    score.resting_heart_rate ?? null,
    score.total_in_bed_time_milli ?? null,
    NOW
  );
}

function upsertCycle(db: Database.Database, c: any): void {
  const score = c.score ?? {};
  db.prepare(`
    INSERT OR REPLACE INTO cycles
      (id, user_id, start, end, strain, kilojoule, avg_hr, max_hr, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(c.id), c.user_id,
    c.start, c.end,
    score.strain ?? null,
    score.kilojoule ?? null,
    score.average_heart_rate ?? null,
    score.max_heart_rate ?? null,
    NOW
  );
}

export async function sync(db: Database.Database, token: string, full: boolean): Promise<void> {
  const startKey = full ? undefined : undefined; // will use sync_state for incremental

  // Workouts
  const lastWorkout = full ? undefined : getSyncState(db, 'last_workout_start');
  console.log(`Syncing workouts${lastWorkout ? ` from ${lastWorkout}` : ' (full)'}...`);
  let workoutCount = 0;
  let latestWorkoutStart: string | undefined;
  for await (const batch of fetchWorkouts(token, lastWorkout)) {
    for (const w of batch) {
      upsertWorkout(db, w);
      workoutCount++;
      if (!latestWorkoutStart || w.start > latestWorkoutStart) latestWorkoutStart = w.start;
    }
    process.stdout.write(`  workouts: ${workoutCount}\r`);
  }
  if (latestWorkoutStart) setSyncState(db, 'last_workout_start', latestWorkoutStart);
  console.log(`  workouts: ${workoutCount} synced`);

  // Sleep
  const lastSleep = full ? undefined : getSyncState(db, 'last_sleep_start');
  console.log(`Syncing sleep${lastSleep ? ` from ${lastSleep}` : ' (full)'}...`);
  let sleepCount = 0;
  let latestSleepStart: string | undefined;
  for await (const batch of fetchSleep(token, lastSleep)) {
    for (const s of batch) {
      upsertSleep(db, s);
      sleepCount++;
      if (!latestSleepStart || s.start > latestSleepStart) latestSleepStart = s.start;
    }
    process.stdout.write(`  sleep: ${sleepCount}\r`);
  }
  if (latestSleepStart) setSyncState(db, 'last_sleep_start', latestSleepStart);
  console.log(`  sleep: ${sleepCount} synced`);

  // Cycles
  const lastCycle = full ? undefined : getSyncState(db, 'last_cycle_start');
  console.log(`Syncing cycles${lastCycle ? ` from ${lastCycle}` : ' (full)'}...`);
  let cycleCount = 0;
  let latestCycleStart: string | undefined;
  for await (const batch of fetchCycles(token, lastCycle)) {
    for (const c of batch) {
      upsertCycle(db, c);
      cycleCount++;
      if (!latestCycleStart || c.start > latestCycleStart) latestCycleStart = c.start;
    }
    process.stdout.write(`  cycles: ${cycleCount}\r`);
  }
  if (latestCycleStart) setSyncState(db, 'last_cycle_start', latestCycleStart);
  console.log(`  cycles: ${cycleCount} synced`);
}
