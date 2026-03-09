#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { initDb } from './db';
import { sync } from './sync';
import { WhoopAuthError } from './whoop';

const configPath = path.join(process.cwd(), 'config.json');

function loadConfig(): Record<string, string> {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(config: Record<string, string>) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const REDIRECT_URI = 'http://localhost:8080/callback';
const SCOPES = 'read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

async function cmdAuth(args: string[]) {
  const codeIdx = args.indexOf('--code');
  const config = loadConfig();

  if (codeIdx !== -1) {
    const rawUrl = args[codeIdx + 1];
    if (!rawUrl) {
      console.error('--code requires a URL argument');
      process.exit(1);
    }

    let code: string;
    try {
      const url = new URL(rawUrl);
      const c = url.searchParams.get('code');
      if (!c) throw new Error('no code param');
      code = c;
    } catch {
      // Maybe they passed just the code directly
      code = rawUrl;
    }

    const clientId = config.client_id;
    const clientSecret = config.client_secret;
    if (!clientId || !clientSecret) {
      console.error('client_id and client_secret must be in config.json');
      process.exit(1);
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error('Token exchange failed:', await res.text());
      process.exit(1);
    }

    const tokens = await res.json() as Record<string, string>;
    config.access_token = tokens.access_token;
    if (tokens.refresh_token) config.refresh_token = tokens.refresh_token;
    saveConfig(config);

    // Also store in tokens table if DB exists
    try {
      const db = initDb();
      db.prepare(`CREATE TABLE IF NOT EXISTS tokens (key TEXT PRIMARY KEY, value TEXT)`).run();
      db.prepare(`INSERT OR REPLACE INTO tokens (key, value) VALUES (?, ?)`).run('access_token', tokens.access_token);
      if (tokens.refresh_token) {
        db.prepare(`INSERT OR REPLACE INTO tokens (key, value) VALUES (?, ?)`).run('refresh_token', tokens.refresh_token);
      }
    } catch {
      // DB step is best-effort
    }

    console.log('Tokens saved to config.json. You can now run: whoop-sync sync');
    return;
  }

  const clientId = config.client_id || 'CLIENT_ID';
  const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=hedwig123`;

  console.log(`Whoop OAuth Setup
=================
1. Open this URL in your browser:
   ${authUrl}

2. Click "Authorize" in Whoop
3. The page will fail to load — copy the full URL from address bar and run:
   whoop-sync auth --code "http://localhost:8080/callback?code=XXXXX..."`);
}

async function cmdSync(args: string[]) {
  const config = loadConfig();
  const token: string = config.access_token;

  if (!token) {
    console.error('No access_token in config.json. Run: whoop-sync auth');
    process.exit(1);
  }

  const full = args.includes('--full');
  if (full) console.log('Running full sync...');

  const db = initDb();

  await sync(db, token, full);
  console.log('Sync complete.');
}

async function cmdStatus() {
  const config = loadConfig();
  const db = initDb();

  const syncState = db.prepare(`SELECT key, value FROM sync_state`).all() as { key: string; value: string }[];
  const lastSync = syncState.find(r => r.key === 'last_sync')?.value ?? 'never';

  const workoutCount = (db.prepare(`SELECT COUNT(*) as n FROM workouts`).get() as { n: number }).n;
  const sleepCount = (db.prepare(`SELECT COUNT(*) as n FROM sleep`).get() as { n: number }).n;
  const cycleCount = (db.prepare(`SELECT COUNT(*) as n FROM cycles`).get() as { n: number }).n;

  console.log(`Whoop Sync Status
=================
Last sync:  ${lastSync}
Workouts:   ${workoutCount}
Sleep:      ${sleepCount}
Cycles:     ${cycleCount}
Token:      ${config.access_token ? 'present' : 'missing'}`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  try {
    if (cmd === 'auth') {
      await cmdAuth(args.slice(1));
    } else if (cmd === 'sync' || cmd === undefined) {
      await cmdSync(args.slice(cmd ? 1 : 0));
    } else if (cmd === 'status') {
      await cmdStatus();
    } else {
      console.error(`Unknown command: ${cmd}`);
      console.error('Usage: whoop-sync [auth|sync|status]');
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    if (err instanceof WhoopAuthError) {
      console.warn(`[WARNING] ${err.message}`);
      process.exit(0);
    }
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
