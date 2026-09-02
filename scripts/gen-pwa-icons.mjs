// Generates PWA PNG icons with no external deps (hand-rolled PNG encoder).
// Run: node scripts/gen-pwa-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder ----------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const encodePNG = (w, h, rgba) => {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// ---- draw the icon -----------------------------------------------------
const BG = [233, 30, 99]; // brand pink
const draw = (size, { maskable = false } = {}) => {
  const buf = Buffer.alloc(size * size * 4);
  const px = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    buf[i] = r * ia + buf[i] * (1 - ia);
    buf[i + 1] = g * ia + buf[i + 1] * (1 - ia);
    buf[i + 2] = b * ia + buf[i + 2] * (1 - ia);
    buf[i + 3] = Math.max(buf[i + 3], a);
  };
  const rect = (x0, y0, x1, y1, c, r = 0) => {
    for (let y = Math.floor(y0); y < y1; y++)
      for (let x = Math.floor(x0); x < x1; x++) {
        if (r > 0) {
          const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
          const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
          if (Math.hypot(x - cx, y - cy) > r) continue;
        }
        px(x, y, c);
      }
  };
  const disc = (cx, cy, rad, c) => {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
        if (Math.hypot(x - cx, y - cy) <= rad) px(x, y, c);
  };

  const S = size;
  const pad = maskable ? S * 0.14 : 0; // safe zone for maskable
  const inner = S - pad * 2;
  const u = (v) => pad + v * inner; // unit -> px within safe box

  // background
  rect(0, 0, S, S, [...BG, 255], maskable ? 0 : S * 0.22);

  const white = [255, 255, 255, 255];
  const cream = [255, 236, 214, 255];
  const flame = [255, 193, 7, 255];

  // plate
  rect(u(0.16), u(0.74), u(0.84), u(0.80), white, u(0.03));
  // cake body (two tiers)
  rect(u(0.24), u(0.46), u(0.76), u(0.74), cream, u(0.04));
  rect(u(0.32), u(0.30), u(0.68), u(0.48), white, u(0.04));
  // frosting drips
  for (const cx of [0.30, 0.40, 0.50, 0.60, 0.70]) disc(u(cx), u(0.46), u(0.035), white);
  // candle
  rect(u(0.485), u(0.16), u(0.515), u(0.30), white);
  // flame
  disc(u(0.5), u(0.135), u(0.035), flame);

  return encodePNG(S, S, buf);
};

writeFileSync(join(OUT, "icon-192.png"), draw(192));
writeFileSync(join(OUT, "icon-512.png"), draw(512));
writeFileSync(join(OUT, "icon-maskable-512.png"), draw(512, { maskable: true }));
console.log("wrote icons to", OUT);
