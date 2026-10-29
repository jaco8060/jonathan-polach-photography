// Cloudflare Pages build: content/ + src/ -> dist/
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ROOT, ContentError, warnings, warn, loadSite, indexPhotos, findPhoto, loadGalleries, readMarkdown,
} from './content.mjs';
import { processImage, mapLimit } from './images.mjs';
import { esc, picture, fill, galleryHtml, head, header, footer, hero, intro, work, wall, moments, quote, close, pageHead } from './render.mjs';

const DIST = path.join(ROOT, 'dist');
// Animation library (deferred, so it never blocks the first paint). Pinned version + integrity hash.
const GSAP_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5';
const gsapTag = (file, hash) => `<script src="${GSAP_BASE}/${file}" integrity="sha384-${hash}" crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>`;
const GSAP_TAGS = gsapTag('gsap.min.js', 'g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt') +
  gsapTag('ScrollTrigger.min.js', 'Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d');
const p = (...a) => path.join(ROOT, ...a);

async function build() {
  const t0 = Date.now();
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });

  // ---- static files & fingerprinted assets
  for (const f of ['_headers', '_redirects']) await fs.copyFile(p(f), path.join(DIST, f));
  await fs.copyFile(p('src/favicon.svg'), path.join(DIST, 'favicon.svg'));
  const assets = {};
  for (const f of await fs.readdir(p('src/assets'))) {
    const buf = await fs.readFile(p('src/assets', f));
    const ext = path.extname(f);
    const name = `${path.basename(f, ext)}.${createHash('sha1').update(buf).digest('hex').slice(0, 8)}${ext}`;
    await fs.writeFile(path.join(DIST, 'assets', name), buf);
    assets[f] = `/assets/${name}`;
  }

  // ---- content
  const site = await loadSite();
  const photos = await indexPhotos(p('content/photos'));
  const galleries = await loadGalleries(p('content/galleries'), photos);
  let clients = [];
  const clientPhotos = await indexPhotos(p('content/client-photos'));
  if (site.clientsEnabled) clients = await loadGalleries(p('content/clients'), clientPhotos);
  else console.log('  Private client galleries are switched off in Site settings, so none were built.');
  const about = await readMarkdown(p('content/about.md'));
  const services = await readMarkdown(p('content/services.md'));

  // ---- images
  // Every photograph the page needs is prepared once, whichever section asks for it.
  const pub = { outDir: path.join(DIST, 'img'), urlBase: '/img' };
  const priv = { outDir: path.join(DIST, 'clients/img'), urlBase: '/clients/img' };
  const jobs = new Map();
  const job = (src, opts = pub) => { const k = src + '|' + opts.urlBase; if (!jobs.has(k)) jobs.set(k, { src, opts }); return jobs.get(k); };
  const refJob = (ref, where) => {
    if (!ref) return null;
    const src = findPhoto(photos, ref);
    if (!src) { warn(where + ': the photo "' + ref + '" was not found in content/photos, so it was skipped.'); return null; }
    return job(src);
  };
  for (const g of [...galleries, ...clients]) {
    const opts = clients.includes(g) ? priv : pub;
    g.coverJob = job(g.cover, opts);
    for (const ph of g.photos) ph.job = job(ph.src, opts);
  }
  const notes = new Map(); // what the owner wrote about a photo, found by file
  for (const g of galleries) for (const ph of g.photos) if (!notes.has(ph.src)) notes.set(ph.src, { alt: ph.alt, caption: ph.caption });

  const printJobs = site.hero.images.slice(0, 3).map((f) => {
    const j = refJob(f, 'Site settings (home page photos)');
    return j && { job: j, ...(notes.get(j.src) ?? {}) };
  });
  const aboutJob = about?.meta.photo ? refJob(about.meta.photo, 'About page') : null;
  const h = site.home;
  const momentJobs = h.moments.map((m) => ({ ...m, job: refJob(m.photo, 'Site settings (day moments)') }));
  const quoteJob = h.testimonial?.photo ? refJob(h.testimonial.photo, 'Site settings (testimonial)') : null;

  const publicPhotos = galleries.flatMap((g) => g.photos.map((ph) => ({ job: ph.job, alt: ph.alt, caption: ph.caption })));
  // spread picks across everything the owner has, so the page never shows one gallery's mood only
  const pick = (n, offset = 0) => {
    if (!publicPhotos.length) return [];
    const take = Math.min(n, publicPhotos.length);
    return Array.from({ length: take }, (_, i) => publicPhotos[(Math.floor(i * publicPhotos.length / take) + offset) % publicPhotos.length]);
  };
  const wallPicks = pick(8);
  const stripPicks = pick(3, 1);
  const footerPick = publicPhotos.at(-1) ?? null;
  const quotePick = quoteJob ? { job: quoteJob } : pick(1, 2)[0];
  const portraitPick = aboutJob ? { job: aboutJob } : pick(1, 3)[0];
  for (const j of [...printJobs, ...momentJobs].map((x) => x && x.job)) if (j) jobs.set(j.src + '|' + j.opts.urlBase, j);

  console.log('  Preparing ' + new Set([...jobs.values()].map((j) => j.src)).size + ' photos (this is the slow part)...');
  await mapLimit([...jobs.values()], 3, async (j) => { j.meta = await processImage(j.src, j.opts); });

  // ---- pages
  const layoutHtml = await fs.readFile(p('src/layout.html'), 'utf8');
  const nav = [['Portfolio', '/portfolio'], ...(about ? [['About', '/about']] : []),
    ...(services ? [['Services', '/services']] : []), ['Contact', '/contact']];
  const ctx = { site, assets, nav, footerPhoto: footerPick?.job.meta };
  const urls = [];
  const fillTpl = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? '');
  const metaOf = (x) => x?.job?.meta;
  const withMeta = (xs) => xs.filter((x) => x?.job?.meta).map((x) => ({ meta: x.job.meta, alt: x.alt || '', caption: x.caption || '' }));

  async function writePage(file, page, main, { scripts = '' } = {}) {
    const html = fillTpl(layoutHtml, {
      head: head(ctx, page), header: header(ctx, page.nav ?? page.path), main, footer: footer(ctx),
      bodyClass: page.bodyClass || '',
      scripts: GSAP_TAGS + '<script src="' + assets['site.js'] + '" defer></script>' + scripts,
    });
    const out = path.join(DIST, file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, html);
    if (!page.noindex && file !== '404.html') urls.push(page.path);
  }
  const ogImage = (m) => m && m.base + '-' + ([...m.widths].reverse().find((w) => w <= 1200) ?? m.widths[0]) + '.jpg';
  const heroOg = ogImage(metaOf(printJobs[0]) ?? galleries[0]?.coverJob.meta);
  const stagger = (html) => html.replace(/<(h2|p|table|ul|ol)>/g, '<$1 class="reveal">'); // each block of text arrives on its own
  const closeHtml = close(ctx, stripPicks.map((x) => x.job.meta), metaOf(portraitPick));

  // home
  const items = galleries.map((g) => ({ href: '/portfolio/' + g.slug + '/', title: g.title, meta: g.coverJob.meta, n: g.photos.length }));
  const prints = {
    tall: printJobs[0] && { meta: printJobs[0].job.meta, alt: printJobs[0].alt, caption: printJobs[0].caption },
    wide: printJobs[1] && { meta: printJobs[1].job.meta, alt: printJobs[1].alt, caption: printJobs[1].caption },
    sq: printJobs[2] && { meta: printJobs[2].job.meta, alt: printJobs[2].alt, caption: '' },
  };
  if (!prints.tall && wallPicks[0]) prints.tall = { meta: wallPicks[0].job.meta, alt: wallPicks[0].alt, caption: wallPicks[0].caption };
  const dayPool = pick(Math.max(h.moments.length, 1), 1);
  const momentItems = momentJobs.map((m, i) => ({ ...m, meta: m.job?.meta ?? dayPool[i % Math.max(dayPool.length, 1)]?.job.meta })).filter((m) => m.meta);
  const homeMain = hero(ctx, prints) +
    (h.title || h.facts.length ? intro(h) : '') +
    (items.length ? work(items) : '') +
    (wallPicks.length ? wall(withMeta(wallPicks)) : '') +
    moments(h, momentItems) +
    quote(h.testimonial, metaOf(quotePick)) +
    closeHtml;
  await writePage('index.html', { home: true, path: '/', image: heroOg, nav: '/' }, homeMain);

  // portfolio index
  await writePage('portfolio/index.html', { title: 'Portfolio', path: '/portfolio', image: heroOg },
    items.length ? work(items, { level: 'h1', title: 'Portfolio', blurb: 'Choose a gallery to see the whole story.', sectionClass: 'work--page' }) + closeHtml : pageHead('Portfolio', 'Galleries are coming soon.'));

  // gallery pages (public + private share one template)
  const lightbox = '<script type="module" src="' + assets['lightbox.js'] + '"></script>';
  async function galleryPage(g, list, i, base, isClient) {
    const layout = g.layout ?? site.layout;
    const next = list[(i + 1) % list.length];
    const body = pageHead(g.title, g.description) + (g.note ? '<p class="note">' + esc(g.note) + '</p>' : '') +
      galleryHtml(g, layout, g.photos.map((ph) => ({ meta: ph.job.meta, alt: ph.alt, caption: ph.caption }))) +
      (isClient ? '' : '<nav class="gallery-nav"><a href="/portfolio">&larr; All galleries</a>' +
        (list.length > 1 ? '<a href="' + base + '/' + next.slug + '/">Next: ' + esc(next.title) + ' &rarr;</a>' : '') + '</nav>' + closeHtml);
    await writePage(base.slice(1) + '/' + g.slug + '/index.html', {
      title: g.title, description: g.description || g.title + ' by ' + site.name, path: base + '/' + g.slug + '/',
      image: ogImage(g.coverJob.meta), noindex: isClient, nav: '/portfolio',
    }, body, { scripts: lightbox });
  }
  for (const [i, g] of galleries.entries()) await galleryPage(g, galleries, i, '/portfolio', false);
  for (const [i, g] of clients.entries()) await galleryPage(g, clients, i, '/clients', true);

  // about / services
  if (about) {
    const photo = aboutJob ? '<div class="about__photo wipe">' + fill(aboutJob.meta, { ratio: '4/5', sizes: '(min-width: 900px) 40vw, 100vw', alt: about.meta.photoAlt || 'Portrait of ' + site.name }) + '</div>' : '';
    await writePage('about.html', { title: about.meta.title || 'About', path: '/about', description: about.meta.description, image: aboutJob && ogImage(aboutJob.meta) },
      '<section class="about">' + photo + '<div class="prose"><h1 class="reveal">' + esc(about.meta.title || 'About') + '</h1>' + stagger(about.html) + '</div></section>' + closeHtml);
  }
  if (services) {
    await writePage('services.html', { title: services.meta.title || 'Services', path: '/services', description: services.meta.description, image: heroOg },
      '<section class="prose prose--wide"><h1 class="reveal">' + esc(services.meta.title || 'Services') + '</h1>' + stagger(services.html) + '</section>' + closeHtml);
  }

  // contact
  const c = site.contact;
  const needsKey = { web3forms: c.web3formsKey, formspree: c.formspreeId, function: c.turnstileSiteKey }[c.method];
  if (!needsKey) warn(`Contact form: the "${c.method}" setting is empty, so the form will show your email address instead of sending.`);
  const details = [
    site.email && `<p><strong>Email</strong><br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>`,
    site.phone && `<p><strong>Phone</strong><br><a href="tel:${esc(site.phone.replace(/[^+\d]/g, ''))}">${esc(site.phone)}</a></p>`,
    site.location && `<p><strong>Based in</strong><br>${esc(site.location)}</p>`,
  ].filter(Boolean).join('');
  const turnstile = c.method === 'function' && c.turnstileSiteKey
    ? `<div class="cf-turnstile" data-sitekey="${esc(c.turnstileSiteKey)}" data-theme="auto"></div>` : '';
  const contactTpl = await fs.readFile(p('src/contact.html'), 'utf8');
  const key = c.method === 'web3forms' ? c.web3formsKey : c.method === 'formspree' ? c.formspreeId : '';
  await writePage('contact.html', { title: 'Contact', path: '/contact', image: heroOg },
    fillTpl(contactTpl, {
      intro: esc(c.intro || 'Tell me a little about your plans and I will reply within a couple of days.'),
      method: needsKey ? c.method : 'mailto', key: esc(key), email: esc(site.email), turnstile, details,
      shootOptions: c.shootTypes.map((t) => `<option>${esc(t)}</option>`).join(''),
    }) + close(ctx, stripPicks.map((x) => x.job.meta), null, { band: false }),
    { scripts: `<script src="${assets['contact.js']}" defer></script>` +
      (turnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '') });

  // 404
  await writePage('404.html', { title: 'Page not found', path: '/404', noindex: true },
    `pageHead("That page isn't here", 'It may have moved. Try the portfolio or the home page.')`);

  // robots + sitemap
  const abs = (u) => (site.url || '') + u;
  await fs.writeFile(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n') + `\n</urlset>\n`);
  await fs.writeFile(path.join(DIST, 'robots.txt'),
    `User-agent: *\nDisallow: /clients/\n${site.url ? `Sitemap: ${site.url}/sitemap.xml\n` : ''}`);

  const noAlt = [...galleries, ...clients].flatMap((g) => g.photos).filter((ph) => !ph.alt && !ph.caption).length;
  if (noAlt) warn(`${noAlt} photo(s) have no description (alt text) or caption. Adding one helps blind visitors and Google.`);
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${galleries.length} galleries, ${clients.length} client galleries, ${urls.length} pages.` +
    (warnings.length ? ` ${warnings.length} warning(s) above.` : ''));
}

build().catch((e) => {
  if (e instanceof ContentError) {
    console.error(`\nBUILD STOPPED. Nothing was published; your live site is unchanged.\n\n  ${e.message}\n`);
  } else console.error(e);
  process.exit(1);
});
