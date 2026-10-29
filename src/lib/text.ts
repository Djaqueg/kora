import type { BookFormat, Chapter } from '../types';
import { escapeHtml } from './html';

export function detectFormat(fileName: string): BookFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'epub') return 'EPUB';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'md' || ext === 'markdown') return 'MD';
  return 'TXT';
}

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Libro sin título';
}

function cleanTitle(title: string): string {
  const stripped = title.replace(/^cap[ií]tulo\s+\d+\s*[:.\-–—]?\s*/i, '').trim();
  return stripped || title.trim() || 'Capítulo';
}

export function splitIntoChapters(raw: string): { title: string; body: string }[] {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const re = /^(?:cap[ií]tulo\s+(\d+)\b[.:)\-–—]?\s*(.*)|#{1,3}\s+(.+))$/gim;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return [{ title: 'Texto', body: text }];
  const chapters: { title: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = cleanTitle((match[2] || match[3] || `Capítulo ${match[1] || i + 1}`).trim());
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    if (body) chapters.push({ title, body });
  }
  return chapters.length ? chapters : [{ title: 'Texto', body: text }];
}

function inlineMd(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function blockToHtml(block: string, mode: 'txt' | 'md'): string {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  if (mode === 'md' && lines.every((line) => /^[-*]\s+/.test(line))) {
    return `<ul>${lines.map((line) => `<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
  }
  if (mode === 'md' && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `<ol>${lines.map((line) => `<li>${inlineMd(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
  }
  if (mode === 'md' && lines.every((line) => line.startsWith('>'))) {
    return `<blockquote><p>${lines.map((line) => inlineMd(line.replace(/^>\s?/, ''))).join(' ')}</p></blockquote>`;
  }
  const text = lines.join(' ');
  return `<p>${mode === 'md' ? inlineMd(text) : escapeHtml(text)}</p>`;
}

export function bodyToHtml(body: string, mode: 'txt' | 'md'): string {
  return body
    .split(/\n\s*\n/)
    .map((block) => blockToHtml(block.trim(), mode))
    .filter(Boolean)
    .join('');
}

export function parseTextDocument(raw: string, bookId: string, format: 'TXT' | 'MD'): { title?: string; chapters: Chapter[] } {
  let source = raw.replace(/^\uFEFF/, '');
  let title: string | undefined;
  if (format === 'MD') {
    const match = source.match(/^\s*#\s+(.+)\n+/);
    if (match && !match[0].startsWith('##')) {
      title = match[1].trim();
      source = source.slice(match[0].length);
    }
  }
  const now = Date.now();
  const chapters = splitIntoChapters(source).map((part, index) => ({
    id: `${bookId}-c${index}`,
    bookId,
    index,
    title: part.title,
    html: bodyToHtml(part.body, format === 'MD' ? 'md' : 'txt'),
    updatedAt: now,
  }));
  return { title, chapters };
}
