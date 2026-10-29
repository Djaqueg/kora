import type { BackupFile } from '../types';

export function isBackup(data: unknown): data is BackupFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Partial<BackupFile>;
  return record.app === 'kora' && record.version === 1 && Array.isArray(record.books) && Array.isArray(record.chapters);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text) as unknown;
}
