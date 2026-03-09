# whoop-sync skill

Syncs Whoop workouts, sleep sessions, and recovery cycles to a local SQLite database.

## CLI Commands

```bash
whoop-sync auth                     # Print OAuth URL + setup instructions
whoop-sync auth --code "<url>"      # Exchange redirect URL for tokens, save to config.json
whoop-sync sync                     # Incremental sync (only new data since last run)
whoop-sync sync --full              # Full resync from beginning
whoop-sync status                   # Show last sync time + record counts
```

## Database

Location: `~/projects/whoop-sync/fitness.db`

### Tables

**workouts**
- `id` — Whoop workout ID (PK)
- `sport_name` — e.g. cycling, weightlifting, running, sauna
- `sport_id` — Numeric sport ID (233 = sauna)
- `start`, `end` — ISO timestamps
- `strain` — Whoop strain score (0-21)
- `avg_hr`, `max_hr` — Heart rate
- `zone_zero_ms` through `zone_five_ms` — Time in each HR zone (milliseconds)
- `synced_at`

**sleep**
- `id` — Sleep session ID (PK)
- `start`, `end`
- `sleep_performance_pct` — 0-100
- `hrv_rmssd` — HRV in milliseconds (may be null)
- `resting_hr`
- `total_in_bed_ms`
- `synced_at`

**cycles**
- `id` — Cycle ID (PK)
- `start`, `end`
- `strain` — Daily strain
- `kilojoule` — Calories burned (kJ)
- `avg_hr`, `max_hr`
- `synced_at`

**sync_state**
- `key` — 'last_workout_start', 'last_sleep_start', 'last_cycle_start'
- `value` — ISO timestamp of last synced record

## Useful SQL Queries

```sql
-- Sauna sessions this week
SELECT start, end FROM workouts
WHERE sport_name = 'sauna'
  AND start >= date('now', 'weekday 0', '-7 days')
ORDER BY start DESC;

-- Weekly sauna count
SELECT count(*) as saunas FROM workouts
WHERE sport_name = 'sauna'
  AND start >= date('now', 'weekday 0', '-7 days');

-- Lifts this week (weightlifting)
SELECT count(*) as lifts FROM workouts
WHERE sport_name = 'weightlifting'
  AND start >= date('now', 'weekday 0', '-7 days');

-- Zone 4+5 cardio minutes this week
SELECT sport_name, start,
  (zone_four_ms + zone_five_ms) / 60000.0 as z45_min
FROM workouts
WHERE sport_name NOT IN ('sauna', 'weightlifting')
  AND (zone_four_ms + zone_five_ms) > 0
  AND start >= date('now', 'weekday 0', '-7 days')
ORDER BY start DESC;

-- Sleep performance last 7 days
SELECT date(start) as night, sleep_performance_pct, hrv_rmssd, resting_hr
FROM sleep ORDER BY start DESC LIMIT 7;

-- Recent workouts
SELECT sport_name, start, strain, avg_hr, max_hr
FROM workouts ORDER BY start DESC LIMIT 10;
```

## Query the DB directly

```bash
sqlite3 ~/projects/whoop-sync/fitness.db "SELECT sport_name, start, strain FROM workouts ORDER BY start DESC LIMIT 5;"
```
