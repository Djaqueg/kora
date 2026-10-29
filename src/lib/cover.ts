import { escapeXml } from './html';

export function hueFromString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

export function makeCover(title: string, _author: string, hue: number, _format: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const size = words.some((word) => word.length > 10) || words.length > 4 ? 30 : 36;
  const lines = words
    .map(
      (word, index) =>
        `<text x="56" y="${148 + index * (size + 14)}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" letter-spacing="3.5" fill="#3d4c57">${escapeXml(word.toUpperCase())}</text>`,
    )
    .join('');
  const tint = `hsl(${hue} 28% 80%)`;
  const stone = `hsl(${hue} 18% 86%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfcfd"/>
      <stop offset="1" stop-color="#e4edf1"/>
    </linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#f7fbfc"/>
      <stop offset="1" stop-color="${stone}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <ellipse cx="590" cy="470" rx="230" ry="280" fill="${tint}" opacity="0.45"/>
  <path d="M500 560c22-70 58-96 108-92 72 8 112 78 96 196l-168 24c-24-62-46-84-36-128z" fill="url(#stone)"/>
  <ellipse cx="608" cy="372" rx="122" ry="150" fill="url(#stone)"/>
  <path d="M498 348c14-120 96-168 196-112 58 32 62 96 28 128 46-70-8-168-120-150-78 12-112 62-104 134z" fill="#e7eef2"/>
  <path d="M430 760c28-120 110-168 210-156 92 12 168 92 188 196H400c-8-16-4-28 30-40z" fill="#f4f8fa"/>
  <path d="M548 300c18-36 48-52 78-40" fill="none" stroke="#c5d3dc" stroke-width="8" stroke-linecap="round"/>
  ${lines}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
