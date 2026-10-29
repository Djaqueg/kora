import type { HighlightColor } from '../types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeXml(value: string): string {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

export function htmlToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

const ALLOWED = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'ul', 'ol', 'li', 'em', 'strong',
  'b', 'i', 'a', 'br', 'hr', 'span', 'div', 'section', 'figure', 'figcaption', 'img',
  'pre', 'code', 'sup', 'sub',
]);

function sanitizeElement(parent: Element) {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    sanitizeElement(el);
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED.has(tag)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const keepLink = tag === 'a' && name === 'href';
      const keepImg = tag === 'img' && name === 'src' && /^(data:|blob:)/i.test(attr.value);
      const keepAlt = tag === 'img' && name === 'alt';
      if (!keepLink && !keepImg && !keepAlt) el.removeAttribute(attr.name);
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (!/^https?:|^mailto:/i.test(href)) el.removeAttribute('href');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noreferrer noopener');
    }
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="kora-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('kora-root');
  if (!root) return '';
  sanitizeElement(root);
  return root.innerHTML;
}

export interface HighlightRange {
  id: string;
  start: number;
  end: number;
  color: HighlightColor;
}

export function wrapHighlights(root: HTMLElement, ranges: HighlightRange[]) {
  const nodes: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push({ node, start: offset });
    offset += node.data.length;
  }
  const usable = ranges.filter((range) => range.end > range.start);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const { node, start } = nodes[i];
    const end = start + node.data.length;
    const slices = usable
      .map((range) => ({
        ...range,
        a: Math.max(start, range.start),
        b: Math.min(end, range.end),
      }))
      .filter((range) => range.b > range.a)
      .sort((a, b) => a.a - b.a);
    if (!slices.length) continue;
    const frag = document.createDocumentFragment();
    let cursor = start;
    const text = node.data;
    for (const slice of slices) {
      const from = Math.max(cursor, slice.a);
      if (from > cursor) frag.append(text.slice(cursor - start, from - start));
      if (slice.b > from) {
        const mark = document.createElement('mark');
        mark.className = `hl hl-${slice.color}`;
        mark.dataset.hlId = slice.id;
        mark.textContent = text.slice(from - start, slice.b - start);
        frag.append(mark);
        cursor = slice.b;
      }
    }
    if (cursor < end) frag.append(text.slice(cursor - start));
    node.replaceWith(frag);
  }
}

export function markSearch(root: HTMLElement, query: string) {
  const needle = query.trim();
  if (needle.length < 2) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const lower = needle.toLowerCase();
  for (const node of nodes) {
    const idx = node.data.toLowerCase().indexOf(lower);
    if (idx < 0) continue;
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, Math.min(node.data.length, idx + needle.length));
    const mark = document.createElement('mark');
    mark.className = 'search-hit';
    try {
      range.surroundContents(mark);
    } catch {
      /* The range can split a mark already created in this node. */
    }
  }
}

export function selectionOffsets(root: HTMLElement, range: Range): { start: number; end: number } | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const probe = range.cloneRange();
  probe.selectNodeContents(root);
  probe.setEnd(range.startContainer, range.startOffset);
  const start = probe.toString().length;
  probe.setEnd(range.endContainer, range.endOffset);
  const end = probe.toString().length;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function scrollToQuote(root: HTMLElement, quote: string): boolean {
  const needle = quote.trim().slice(0, 90);
  if (needle.length < 2) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let full = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push(node);
    full += node.data;
  }
  const idx = full.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return false;
  let acc = 0;
  for (const node of nodes) {
    if (acc + node.data.length > idx) {
      const el = node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('flash-target');
      window.setTimeout(() => el?.classList.remove('flash-target'), 1600);
      return true;
    }
    acc += node.data.length;
  }
  return false;
}

export function blocksFromHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [...doc.body.querySelectorAll('p, h1, h2, h3, li, blockquote')];
  const source = blocks.length ? blocks : [doc.body];
  return source.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
