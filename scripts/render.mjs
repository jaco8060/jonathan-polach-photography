// HTML building blocks. Everything is plain strings so the output is static and fast.
import { FONTS, GUTTERS, contrast } from './content.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SIZES = {
  justified: '(min-width: 1000px) 40vw, 100vw',
  masonry: '(min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw',
  single: '(min-width: 1100px) 1100px, 100vw',
  card: '(min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw',
  hero: '100vw',
};
export const sizesFor = (k) => SIZES[k];

export function picture(p, { alt = '', sizes, eager = false }) {
  const set = (ext) => p.widths.map((w) => `${p.base}-${w}.${ext} ${w}w`).join(', ');
  const fallbackW = [...p.widths].reverse().find((w) => w <= 1200) ?? p.widths[0];
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<picture>` +
    `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">` +
    `<img src="${p.base}-${fallbackW}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(alt)}" ${loading} style="background-color:${p.color}">` +
    `</picture>`;
}

const largest = (p, ext = 'webp') => `${p.base}-${p.widths.at(-1)}.${ext}`;

export function galleryHtml(gallery, layout, photos) {
  const items = photos.map(({ meta, alt, caption }, i) => {
    const text = alt || caption || `${gallery.title}, photo ${i + 1}`;
    const cap = layout === 'single' && caption ? `<figcaption>${esc(caption)}</figcaption>` : '';
    return `<figure class="ph reveal" style="--ar:${(meta.width / meta.height).toFixed(4)}">` +
      `<a href="${largest(meta)}" data-pswp-width="${meta.width}" data-pswp-height="${meta.height}" data-caption="${esc(caption)}">` +
      picture(meta, { alt: text, sizes: SIZES[layout] }) + `</a>${cap}</figure>`;
  });
  return `<section id="gallery" class="gallery gallery--${layout}" aria-label="${esc(gallery.title)} photos">\n${items.join('\n')}\n</section>`;
}

export function themeCss(site) {
  const f = FONTS[site.fonts];
  const c = site.colors;
  return `:root{--bg:${c.background};--text:${c.text};--accent:${c.accent};` +
    `--accent-ink:${contrast(c.accent, '#ffffff') >= contrast(c.accent, '#0a0a0a') ? '#ffffff' : '#0a0a0a'};--font-head:${f.heading};--font-body:${f.body};--gutter:${GUTTERS[site.gutter]}}`;
}

const instagramUrl = (v) => (!v ? '' : /^https?:/.test(v) ? v : `https://instagram.com/${v.replace(/^@/, '')}`);

export function head(ctx, page) {
  const { site, assets } = ctx;
  const title = page.home ? `${site.name}${site.tagline ? ' · ' + site.tagline : ''}` : `${page.title} · ${site.name}`;
  const desc = page.description || site.description;
  const abs = (p) => (site.url && p ? site.url + p : p);
  const url = abs(page.path);
  const img = page.image ? abs(page.image) : '';
  const ld = site.name && !page.noindex ? {
    '@context': 'https://schema.org', '@type': 'Photographer', name: site.name,
    url: site.url || undefined, email: site.email || undefined, telephone: site.phone || undefined,
    address: site.location ? { '@type': 'PostalAddress', addressLocality: site.location } : undefined,
    sameAs: site.instagram ? [instagramUrl(site.instagram)] : undefined, image: img || undefined,
  } : null;
  return [
    `<title>${esc(title)}</title>`,
    desc && `<meta name="description" content="${esc(desc)}">`,
    page.noindex && `<meta name="robots" content="noindex, nofollow">`,
    site.url && !page.noindex && `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    desc && `<meta property="og:description" content="${esc(desc)}">`,
    site.url && `<meta property="og:url" content="${esc(url)}">`,
    img && !page.noindex && `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">`,
    `<script>document.documentElement.classList.add('js')</script>`,
    `<meta name="theme-color" content="${site.colors.background}">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="stylesheet" href="${FONTS[site.fonts].url}">`,
    `<style>${themeCss(site)}</style>`,
    `<link rel="stylesheet" href="${assets['style.css']}">`,
    page.extraHead || '',
    ld && `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n');
}

const links = (items, current) => items.map(([label, href]) =>
  `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');

// A framed picture that always fills its box (object-fit), whatever shape the owner's photo is.
export function fill(meta, { ratio, sizes, alt = '', cls = '', eager = false }) {
  return `<div class="fill ${cls}" style="aspect-ratio:${ratio}">${picture(meta, { alt, sizes, eager })}</div>`;
}
// A photo keeps its own proportions (only extreme panoramas or slivers are trimmed), so nothing the owner shot is cropped away.
const natural = (m) => `${Math.min(2.2, Math.max(0.55, m.width / m.height)).toFixed(4)}`;
const cap = (t) => (t ? `<figcaption>${esc(t)}</figcaption>` : '');
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s);

// ---------- header / footer ----------
// Wordmark left, three plain links centred, one filled action at the right.
export function header(ctx, current) {
  const mid = ctx.nav.filter(([, href]) => href !== '/contact');
  return `<header class="site-header"><a class="wordmark" href="/">${esc(ctx.site.name)}</a>` +
    `<button class="nav-toggle" aria-expanded="false" aria-controls="nav"><span class="sr">Menu</span><span class="bars" aria-hidden="true"></span></button>` +
    `<nav id="nav" class="nav" aria-label="Main"><div class="nav__links">${links(mid, current)}</div>` +
    `<a class="btn" href="/contact">Enquire</a></nav></header>`;
}

// The footer is the last photograph, darkened evenly, with the name across the bottom.
export function footer({ site, nav, footerPhoto }) {
  const words = site.name.split(/\s+/);
  const half = Math.ceil(words.length / 2);
  const lines = words.length > 1 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [site.name];
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(20, 100 / (longest * 0.56)).toFixed(1);
  const contact = [
    site.email && `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`,
    site.phone && `<a href="tel:${esc(site.phone.replace(/[^+\d]/g, ''))}">${esc(site.phone)}</a>`,
    site.location && `<span>${esc(site.location)}</span>`,
    site.instagram && `<a href="${esc(instagramUrl(site.instagram))}" rel="noopener">Instagram</a>`,
  ].filter(Boolean).join('');
  return `<footer class="foot">${footerPhoto ? `<div class="foot__img">${picture(footerPhoto, { alt: '', sizes: '100vw' })}</div>` : ''}` +
    `<div class="foot__top reveal"><ul>${nav.map(([l, h]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul>` +
    `<div class="foot__contact">${contact}</div></div>` +
    `<a class="foot__mark reveal" href="/" style="--mark:${size}vw" aria-label="${esc(site.name)}, home">${lines.map((l) => `<span>${esc(l)}</span>`).join('')}</a>` +
    `<p class="foot__legal reveal">&copy; ${new Date().getFullYear()} ${esc(site.name)}</p></footer>`;
}

// ---------- home: hero (three prints, one line) ----------
export function hero(ctx, { tall, wide, sq }) {
  const { site } = ctx;
  const fig = (cls, p, ratio, sizes, eager = false) => p
    ? `<figure class="print print--${cls}">${fill(p.meta, { ratio, sizes, alt: p.alt, eager })}${cap(p.caption)}</figure>` : '';
  const line = firstSentence(site.description);
  return `<section class="hero">${fig('sq', sq, '1/1', '190px')}` +
    `<div class="hero__text"><h1>${esc(site.tagline || site.name)}</h1>${line ? `<p>${esc(line)}</p>` : ''}</div>` +
    `${fig('tall', tall, '9/10', '(min-width: 900px) 34vw, 72vw', true)}${fig('wide', wide, '16/10', '(min-width: 900px) 34vw, 100vw')}</section>`;
}

// ---------- home: intro (title, note, facts row) ----------
export function intro(h) {
  const facts = h.facts.length ? `<ul class="facts">${h.facts.map((f) =>
    `<li class="reveal"><strong>${esc(f.value)}</strong>${f.label ? `<span>${esc(f.label)}</span>` : ''}</li>`).join('')}</ul>` : '';
  return `<section class="intro"><div class="intro__row"><h2 class="reveal">${esc(h.title)}</h2>` +
    `<p class="intro__note reveal">${esc(h.intro)}</p></div>${facts}</section>`;
}

// ---------- work: staggered tiles with empty cells ----------
const PATTERN = [[1, 3, 1, 'wide'], [4, 5, 1, 'one'], [2, 3, 2, 'one'], [3, 4, 2, 'one'], [3, 5, 3, 'wide'], [1, 2, 3, 'one']];
const count = (n) => `${n} photo${n === 1 ? '' : 's'}`;
export function work(items, { level = 'h2', title = 'Galleries', blurb = '', sectionClass = '' } = {}) {
  let single = 0;
  const tiles = items.map((it, i) => {
    const [c1, c2, r, kind] = PATTERN[i % PATTERN.length];
    const row = r + Math.floor(i / PATTERN.length) * 3;
    const side = kind === 'one' ? (single++ % 2 ? 'r' : 'l') : '';
    const w = kind === 'wide';
    return `<li class="t t--${kind} ${side ? 'm-' + side : ''} wipe" style="--c:${c1}/${c2};--r:${row}"><a href="${it.href}">` +
      fill(it.meta, { ratio: natural(it.meta), sizes: w ? '(min-width: 900px) 50vw, 100vw' : '(min-width: 900px) 25vw, 50vw' }) +
      `<span class="t__cap"><span>${esc(it.title)}</span><span>${count(it.n)}</span></span></a></li>`;
  }).join('');
  return `<section class="work ${sectionClass}"><ul class="work__grid">` +
    `<li class="work__title reveal" style="--c:3/4;--r:1"><${level}>${esc(title)}</${level}>${blurb ? `<p>${esc(blurb)}</p>` : ''}</li>${tiles}</ul></section>`;
}

// ---------- gallery wall: photographs hung at different sizes ----------
const WALL = [
  [{ c: '1/6', off: 0 }, { c: '7/13', off: '10vh' }],
  [{ c: '5/12', off: 0 }, { c: '1/4', off: '10vh' }],
  [{ c: '8/13', off: 0 }, { c: '1/7', off: '10vh' }],
  [{ c: '2/8', off: 0 }, { c: '9/13', off: '10vh' }],
];
export function wall(photos) {
  const pairs = [];
  for (let i = 0; i < photos.length; i += 2) pairs.push(photos.slice(i, i + 2));
  const html = pairs.map((pair, p) => `<div class="wall__pair">${pair.map((ph, k) => {
    const s = WALL[p % WALL.length][k];
    return `<figure class="w wipe m${(p * 2 + k) % 4}" style="--c:${s.c};--off:${s.off}">${fill(ph.meta, { ratio: natural(ph.meta), sizes: '(min-width: 900px) 45vw, 90vw', alt: ph.alt })}${cap(ph.caption)}</figure>`;
  }).join('')}</div>`).join('');
  return `<section class="wall" aria-labelledby="wall-h"><h2 class="sr" id="wall-h">Selected photographs</h2>${html}</section>`;
}

// ---------- moments: the day, hour by hour (a row you drag, and choose how much of the day you want covered) ----------
const GAPS = [80, 124, 96, 140, 88, 130];
export function moments(h, items) {
  if (!items.length) return '';
  const cover = h.coverage.length ? `<div class="cover" hidden><p id="cover-h">How long would you like me there?</p>` +
    `<div class="cover__btns" role="group" aria-labelledby="cover-h">${h.coverage.map((n) => `<button type="button" data-hours="${n}" aria-pressed="false">${n} hours</button>`).join('')}` +
    `<button type="button" data-hours="all" aria-pressed="true">All day</button></div><p class="cover__status" role="status" aria-live="polite"></p></div>` : '';
  const cols = items.map((m, i) => `<li data-at="${Number.isFinite(Number(m.at)) ? Number(m.at) : 0}"><h3>${esc(m.title)}</h3>${m.text ? `<p>${esc(m.text)}</p>` : ''}` +
    `<div class="gap" style="height:${GAPS[i % GAPS.length]}px"></div>${fill(m.meta, { ratio: '4/5', sizes: '280px', alt: m.alt || '' })}</li>`).join('');
  return `<section class="moments" aria-labelledby="mt"><div class="moments__head"><h2 id="mt">${esc(h.momentsTitle)}</h2>${cover}` +
    `<div class="moments__btns"><button type="button" data-dir="-1" aria-label="Earlier moments">&larr;</button><button type="button" data-dir="1" aria-label="Later moments">&rarr;</button></div></div>` +
    `<div class="bar" aria-hidden="true"><span></span></div><ol class="moments__row" tabindex="0" aria-label="${esc(h.momentsTitle)}">${cols}</ol></section>`;
}

// ---------- testimonial: the quotation on the photograph ----------
export function quote(t, meta) {
  if (!t) return '';
  return `<section class="quote" aria-labelledby="q-h"><h2 class="sr" id="q-h">In their words</h2>` +
    `${meta ? `<div class="quote__img">${picture(meta, { alt: '', sizes: '100vw' })}</div>` : ''}` +
    `<blockquote class="reveal"><p>&ldquo;${esc(t.quote)}&rdquo;</p></blockquote>` +
    `<p class="quote__who reveal">${esc(t.name || '')}${t.role ? `, ${esc(t.role)}` : ''}</p></section>`;
}

// ---------- close: three photographs, then a band with the one link ----------
export function close(ctx, strip, portrait, { band = true } = {}) {
  const { site } = ctx;
  const h = site.home;
  const stripHtml = `<div class="close__strip">${strip.map((m) => `<div class="wipe"><div class="fill">${picture(m, { alt: '', sizes: '34vw' })}</div></div>`).join('')}</div>`;
  if (!band) return `<section class="close close--strip" aria-label="More photographs">${stripHtml}</section>`;
  const sub = ['I reply within a couple of days.', site.email, site.phone].filter(Boolean).map(esc).join(' &middot; ');
  return `<section class="close" aria-labelledby="close-h"><h2 class="sr" id="close-h">Get in touch</h2>` +
    stripHtml +
    `<div class="close__band"><div class="close__text reveal"><p class="close__line">${esc(h.closing)} <a href="/contact">${esc(h.closingLink)}</a></p>` +
    `<p class="close__sub">${sub}</p></div>` +
    `${portrait ? `<div class="close__who">${fill(portrait, { ratio: '4/5', sizes: '150px' })}</div>` : ''}</div></section>`;
}

// page title row used on inner pages
export function pageHead(title, text) {
  return `<section class="phead"><h1 class="reveal">${esc(title)}</h1>${text ? `<p class="reveal">${esc(text)}</p>` : ''}</section>`;
}
