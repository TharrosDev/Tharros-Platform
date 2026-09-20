// Regenerates the Tharros favicon assets from the brand mark
// (`apps/web/src/components/brand/logo.tsx`). Pure Node — rasterizes the mark's
// geometry with 4x supersampled anti-aliasing and packs a multi-size PNG-in-ICO,
// so no native image deps (sharp/imagemagick) are needed. Run after the mark or
// the hi-vis primary changes:
//
//   node scripts/generate-favicon.mjs
//
// Emits apps/web/src/app/favicon.ico (16/32/48) + apps/web/src/app/apple-icon.png.
// The SVG favicon (apps/web/src/app/icon.svg) is hand-maintained from the same path.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps/web/src/app");

// Safety yellow: oklch(0.835 0.152 88) → sRGB. Keep in sync with --primary in
// globals.css. The plate is press black so the mark reads on a light tab strip,
// with the "T" punched out in hi-vis.
const PLATE = { r: 0x1a, g: 0x17, b: 0x10 };
const HIVIS = { r: 0xf2, g: 0xc2, b: 0x3d };

// Mark geometry, in the 24×24 viewBox of the source path.
// Outer tile: a square plate, chamfered top-right (edge from (14.5,0) to
// (24,4.6)). Nothing in this system is rounded, including the mark.
function insideTile(x, y) {
  if (x < 0 || x > 24 || y < 0 || y > 24) return false;
  // Top-right chamfer: exclude points on the outer side of the cut edge.
  // Edge vector (9.5, 4.6); interior is where the cross product is positive.
  if (9.5 * y - 4.6 * (x - 14.5) < 0) return false;
  return true;
}

function insideT(x, y) {
  const topBar = x >= 5.5 && x <= 18.5 && y >= 6.2 && y <= 9.5;
  const stem = x >= 10.6 && x <= 13.4 && y >= 9.5 && y <= 18;
  return topBar || stem;
}

// Render an RGBA buffer at `size`px. `bg` null → transparent outside the mark
// and through the T (browser-tab favicon). A solid `bg` (apple touch icon) fills
// the canvas and paints the T in that colour so the mark reads on iOS.
function render(size, bg) {
  const SS = 4; // supersampling factor per axis
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let markHits = 0;
      const samples = SS * SS;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // Sample centre → 24-space.
          const x = ((px + (sx + 0.5) / SS) / size) * 24;
          const y = ((py + (sy + 0.5) / SS) / size) * 24;
          if (insideTile(x, y) && !insideT(x, y)) markHits++;
        }
      }
      const cov = markHits / samples;
      const i = (py * size + px) * 4;
      if (bg) {
        // Composite the plate over an opaque background.
        buf[i] = Math.round(PLATE.r * cov + bg.r * (1 - cov));
        buf[i + 1] = Math.round(PLATE.g * cov + bg.g * (1 - cov));
        buf[i + 2] = Math.round(PLATE.b * cov + bg.b * (1 - cov));
        buf[i + 3] = 255;
      } else {
        buf[i] = PLATE.r;
        buf[i + 1] = PLATE.g;
        buf[i + 2] = PLATE.b;
        buf[i + 3] = Math.round(cov * 255);
      }
    }
  }
  return buf;
}

// Minimal PNG encoder (RGBA, filter 0 per scanline).
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter byte
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Pack PNG images into an ICO (PNG-compressed entries — supported by all
// current browsers).
function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6 + count * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const parts = [];
  images.forEach((img, idx) => {
    const e = 6 + idx * 16;
    header[e] = img.size >= 256 ? 0 : img.size; // width (0 = 256)
    header[e + 1] = img.size >= 256 ? 0 : img.size; // height
    header[e + 2] = 0; // palette
    header[e + 3] = 0; // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bpp
    header.writeUInt32LE(img.png.length, e + 8); // size
    header.writeUInt32LE(offset, e + 12); // offset
    offset += img.png.length;
    parts.push(img.png);
  });
  return Buffer.concat([header, ...parts]);
}

const icoSizes = [16, 32, 48];
const ico = encodeIco(
  icoSizes.map((size) => ({ size, png: encodePng(size, render(size, null)) })),
);
writeFileSync(join(appDir, "favicon.ico"), ico);

// Apple touch icon: opaque white canvas (iOS squares + adds its own rounding).
writeFileSync(join(appDir, "apple-icon.png"), encodePng(180, render(180, HIVIS)));

console.log(`favicon.ico (${icoSizes.join("/")}) + apple-icon.png written to ${appDir}`);
