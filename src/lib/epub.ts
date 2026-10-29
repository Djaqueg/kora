import JSZip from 'jszip';
import type { Chapter } from '../types';
import { escapeXml, sanitizeHtml } from './html';

export interface ParsedBook {
  title?: string;
  author?: string;
  chapters: Chapter[];
}

function locals(doc: Document, name: string): Element[] {
  return [...doc.getElementsByTagName('*')].filter((el) => el.localName === name);
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return new DOMParser().parseFromString(xml, 'text/html');
  return doc;
}

export function joinPath(baseDir: string, rel: string): string {
  const clean = decodeURIComponent(rel).split('#')[0].split('?')[0];
  const parts = baseDir ? baseDir.split('/').filter(Boolean) : [];
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function zipEntry(zip: JSZip, path: string) {
  const normalized = path.replace(/^\//, '');
  return zip.file(normalized) || zip.file(decodeURIComponent(normalized)) || zip.file(path);
}

function innerContent(el: Element): string {
  const html = (el as HTMLElement).innerHTML;
  if (typeof html === 'string' && html.trim()) return html;
  return [...el.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join('');
}

async function inlineImages(doc: Document, zip: JSZip, chapterFile: string) {
  const dir = chapterFile.includes('/') ? chapterFile.slice(0, chapterFile.lastIndexOf('/')) : '';
  const images = [...doc.getElementsByTagName('*')].filter((el) => el.localName === 'img');
  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    const path = joinPath(dir, src);
    const file = zipEntry(zip, path);
    if (!file) {
      img.removeAttribute('src');
      continue;
    }
    const base64 = await file.async('base64');
    const ext = path.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png' ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : ext === 'svg' ? 'image/svg+xml'
      : 'application/octet-stream';
    img.setAttribute('src', `data:${mime};base64,${base64}`);
  }
}

export async function parseEpub(data: ArrayBuffer, bookId: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(data);
  const containerFile = zipEntry(zip, 'META-INF/container.xml');
  if (!containerFile) throw new Error('El EPUB no incluye META-INF/container.xml.');
  const container = parseXml(await containerFile.async('string'));
  const rootfile = locals(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!rootfile) throw new Error('El EPUB no declara un archivo raíz.');
  const opfPath = decodeURIComponent(rootfile).replace(/^\//, '');
  const opfFile = zipEntry(zip, opfPath);
  if (!opfFile) throw new Error('No se encontró el paquete OPF del EPUB.');
  const opf = parseXml(await opfFile.async('string'));
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const title = locals(opf, 'title')[0]?.textContent?.trim() || undefined;
  const author = locals(opf, 'creator')[0]?.textContent?.trim() || undefined;

  const manifest = new Map<string, { href: string; mediaType: string; props: string }>();
  for (const item of locals(opf, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) continue;
    manifest.set(id, {
      href: decodeURIComponent(href),
      mediaType: item.getAttribute('media-type') || '',
      props: item.getAttribute('properties') || '',
    });
  }

  const labels = new Map<string, string>();
  for (const item of manifest.values()) {
    if (!/\bnav\b/.test(item.props) && !/toc/i.test(item.href)) continue;
    const navFile = zipEntry(zip, joinPath(base, item.href));
    if (!navFile) continue;
    const nav = parseXml(await navFile.async('string'));
    for (const anchor of [...nav.getElementsByTagName('*')].filter((el) => el.localName === 'a')) {
      const href = anchor.getAttribute('href');
      const text = anchor.textContent?.trim();
      if (!href || !text) continue;
      const fileHref = href.split('#')[0];
      if (fileHref) labels.set(fileHref, text);
    }
  }

  const spine = locals(opf, 'itemref')
    .map((node) => node.getAttribute('idref'))
    .filter((id): id is string => Boolean(id));

  const chapters: Chapter[] = [];
  let index = 0;
  const now = Date.now();
  for (const id of spine) {
    const item = manifest.get(id);
    if (!item) continue;
    const isHtml = /html|xml/i.test(item.mediaType) || /\.x?html?$/i.test(item.href);
    if (!isHtml || /\.ncx$/i.test(item.href)) continue;
    const path = joinPath(base, item.href);
    const file = zipEntry(zip, path);
    if (!file) continue;
    const raw = await file.async('string');
    const doc = parseXml(raw);
    await inlineImages(doc, zip, path);
    const body = [...doc.getElementsByTagName('*')].find((el) => el.localName === 'body');
    if (!body) continue;
    const heading = [...body.getElementsByTagName('*')].find((el) => ['h1', 'h2', 'h3'].includes(el.localName || ''));
    const headingText = heading?.textContent?.trim();
    if (heading && headingText && heading.parentElement === body) heading.remove();
    const html = sanitizeHtml(innerContent(body));
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || '';
    if (!plain) continue;
    const titleFromNav = labels.get(item.href) || labels.get(path.split('/').pop() || '');
    chapters.push({
      id: `${bookId}-c${index}`,
      bookId,
      index,
      title: titleFromNav || headingText || `Capítulo ${index + 1}`,
      html: html || `<p>${escapeXml(plain)}</p>`,
      updatedAt: now,
    });
    index += 1;
  }
  if (!chapters.length) throw new Error('No se encontraron capítulos legibles en el EPUB.');
  return { title, author, chapters };
}

export async function buildEpub(opts: {
  title: string;
  author: string;
  chapters: { title: string; paragraphs: string[] }[];
}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );
  const manifest: string[] = [];
  const spine: string[] = [];
  opts.chapters.forEach((chapter, index) => {
    const id = `c${index + 1}`;
    const href = `${id}.xhtml`;
    const body = chapter.paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join('\n');
    zip.file(
      `OEBPS/${href}`,
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es" lang="es">
<head><title>${escapeXml(chapter.title)}</title></head>
<body>
<h1>${escapeXml(chapter.title)}</h1>
${body}
</body>
</html>`,
    );
    manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
  });
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:kora:${escapeXml(opts.title)}</dc:identifier>
    <dc:title>${escapeXml(opts.title)}</dc:title>
    <dc:creator>${escapeXml(opts.author)}</dc:creator>
    <dc:language>es</dc:language>
  </metadata>
  <manifest>
    ${manifest.join('\n')}
  </manifest>
  <spine>
    ${spine.join('\n')}
  </spine>
</package>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}
