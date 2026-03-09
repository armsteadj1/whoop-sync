import fs from 'fs';
import path from 'path';
import { initDb } from './db';
import { sync } from './sync';
import { WhoopAuthError } from './whoop';

const configPath = path.join(process.cwd(), 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('config.json not found');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token: string = config.access_token;

if (!token) {
  console.error('No access_token in config.json');
  process.exit(1);
}

const full = process.argv.includes('--full');
if (full) console.log('Running full sync...');

const db = initDb();

sync(db, token, full)
  .then(() => {
    console.log('Sync complete.');
    process.exit(0);
  })
  .catch((err) => {
    if (err instanceof WhoopAuthError) {
      console.warn(`[WARNING] ${err.message}`);
      process.exit(0);
    }
    console.error('Sync failed:', err);
    process.exit(1);
  });
