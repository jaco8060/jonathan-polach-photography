// Mobile menu, hero crossfade, and scroll animations (GSAP + ScrollTrigger).
// Everything here is an enhancement: the site is fully readable if this file or GSAP fails to load.
// Animations only touch transform and opacity, so they never force the browser to re-layout the page.
document.documentElement.classList.add('ready');

const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// Hero photo crossfade (CSS opacity transition; pauses when the tab is hidden or the hero is off-screen)
const hero = document.querySelector('.hero[data-mode="crossfade"]');
const slides = hero ? [...hero.querySelectorAll('.slide')] : [];
if (slides.length > 1 && !reduced.matches) {
  let i = 0, timer = null;
  const next = () => {
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  };
  const run = (on) => { clearInterval(timer); if (on) timer = setInterval(next, 5500); };
  new IntersectionObserver(([e]) => run(e.isIntersecting && !document.hidden)).observe(hero);
  document.addEventListener('visibilitychange', () => run(!document.hidden));
}

const items = [...document.querySelectorAll('.reveal')];
const showAll = () => items.forEach((el) => el.classList.add('in'));

if (!window.gsap || !window.ScrollTrigger) {
  showAll();
} else {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mm = gsap.matchMedia();

  // Fade and rise as things scroll into view, grouped so neighbours arrive one after another.
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      interval: 0.1,
      batchMax: 6,
      onEnter: (els) => gsap.to(els, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, overwrite: 'auto',
        onComplete: () => els.forEach((el) => { el.classList.add('in'); gsap.set(el, { clearProps: 'opacity,transform' }); }),
      }),
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', showAll);

  // Gentle parallax on large screens: photos drift slightly inside their frames while you scroll.
  mm.add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('.story__img img, .tile__img img, .intro__pic img, .cta[data-bg] img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.closest('.story__img, .tile__img, .intro__pic, .cta'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    if (hero) {
      const heroScroll = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__slides', { yPercent: 10, ease: 'none', scrollTrigger: heroScroll });
      // explicit start values: the CSS entrance animation may still be running when this is created
      gsap.fromTo('.hero__text', { opacity: 1, y: 0 }, { opacity: 0, y: -50, ease: 'none', scrollTrigger: { ...heroScroll, end: 'bottom 40%' } });
    }
  });
}
