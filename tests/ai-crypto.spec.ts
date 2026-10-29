import { expect, test } from '@playwright/test';
import { AI_PBKDF2_ITERATIONS, decryptAiSecrets } from '../src/lib/ai-crypto';
import { buildDriveSnapshot } from '../src/lib/drive-snapshot';
import { defaultSettings, type BackupFile, type Settings } from '../src/types';

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

test('el archivo de Drive lleva las claves cifradas y no la contraseña', async () => {
  const source = snapshot({
    aiProvider: 'gemini',
    geminiKey: GEMINI,
    geminiModel: 'gemini-kora-sync-test',
    nvidiaKey: NVIDIA,
    nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
    nvidiaModel: 'meta/llama-3.1-70b-instruct',
    syncEncryptedAiKeys: true,
    theme: 'sepia',
  });

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
  expect(encoded).not.toContain('gemini-kora-sync-test');
  expect(payload.settings.theme).toBe('sepia');
  expect(payload.settings.syncEncryptedAiKeys).toBeUndefined();

  const restored = await decryptAiSecrets(payload.encryptedAi!, PASSWORD);
  expect(restored.geminiKey).toBe(GEMINI);
  expect(restored.nvidiaKey).toBe(NVIDIA);
  expect(restored.geminiModel).toBe('gemini-kora-sync-test');
  expect(restored.aiProvider).toBe('gemini');
  await expect(decryptAiSecrets(payload.encryptedAi!, 'otra-contraseña')).rejects.toThrow(/contraseña no es correcta/i);
});

test('con el cifrado apagado no se suben claves ni bloque cifrado', async () => {
  const payload = await buildDriveSnapshot(snapshot({
    geminiKey: GEMINI,
    nvidiaKey: NVIDIA,
    syncEncryptedAiKeys: false,
  }), PASSWORD);
  const encoded = JSON.stringify(payload);
  expect(payload.aiSecretsMode).toBe('omitted');
  expect(payload.encryptedAi).toBeUndefined();
  expect(encoded).not.toContain(GEMINI);
  expect(encoded).not.toContain(NVIDIA);
  expect(encoded).not.toContain(PASSWORD);
});

test('sin contraseña no arma un archivo con claves en claro', async () => {
  await expect(buildDriveSnapshot(snapshot({
    geminiKey: GEMINI,
    syncEncryptedAiKeys: true,
  }), '   ')).rejects.toThrow(/contraseña de cifrado/i);
});
