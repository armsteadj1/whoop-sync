# whoop-sync

Syncs Whoop workout, sleep, and cycle data to a local SQLite database.

## Setup

1. Copy `config.example.json` to `config.json` and fill in your credentials:
   ```json
   {
     "access_token": "your-whoop-access-token"
   }
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Incremental sync (only fetches new data since last sync):
```bash
npm run sync
```

Full sync (fetches all available history):
```bash
npm run sync -- --full
```

## Database

Data is stored in `fitness.db` (SQLite) with tables:
- `workouts` — workout sessions with strain, HR zones, etc.
- `sleep` — sleep sessions with HRV, performance %, resting HR
- `cycles` — daily physiological cycles
- `sync_state` — tracks last sync timestamps for incremental syncs

## Notes

- If the access token is expired (401), the tool logs a warning and exits cleanly (exit code 0).
- No OAuth flow is implemented — supply a valid token in `config.json`.
