import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const shots = join(process.cwd(), 'test-results', 'ui');
mkdirSync(shots, { recursive: true });

const PASSWORD = 'Kora-Llave-9f3c';
const GEMINI = 'AIzaSy-KORA-SECRETO-7391';
const NVIDIA = 'nvapi-kora-secreto-4410';
const MODEL = 'gemini-kora-sync-test';

function extractSnapshot(body: string, contentType: string): string {
  if (contentType.includes('application/json') && body.trim().startsWith('{')) return body;
  const marker = 'Content-Type: application/json\r\n\r\n';
  const start = body.lastIndexOf(marker);
  if (start < 0) throw new Error(`No se encontró el JSON de sincronización: ${body.slice(0, 180)}`);
  const jsonStart = start + marker.length;
  const jsonEnd = body.indexOf('\r\n--', jsonStart);
  return body.slice(jsonStart, jsonEnd === -1 ? undefined : jsonEnd);
}

async function mockDrive(page: Page) {
  let snapshotJson = '';
  const handle = async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === 'GET' && url.includes('/drive/v3/files') && !url.includes('alt=media')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshotJson ? { files: [{ id: 'sync-1', name: 'kora-sync.json' }] } : { files: [] }),
      });
      return;
    }
    if ((method === 'POST' || method === 'PATCH') && url.includes('/upload/')) {
      snapshotJson = extractSnapshot(request.postData() || '', request.headers()['content-type'] || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sync-1' }) });
      return;
    }
    if (method === 'GET' && url.includes('alt=media')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: snapshotJson || '{}' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'no simulado' } }) });
  };
  await page.route('https://www.googleapis.com/**', handle);
  return {
    snapshot: () => JSON.parse(snapshotJson) as {
      aiSecretsMode?: string;
      encryptedAi?: { salt?: string; iv?: string; ciphertext?: string; alg?: string };
      settings: { theme?: string; geminiKey?: string; syncEncryptedAiKeys?: boolean };
    },
    raw: () => snapshotJson,
  };
}

async function openData(page: Page) {
  await page.goto('./#/ajustes');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await page.getByRole('tab', { name: 'Datos' }).click();
  await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeVisible();
}

async function connectFakeDrive(page: Page) {
  await page.getByRole('textbox', { name: 'Client ID de Google' }).fill('kora-test.apps.googleusercontent.com');
  await page.getByRole('textbox', { name: 'O pega un token de acceso (OAuth)' }).fill('ya29.kora-token-de-prueba');
  await page.getByRole('button', { name: 'Usar este token' }).click();
  await expect(page.getByText('Conectada')).toBeVisible();
  await page.getByRole('textbox', { name: /ID de carpeta/ }).fill('carpeta-kora-1');
}

async function setAiKeys(page: Page) {
  await page.getByRole('tab', { name: 'IA' }).click();
  await page.getByRole('radio', { name: 'Google Gemini' }).check();
  await page.getByRole('textbox', { name: 'Clave de Gemini' }).fill(GEMINI);
  await page.getByRole('textbox', { name: 'Modelo de Gemini' }).fill(MODEL);
  await page.getByRole('textbox', { name: 'Clave de NVIDIA Build' }).fill(NVIDIA);
}

test.describe('sincronización cifrada', () => {
  test.use({ serviceWorkers: 'block' });

  test('el cifrado es opcional, la ayuda está cerrada y una contraseña mala no rompe el resto', async ({ page }) => {
    test.setTimeout(120_000);
    const drive = await mockDrive(page);
    await openData(page);

    await expect(page.getByRole('button', { name: '¿Cómo obtengo el Client ID?' })).toBeVisible();
    await expect(page.getByText(/orígenes autorizados/i)).toBeHidden();
    await expect(page.getByText(/Google Cloud Console/i)).toBeHidden();
    const syncSwitch = page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' });
    await expect(syncSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('textbox', { name: 'Contraseña de cifrado' })).toBeHidden();

    await page.getByRole('button', { name: '¿Cómo obtengo el Client ID?' }).click();
    await expect(page.getByText(/orígenes autorizados/i)).toBeVisible();
    await page.getByRole('button', { name: '¿Cómo obtengo el Client ID?' }).click();
    await expect(page.getByText(/orígenes autorizados/i)).toBeHidden();

    await syncSwitch.click();
    await expect(syncSwitch).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('textbox', { name: 'Contraseña de cifrado' }).fill(PASSWORD);
    await page.waitForFunction(async (expected) => {
      const value = await new Promise<string>((resolve, reject) => {
        const request = indexedDB.open('kora');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('kv', 'readonly');
          const read = tx.objectStore('kv').get('aiSyncPassword');
          read.onsuccess = () => resolve(typeof read.result === 'string' ? read.result : '');
          read.onerror = () => reject(read.error);
        };
      });
      return value === expected;
    }, PASSWORD);
    await page.reload();
    await page.getByRole('tab', { name: 'Datos' }).click();
    await expect(page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('textbox', { name: 'Contraseña de cifrado' })).toHaveValue(PASSWORD);

    await setAiKeys(page);
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await page.getByRole('button', { name: 'Sepia' }).click();
    await expect(page.getByRole('button', { name: 'Sepia' })).toHaveClass(/on/);

    await page.getByRole('tab', { name: 'Datos' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar respaldo' }).click();
    const download = await downloadPromise;
    const backup = JSON.parse(readFileSync((await download.path())!, 'utf8')) as {
      settings: { geminiKey?: string; nvidiaKey?: string };
      encryptedAi?: unknown;
      aiSecretsMode?: string;
    };
    expect(backup.settings.geminiKey).toBe(GEMINI);
    expect(backup.settings.nvidiaKey).toBe(NVIDIA);
    expect(backup.encryptedAi).toBeUndefined();
    expect(backup.aiSecretsMode).toBeUndefined();
    expect(JSON.stringify(backup)).not.toContain(PASSWORD);

    await connectFakeDrive(page);
    await page.getByRole('button', { name: 'Subir kora-sync.json' }).click();
    await expect(page.locator('.form-note', { hasText: /claves de IA van cifradas/i })).toBeVisible();
    const uploaded = drive.raw();
    expect(uploaded).not.toContain(GEMINI);
    expect(uploaded).not.toContain(NVIDIA);
    expect(uploaded).not.toContain(PASSWORD);
    expect(uploaded).not.toContain(MODEL);
    expect(drive.snapshot().aiSecretsMode).toBe('encrypted');
    expect(drive.snapshot().encryptedAi?.alg).toBe('AES-GCM');
    expect(drive.snapshot().encryptedAi?.salt).toBeTruthy();
    expect(drive.snapshot().encryptedAi?.iv).toBeTruthy();
    expect(drive.snapshot().encryptedAi?.ciphertext).toBeTruthy();
    expect(drive.snapshot().settings.theme).toBe('sepia');
    expect(drive.snapshot().settings.geminiKey).toBeUndefined();

    await page.getByRole('tab', { name: 'IA' }).click();
    await page.getByRole('radio', { name: 'Solo local' }).check();
    await page.getByRole('textbox', { name: 'Clave de Gemini' }).fill('');
    await page.getByRole('textbox', { name: 'Modelo de Gemini' }).fill('modelo-solo-local');
    await page.getByRole('textbox', { name: 'Clave de NVIDIA Build' }).fill('');
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await page.getByRole('button', { name: 'Oscuro' }).click();
    await page.getByRole('tab', { name: 'Datos' }).click();
    await page.getByRole('textbox', { name: 'Contraseña de cifrado' }).fill('contraseña-incorrecta');
    await page.getByRole('button', { name: 'Bajar y combinar' }).click();
    await expect(page.getByRole('alert')).toContainText(/contraseña no es correcta/i);
    await expect(page.getByRole('alert')).toContainText(/libros, progreso y subrayados sí se sincronizaron/i);

    await page.getByRole('tab', { name: 'Lectura' }).click();
    await expect(page.getByRole('button', { name: 'Sepia' })).toHaveClass(/on/);
    await page.getByRole('tab', { name: 'IA' }).click();
    await expect(page.getByRole('textbox', { name: 'Clave de Gemini' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Modelo de Gemini' })).toHaveValue('modelo-solo-local');
    await expect(page.getByRole('radio', { name: 'Solo local' })).toBeChecked();

    await page.getByRole('tab', { name: 'Datos' }).click();
    await page.getByRole('textbox', { name: 'Contraseña de cifrado' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Bajar y combinar' }).click();
    await expect(page.getByRole('status').filter({ hasText: /claves de IA se recuperaron/i })).toBeVisible();
    await page.getByRole('tab', { name: 'IA' }).click();
    await expect(page.getByRole('textbox', { name: 'Clave de Gemini' })).toHaveValue(GEMINI);
    await expect(page.getByRole('textbox', { name: 'Clave de NVIDIA Build' })).toHaveValue(NVIDIA);
    await expect(page.getByRole('textbox', { name: 'Modelo de Gemini' })).toHaveValue(MODEL);
    await expect(page.getByRole('radio', { name: 'Google Gemini' })).toBeChecked();
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await expect(page.getByRole('button', { name: /Semillas de atención/ })).toBeVisible();
  });

  test('apagado, las claves no viajan y el resto sí', async ({ page }) => {
    const drive = await mockDrive(page);
    await page.goto('./#/ajustes');
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await setAiKeys(page);
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await page.getByRole('button', { name: 'Sepia' }).click();
    await page.getByRole('tab', { name: 'Datos' }).click();
    await expect(page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' })).toHaveAttribute('aria-checked', 'false');
    await connectFakeDrive(page);
    await page.getByRole('button', { name: 'Subir kora-sync.json' }).click();
    await expect(page.getByText('kora-sync.json actualizado en la carpeta.')).toBeVisible();
    expect(drive.snapshot().aiSecretsMode).toBe('omitted');
    expect(drive.snapshot().encryptedAi).toBeUndefined();
    expect(drive.raw()).not.toContain(GEMINI);
    expect(drive.raw()).not.toContain(NVIDIA);

    await page.getByRole('tab', { name: 'IA' }).click();
    await page.getByRole('textbox', { name: 'Clave de Gemini' }).fill('');
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await page.getByRole('button', { name: 'Oscuro' }).click();
    await page.getByRole('tab', { name: 'Datos' }).click();
    await page.getByRole('button', { name: 'Bajar y combinar' }).click();
    await expect(page.getByText('Datos combinados desde kora-sync.json.')).toBeVisible();
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await expect(page.getByRole('button', { name: 'Sepia' })).toHaveClass(/on/);
    await page.getByRole('tab', { name: 'IA' }).click();
    await expect(page.getByRole('textbox', { name: 'Clave de Gemini' })).toHaveValue('');
  });
});

test.describe('capturas de datos', () => {
  test.use({ serviceWorkers: 'block' });

  test('escritorio', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openData(page);
    await page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' }).click();
    await page.getByRole('textbox', { name: 'Contraseña de cifrado' }).fill(PASSWORD);
    await expect(page.getByText(/orígenes autorizados/i)).toBeHidden();
    await page.screenshot({ path: join(shots, 'desktop-datos-cifrado.png'), fullPage: true });
  });

  test('móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openData(page);
    await page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' }).click();
    await page.getByRole('textbox', { name: 'Contraseña de cifrado' }).fill(PASSWORD);
    await expect(page.getByText(/orígenes autorizados/i)).toBeHidden();
    await page.screenshot({ path: join(shots, 'mobile-datos-cifrado.png') });
  });
});
