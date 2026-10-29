// Mobile menu, the "day, hour by hour" row, and scroll animations (GSAP + ScrollTrigger).
// Everything here is an enhancement: the site is fully readable if this file or GSAP fails to load.
// Animations only touch transform, opacity and clip-path, so they never force the browser to re-layout the page.
document.documentElement.classList.add('ready');

const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// ---- The day, hour by hour: drag the row, step with the buttons, and choose how much of the day you want covered.
const section = document.querySelector('.moments');
if (section) {
  const row = section.querySelector('.moments__row');
  const thumb = section.querySelector('.bar span');
  const moments = [...row.children];

  const sync = () => {
    const max = row.scrollWidth - row.clientWidth;
    const share = max > 0 ? row.clientWidth / row.scrollWidth : 1;
    const at = max > 0 ? row.scrollLeft / max : 0;
    thumb.style.width = `${share * 100}%`;
    thumb.style.transform = `translateX(${at * (1 / share - 1) * 100}%)`;
  };
  row.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  addEventListener('resize', sync);
  sync();

  section.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () =>
    row.scrollBy({ left: Number(b.dataset.dir) * 312, behavior: 'smooth' })));
  row.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      row.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * 312, behavior: 'smooth' });
    }
  });

  // mouse drag (touch and trackpads already scroll natively)
  let down = null;
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = { x: e.clientX, left: row.scrollLeft };
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    row.classList.add('is-drag');
    row.scrollLeft = down.left - (e.clientX - down.x);
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = null;
    row.classList.remove('is-drag');
  });

  // How long would you like me there? Moments outside the chosen time fade back.
  const cover = section.querySelector('.cover');
  if (cover) {
    cover.hidden = false;
    const status = cover.querySelector('.cover__status');
    const buttons = [...cover.querySelectorAll('[data-hours]')];
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const all = btn.dataset.hours === 'all';
      const hours = Number(btn.dataset.hours);
      buttons.forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
      let n = 0;
      moments.forEach((li) => {
        const out = !all && Number(li.dataset.at) > hours;
        li.classList.toggle('is-out', out);
        if (!out) n += 1;
      });
      status.textContent = all
        ? `A full day covers all ${moments.length} moments.`
        : `${hours} hours covers ${n} of ${moments.length} moments. The faded ones would fall outside the time.`;
    }));
  }
}

// ---- Scroll animations
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const items = [...document.querySelectorAll('.reveal, .wipe')];
const showAll = () => items.forEach((el) => el.classList.add('in'));

if (!window.gsap || !window.ScrollTrigger) {
  showAll();
} else {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mm = gsap.matchMedia();

  // Text rises in, photographs open from the bottom edge. Neighbours arrive one after another.
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const played = new Set();
    const play = (els) => {
      els = els.filter((el) => !played.has(el));
      els.forEach((el) => played.add(el));
      const text = els.filter((el) => el.classList.contains('reveal'));
      const pics = els.filter((el) => el.classList.contains('wipe'));
      const done = (el) => { el.classList.add('in'); gsap.set(el.querySelector('.fill') || el, { clearProps: 'clipPath' }); gsap.set(el, { clearProps: 'opacity,transform' }); };
      if (text.length) gsap.to(text, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.09, overwrite: 'auto', onComplete: () => text.forEach(done) });
      pics.forEach((el, i) => gsap.to(el.querySelector('.fill'), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.out', delay: i * 0.12, onComplete: () => done(el) }));
    };

    // Anything already on screen when the page opens plays straight away. (ScrollTrigger only fires once you scroll.)
    const onScreen = () => items.filter((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.92 && r.bottom > 0; });
    play(onScreen());
    addEventListener('load', () => play(onScreen()), { once: true }); // photos and fonts can shift the layout; catch late arrivals

    // Everything further down plays as it scrolls into view.
    ScrollTrigger.batch(items, {
      start: 'clamp(top 90%)', // clamp: things near the very bottom of the page still fire
      once: true,
      interval: 0.1,
      batchMax: 6,
      onEnter: play,
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', showAll);

  // Gentle parallax on large screens: the quotation and footer photographs drift slightly inside their frames.
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('.quote__img img, .foot__img img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.closest('.quote, .foot'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  });
}
