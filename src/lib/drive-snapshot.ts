import { encryptAiSecrets } from './ai-crypto';
import type { AiSecrets, BackupFile, Settings } from '../types';

const STRIP_FIELDS = [
  'aiProvider',
  'geminiKey',
  'geminiModel',
  'nvidiaKey',
  'nvidiaBaseUrl',
  'nvidiaModel',
  'googleAccessToken',
  'googleTokenExpiry',
  'syncEncryptedAiKeys',
] as const;

export function pickAiSecrets(settings: Settings): AiSecrets {
  const geminiKey = settings.geminiKey;
  return {
    aiProvider: settings.aiProvider === 'none' ? 'none' : geminiKey.trim() ? 'gemini' : 'none',
    geminiKey,
    geminiModel: settings.geminiModel,
  };
}

function withoutSecrets(settings: Settings): Settings {
  const next: Record<string, unknown> = { ...settings };
  for (const field of STRIP_FIELDS) delete next[field];
  return next as unknown as Settings;
}

function stripped(snapshot: BackupFile): BackupFile {
  const copy: BackupFile = { ...snapshot, settings: withoutSecrets(snapshot.settings) };
  delete copy.encryptedAi;
  return copy;
}

export async function buildDriveSnapshot(snapshot: BackupFile, password: string): Promise<BackupFile> {
  const base = stripped(snapshot);
  if (!snapshot.settings.syncEncryptedAiKeys) {
    return { ...base, aiSecretsMode: 'omitted' };
  }
  if (!password.trim()) {
    throw new Error('Escribe una contraseña de cifrado para subir las claves de IA. No se envió nada a Drive.');
  }
  const encryptedAi = await encryptAiSecrets(pickAiSecrets(snapshot.settings), password);
  return { ...base, aiSecretsMode: 'encrypted', encryptedAi };
}

export async function buildExportSnapshot(snapshot: BackupFile, password: string): Promise<BackupFile> {
  const base = stripped(snapshot);
  if (snapshot.settings.syncEncryptedAiKeys && password.trim()) {
    const encryptedAi = await encryptAiSecrets(pickAiSecrets(snapshot.settings), password);
    return { ...base, aiSecretsMode: 'encrypted', encryptedAi };
  }
  return { ...base, aiSecretsMode: 'omitted' };
}
