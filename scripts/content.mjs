// Loads and validates everything the owner edits in /content.
// Bad formatting stops the build with a plain-English message (Cloudflare keeps the last good site live).
// Small problems (a missing photo, a blank color) are skipped with a warning.
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { marked } from 'marked';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const MAX_BYTES = 25 * 1024 * 1024;

export class ContentError extends Error {}
export const warnings = [];
export const warn = (msg) => { warnings.push(msg); console.warn(`  ! ${msg}`); };

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const baseSlug = (file) => slugify(path.basename(file, path.extname(file)));
const rel = (p) => path.relative(ROOT, p);

const exists = (p) => fs.access(p).then(() => true, () => false);

async function readText(file) {
  return (await exists(file)) ? fs.readFile(file, 'utf8') : null;
}

function parseOrFail(file, text, parser) {
  try { return parser(text); } catch (e) {
    throw new ContentError(
      `The file "${rel(file)}" has a formatting problem and could not be read.\n` +
      `    ${String(e.message).split('\n')[0]}\n` +
      `    Open it in the editor and check for a missing quote, colon, or comma. ` +
      `Your live site has not changed.`);
  }
}

export async function readYaml(file) {
  const text = await readText(file);
  if (text === null) return null;
  return parseOrFail(file, text, (t) => YAML.parse(t)) ?? {};
}

// Markdown file with optional "---" front matter -> { meta, html }
export async function readMarkdown(file) {
  const text = await readText(file);
  if (text === null) return null;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = m ? parseOrFail(file, m[1], (t) => YAML.parse(t)) ?? {} : {};
  return { meta, html: marked.parse(m ? m[2] : text) };
}

// ---------- site settings ----------
export const PRESETS = {
  'warm-editorial': { background: '#dedad3', text: '#0a0a0a', accent: '#256f82' }, // putty, black, teal
  'light-gallery':  { background: '#f3f2ef', text: '#141414', accent: '#1f6a80' },
  'dark-gallery':   { background: '#121110', text: '#efece6', accent: '#5fb3c4' },
};

export const FONTS = {
  'elegant-serif': {
    heading: "'Newsreader', Georgia, serif", body: "'Newsreader', Georgia, serif",
    url: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap',
  },
  'modern-sans': {
    heading: "'Manrope', system-ui, sans-serif", body: "'Manrope', system-ui, sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600&display=swap',
  },
  classic: {
    heading: "'Playfair Display', Georgia, serif", body: "'Source Serif 4', Georgia, serif",
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Source+Serif+4:wght@400;500&display=swap',
  },
};

export const GUTTERS = { tight: '4px', normal: '10px', airy: '24px' };
export const LAYOUTS = ['justified', 'masonry', 'single'];

const isHex = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export async function loadSite() {
  const raw = (await readYaml(path.join(ROOT, 'content/site.json'))) ?? {};
  const pick = (value, allowed, fallback, label) => {
    if (value == null || value === '') return fallback;
    if (allowed.includes(value)) return value;
    warn(`Site settings: "${value}" is not a valid ${label}. Using "${fallback}" instead.`);
    return fallback;
  };
  const presetName = pick(raw.preset, Object.keys(PRESETS), 'warm-editorial', 'preset');
  const preset = PRESETS[presetName];
  const colors = {};
  for (const key of ['background', 'text', 'accent']) {
    const v = raw.colors?.[key];
    if (v && !isHex(v)) warn(`Site settings: the ${key} color "${v}" is not a valid color (use a code like #8c4a32). Using the preset color.`);
    colors[key] = isHex(v) ? v.trim() : preset[key];
  }
  if (contrast(colors.accent, colors.background) < 3) {
    warn(`Site settings: the accent color ${colors.accent} is too faint to read on ${colors.background}. Using the preset accent.`);
    colors.accent = preset.accent;
  }
  if (contrast(colors.text, colors.background) < 4.5) {
    warn('Site settings: the text color does not stand out enough from the background. Using the preset colors.');
    Object.assign(colors, preset);
  }
  const contact = raw.contact ?? {};
  return {
    name: raw.name || 'Photography',
    tagline: raw.tagline || '',
    description: raw.description || '',
    url: (raw.url || process.env.CF_PAGES_URL || '').replace(/\/$/, ''),
    email: raw.email || '',
    phone: raw.phone || '',
    location: raw.location || '',
    instagram: raw.instagram || '',
    colors,
    fonts: pick(raw.fonts, Object.keys(FONTS), 'elegant-serif', 'font choice'),
    layout: pick(raw.layout, LAYOUTS, 'justified', 'gallery layout'),
    gutter: pick(raw.gutter, Object.keys(GUTTERS), 'normal', 'gutter size'),
    hero: { images: raw.hero?.images ?? [] },
    contact: {
      intro: contact.intro || '',
      method: pick(contact.method, ['function', 'web3forms', 'formspree'], 'function', 'contact method'),
      web3formsKey: contact.web3formsKey || '',
      formspreeId: contact.formspreeId || '',
      turnstileSiteKey: contact.turnstileSiteKey || '',
      shootTypes: contact.shootTypes?.length ? contact.shootTypes : ['Wedding', 'Engagement', 'Event', 'Other'],
    },
    home: {
      title: raw.home?.title || '',
      intro: raw.home?.intro || raw.description || '',
      facts: (raw.home?.facts ?? []).filter((f) => f?.value).slice(0, 4),
      momentsTitle: raw.home?.momentsTitle || 'The day, hour by hour',
      moments: (raw.home?.moments ?? []).filter((m) => m?.title),
      coverage: (raw.home?.coverage ?? [4, 6, 8, 10]).map(Number).filter((n) => n > 0),
      testimonial: raw.home?.testimonial?.quote ? raw.home.testimonial : null,
      closing: raw.home?.closing || 'Your day only happens once.',
      closingLink: raw.home?.closingLink || 'Tell me about it',
    },
    clientsEnabled: raw.clients?.enabled === true,
  };
}

// ---------- photos & galleries ----------
// Every photo lives in one folder (content/photos). Galleries refer to photos by file name;
// capitals, spaces, and the folder part of the path are ignored.
export async function indexPhotos(dir) {
  const index = new Map();
  async function walk(d) {
    for (const entry of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) {
        const { size } = await fs.stat(full);
        if (size > MAX_BYTES) {
          throw new ContentError(
            `The photo "${rel(full)}" is ${(size / 1048576).toFixed(1)} MB, which is over the 25 MB limit. ` +
            `Re-export it from Lightroom at 2400 px on the long edge, JPEG quality 82, and upload it again.`);
        }
        const key = baseSlug(entry.name);
        if (index.has(key)) warn(`Two photos share the name "${entry.name}". Only one will be used; rename one of them.`);
        else index.set(key, full);
      }
    }
  }
  await walk(dir);
  return index;
}

export const findPhoto = (index, ref) => (ref ? index.get(baseSlug(String(ref))) : undefined);

export async function loadGalleries(dir, index) {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => /\.ya?ml$/i.test(f));
  const out = [];
  for (const f of files) {
    const file = path.join(dir, f);
    const data = (await readYaml(file)) ?? {};
    const slug = slugify(path.basename(f, path.extname(f)));
    const photos = [];
    for (const item of data.photos ?? []) {
      const entry = typeof item === 'string' ? { file: item } : item;
      const src = findPhoto(index, entry?.file);
      if (!src) { warn(`Gallery "${f}": the photo "${entry?.file}" was not found in content/photos, so it was skipped.`); continue; }
      photos.push({ src, alt: entry.alt || '', caption: entry.caption || '' });
    }
    if (!photos.length) { warn(`Gallery "${f}" has no photos, so it was left out of the site.`); continue; }
    let cover = findPhoto(index, data.cover);
    if (data.cover && !cover) warn(`Gallery "${f}": the cover photo "${data.cover}" was not found. Using the first photo.`);
    out.push({
      slug,
      title: data.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: data.description || '',
      layout: LAYOUTS.includes(data.layout) ? data.layout : null,
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999,
      note: data.note || '',
      cover: cover ?? photos[0].src,
      photos,
    });
  }
  return out.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
