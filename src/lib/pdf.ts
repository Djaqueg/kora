import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Chapter } from '../types';
import { escapeHtml } from './html';

const docs = new Map<string, Promise<PDFDocumentProxy>>();

async function pdfjs() {
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  return lib;
}

function bytesOf(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data.slice(0));
}

export async function parsePdf(data: ArrayBuffer, bookId: string): Promise<{ title?: string; author?: string; chapters: Chapter[] }> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: bytesOf(data) }).promise;
  let title: string | undefined;
  let author: string | undefined;
  try {
    const meta = await doc.getMetadata();
    const info = (meta.info || {}) as { Title?: string; Author?: string };
    title = info.Title?.trim() || undefined;
    author = info.Author?.trim() || undefined;
  } catch {
    title = undefined;
  }
  const chapters: Chapter[] = [];
  const now = Date.now();
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = '';
      } else if (item.str && !item.str.endsWith(' ')) line += ' ';
    }
    if (line.trim()) lines.push(line.trim());
    const paragraphs = lines
      .join('\n')
      .split(/\n{2,}/)
      .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
    const html = paragraphs.length
      ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
      : '<p><em>Esta página no contiene texto seleccionable. Puedes verla en la vista de página.</em></p>';
    chapters.push({
      id: `${bookId}-c${pageNumber - 1}`,
      bookId,
      index: pageNumber - 1,
      title: `Página ${pageNumber}`,
      html,
      updatedAt: now,
    });
  }
  await doc.destroy();
  if (!chapters.length) throw new Error('El PDF no tiene páginas.');
  return { title, author, chapters };
}

export function loadPdfDocument(bookId: string, data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const cached = docs.get(bookId);
  if (cached) return cached;
  const promise = pdfjs().then((lib) => lib.getDocument({ data: bytesOf(data) }).promise);
  docs.set(bookId, promise);
  return promise;
}

export function forgetPdf(bookId: string) {
  const pending = docs.get(bookId);
  docs.delete(bookId);
  pending?.then((doc) => doc.destroy()).catch(() => undefined);
}

export async function renderPdfPage(bookId: string, data: ArrayBuffer, pageNumber: number, canvas: HTMLCanvasElement) {
  const doc = await loadPdfDocument(bookId, data);
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const maxWidth = Math.min(canvas.parentElement?.clientWidth || 720, 820);
  const scale = Math.min(2, (maxWidth / unscaled.width) * (window.devicePixelRatio || 1));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / (window.devicePixelRatio || 1))}px`;
  canvas.style.height = 'auto';
  await page.render({ canvas, viewport }).promise;
}
