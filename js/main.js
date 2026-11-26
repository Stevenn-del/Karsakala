/**
 * KARSAKALA — Skrip Utama Frontend (main.js)
 * Mengelola navigasi global, drawer menu mobile, slideshow beranda, dan interaksi bersama.
 */

/**
 * Menghubungkan gestur navigasi horizontal terpadu (usap touchpad/trackpad, klik-seret mouse,
 * serta usap layar sentuh) ke area kartu galeri/karousel tanpa mengganggu klik kartu.
 * @param {HTMLElement} container - Elemen wadah area kartu karousel.
 * @param {Object} options - Opsi dan callback navigasi.
 * @param {Function} options.onNext - Callback menuju kartu berikutnya.
 * @param {Function} options.onPrev - Callback menuju kartu sebelumnya.
 * @param {Function} [options.shouldIgnore] - Predikat opsional untuk menonaktifkan gestur (mis. saat modal terbuka).
 * @param {string} [options.ignoreTargetSelector] - Selektor CSS elemen interaktif yang tidak memicu seret.
 */
window.attachCarouselGestures = function attachCarouselGestures(container, options = {}) {
  if (!container || container.dataset.gesturesAttached === 'true') return;
  const { onNext, onPrev, shouldIgnore, ignoreTargetSelector = 'button, a' } = options;
  if (typeof onNext !== 'function' || typeof onPrev !== 'function') return;

  container.dataset.gesturesAttached = 'true';

  // Mencegah browser memulai seret gambar HTML5 bawaan yang dapat membajak mouseup
  container.addEventListener('dragstart', (e) => e.preventDefault());

  let isMouseDragging = false;
  let dragStartX = 0;
  let dragAnchorX = 0;
  let dragStartTime = 0;
  let hasDragged = false;
  let didStepDuringDrag = false;
  let lastDragStepTime = 0;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchAnchorX = 0;
  let touchStartTime = 0;
  let isHorizontalTouch = null;
  let hasTouchMoved = false;
  let didStepDuringTouch = false;
  let lastTouchStepTime = 0;

  // 1. Usap Horizontal Touchpad / Trackpad (Wheel deltaX) dengan filter inersia
  let wheelAccX = 0;
  let prevAbsWheelDx = 0;
  let lastWheelEventTime = 0;
  let lastWheelTriggerTime = 0;
  let wheelLocked = false;
  let wheelIdleTimer = null;

  container.addEventListener('wheel', (e) => {
    if (shouldIgnore && shouldIgnore(e)) return;

    const scale = e.deltaMode === 1 ? 32 : (e.deltaMode === 2 ? container.clientWidth : 1);
    const dx = e.deltaX * scale;
    const dy = e.deltaY * scale;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX <= absY || absX <= 2) return;

    // Cegah navigasi back/forward dua jari bawaan browser saat mengusap galeri
    if (e.cancelable) e.preventDefault();

    const now = performance.now();
    const dt = now - lastWheelEventTime;
    lastWheelEventTime = now;

    // Reset alur jika ada jeda antar usapan atau arah usapan berbalik
    if (dt > 90 || (dx !== 0 && wheelAccX !== 0 && Math.sign(dx) !== Math.sign(wheelAccX))) {
      wheelAccX = 0;
      wheelLocked = false;
    }

    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelAccX = 0;
      wheelLocked = false;
      prevAbsWheelDx = 0;
    }, 120);

    // Deteksi dorongan baru saat inersia sebelumnya masih melambat
    if (wheelLocked && absX > prevAbsWheelDx * 1.6 && absX >= 14 && (now - lastWheelTriggerTime > 220)) {
      wheelLocked = false;
      wheelAccX = 0;
    }
    prevAbsWheelDx = absX;

    if (wheelLocked) {
      if ((now - lastWheelTriggerTime > 380) && absX >= 18) {
        wheelLocked = false;
        wheelAccX = 0;
      } else {
        return;
      }
    }

    wheelAccX += dx;
    if (Math.abs(wheelAccX) >= 36 && (now - lastWheelTriggerTime > 160)) {
      if (wheelAccX > 0) onNext();
      else onPrev();
      lastWheelTriggerTime = now;
      wheelAccX = 0;
      wheelLocked = true;
    }
  }, { passive: false });

  // 2. Klik-dan-Seret Mouse (Responsif seketika saat melewati ambang batas)
  const onMouseMove = (e) => {
    if (!isMouseDragging) return;
    const totalDx = e.clientX - dragStartX;

    if (Math.abs(totalDx) > 6) {
      hasDragged = true;
      container.classList.add('is-dragging');
    }

    const stepDx = e.clientX - dragAnchorX;
    const stepThreshold = didStepDuringDrag ? 95 : 42;
    const now = performance.now();

    if (Math.abs(stepDx) >= stepThreshold && (!didStepDuringDrag || now - lastDragStepTime > 220)) {
      if (stepDx < 0) onNext();
      else onPrev();
      dragAnchorX = e.clientX;
      didStepDuringDrag = true;
      lastDragStepTime = now;
    }
  };

  const endMouseDrag = (e) => {
    if (!isMouseDragging) return;
    isMouseDragging = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endMouseDrag);
    window.removeEventListener('blur', endMouseDrag);

    container.classList.remove('is-dragging');

    if (hasDragged) {
      if (!didStepDuringDrag && e && typeof e.clientX === 'number') {
        const dx = e.clientX - dragStartX;
        const elapsed = performance.now() - dragStartTime;
        if (elapsed < 280 && Math.abs(dx) >= 22) {
          if (dx < 0) onNext();
          else onPrev();
        }
      }
      setTimeout(() => {
        hasDragged = false;
      }, 60);
    }
  };

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (shouldIgnore && shouldIgnore(e)) return;
    if (ignoreTargetSelector && e.target.closest(ignoreTargetSelector)) return;

    isMouseDragging = true;
    hasDragged = false;
    didStepDuringDrag = false;
    dragStartX = e.clientX;
    dragAnchorX = e.clientX;
    dragStartTime = performance.now();
    lastDragStepTime = 0;

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', endMouseDrag);
    window.addEventListener('blur', endMouseDrag);
  });

  // 3. Gestur Layar Sentuh untuk Ponsel & Tablet
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    if (shouldIgnore && shouldIgnore(e)) return;
    if (ignoreTargetSelector && e.target.closest(ignoreTargetSelector)) return;

    touchStartX = e.touches[0].clientX;
    touchAnchorX = touchStartX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = performance.now();
    isHorizontalTouch = null;
    hasTouchMoved = false;
    didStepDuringTouch = false;
    lastTouchStepTime = 0;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const totalDx = t.clientX - touchStartX;
    const totalDy = t.clientY - touchStartY;

    if (isHorizontalTouch === null && (Math.abs(totalDx) > 8 || Math.abs(totalDy) > 8)) {
      isHorizontalTouch = Math.abs(totalDx) >= Math.abs(totalDy);
    }

    // Biarkan gulir halaman vertikal berjalan normal bila pengguna menggulir atas/bawah
    if (isHorizontalTouch !== true) return;

    hasTouchMoved = true;
    if (e.cancelable) e.preventDefault();

    const stepDx = t.clientX - touchAnchorX;
    const stepThreshold = didStepDuringTouch ? 85 : 36;
    const now = performance.now();

    if (Math.abs(stepDx) >= stepThreshold && (!didStepDuringTouch || now - lastTouchStepTime > 200)) {
      if (stepDx < 0) onNext();
      else onPrev();
      touchAnchorX = t.clientX;
      didStepDuringTouch = true;
      lastTouchStepTime = now;
    }
  }, { passive: false });

  const endTouchDrag = (e) => {
    if (!hasTouchMoved) return;
    if (!didStepDuringTouch && e.changedTouches && e.changedTouches[0]) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const elapsed = performance.now() - touchStartTime;
      if ((isHorizontalTouch && Math.abs(dx) >= 24) || (elapsed < 300 && Math.abs(dx) >= 18)) {
        if (dx < 0) onNext();
        else onPrev();
      }
    }
    setTimeout(() => {
      hasTouchMoved = false;
    }, 80);
  };

  container.addEventListener('touchend', endTouchDrag, { passive: true });
  container.addEventListener('touchcancel', endTouchDrag, { passive: true });

  // 4. Penahan Klik (Fase Capture) agar Seret/Usap Tidak Membuka Detail Kartu
  container.addEventListener('click', (e) => {
    if (hasDragged || hasTouchMoved) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      hasDragged = false;
      hasTouchMoved = false;
    }
  }, true);
};

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // BAGIAN 1: NAVIGASI GLOBAL & MENU RESPONSIVE (DRAWER MOBILE)
  // ==========================================================================
  const mobileToggle = document.getElementById('mobile-nav-toggle') || document.querySelector('.mobile-nav-toggle');
  const navDrawer = document.getElementById('nav-center-menu') || document.querySelector('.nav-center-wrapper');
  const navLinks = document.querySelectorAll('.nav-item-link');
  
  if (mobileToggle && navDrawer) {
    // Tombol pembuka/penutup menu drawer mobile
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = navDrawer.classList.toggle('show');
      mobileToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.className = isExpanded ? 'bi bi-x-lg' : 'bi bi-list';
      }
    });

    // Menutup menu drawer saat pengguna mengklik di luar area menu
    document.addEventListener('click', (e) => {
      if (navDrawer.classList.contains('show') && 
          !navDrawer.contains(e.target) && 
          !mobileToggle.contains(e.target)) {
        navDrawer.classList.remove('show');
        mobileToggle.setAttribute('aria-expanded', 'false');
        const icon = mobileToggle.querySelector('i');
        if (icon) icon.className = 'bi bi-list';
      }
    });
  }

  // Pengguliran halus (smooth scroll) untuk tautan jangkar dalam halaman
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
          if (navDrawer && navDrawer.classList.contains('show')) {
            navDrawer.classList.remove('show');
            if (mobileToggle) {
              mobileToggle.setAttribute('aria-expanded', 'false');
              const icon = mobileToggle.querySelector('i');
              if (icon) icon.className = 'bi bi-list';
            }
          }
        }
      }
    });
  });

  // ScrollSpy untuk menandai menu aktif pada navigasi satu halaman
  const sections = document.querySelectorAll('section[id], div[id="hero-section"]');
  if (sections.length > 1 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (href === `#${id}`) {
                navLinks.forEach((l) => l.classList.remove('active'));
                link.classList.add('active');
              }
            });
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
      }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  // ==========================================================================
  // BAGIAN 2: SLIDESHOW LATAR BELAKANG HERO BERANDA
  // ==========================================================================
  const slides = document.querySelectorAll('.hero-slide');
  if (slides && slides.length > 0) {
    const SLIDE_INTERVAL = 6000; // Berganti setiap 6 detik
    let timerId = null;

    // Mendukung parameter url ?slide=0, 1, 2 untuk pengujian langsung
    const urlParams = new URLSearchParams(window.location.search);
    const paramSlide = parseInt(urlParams.get('slide'), 10);
    const initialIndex = (!isNaN(paramSlide) && paramSlide >= 0 && paramSlide < slides.length) ? paramSlide : 0;
    let currentIndex = initialIndex;

    function showSlide(index, instant = false) {
      slides.forEach((slide, idx) => {
        slide.style.transition = instant ? 'none' : '';
        if (idx === index) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });

      if (instant) {
        // Mengembalikan transisi pada frame berikutnya tanpa memicu forced synchronous reflow
        requestAnimationFrame(() => {
          slides.forEach(s => s.style.transition = '');
        });
      }

      currentIndex = index;
    }

    function nextSlide() {
      const nextIndex = (currentIndex + 1) % slides.length;
      showSlide(nextIndex, false);
    }

    function startSlideshow() {
      stopSlideshow();
      timerId = setInterval(nextSlide, SLIDE_INTERVAL);
    }

    function stopSlideshow() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    // Menghentikan sejenak slideshow ketika tab browser tidak aktif untuk menghemat baterai/GPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopSlideshow();
      } else {
        startSlideshow();
      }
    });

    // Menampilkan slide awal dan memulai perputaran otomatis
    showSlide(initialIndex, true);
    startSlideshow();
  }

  // ==========================================================================
  // BAGIAN 3: PREFETCH INTELIGEN UNTUK NAVIGASI INSTAN ANTAR-HALAMAN (ZERO DELAY)
  // Memuat awal dokumen HTML saat kursor melayang secara stabil di atas tautan
  // dijadwalkan saat thread idle agar tidak membebani animasi atau transisi halaman.
  // ==========================================================================
  const prefetchedUrls = new Set();
  function prefetchUrl(url) {
    if (!url || prefetchedUrls.has(url) || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) return;
    if (navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && navigator.connection.effectiveType.includes('2g')))) return;
    prefetchedUrls.add(url);
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 120));
    schedule(() => {
      if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = 'document';
      document.head.appendChild(link);
    });
  }

  let hoverTimer = null;
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a[href]');
    if (a && a.origin === window.location.origin) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => prefetchUrl(a.href), 70);
    }
  }, { passive: true });

  document.addEventListener('mouseout', () => {
    clearTimeout(hoverTimer);
  }, { passive: true });

  // Mobile touchscreen instant prefetch on initial touch contact
  document.addEventListener('touchstart', (e) => {
    const a = e.target.closest('a[href]');
    if (a && a.origin === window.location.origin) {
      prefetchUrl(a.href);
    }
  }, { passive: true });
});
