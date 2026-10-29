import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const TEAL = [155, 184, 197, 255];
const CREAM = [247, 251, 252, 255];
const PAPER = [255, 255, 255, 255];
const AMBER = [231, 241, 245, 255];
const INK = [28, 36, 43, 255];
const ROSE = [28, 36, 43, 255];

function paintIcon(x, y, size, maskable) {
  let nx = x / (size - 1);
  let ny = y / (size - 1);
  if (maskable) {
    nx = (nx - 0.5) / 0.7 + 0.5;
    ny = (ny - 0.5) / 0.7 + 0.5;
  }
  let color = TEAL;
  const left = [
    [0.22, 0.34],
    [0.48, 0.28],
    [0.48, 0.74],
    [0.24, 0.8],
  ];
  const right = [
    [0.52, 0.28],
    [0.78, 0.34],
    [0.76, 0.8],
    [0.52, 0.74],
  ];
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    if (inPoly(nx, ny, left)) color = CREAM;
    else if (inPoly(nx, ny, right)) color = PAPER;
    if (nx > 0.485 && nx < 0.515 && ny > 0.28 && ny < 0.76) color = TEAL;
    const lines = [
      [0.28, 0.46, 0.42, 0.012, INK],
      [0.28, 0.53, 0.38, 0.012, INK],
      [0.28, 0.6, 0.4, 0.012, INK],
      [0.58, 0.46, 0.7, 0.012, ROSE],
      [0.58, 0.53, 0.68, 0.012, ROSE],
      [0.58, 0.6, 0.71, 0.012, ROSE],
    ];
    for (const [x0, y0, x1, h, c] of lines) {
      if (nx >= x0 && nx <= x1 && Math.abs(ny - y0) <= h) color = c;
    }
    if (inCircle(nx, ny, 0.74, 0.24, 0.07)) color = AMBER;
    if (Math.abs(nx - 0.74) < 0.035 && Math.abs(ny - 0.24) < 0.008) color = INK;
    if (Math.abs(ny - 0.24) < 0.035 && Math.abs(nx - 0.74) < 0.008) color = INK;
  }
  return color;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, (x, y, s) => paintIcon(x, y, s, false)));
writeFileSync('public/icons/icon-512.png', png(512, (x, y, s) => paintIcon(x, y, s, false)));
writeFileSync('public/icons/icon-maskable.png', png(512, (x, y, s) => paintIcon(x, y, s, true)));
console.log('icons written');
