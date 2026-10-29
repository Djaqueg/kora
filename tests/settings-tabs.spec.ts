import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shots = join(process.cwd(), 'test-results', 'ui');
mkdirSync(shots, { recursive: true });

async function openSettings(page: Page, section?: string) {
  const query = section ? `?seccion=${section}` : '';
  await page.goto(`./#/ajustes${query}`);
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Categorías de ajustes' })).toBeVisible();
}

async function expectOnlyPanel(page: Page, visible: string[], hidden: string[]) {
  for (const name of visible) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const name of hidden) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeHidden();
  }
}

test.describe('pestañas de ajustes', () => {
  test.describe('escritorio', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('cambian el contenido y el deep-link sync abre Datos', async ({ page }) => {
      await openSettings(page);
      const tabs = page.getByRole('tablist', { name: 'Categorías de ajustes' });
      await expect(tabs.getByRole('tab')).toHaveCount(5);
      await expect(page.getByRole('tab', { name: 'Lectura' })).toHaveAttribute('aria-selected', 'true');
      await expectOnlyPanel(
        page,
        ['Lectura'],
        ['Meta diaria', 'Sincronización', 'Respaldo', 'Inteligencia artificial', 'Instalar la app', 'Acerca de'],
      );
      await page.screenshot({ path: join(shots, 'desktop-ajustes-lectura.png') });

      await page.getByRole('tab', { name: 'Hábito' }).click();
      await expect(page.getByRole('tab', { name: 'Hábito' })).toHaveAttribute('aria-selected', 'true');
      await expectOnlyPanel(page, ['Meta diaria'], ['Lectura', 'Sincronización', 'Inteligencia artificial', 'Instalar la app']);
      await expect(page.getByRole('spinbutton', { name: 'Minutos' })).toBeVisible();

      await page.getByRole('tab', { name: 'Datos' }).click();
      await expect(page.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
      await expectOnlyPanel(page, ['Sincronización', 'Respaldo'], ['Lectura', 'Meta diaria', 'Inteligencia artificial', 'Acerca de']);
      await expect(page.getByRole('button', { name: 'Exportar respaldo' })).toBeVisible();
      await expect(page.getByText(/Client ID de Google/)).toBeVisible();
      await page.screenshot({ path: join(shots, 'desktop-ajustes-datos.png') });

      await page.getByRole('tab', { name: 'IA' }).click();
      await expect(page.getByRole('tab', { name: 'IA' })).toHaveAttribute('aria-selected', 'true');
      await expectOnlyPanel(page, ['Inteligencia artificial'], ['Sincronización', 'Respaldo', 'Lectura', 'Acerca de']);
      await expect(page.getByText('Google Gemini')).toBeVisible();
      await expect(page.getByText('NVIDIA Build / API compatible con OpenAI')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Base URL' })).toBeVisible();
      await page.screenshot({ path: join(shots, 'desktop-ajustes-ia.png') });

      await page.getByRole('tab', { name: 'App' }).click();
      await expect(page.getByRole('tab', { name: 'App' })).toHaveAttribute('aria-selected', 'true');
      await expectOnlyPanel(page, ['Instalar la app', 'Acerca de'], ['Inteligencia artificial', 'Lectura', 'Sincronización', 'Meta diaria']);
      await expect(page.getByRole('button', { name: 'Acerca de la privacidad' })).toBeVisible();

      await page.goto('./');
      await expect(page.getByTestId('library')).toBeVisible();
      await page.getByRole('button', { name: 'Desde Google Drive' }).click();
      await expect(page.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Lectura' })).toBeHidden();

      await openSettings(page, 'sync');
      await expect(page.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Respaldo' })).toBeVisible();
    });
  });

  test.describe('móvil', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('cambian el contenido sin desbordar la página', async ({ page }) => {
      await openSettings(page);
      const tabs = page.getByRole('tablist', { name: 'Categorías de ajustes' });
      await expect(tabs.getByRole('tab')).toHaveCount(5);

      const metrics = await tabs.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          overflowX: style.overflowX,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(['auto', 'scroll']).toContain(metrics.overflowX);
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
      expect(metrics.pageOverflow).toBeLessThanOrEqual(1);

      await expect(page.getByRole('tab', { name: 'Lectura' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Lectura' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Meta diaria' })).toBeHidden();
      await page.screenshot({ path: join(shots, 'mobile-ajustes-lectura.png') });

      await page.getByRole('tab', { name: 'Datos' }).click();
      await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Respaldo' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Lectura' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Exportar respaldo' })).toBeVisible();
      await page.screenshot({ path: join(shots, 'mobile-ajustes-datos.png') });

      await page.getByRole('tab', { name: 'IA' }).click();
      await expect(page.getByRole('heading', { name: 'Inteligencia artificial' })).toBeVisible();
      await expect(page.getByText('Google Gemini')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeHidden();
      await page.screenshot({ path: join(shots, 'mobile-ajustes-ia.png') });

      await page.getByRole('tab', { name: 'App' }).click();
      await expect(page.getByRole('heading', { name: 'Instalar la app' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Acerca de' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Inteligencia artificial' })).toBeHidden();

      const stillFits = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(stillFits).toBeLessThanOrEqual(1);

      await page.goto('./#/ajustes?seccion=sync');
      await expect(page.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Sincronización' })).toBeVisible();
    });
  });
});
