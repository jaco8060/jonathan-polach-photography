// PhotoSwipe lightbox: keyboard, swipe, pinch-zoom, preloading, captions, and shareable #photo-N links.
// If the CDN is blocked, the photo links still open the full-size image.
import PhotoSwipeLightbox from 'https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.4/photoswipe-lightbox.esm.min.js';

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = 'https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.4/photoswipe.min.css';
document.head.append(css);

const lightbox = new PhotoSwipeLightbox({
  gallery: '#gallery',
  children: 'a',
  pswpModule: () => import('https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.4/photoswipe.esm.min.js'),
  preload: [1, 2],
  bgOpacity: 0.95,
});

lightbox.on('uiRegister', () => {
  lightbox.pswp.ui.registerElement({
    name: 'caption',
    order: 9,
    isButton: false,
    appendTo: 'root',
    onInit: (el, pswp) => {
      el.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:.9rem 1rem;text-align:center;color:#eee;font:1rem/1.4 system-ui,sans-serif;background:linear-gradient(transparent,rgba(0,0,0,.55));pointer-events:none';
      pswp.on('change', () => {
        el.textContent = pswp.currSlide.data.element?.dataset.caption || '';
        el.hidden = !el.textContent;
        history.replaceState(null, '', `#photo-${pswp.currIndex + 1}`);
      });
    },
  });
});
lightbox.on('close', () => history.replaceState(null, '', location.pathname + location.search));
lightbox.init();

const match = location.hash.match(/^#photo-(\d+)$/);
if (match) lightbox.loadAndOpen(Number(match[1]) - 1);
