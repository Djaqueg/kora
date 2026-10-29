import { expect, test } from '@playwright/test';
import { AI_PBKDF2_ITERATIONS, decryptAiSecrets, encryptAiPlaintext } from '../src/lib/ai-crypto';
import { buildDriveSnapshot, buildExportSnapshot } from '../src/lib/drive-snapshot';
import { defaultSettings, type AiSecrets, type BackupFile, type Settings } from '../src/types';

const PASSWORD = 'Kora-Llave-9f3c';
const GEMINI = 'AIzaSy-KORA-SECRETO-7391';
const NVIDIA = 'nvapi-kora-secreto-4410';

function snapshot(settings: Partial<Settings>): BackupFile {
  return {
    version: 1,
    app: 'kora',
    exportedAt: Date.now(),
    books: [],
    chapters: [],
    highlights: [],
    capsules: [],
    flashcards: [],
    quizzes: [],
    streak: {
      current: 1,
      longest: 2,
      lastGoalDate: '2026-10-28',
      dailyGoalMinutes: 15,
      dailyCapsuleGoal: 1,
      minutesToday: 4,
      capsulesToday: 0,
      date: '2026-10-29',
    },
    settings: { ...defaultSettings, ...settings },
    tombstones: [],
  };
}

test('el archivo de Drive lleva la clave de Gemini cifrada y no la contraseña', async () => {
  const source = snapshot({
    aiProvider: 'gemini',
    geminiKey: GEMINI,
    geminiModel: 'gemini-2.5-pro',
    syncEncryptedAiKeys: true,
    theme: 'sepia',
    googleAccessToken: 'ya29.no-debe-viajar',
    googleTokenExpiry: Date.now() + 60_000,
  });
  (source.settings as Settings & { nvidiaKey?: string }).nvidiaKey = NVIDIA;

  const payload = await buildDriveSnapshot(source, PASSWORD);
  const encoded = JSON.stringify(payload);
  expect(payload.aiSecretsMode).toBe('encrypted');
  expect(payload.encryptedAi?.alg).toBe('AES-GCM');
  expect(payload.encryptedAi?.kdf).toBe('PBKDF2');
  expect(payload.encryptedAi?.iterations).toBe(AI_PBKDF2_ITERATIONS);
  expect(payload.encryptedAi?.salt).toBeTruthy();
  expect(payload.encryptedAi?.iv).toBeTruthy();
  expect(payload.encryptedAi?.ciphertext).toBeTruthy();
  expect(encoded).not.toContain(GEMINI);
  expect(encoded).not.toContain(NVIDIA);
  expect(encoded).not.toContain(PASSWORD);
  expect(encoded).not.toContain('ya29.no-debe-viajar');
  expect(encoded).not.toContain('gemini-2.5-pro');
  expect(payload.settings.theme).toBe('sepia');
  expect(payload.settings.syncEncryptedAiKeys).toBeUndefined();
  expect(payload.settings.googleAccessToken).toBeUndefined();

  const restored = await decryptAiSecrets(payload.encryptedAi!, PASSWORD);
  expect(restored.geminiKey).toBe(GEMINI);
  expect(restored.geminiModel).toBe('gemini-2.5-pro');
  expect(restored.aiProvider).toBe('gemini');
  expect(restored).not.toHaveProperty('nvidiaKey');
  await expect(decryptAiSecrets(payload.encryptedAi!, 'otra-contraseña')).rejects.toThrow(/contraseña no es correcta/i);
});

test('un bloque antiguo con NVIDIA conserva Gemini y descarta la otra clave', async () => {
  const legacy = {
    aiProvider: 'nvidia',
    geminiKey: GEMINI,
    geminiModel: 'gemini-2.0-flash',
    nvidiaKey: NVIDIA,
    nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
    nvidiaModel: 'meta/llama-3.1-70b-instruct',
  };
  const blob = await encryptAiPlaintext(JSON.stringify(legacy), PASSWORD);
  const restored = await decryptAiSecrets(blob, PASSWORD);
  expect(restored).toEqual({
    aiProvider: 'gemini',
    geminiKey: GEMINI,
    geminiModel: 'gemini-2.0-flash',
  } satisfies AiSecrets);
  expect(JSON.stringify(restored)).not.toContain(NVIDIA);
  expect(restored).not.toHaveProperty('nvidiaKey');
});

test('con el cifrado apagado no se suben claves ni bloque cifrado', async () => {
  const payload = await buildDriveSnapshot(snapshot({
    geminiKey: GEMINI,
    syncEncryptedAiKeys: false,
    googleAccessToken: 'ya29.tampoco',
  }), PASSWORD);
  const encoded = JSON.stringify(payload);
  expect(payload.aiSecretsMode).toBe('omitted');
  expect(payload.encryptedAi).toBeUndefined();
  expect(encoded).not.toContain(GEMINI);
  expect(encoded).not.toContain(NVIDIA);
  expect(encoded).not.toContain(PASSWORD);
  expect(encoded).not.toContain('ya29.tampoco');
});

test('el respaldo en claro omite la clave y el cifrado la incluye solo como bloque', async () => {
  const plain = await buildExportSnapshot(snapshot({
    geminiKey: GEMINI,
    geminiModel: 'gemini-2.0-flash',
    syncEncryptedAiKeys: false,
  }), PASSWORD);
  expect(JSON.stringify(plain)).not.toContain(GEMINI);
  expect(plain.aiSecretsMode).toBe('omitted');

  const locked = await buildExportSnapshot(snapshot({
    aiProvider: 'gemini',
    geminiKey: GEMINI,
    geminiModel: 'gemini-2.5-pro',
    syncEncryptedAiKeys: true,
  }), PASSWORD);
  expect(JSON.stringify(locked)).not.toContain(GEMINI);
  expect(locked.aiSecretsMode).toBe('encrypted');
  const restored = await decryptAiSecrets(locked.encryptedAi!, PASSWORD);
  expect(restored.geminiKey).toBe(GEMINI);
  expect(restored.geminiModel).toBe('gemini-2.5-pro');
});

test('sin contraseña no arma un archivo con claves en claro', async () => {
  await expect(buildDriveSnapshot(snapshot({
    geminiKey: GEMINI,
    syncEncryptedAiKeys: true,
  }), '   ')).rejects.toThrow(/contraseña de cifrado/i);
});
