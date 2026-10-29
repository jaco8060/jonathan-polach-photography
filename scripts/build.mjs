// Cloudflare Pages build: content/ + src/ -> dist/
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ROOT, ContentError, warnings, warn, loadSite, indexPhotos, findPhoto, loadGalleries, readMarkdown,
} from './content.mjs';
import { processImage, mapLimit } from './images.mjs';
import { esc, picture, galleryHtml, head, header, footer, hero, tiles, stories, strip } from './render.mjs';

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
  const pub = { outDir: path.join(DIST, 'img'), urlBase: '/img' };
  const priv = { outDir: path.join(DIST, 'clients/img'), urlBase: '/clients/img' };
  const heroSrcs = site.hero.images.map((f) => {
    const src = findPhoto(photos, f);
    if (!src) warn(`Site settings: the hero photo "${f}" was not found in content/photos, so it was skipped.`);
    return src;
  }).filter(Boolean);
  if (!heroSrcs.length && galleries[0]) heroSrcs.push(galleries[0].cover);
  const aboutSrc = about?.meta.photo ? findPhoto(photos, about.meta.photo) : null;
  if (about?.meta.photo && !aboutSrc) warn(`About page: the photo "${about.meta.photo}" was not found in content/photos, so it was skipped.`);

  const jobs = [];
  const add = (src, opts) => { const job = { src, opts }; jobs.push(job); return job; };
  const heroJobs = heroSrcs.map((s) => add(s, pub));
  const aboutJob = aboutSrc && add(aboutSrc, pub);
  for (const g of [...galleries, ...clients]) {
    const opts = clients.includes(g) ? priv : pub;
    g.cover = add(g.cover, opts);
    for (const ph of g.photos) ph.job = add(ph.src, opts);
  }
  console.log(`  Preparing ${new Set(jobs.map((j) => j.src)).size} photos (this is the slow part)...`);
  await mapLimit(jobs, 3, async (j) => { j.meta = await processImage(j.src, j.opts); });

  // ---- pages
  const layoutHtml = await fs.readFile(p('src/layout.html'), 'utf8');
  const nav = [['Portfolio', '/portfolio'], ...(about ? [['About', '/about']] : []),
    ...(services ? [['Services', '/services']] : []), ['Contact', '/contact']];
  const ctx = { site, assets, nav };
  const urls = [];
  const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? '');

  async function writePage(file, page, main, { scripts = '' } = {}) {
    const html = fill(layoutHtml, {
      head: head(ctx, page), header: header(ctx, page.nav ?? page.path, page.home), main, footer: footer(ctx),
      bodyClass: page.bodyClass || '',
      scripts: `${GSAP_TAGS}<script src="${assets['site.js']}" defer></script>${scripts}`,
    });
    const out = path.join(DIST, file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, html);
    if (!page.noindex && file !== '404.html') urls.push(page.path);
  }
  const heading = (title, text) => `<section class="page-head"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</section>`;
  const ogImage = (g) => g && `${g.meta.base}-${[...g.meta.widths].reverse().find((w) => w <= 1200) ?? g.meta.widths[0]}.jpg`;
  const heroOg = ogImage(heroJobs[0]);

  // home
  const cardItems = galleries.map((g) => ({ href: `/portfolio/${g.slug}/`, title: g.title, description: g.description, meta: g.cover.meta, n: g.photos.length }));
  const pool = galleries.flatMap((g) => g.photos.map((ph) => ({ meta: ph.job.meta, alt: ph.alt || ph.caption })));
  const portrait = pool.filter((x) => x.meta.height > x.meta.width);
  const introPics = [portrait[0] ?? pool[0], portrait[1] ?? pool[1]].filter(Boolean);
  const stripPics = pool.length > 4 ? Array.from({ length: Math.min(8, pool.length) }, (_, i) => pool[Math.floor(i * pool.length / Math.min(8, pool.length))]) : [];
  const ctaBg = (heroJobs[1] ?? heroJobs[0])?.meta;
  const cta = `<section class="cta"${ctaBg ? ' data-bg' : ''}>${ctaBg ? picture(ctaBg, { alt: '', sizes: '100vw' }) : ''}<div class="cta__inner reveal"><p class="eyebrow">Let's talk</p><h2>Planning something? I'd love to hear about it.</h2><a class="btn btn--light" href="/contact">Get in touch</a></div></section>`;
  const h = site.home;
  const homeMain = hero(ctx, heroJobs.map((j) => j.meta)) + '<span id="start"></span>' +
    (h.intro ? `<section class="intro"><div class="intro__text reveal"><p class="eyebrow">Hello</p><p class="intro__lead">${esc(h.intro)}</p>${about ? '<a class="link" href="/about">More about me</a>' : ''}</div>` +
      (introPics.length ? `<div class="intro__pics reveal">${introPics.map((x, i) => `<div class="intro__pic intro__pic--${i + 1}">${picture(x.meta, { alt: x.alt, sizes: '(min-width: 900px) 25vw, 60vw' })}</div>`).join('')}</div>` : '') + '</section>' : '') +
    (cardItems.length ? `<section class="section"><p class="eyebrow">Selected work</p><h2 class="section__title">Recent stories</h2>${stories(cardItems.slice(0, 4))}</section>` : '') +
    (stripPics.length ? strip(stripPics) : '') +
    (h.process.length ? `<section class="process"><h2 class="section__title">How it works</h2><ol>${h.process.map((s, i) => `<li class="reveal"><span class="eyebrow">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.text || '')}</p></li>`).join('')}</ol></section>` : '') +
    (h.testimonials.length ? `<section class="quotes">${h.testimonials.map((t) => `<figure class="reveal"><blockquote>${esc(t.quote)}</blockquote>${t.name ? `<figcaption>${esc(t.name)}</figcaption>` : ''}</figure>`).join('')}</section>` : '') +
    cta;
  await writePage('index.html', { home: true, path: '/', image: heroOg, nav: '/' }, homeMain);

  // portfolio index
  await writePage('portfolio/index.html', { title: 'Portfolio', path: '/portfolio', image: heroOg },
    heading('Portfolio', 'Choose a gallery.') + (galleries.length ? tiles(cardItems) : '<p class="empty">Galleries are coming soon.</p>'));

  // gallery pages (public + private share one template)
  const lightbox = `<script type="module" src="${assets['lightbox.js']}"></script>`;
  async function galleryPage(g, list, i, base, isClient) {
    const layout = g.layout ?? site.layout;
    const next = list[(i + 1) % list.length];
    const body = heading(g.title, g.description) + (g.note ? `<p class="note">${esc(g.note)}</p>` : '') +
      galleryHtml(g, layout, g.photos.map((ph) => ({ meta: ph.job.meta, alt: ph.alt, caption: ph.caption }))) +
      (isClient ? '' : `<nav class="gallery-nav"><a href="/portfolio">&larr; All galleries</a>` +
        (list.length > 1 ? `<a href="${base}/${next.slug}/">Next: ${esc(next.title)} &rarr;</a>` : '') + `</nav>` + cta);
    await writePage(`${base.slice(1)}/${g.slug}/index.html`, {
      title: g.title, description: g.description || `${g.title} by ${site.name}`, path: `${base}/${g.slug}/`,
      image: ogImage(g.cover), noindex: isClient, nav: '/portfolio',
    }, body, { scripts: lightbox });
  }
  for (const [i, g] of galleries.entries()) await galleryPage(g, galleries, i, '/portfolio', false);
  for (const [i, g] of clients.entries()) await galleryPage(g, clients, i, '/clients', true);

  // about / services
  if (about) {
    const photo = aboutJob ? `<div class="about__photo">${picture(aboutJob.meta, { alt: about.meta.photoAlt || `Portrait of ${site.name}`, sizes: '(min-width: 900px) 40vw, 100vw' })}</div>` : '';
    await writePage('about.html', { title: about.meta.title || 'About', path: '/about', description: about.meta.description, image: aboutJob && ogImage(aboutJob) },
      `<section class="about">${photo}<div class="prose"><h1>${esc(about.meta.title || 'About')}</h1>${about.html}</div></section>${cta}`);
  }
  if (services) {
    await writePage('services.html', { title: services.meta.title || 'Services', path: '/services', description: services.meta.description, image: heroOg },
      `<section class="prose prose--wide"><h1>${esc(services.meta.title || 'Services')}</h1>${services.html}</section>${cta}`);
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
    fill(contactTpl, {
      intro: esc(c.intro || 'Tell me a little about your plans and I will reply within a couple of days.'),
      method: needsKey ? c.method : 'mailto', key: esc(key), email: esc(site.email), turnstile, details,
      shootOptions: c.shootTypes.map((t) => `<option>${esc(t)}</option>`).join(''),
    }),
    { scripts: `<script src="${assets['contact.js']}" defer></script>` +
      (turnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '') });

  // 404
  await writePage('404.html', { title: 'Page not found', path: '/404', noindex: true },
    `<section class="page-head"><h1>That page isn't here</h1><p>It may have moved. Try the <a href="/portfolio">portfolio</a> or <a href="/">home page</a>.</p></section>`);

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
