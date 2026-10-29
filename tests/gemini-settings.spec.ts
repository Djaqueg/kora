import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const shots = join(process.cwd(), 'test-results', 'ui');
mkdirSync(shots, { recursive: true });

const GEMINI = 'AIzaSy-KORA-SECRETO-7391';
const MASK = '••••7391';

async function openAi(page: Page) {
  await page.goto('./#/ajustes');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await page.getByRole('tab', { name: 'IA' }).click();
  await expect(page.getByRole('heading', { name: 'Inteligencia artificial' })).toBeVisible();
}

function viewports() {
  return [
    { name: 'escritorio', width: 1280, height: 800 },
    { name: 'móvil', width: 390, height: 844 },
  ] as const;
}

for (const viewport of viewports()) {
  test.describe(`ajustes de Gemini · ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: 'block',
    });

    test('enmascara la clave, la prueba sin ponerla en la URL y permite borrarla', async ({ page }) => {
      const seen: { url: string; key?: string }[] = [];
      await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
        const url = route.request().url();
        const key = route.request().headers()['x-goog-api-key'];
        seen.push({ url, key });
        expect(url).not.toContain('key=');
        expect(url).not.toContain(GEMINI);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ name: 'models/gemini-2.0-flash' }),
        });
      });

      await openAi(page);
      await expect(page.getByRole('combobox', { name: 'Modelo de Gemini' })).toHaveValue('gemini-2.0-flash');
      await expect(page.getByText(/djaqueg\.github\.io\/\*/)).toBeVisible();
      await expect(page.getByText(/NVIDIA/)).toHaveCount(0);
      await expect(page.getByRole('radio', { name: /NVIDIA/ })).toHaveCount(0);

      const key = page.getByRole('textbox', { name: 'Clave de Gemini' });
      await key.fill(GEMINI);
      await page.getByRole('button', { name: 'Mostrar clave' }).click();
      await expect(key).toHaveValue(GEMINI);
      await page.getByRole('heading', { name: 'Inteligencia artificial' }).click();
      await expect(key).toHaveValue(MASK);
      await page.getByRole('combobox', { name: 'Modelo de Gemini' }).selectOption('gemini-3.8-flash');
      await page.getByRole('button', { name: 'Mostrar clave' }).click();
      await expect(key).toHaveValue(MASK);
      await expect(key).not.toHaveValue(GEMINI);

      await page.getByRole('button', { name: 'Probar clave' }).click();
      await expect(page.getByRole('status').filter({ hasText: /clave de Gemini funciona/i })).toBeVisible();
      expect(seen).toHaveLength(1);
      expect(seen[0]?.key).toBe(GEMINI);
      expect(seen[0]?.url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true);

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('tab', { name: 'Datos' }).click();
      await page.getByRole('button', { name: 'Exportar respaldo' }).click();
      const download = await downloadPromise;
      const backup = readFileSync((await download.path())!, 'utf8');
      expect(backup).not.toContain(GEMINI);
      expect(backup).not.toContain('ya29');

      if (viewport.width < 500) {
        await expect(page.locator('.toast')).toHaveCount(0);
        await page.screenshot({ path: join(shots, 'mobile-datos-tab.png'), fullPage: true });
        await page.getByRole('tab', { name: 'IA' }).click();
        await expect(key).toHaveValue(MASK);
        const hide = page.getByRole('button', { name: 'Ocultar clave' });
        if (await hide.count()) await hide.click();
        await expect(key).toHaveValue(MASK);
        await page.screenshot({ path: join(shots, 'mobile-ia-tab.png'), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      }

      await page.getByRole('tab', { name: 'IA' }).click();
      await page.getByRole('button', { name: 'Borrar clave' }).click();
      await expect(key).toHaveValue('');
      await expect(page.getByRole('status').filter({ hasText: /borrada/i })).toBeVisible();
    });
  });
}
