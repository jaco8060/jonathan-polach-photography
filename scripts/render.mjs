// HTML building blocks. Everything is plain strings so the output is static and fast.
import { FONTS, GUTTERS } from './content.mjs';

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
    `--font-head:${f.heading};--font-body:${f.body};--gutter:${GUTTERS[site.gutter]}}`;
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

// Logo in the middle, links split on either side (stacked in a drop-down on phones).
export function header(ctx, current, overHero = false) {
  const half = Math.ceil(ctx.nav.length / 2);
  return `<header class="site-header${overHero ? ' on-hero' : ''}"><a class="wordmark" href="/">${esc(ctx.site.name)}</a>` +
    `<button class="nav-toggle" aria-expanded="false" aria-controls="nav"><span class="sr">Menu</span><span class="bars" aria-hidden="true"></span></button>` +
    `<nav id="nav" class="nav" aria-label="Main"><div class="nav__l">${links(ctx.nav.slice(0, half), current)}</div>` +
    `<div class="nav__r">${links(ctx.nav.slice(half), current)}</div></nav></header>`;
}

export function footer({ site, nav }) {
  const col = (title, body) => body ? `<div><h2 class="eyebrow">${title}</h2>${body}</div>` : '';
  const contact = [
    site.email && `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`,
    site.phone && `<a href="tel:${esc(site.phone.replace(/[^+\d]/g, ''))}">${esc(site.phone)}</a>`,
    site.location && `<span>${esc(site.location)}</span>`,
  ].filter(Boolean).join('');
  const social = site.instagram ? `<a href="${esc(instagramUrl(site.instagram))}" rel="noopener">Instagram</a>` : '';
  return `<footer class="site-footer"><div class="footer__top"><a class="footer__mark" href="/">${esc(site.name)}</a>` +
    `${site.tagline ? `<p>${esc(site.tagline)}</p>` : ''}</div><div class="footer__cols">` +
    col('Explore', links(nav)) + col('Say hello', contact) + col('Follow', social) +
    `</div><p class="footer__small">&copy; ${new Date().getFullYear()} ${esc(site.name)}</p></footer>`;
}

export function hero(ctx, slides) {
  const { site } = ctx;
  const imgs = slides.map((m, i) =>
    `<div class="slide${i === 0 ? ' is-active' : ''}">${picture(m, { alt: '', sizes: SIZES.hero, eager: i === 0 })}</div>`).join('');
  return `<section class="hero" data-mode="${site.hero.mode}"${slides.length ? '' : ' data-empty'}>` +
    `<div class="hero__slides" aria-hidden="true">${imgs}</div>` +
    `<div class="hero__text">${site.tagline ? `<p class="eyebrow">${esc(site.name)}</p><h1>${esc(site.tagline)}</h1>` : `<h1>${esc(site.name)}</h1>`}` +
    `<a class="btn btn--light" href="/portfolio">View the portfolio</a></div>` +
    `<a class="hero__cue" href="#start" aria-label="Scroll down"><span></span></a></section>`;
}

const pad = (i) => String(i + 1).padStart(2, '0');
const count = (n) => `${n} photo${n === 1 ? '' : 's'}`;

// Portfolio page: tall tiles, every second one dropped for an editorial stagger.
export function tiles(items) {
  return `<ul class="tiles">${items.map(({ href, title, meta, n }, i) =>
    `<li class="reveal"><a href="${href}"><span class="tile__img">${picture(meta, { alt: '', sizes: SIZES.card })}</span>` +
    `<span class="tile__meta"><span class="eyebrow">${pad(i)}</span><strong>${esc(title)}</strong><small>${count(n)}</small></span></a></li>`).join('')}</ul>`;
}

// Home page: big alternating "stories".
export function stories(items) {
  return items.map(({ href, title, description, meta }, i) =>
    `<article class="story reveal"><a class="story__img" href="${href}" tabindex="-1" aria-hidden="true">${picture(meta, { alt: '', sizes: '(min-width: 900px) 55vw, 100vw' })}</a>` +
    `<div class="story__text"><span class="eyebrow">${pad(i)}</span><h3><a href="${href}">${esc(title)}</a></h3>` +
    `${description ? `<p>${esc(description)}</p>` : ''}<a class="link" href="${href}">View the gallery</a></div></article>`).join('');
}

// Horizontal strip of loose photos.
export function strip(items) {
  return `<div class="strip" role="group" aria-label="More photos" tabindex="0">${items.map(({ meta, alt }) =>
    `<div class="strip__item" style="--ar:${(meta.width / meta.height).toFixed(4)}">${picture(meta, { alt, sizes: '(min-width: 900px) 30vw, 70vw' })}</div>`).join('')}</div>`;
}
