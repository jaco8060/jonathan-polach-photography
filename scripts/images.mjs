// Resizes each photo once into AVIF, WebP and JPEG at several widths, plus a placeholder color.
// File names contain a hash of the photo, so a changed photo always gets a new name (safe to cache forever).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { slugify } from './content.mjs';

const WIDTHS = [480, 800, 1200, 1600, 2400];
const cache = new Map();

export async function processImage(src, { outDir, urlBase }) {
  const key = `${src}|${outDir}`;
  if (!cache.has(key)) cache.set(key, run(src, outDir, urlBase));
  return cache.get(key);
}

async function run(src, outDir, urlBase) {
  const buf = await fs.readFile(src);
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const id = `${slugify(path.basename(src, path.extname(src)))}-${hash}`;
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;
  const widths = [...new Set([...WIDTHS.filter((w) => w < width), Math.min(width, 2400)])];

  await fs.mkdir(outDir, { recursive: true });
  const base = () => sharp(buf, { failOn: 'none' }).rotate(); // rotate() applies the camera's orientation; output has no EXIF/GPS
  for (const w of widths) {
    const resized = () => base().resize({ width: w, withoutEnlargement: true });
    await Promise.all([
      resized().avif({ quality: 55, effort: 3 }).toFile(path.join(outDir, `${id}-${w}.avif`)),
      resized().webp({ quality: 78, effort: 4 }).toFile(path.join(outDir, `${id}-${w}.webp`)),
      resized().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${id}-${w}.jpg`)),
    ]);
  }
  const { dominant } = await base().resize(64).stats();
  const color = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return { id, base: `${urlBase}/${id}`, width: Math.min(width, 2400), height: Math.round(height * Math.min(width, 2400) / width), widths, color };
}

// Simple worker pool so we resize a few photos at a time.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}
