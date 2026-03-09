const BASE_URL = 'https://api.prod.whoop.com/developer/v2';

export class WhoopAuthError extends Error {
  constructor() {
    super('Whoop API returned 401 — token may be expired');
    this.name = 'WhoopAuthError';
  }
}

async function get(token: string, path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new WhoopAuthError();
  if (!res.ok) throw new Error(`Whoop API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function* paginate(token: string, path: string, start?: string): AsyncGenerator<any[]> {
  let nextToken: string | undefined;
  const sep = path.includes('?') ? '&' : '?';
  const startParam = start ? `&start=${encodeURIComponent(start)}` : '';
  do {
    const tokenParam = nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : '';
    const url = `${path}${sep}limit=25${startParam}${tokenParam}`;
    const data = await get(token, url);
    if (data.records && data.records.length > 0) yield data.records;
    nextToken = data.next_token ?? undefined;
  } while (nextToken);
}

export async function* fetchWorkouts(token: string, start?: string): AsyncGenerator<any[]> {
  yield* paginate(token, '/activity/workout', start);
}

export async function* fetchSleep(token: string, start?: string): AsyncGenerator<any[]> {
  yield* paginate(token, '/activity/sleep', start);
}

export async function* fetchCycles(token: string, start?: string): AsyncGenerator<any[]> {
  yield* paginate(token, '/cycle', start);
}

export async function* fetchRecovery(token: string, start?: string): AsyncGenerator<any[]> {
  yield* paginate(token, '/recovery', start);
}

export async function refreshTokens(config: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const tokens = await res.json() as Record<string, string>;
  return tokens;
}
