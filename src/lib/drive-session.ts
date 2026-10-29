export const DRIVE_SESSION_KEY = 'kora.driveSession';
export const DRIVE_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface DriveSession {
  accessToken: string;
  expiry: number;
  email: string;
}

const listeners = new Set<() => void>();
let memory: DriveSession | null = null;
let rawCache: string | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function parse(raw: string): DriveSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DriveSession>;
    if (!parsed.accessToken || typeof parsed.expiry !== 'number') return null;
    return {
      accessToken: parsed.accessToken,
      expiry: parsed.expiry,
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return null;
  }
}

export function readDriveSession(): DriveSession | null {
  let raw = '';
  try {
    raw = sessionStorage.getItem(DRIVE_SESSION_KEY) || '';
  } catch {
    return memory;
  }
  if (raw === rawCache) return memory;
  rawCache = raw;
  memory = parse(raw);
  return memory;
}

export function writeDriveSession(session: DriveSession) {
  memory = {
    accessToken: session.accessToken,
    expiry: session.expiry,
    email: session.email || '',
  };
  rawCache = JSON.stringify(memory);
  try {
    sessionStorage.setItem(DRIVE_SESSION_KEY, rawCache);
  } catch {
    rawCache = null;
  }
  emit();
}

export function clearDriveSession() {
  memory = null;
  rawCache = '';
  try {
    sessionStorage.removeItem(DRIVE_SESSION_KEY);
  } catch {
    rawCache = null;
  }
  emit();
}

export function subscribeDriveSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sessionNeedsRefresh(session: DriveSession | null, now = Date.now()): boolean {
  if (!session?.accessToken) return false;
  return session.expiry - now <= DRIVE_REFRESH_MARGIN_MS;
}

export function adoptLegacyDriveToken(input: unknown) {
  if (readDriveSession()?.accessToken) return;
  if (!input || typeof input !== 'object') return;
  const raw = input as Record<string, unknown>;
  const accessToken = typeof raw.googleAccessToken === 'string' ? raw.googleAccessToken.trim() : '';
  const expiry = typeof raw.googleTokenExpiry === 'number' ? raw.googleTokenExpiry : 0;
  if (!accessToken || expiry <= Date.now()) return;
  writeDriveSession({ accessToken, expiry, email: '' });
}
