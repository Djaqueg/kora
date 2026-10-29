import { expect, test, type Page } from '@playwright/test';

const CLIENT = 'kora-test.apps.googleusercontent.com';
const EMAIL = 'lector@example.com';

interface GisCall {
  prompt: string;
  login_hint?: string;
  hint?: string;
}

async function installGis(page: Page) {
  await page.addInitScript(() => {
    const calls: GisCall[] = [];
    const host = window as unknown as {
      __koraGis: GisCall[];
      __koraAllowSilent: boolean;
      __koraExpiresIn: number;
    };
    host.__koraGis = calls;
    host.__koraAllowSilent = true;
    host.__koraExpiresIn = 3600;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: (opts) => {
              const prompt = opts?.prompt ?? '';
              calls.push({ prompt, login_hint: opts?.login_hint, hint: opts?.hint });
              if (prompt === '' && !host.__koraAllowSilent) {
                config.callback({ error: 'interaction_required', error_description: 'hace falta volver a entrar' });
                return;
              }
              config.callback({
                access_token: prompt === '' ? 'ya29.renovado' : 'ya29.cuenta-elegida',
                expires_in: host.__koraExpiresIn || 3600,
              });
            },
          }),
        },
      },
    };
  });
}

async function openData(page: Page) {
  await page.goto('./#/ajustes');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await page.getByRole('tab', { name: 'Datos' }).click();
  await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeVisible();
}

async function connect(page: Page) {
  await page.getByRole('textbox', { name: 'Client ID de Google' }).fill(CLIENT);
  await page.getByRole('button', { name: 'Conectar cuenta Google' }).click();
  await expect(page.getByText('Cuenta conectada en este dispositivo.')).toBeVisible();
  await expect(page.getByText(`Cuenta: ${EMAIL}`)).toBeVisible();
}

async function gisCalls(page: Page): Promise<GisCall[]> {
  return page.evaluate(() => (window as unknown as { __koraGis: GisCall[] }).__koraGis);
}

async function storedSettings(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open('kora');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('kv', 'readonly');
        const read = tx.objectStore('kv').get('settings');
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      };
    });
    return JSON.stringify(value ?? {});
  });
}

function viewports() {
  return [
    { name: 'escritorio', width: 1280, height: 800 },
    { name: 'móvil', width: 390, height: 844 },
  ] as const;
}

for (const viewport of viewports()) {
  test.describe(`renovación del token · ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: 'block',
    });

    test('renueva en silencio con la cuenta recordada y no guarda el token', async ({ page }) => {
      const auths: string[] = [];
      let body = '';
      await installGis(page);
      await page.route('https://www.googleapis.com/**', async (route) => {
        const request = route.request();
        const url = request.url();
        if (url.includes('/oauth2/')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ email: EMAIL }),
          });
          return;
        }
        auths.push(request.headers().authorization || '');
        if (request.method() === 'POST' || request.method() === 'PATCH') body = request.postData() || '';
        if (request.method() === 'GET' && url.includes('/drive/v3/files') && !url.includes('alt=media')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
          return;
        }
        if (request.method() === 'POST' || request.method() === 'PATCH') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sync-1' }) });
          return;
        }
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      });

      await openData(page);
      await connect(page);
      expect((await gisCalls(page)).map((call) => call.prompt)).toEqual(['select_account consent']);
      await page.getByRole('textbox', { name: /ID de carpeta/ }).fill('carpeta-kora-1');
      await page.evaluate(() => {
        const raw = sessionStorage.getItem('kora.driveSession');
        if (!raw) throw new Error('sin sesión');
        const session = JSON.parse(raw) as { expiry: number };
        session.expiry = Date.now() + 60_000;
        sessionStorage.setItem('kora.driveSession', JSON.stringify(session));
      });
      await page.getByRole('button', { name: 'Subir a Drive' }).click();
      await expect(page.getByText('kora-sync.json actualizado en la carpeta.')).toBeVisible();
      const calls = await gisCalls(page);
      expect(calls.map((call) => call.prompt)).toEqual(['select_account consent', '']);
      expect(calls[1]?.login_hint).toBe(EMAIL);
      expect(calls[1]?.hint).toBe(EMAIL);
      expect(auths.some((header) => header === 'Bearer ya29.renovado')).toBe(true);
      expect(body).not.toContain('ya29');
      expect(await storedSettings(page)).not.toContain('ya29');
      const sessionRaw = await page.evaluate(() => sessionStorage.getItem('kora.driveSession') || '');
      expect(sessionRaw).toContain('ya29.renovado');
      expect(sessionRaw).toContain(EMAIL);

      await page.getByRole('button', { name: 'Cambiar cuenta' }).click();
      await expect(page.getByText('Cuenta conectada en este dispositivo.')).toBeVisible();
      const afterSwitch = await gisCalls(page);
      expect(afterSwitch.at(-1)?.prompt).toBe('select_account consent');

      if (viewport.width < 500) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      }
    });

    test('un 401 reintenta una vez y, si el silencio falla, ofrece Reconectar', async ({ page }) => {
      let driveHits = 0;
      await installGis(page);
      await page.route('https://www.googleapis.com/**', async (route) => {
        const request = route.request();
        const url = request.url();
        if (url.includes('/oauth2/')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ email: EMAIL }),
          });
          return;
        }
        driveHits += 1;
        if (driveHits === 1) {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'expired' } }) });
          return;
        }
        if (request.method() === 'GET' && url.includes('/drive/v3/files')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ files: [{ id: 'book-1', name: 'cuaderno.txt', mimeType: 'text/plain' }] }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'hola' });
      });

      await openData(page);
      await connect(page);
      await page.getByRole('textbox', { name: /ID de carpeta/ }).fill('carpeta-kora-1');
      await page.getByRole('button', { name: 'Ver libros de la carpeta' }).click();
      await expect(page.getByRole('checkbox', { name: 'cuaderno.txt' })).toBeVisible();
      const calls = await gisCalls(page);
      expect(calls.filter((call) => call.prompt === '')).toHaveLength(1);
      expect(calls.find((call) => call.prompt === '')?.login_hint).toBe(EMAIL);
      expect(await page.getByText('El token caducó. Vuelve a conectar la cuenta.')).toHaveCount(0);

      await page.evaluate(() => {
        (window as unknown as { __koraAllowSilent: boolean }).__koraAllowSilent = false;
        const raw = sessionStorage.getItem('kora.driveSession');
        if (!raw) throw new Error('sin sesión');
        const session = JSON.parse(raw) as { expiry: number };
        session.expiry = Date.now() + 30_000;
        sessionStorage.setItem('kora.driveSession', JSON.stringify(session));
      });
      await page.getByRole('button', { name: 'Subir a Drive' }).click();
      await expect(page.getByRole('alert')).toContainText(/Pulsa Reconectar/i);
      await expect(page.getByRole('button', { name: 'Reconectar' })).toBeVisible();
      await expect(page.getByText('El token caducó. Vuelve a conectar la cuenta.')).toHaveCount(0);

      await page.evaluate(() => {
        (window as unknown as { __koraAllowSilent: boolean }).__koraAllowSilent = true;
      });
      await page.getByRole('button', { name: 'Reconectar' }).click();
      await expect(page.getByText('Cuenta conectada en este dispositivo.')).toBeVisible();
      expect((await gisCalls(page)).at(-1)?.prompt).toBe('select_account consent');
    });
  });
}
