import { escapeXml } from './html';

export function hueFromString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function wrapWords(value: string, max: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export function makeCover(title: string, author: string, hue: number, format: string): string {
  const lines = wrapWords(title, 16);
  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="40" y="${168 + index * 38}" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" fill="#f7f3ea">${escapeXml(line)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="680" viewBox="0 0 480 680">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 42% 28%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 28) % 360} 38% 16%)"/>
    </linearGradient>
  </defs>
  <rect width="480" height="680" rx="36" fill="url(#g)"/>
  <circle cx="400" cy="90" r="70" fill="hsl(${(hue + 46) % 360} 70% 58%)" opacity="0.9"/>
  <circle cx="70" cy="600" r="90" fill="#f4efe4" opacity="0.08"/>
  <rect x="40" y="48" width="86" height="28" rx="14" fill="#f4efe4"/>
  <text x="83" y="67" text-anchor="middle" font-family="Outfit, sans-serif" font-size="13" font-weight="700" fill="hsl(${hue} 42% 22%)">${escapeXml(format)}</text>
  ${titleSvg}
  <text x="40" y="${188 + lines.length * 38}" font-family="Outfit, sans-serif" font-size="18" fill="#f4efe4" opacity="0.85">${escapeXml(author)}</text>
  <path d="M40 600h400" stroke="#f4efe4" stroke-opacity="0.35"/>
  <text x="40" y="636" font-family="Georgia, serif" font-size="22" fill="#f4efe4">Kora</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
