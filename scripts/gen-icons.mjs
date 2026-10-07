/**
 * Generate PNG icons for notifications / PWA manifest (Chrome does not
 * render SVG icons in OS notifications, so we need real PNGs).
 *
 * Draws the TSPK brand square (#2e8db2) with a white "Т" on it.
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public");

const BG = [0x2e, 0x8d, 0xb2]; // brand blue
const FG = [255, 255, 255]; // white "Т"

/** Render RGBA pixel buffer of size×size: brand square + white "Т". */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded corners: cut a quarter-circle of radius r at each corner.
      const r = Math.round(size * 0.18);
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      const inCorner = dx < r && dy < r &&
        (r - dx) ** 2 + (r - dy) ** 2 > r * r;
      set(x, y, inCorner ? [0, 0, 0] : BG, inCorner ? 0 : 255);
    }
  }
  // "Т" glyph as two rectangles, sized relative to the canvas.
  const barH = Math.round(size * 0.11);
  const barW = Math.round(size * 0.56);
  const stemW = Math.round(size * 0.11);
  const stemH = Math.round(size * 0.42);
  const x0 = Math.round((size - barW) / 2);
  const y0 = Math.round(size * 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inBar = x >= x0 && x < x0 + barW && y >= y0 && y < y0 + barH;
      const inStem =
        x >= Math.round(size / 2 - stemW / 2) &&
        x < Math.round(size / 2 + stemW / 2) &&
        y >= y0 && y < y0 + barH + stemH;
      if (inBar || inStem) set(x, y, FG);
    }
  }
  return px;
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(px, size) {
  // Raw scanlines: each row prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(render(size), size));
  console.log("wrote", file);
}
