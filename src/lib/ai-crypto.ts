import type { AiProvider, AiSecrets, EncryptedAiBlob } from '../types';

export const AI_PBKDF2_ITERATIONS = 600_000;

export const WRONG_AI_PASSWORD =
  'La contraseña no es correcta. Las claves de IA no se recuperaron; libros, progreso y subrayados sí se sincronizaron.';

export const UNREADABLE_AI_BLOB =
  'El bloque de claves cifradas no se pudo leer. Libros, progreso y subrayados sí se sincronizaron.';

const subtle = globalThis.crypto.subtle;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asBuffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function normalizeAiSecrets(value: unknown): AiSecrets | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const provider = record.aiProvider;
  if (provider !== 'gemini' && provider !== 'none' && provider !== 'nvidia') return null;
  if (typeof record.geminiKey !== 'string') return null;
  const geminiKey = record.geminiKey;
  const geminiModel = typeof record.geminiModel === 'string' && record.geminiModel.trim()
    ? record.geminiModel.trim()
    : 'gemini-2.0-flash';
  let aiProvider: AiProvider;
  if (provider === 'none') aiProvider = 'none';
  else aiProvider = geminiKey.trim() ? 'gemini' : 'none';
  return { aiProvider, geminiKey, geminiModel };
}

function storedSecrets(secrets: AiSecrets): AiSecrets {
  return normalizeAiSecrets(secrets) || {
    aiProvider: secrets.geminiKey.trim() ? 'gemini' : 'none',
    geminiKey: secrets.geminiKey,
    geminiModel: secrets.geminiModel || 'gemini-2.0-flash',
  };
}

export async function encryptAiPlaintext(plain: string, password: string): Promise<EncryptedAiBlob> {
  if (!password.trim()) throw new Error('Escribe una contraseña de cifrado para subir las claves de IA. No se envió nada a Drive.');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, AI_PBKDF2_ITERATIONS);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: asBuffer(iv) },
    key,
    new TextEncoder().encode(plain),
  );
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: AI_PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function encryptAiSecrets(secrets: AiSecrets, password: string): Promise<EncryptedAiBlob> {
  return encryptAiPlaintext(JSON.stringify(storedSecrets(secrets)), password);
}

function assertBlob(blob: EncryptedAiBlob): void {
  const iterationsOk = Number.isInteger(blob.iterations) && blob.iterations >= 100_000 && blob.iterations <= 1_200_000;
  if (
    blob.v !== 1 ||
    blob.alg !== 'AES-GCM' ||
    blob.kdf !== 'PBKDF2' ||
    blob.hash !== 'SHA-256' ||
    !iterationsOk ||
    typeof blob.salt !== 'string' ||
    typeof blob.iv !== 'string' ||
    typeof blob.ciphertext !== 'string' ||
    !blob.salt ||
    !blob.iv ||
    !blob.ciphertext
  ) {
    throw new Error(UNREADABLE_AI_BLOB);
  }
}

export async function decryptAiSecrets(blob: EncryptedAiBlob, password: string): Promise<AiSecrets> {
  assertBlob(blob);
  if (!password) throw new Error(WRONG_AI_PASSWORD);
  try {
    const key = await deriveKey(password, base64ToBytes(blob.salt), blob.iterations);
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: asBuffer(base64ToBytes(blob.iv)) },
      key,
      asBuffer(base64ToBytes(blob.ciphertext)),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
    const secrets = normalizeAiSecrets(parsed);
    if (!secrets) throw new Error(UNREADABLE_AI_BLOB);
    return secrets;
  } catch (reason) {
    if (reason instanceof Error && (reason.message === UNREADABLE_AI_BLOB || reason.message === WRONG_AI_PASSWORD)) throw reason;
    throw new Error(WRONG_AI_PASSWORD);
  }
}
