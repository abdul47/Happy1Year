/* ============================================================
   app.js — Scroll animations + Polaroid cluster + Lightbox
   ============================================================ */

/* ----------------------------------------------------------
   1. BACKGROUND SCROLL EFFECT
      The photo is a fixed layer behind the whole page.
      On scroll: zoom toward face, blur, hero text fades out.
   ---------------------------------------------------------- */

// Inject the fixed background div into the body (before everything)
const fixedBg = document.createElement('div');
fixedBg.className = 'fixed-bg';
document.body.prepend(fixedBg);

const heroOverlay = document.getElementById('heroOverlay');
const heroText    = document.getElementById('heroText');

const MAX_ZOOM   = 1.55;              // zoom toward face
const MAX_BLUR   = 16;               // blur at full scroll
const ZOOM_START = 0;
const ZOOM_END   = 150;              // Full zoom/blur within 150px (single scroll!)

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

let autoScrolled = false;

function onScroll() {
  const scrollY  = window.scrollY;
  const progress = clamp((scrollY - ZOOM_START) / (ZOOM_END - ZOOM_START), 0, 1);

  const scale    = lerp(1, MAX_ZOOM, progress);
  const blur     = lerp(0, MAX_BLUR, progress);

  fixedBg.style.transform = `scale(${scale})`;
  fixedBg.style.filter    = `blur(${blur}px)`;

  // Hero overlay darkens as we scroll
  heroOverlay.style.opacity = clamp(progress * 1.5, 0, 0.85);

  // Hero text floats up and fades quickly on single scroll
  const textFade = clamp(1 - progress * 2.5, 0, 1);
  heroText.style.opacity   = textFade;
  heroText.style.transform = `translateX(-50%) translateY(${progress * -40}px)`;

  // Single scroll auto-lock to polaroid section
  const targetTop = document.getElementById('polaroidSection').offsetTop;
  if (scrollY > 30 && scrollY < targetTop - 50 && !autoScrolled) {
    autoScrolled = true;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  } else if (scrollY === 0) {
    autoScrolled = false;
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll(); // init


/* ----------------------------------------------------------
   2. BUILD POLAROID CLUSTER
      Autofits 21 polaroid cards across visible screen
   ---------------------------------------------------------- */
const container = document.getElementById('clusterContainer');

// Cluster layout: [left%, top%, rotation(deg), z-index] — 21 entries, structured auto-fit
const LAYOUT = [
  // Band 1 (Top)
  [  1,   2,  -12,  2],
  [ 20,   0,    8,  3],
  [ 40,   3,  -10,  4],
  [ 60,   1,   11,  3],
  [ 80,   4,   -7,  2],

  // Band 2 (Upper Middle)
  [  2,  22,   10,  4],
  [ 21,  19,   -8,  5],
  [ 41,  23,   14,  6],
  [ 61,  20,   -9,  5],
  [ 81,  24,   12,  4],

  // Band 3 (Lower Middle)
  [  0,  44,  -11,  6],
  [ 20,  41,    9,  7],
  [ 40,  45,  -15,  8],
  [ 60,  42,    7,  7],
  [ 80,  46,  -10,  6],

  // Band 4 (Bottom)
  [  2,  66,    7,  8],
  [ 21,  63,  -12,  9],
  [ 41,  67,    9, 10],
  [ 61,  64,   -8,  9],
  [ 81,  68,   13,  8],

  // Center Accent
  [ 41,  33,   -5, 11],
];

function buildCluster() {
  POLAROIDS.forEach((data, i) => {
    const [lp, tp, rot, zi] = LAYOUT[i % LAYOUT.length];

    const card = document.createElement('div');
    card.className = 'polaroid-card';
    card.style.cssText = `
      left: ${lp}%;
      top:  ${tp}%;
      z-index: ${zi};
      --base-transform: rotate(${rot}deg);
      transform: rotate(${rot}deg);
    `;
    card.dataset.index = i;

    // photo
    const wrap = document.createElement('div');
    wrap.className = 'photo-wrap';

    if (data.src) {
      const img = document.createElement('img');
      img.src   = data.src;
      img.alt   = data.caption || 'Memory';
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'photo-placeholder';
      ph.textContent = '+ add photo';
      wrap.appendChild(ph);
    }
    card.appendChild(wrap);

    // heart
    const heart = document.createElement('div');
    heart.className = 'p-heart';
    heart.textContent = '♡';
    card.appendChild(heart);

    // click handler
    card.addEventListener('click', () => openLightbox(data, card));

    container.appendChild(card);

    // staggered entrance animation
    setTimeout(() => {
      card.style.animation = `popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards`;
    }, 60 + i * 55);
  });
}

buildCluster();


/* ----------------------------------------------------------
   3. POLAROID SECTION SCROLL-IN
      Cluster fades/rises as user scrolls into view
   ---------------------------------------------------------- */
const polaroidSection = document.getElementById('polaroidSection');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // trigger entrance on all cards
      document.querySelectorAll('.polaroid-card').forEach((card, i) => {
        card.style.animation = 'none';
        void card.offsetWidth; // reflow
        setTimeout(() => {
          card.style.animation = `popIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards`;
        }, i * 55);
      });
      sectionObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.01 });

sectionObserver.observe(polaroidSection);


/* ----------------------------------------------------------
   4. LIGHTBOX & STICKER SHOWER
   ---------------------------------------------------------- */
const lightbox       = document.getElementById('lightbox');
const lightboxInner  = lightbox.querySelector('.lightbox-inner');
const lbImg          = document.getElementById('lightboxImg');
const lbCaption      = document.getElementById('lightboxCaption');
const lbText         = document.getElementById('lightboxText');
const lbClose        = document.getElementById('lightboxClose');

let currentOrigin    = null;
let stickerTimer     = null;
let activeStickerSrc = null;

// Inject Standalone Clickable Sticker Photo Button into Lightbox
const stickerBtn = document.createElement('img');
stickerBtn.className = 'sticker-photo-btn';
stickerBtn.alt = 'sticker button';
lightbox.appendChild(stickerBtn);

// Click handler for sticker button
stickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (activeStickerSrc) {
    triggerStickerShower(activeStickerSrc, 50);
  }
});

function openLightbox(data, sourceCard) {
  // Set content
  lbImg.src             = data.src || '';
  lbImg.style.display   = data.src ? 'block' : 'none';
  lbCaption.textContent = data.caption || '';
  lbText.textContent    = data.message || '';

  activeStickerSrc = data.sticker || null;
  if (activeStickerSrc) {
    stickerBtn.src = activeStickerSrc;
    stickerBtn.style.display = 'block';
  } else {
    stickerBtn.style.display = 'none';
  }

  // Activate overlay
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';

  currentOrigin = sourceCard;

  // Clear any existing sticker timer & floating stickers
  if (stickerTimer) clearTimeout(stickerTimer);
  clearFloatingStickers();

  // After 1 second, automatically float 50 stickers from bottom to top!
  if (activeStickerSrc) {
    stickerTimer = setTimeout(() => {
      if (lightbox.classList.contains('active')) {
        triggerStickerShower(activeStickerSrc, 50);
      }
    }, 1000);
  }
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';

  if (stickerTimer) {
    clearTimeout(stickerTimer);
    stickerTimer = null;
  }
  clearFloatingStickers();

  setTimeout(() => {
    lbImg.src = '';
  }, 500);
}

// Function to trigger 50 floating stickers from bottom to top
function triggerStickerShower(stickerSrc, count = 50) {
  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = stickerSrc;
    img.className = 'floating-sticker';

    const size = Math.random() * 35 + 40;        // 40px to 75px
    const left = Math.random() * 92 + 2;          // 2vw to 94vw
    const duration = Math.random() * 1.5 + 2.5;  // 2.5s to 4.0s
    const delay = Math.random() * 1.2;          // 0s to 1.2s delay
    const startRot = (Math.random() - 0.5) * 50;
    const endRot = (Math.random() - 0.5) * 100;
    const drift = (Math.random() - 0.5) * 140;

    img.style.cssText = `
      left: ${left}vw;
      width: ${size}px;
      height: ${size}px;
      --duration: ${duration}s;
      --start-rot: ${startRot}deg;
      --end-rot: ${endRot}deg;
      --drift: ${drift}px;
      animation-delay: ${delay}s;
    `;

    document.body.appendChild(img);

    // Self cleanup after animation completes
    setTimeout(() => {
      img.remove();
    }, (duration + delay) * 1000 + 200);
  }
}

function clearFloatingStickers() {
  document.querySelectorAll('.floating-sticker').forEach(el => el.remove());
}

lbClose.addEventListener('click', closeLightbox);

// Click outside polaroid to close
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

// ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
});
