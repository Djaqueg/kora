import type { BackupFile } from '../types';

export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services. Revisa tu conexión.'));
    document.head.appendChild(script);
  });
}

export function requestGoogleToken(clientId: string): Promise<{ accessToken: string; expiresIn: number }> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error('Google Identity Services no está disponible.'));
          return;
        }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(new Error(response.error_description || response.error || 'Google no entregó un token.'));
              return;
            }
            resolve({ accessToken: response.access_token, expiresIn: response.expires_in || 3600 });
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      }),
  );
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
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(await driveError(response));
}

export async function downloadSync(token: string, folderId: string): Promise<BackupFile> {
  const id = await findSyncFile(token, folderId);
  if (!id) throw new Error('No hay un archivo kora-sync.json en esa carpeta. Súbelo primero desde el otro dispositivo.');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await driveError(response));
  return response.json() as Promise<BackupFile>;
}
