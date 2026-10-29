import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';

const shots = join(process.cwd(), 'test-results', 'ui');
mkdirSync(shots, { recursive: true });

async function openLibrary(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('library')).toBeVisible();
  await expect(page.getByRole('button', { name: /Semillas de atención/ })).toBeVisible();
}

function pdfBytes(text: string): Buffer {
  const stream = `BT /F1 24 Tf 48 120 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 220] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  body += table;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'binary');
}

async function epubFile(): Promise<string> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  zip.file(
    'OEBPS/c1.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head><title>Puente</title></head>
<body><h1>Puente de prueba</h1><p>Puente de prueba del epub para Kora.</p></body>
</html>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">kora-test</dc:identifier>
    <dc:title>EPUB de prueba</dc:title>
    <dc:creator>Equipo Kora</dc:creator>
    <dc:language>es</dc:language>
  </metadata>
  <manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c1"/></spine>
</package>`,
  );
  const path = join(tmpdir(), 'kora-prueba.epub');
  writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer' }));
  return path;
}

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('biblioteca, lectura, flashcard, cápsulas, repaso y ajustes', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole('button', { name: /El cuaderno de las decisiones/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Memoria viva/ })).toBeVisible();
    await expect(page.getByText('EPUB').first()).toBeVisible();
    await expect(page.getByText('TXT').first()).toBeVisible();
    await expect(page.getByText('MD').first()).toBeVisible();
    await expect(page.getByTestId('streak-widget')).toContainText(/racha/i);
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toBeHidden();

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(new URL(href!, window.location.href));
      return response.json();
    }, manifestHref);
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('es');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()));

    await page.getByRole('button', { name: /Semillas de atención/ }).click();
    await expect(page.getByRole('heading', { name: 'Semillas de atención' })).toBeVisible();
    await expect(page.getByText('Por: Clara Vidal')).toBeVisible();
    await expect(page.getByText(/Resumen ejecutivo/)).toBeVisible();
    await expect(page.getByText(/jardín que se cultiva con límites/)).toBeVisible();
    await page.getByTestId('book-sheet').screenshot({ path: join(shots, 'desktop-book-detail.png') });
    await page.getByRole('button', { name: 'Leer', exact: true }).click();
    await expect(page.getByTestId('reader-body')).toContainText('atención');
    await expect(page.getByTestId('page-label')).toContainText(/Página \d+/);
    await expect(page.locator('p.drop-cap')).toBeVisible();
    await expect(page.locator('.hl').first()).toBeVisible();

    await page.evaluate(() => {
      const root = document.querySelector('[data-testid="reader-body"]');
      if (!root) throw new Error('sin lector');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Text | null = null;
      while (walker.nextNode()) {
        const current = walker.currentNode as Text;
        if (current.data.includes('ninguna jerarquía')) {
          node = current;
          break;
        }
      }
      if (!node) throw new Error('no está la frase');
      const start = node.data.indexOf('ninguna jerarquía');
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + 'ninguna jerarquía'.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.getByTestId('selection-toolbar').getByRole('button', { name: 'Flashcard' }).click();
    await expect(page.getByText('Flashcard creada.')).toBeVisible();

    await page.getByRole('button', { name: /^Capítulo \d+$/ }).click();
    await expect(page.getByTestId('reader-sheet')).toBeVisible();
    await expect(page.getByText('Tamaño de texto')).toBeVisible();
    await expect(page.getByText('Desplazamiento', { exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Desplazamiento' })).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Capítulos').selectOption({ index: 0 });
    await page.getByTestId('reader-overlay').click({ position: { x: 24, y: 24 } });
    await expect(page.getByRole('heading', { name: 'Capítulo 1' })).toBeVisible();
    await expect(page.locator('p.drop-cap')).toBeVisible();
    await page.screenshot({ path: join(shots, 'desktop-reader.png') });
    await page.getByRole('button', { name: /^Capítulo \d+$/ }).click();
    await expect(page.getByTestId('reader-sheet')).toBeVisible();
    await page.screenshot({ path: join(shots, 'desktop-reader-sheet.png') });
    await page.getByRole('switch', { name: 'Desplazamiento' }).click();
    await expect(page.getByTestId('reader-scroll')).toHaveClass(/mode-page/);
    await page.getByRole('switch', { name: 'Desplazamiento' }).click();
    await expect(page.getByTestId('reader-scroll')).toHaveClass(/mode-scroll/);
    await page.getByRole('button', { name: 'Texto grande' }).click();
    await page.getByRole('button', { name: 'Escuchar capítulo' }).click();
    await expect(page.getByTestId('audio-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar audio' }).click();
    await expect(page.getByTestId('audio-bar')).toBeHidden();

    await page.getByRole('button', { name: 'Volver al libro' }).click();
    await expect(page.getByText(/7 tarjetas/)).toBeVisible();
    await page.getByRole('button', { name: 'Generar' }).click();
    await page.getByTestId('generate-confirm').click();
    await expect(page.getByText(/Síntesis lista/)).toBeVisible();

    await page.getByRole('button', { name: 'Síntesis 15 min' }).click();
    await expect(page.getByTestId('synthesis-view')).toBeVisible();
    await expect(page.getByTestId('capsule-title')).toBeVisible();
    const ideas = await page.getByRole('heading', { level: 1 }).innerText();
    expect(ideas).toMatch(/([8-9]|1[0-2]) ideas clave/);
    await page.getByRole('button', { name: 'Ir al pasaje en el libro' }).click();
    await expect(page.getByTestId('reader')).toBeVisible();
    await page.getByRole('button', { name: 'Volver al libro' }).click();
    await page.getByRole('button', { name: 'Síntesis 15 min' }).click();
    await page.getByRole('button', { name: 'Marcar como hecha' }).click();
    await expect(page.getByRole('button', { name: 'Hecha hoy' })).toBeVisible();
    await page.getByRole('button', { name: 'Audio resumen' }).click();
    await expect(page.getByTestId('audio-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar audio' }).click();

    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await expect(page.getByTestId('streak-widget')).toContainText('1 día de racha');

    await page.getByRole('button', { name: 'Repaso' }).click();
    await expect(page.getByTestId('review-view')).toBeVisible();
    await expect(page.getByText('Toca para ver la respuesta')).toBeVisible();
    await page.getByRole('button', { name: 'Voltear tarjeta' }).click();
    await page.getByRole('button', { name: /Bien/ }).click();
    await page.getByRole('tablist').getByRole('button', { name: 'Mini-quiz' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await page.locator('.quiz-options button').first().click();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();

    await page.getByRole('button', { name: 'Ajustes' }).click();
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await page.getByRole('tab', { name: 'IA' }).click();
    await expect(page.getByRole('textbox', { name: 'Clave de Gemini' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Probar clave' })).toBeVisible();
    await expect(page.getByText(/NVIDIA/)).toHaveCount(0);
    await page.getByRole('tab', { name: 'Datos' }).click();
    await expect(page.getByText(/Client ID de Google/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar respaldo' })).toBeVisible();
    await expect(page.getByRole('button', { name: '¿Cómo obtengo el Client ID?' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Sincronizar claves de IA cifradas en Drive' })).toBeVisible();
    await expect(page.getByTestId('sync-block')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sincronizar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subir a Drive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bajar de Drive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Importar libros desde Drive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver libros de la carpeta' })).toBeVisible();
    await expect(page.getByText(/orígenes autorizados/i)).toBeHidden();
    await page.getByRole('tab', { name: 'Lectura' }).click();
    await page.getByRole('button', { name: 'Sepia' }).click();
  });

  test('importa TXT, MD, EPUB y PDF', async ({ page }) => {
    await openLibrary(page);
    const txt = join(tmpdir(), 'notas-sueltas.txt');
    const md = join(tmpdir(), 'notas-markdown.md');
    const pdf = join(tmpdir(), 'pagina-kora.pdf');
    writeFileSync(txt, 'Capítulo 1: Notas sueltas\n\nFrase unica del archivo de texto para comprobar el lector.\n');
    writeFileSync(md, '# Notas markdown\n\n## Margen\n\nIdea markdown de prueba para Kora.\n');
    writeFileSync(pdf, pdfBytes('Hola Kora PDF'));
    const epub = await epubFile();

    await page.locator('input[type="file"]').first().setInputFiles([txt, md, epub, pdf]);
    await expect(page.getByRole('button', { name: /notas sueltas/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Notas markdown/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /EPUB de prueba/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /pagina kora/ })).toBeVisible();

    await page.getByRole('button', { name: /EPUB de prueba/ }).click();
    await page.getByRole('button', { name: 'Leer', exact: true }).click();
    await expect(page.getByTestId('reader-body')).toContainText('Puente de prueba del epub');

    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await page.getByRole('button', { name: /pagina kora/ }).click();
    await page.getByRole('button', { name: 'Leer', exact: true }).click();
    await expect(page.getByTestId('reader-body')).toContainText('Hola Kora PDF');
    await expect(page.locator('.pdf-stage canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await page.getByRole('button', { name: /notas sueltas/ }).click();
    await page.getByRole('button', { name: 'Leer', exact: true }).click();
    await expect(page.getByTestId('reader-body')).toContainText('Frase unica del archivo de texto');
  });
});

test.describe('móvil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('navegación inferior, lectura y ajustes', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await expect(page.getByTestId('sidebar')).toBeHidden();
    await expect(page.getByTestId('streak-widget')).toBeVisible();
    await page.getByRole('button', { name: /Memoria viva/ }).click();
    await page.getByTestId('book-sheet').screenshot({ path: join(shots, 'mobile-book-detail.png') });
    await page.getByRole('button', { name: 'Síntesis 15 min' }).click();
    await expect(page.getByTestId('capsule-card')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Idea 2 de')).toBeVisible();
    await page.getByTestId('bottom-nav').getByRole('button', { name: 'Ajustes' }).click();
    await expect(page.getByRole('heading', { name: 'Kora en este dispositivo' })).toBeVisible();
    await page.getByRole('tab', { name: 'IA' }).click();
    await expect(page.getByRole('combobox', { name: 'Modelo de Gemini' })).toHaveValue('gemini-2.0-flash');
    await page.getByTestId('bottom-nav').getByRole('button', { name: 'Repaso' }).click();
    await expect(page.getByTestId('review-view')).toBeVisible();
    await page.screenshot({ path: join(shots, 'mobile-review.png') });
    await page.getByTestId('bottom-nav').getByRole('button', { name: 'Biblioteca' }).click();
    await page.getByRole('button', { name: /Semillas de atención/ }).click();
    await page.getByRole('button', { name: 'Leer', exact: true }).click();
    await expect(page.locator('p.drop-cap')).toBeVisible();
    await page.screenshot({ path: join(shots, 'mobile-reader.png') });
    await page.getByRole('button', { name: /^Capítulo \d+$/ }).click();
    await expect(page.getByTestId('reader-sheet')).toBeVisible();
    await page.screenshot({ path: join(shots, 'mobile-reader-sheet.png') });
  });
});
