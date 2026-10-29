import type { BackupFile } from '../types';
import {
  readDriveSession,
  sessionNeedsRefresh,
  writeDriveSession,
  type DriveSession,
} from './drive-session';

export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file openid email';

export class DriveReconnectError extends Error {
  constructor(message = 'La sesión de Google caducó. Pulsa Reconectar para volver a entrar.') {
    super(message);
    this.name = 'DriveReconnectError';
  }
}

let gisPromise: Promise<void> | null = null;
let refreshClientId = '';
let silentInflight: Promise<string> | null = null;

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('No se pudo cargar Google Identity Services. Revisa tu conexión.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function rememberDriveClient(clientId: string) {
  refreshClientId = clientId.trim();
}

function fetchGoogleEmail(token: string): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) return '';
      const data = (await response.json()) as { email?: string };
      return typeof data.email === 'string' ? data.email : '';
    })
    .catch(() => '')
    .finally(() => window.clearTimeout(timer));
}

function requestGoogleToken(clientId: string, mode: 'interactive' | 'silent'): Promise<DriveSession> {
  rememberDriveClient(clientId);
  if (!window.google?.accounts?.oauth2) {
    return loadGis().then(() => requestGoogleToken(clientId, mode));
  }
  const knownEmail = readDriveSession()?.email || '';
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(mode === 'silent'
        ? new DriveReconnectError()
        : new Error('No se pudo conectar con Google. Inténtalo otra vez.'));
    };
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (settled) return;
        if (response.error || !response.access_token) {
          fail();
          return;
        }
        settled = true;
        const accessToken = response.access_token;
        const expiry = Date.now() + (response.expires_in || 3600) * 1000;
        const base: DriveSession = {
          accessToken,
          expiry,
          email: mode === 'silent' ? knownEmail : '',
        };
        writeDriveSession(base);
        if (mode === 'silent' && knownEmail) {
          resolve(base);
          return;
        }
        void fetchGoogleEmail(accessToken).then((email) => {
          const next = { ...base, email: email || knownEmail };
          writeDriveSession(next);
          resolve(next);
        });
      },
      error_callback: () => fail(),
    });
    if (mode === 'silent') {
      client.requestAccessToken({ prompt: '', hint: knownEmail, login_hint: knownEmail });
    } else {
      client.requestAccessToken({ prompt: 'select_account consent' });
    }
  });
}

export function requestInteractiveToken(clientId: string): Promise<DriveSession> {
  return requestGoogleToken(clientId, 'interactive');
}

export function startSilentRefresh(clientId: string): Promise<string> {
  rememberDriveClient(clientId);
  const session = readDriveSession();
  if (!clientId.trim() || !session?.email) return Promise.reject(new DriveReconnectError());
  if (silentInflight) return silentInflight;
  silentInflight = requestGoogleToken(clientId, 'silent')
    .then((next) => next.accessToken)
    .finally(() => {
      silentInflight = null;
    });
  return silentInflight;
}

/** Call this synchronously inside the click handler so Android Chrome still has the user gesture. */
export function beginDriveAccess(clientId: string): Promise<string> {
  rememberDriveClient(clientId);
  const session = readDriveSession();
  if (!session?.accessToken) return Promise.reject(new Error('Conecta Google y elige una carpeta.'));
  if (!sessionNeedsRefresh(session)) return Promise.resolve(session.accessToken);
  return startSilentRefresh(clientId);
}

function withAuth(token: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function authorizedFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  const current = readDriveSession()?.accessToken || token;
  const first = await fetch(url, withAuth(current, init));
  if (first.status !== 401) return first;
  if (!refreshClientId) throw new DriveReconnectError();
  let next = '';
  try {
    next = await startSilentRefresh(refreshClientId);
  } catch {
    throw new DriveReconnectError();
  }
  const second = await fetch(url, withAuth(next, init));
  if (second.status === 401) throw new DriveReconnectError();
  return second;
}

async function driveError(response: Response): Promise<string> {
  if (response.status === 401) return 'TOKEN_EXPIRED';
  try {
    const data = (await response.json()) as { error?: { message?: string } | string };
    if (typeof data.error === 'string') return data.error;
    return data.error?.message || `Drive respondió ${response.status}`;
  } catch {
    return `Drive respondió ${response.status}`;
  }
}

async function driveJson<T>(token: string, url: string): Promise<T> {
  const response = await authorizedFetch(token, url);
  if (!response.ok) throw new Error(await driveError(response));
  return response.json() as Promise<T>;
}

export async function listFolders(token: string): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=100&orderBy=name${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const data = await driveJson<{ files?: DriveItem[]; nextPageToken?: string }>(token, url);
    items.push(...(data.files || []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return items;
}

const BOOK_EXT = /\.(epub|pdf|txt|md|markdown)$/i;
const BOOK_MIME = new Set(['application/pdf', 'application/epub+zip', 'text/plain', 'text/markdown', 'text/x-markdown']);

export async function listBookFiles(token: string, folderId: string): Promise<DriveItem[]> {
  const safeId = folderId.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${safeId}' in parents and trashed=false`);
  const data = await driveJson<{ files?: DriveItem[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=200&orderBy=name`,
  );
  return (data.files || []).filter((file) => BOOK_EXT.test(file.name) || BOOK_MIME.has(file.mimeType || ''));
}

export async function downloadDriveFile(token: string, fileId: string): Promise<ArrayBuffer> {
  const response = await authorizedFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok) throw new Error(await driveError(response));
  return response.arrayBuffer();
}

export async function findSyncFile(token: string, folderId: string): Promise<string | null> {
  const safeId = folderId.replace(/'/g, "\\'");
  const q = encodeURIComponent(`name='kora-sync.json' and '${safeId}' in parents and trashed=false`);
  const data = await driveJson<{ files?: DriveItem[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
  );
  return data.files?.[0]?.id || null;
}

export async function uploadSync(token: string, folderId: string, json: string): Promise<void> {
  const existing = await findSyncFile(token, folderId);
  if (existing) {
    const response = await authorizedFetch(token, `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    if (!response.ok) throw new Error(await driveError(response));
    return;
  }
  const metadata = { name: 'kora-sync.json', mimeType: 'application/json', parents: [folderId] };
  const boundary = `kora_${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
    `--${boundary}--`;
  const response = await authorizedFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(await driveError(response));
}

export async function downloadSync(token: string, folderId: string): Promise<BackupFile> {
  const id = await findSyncFile(token, folderId);
  if (!id) throw new Error('No hay un archivo kora-sync.json en esa carpeta. Súbelo primero desde el otro dispositivo.');
  const response = await authorizedFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  if (!response.ok) throw new Error(await driveError(response));
  return response.json() as Promise<BackupFile>;
}
