import { encryptAiSecrets } from './ai-crypto';
import type { AiSecrets, BackupFile, Settings } from '../types';

const SECRET_FIELDS = ['aiProvider', 'geminiKey', 'geminiModel', 'nvidiaKey', 'nvidiaBaseUrl', 'nvidiaModel'] as const;

export function pickAiSecrets(settings: Settings): AiSecrets {
  return {
    aiProvider: settings.aiProvider,
    geminiKey: settings.geminiKey,
    geminiModel: settings.geminiModel,
    nvidiaKey: settings.nvidiaKey,
    nvidiaBaseUrl: settings.nvidiaBaseUrl,
    nvidiaModel: settings.nvidiaModel,
  };
}

function withoutDriveSecrets(settings: Settings): Settings {
  const next: Partial<Settings> = { ...settings };
  for (const field of SECRET_FIELDS) delete next[field];
  delete next.syncEncryptedAiKeys;
  return next as Settings;
}

export async function buildDriveSnapshot(snapshot: BackupFile, password: string): Promise<BackupFile> {
  const secrets = pickAiSecrets(snapshot.settings);
  const settings = withoutDriveSecrets(snapshot.settings);
  if (!snapshot.settings.syncEncryptedAiKeys) {
    const omitted: BackupFile = { ...snapshot, settings, aiSecretsMode: 'omitted' };
    delete omitted.encryptedAi;
    return omitted;
  }
  if (!password.trim()) {
    throw new Error('Escribe una contraseña de cifrado para subir las claves de IA. No se envió nada a Drive.');
  }
  const encryptedAi = await encryptAiSecrets(secrets, password);
  return { ...snapshot, settings, aiSecretsMode: 'encrypted', encryptedAi };
}
