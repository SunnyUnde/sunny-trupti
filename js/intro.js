(function (root) {
  'use strict';

  function shouldPlayIntro(prefersReduced) {
    return !prefersReduced;
  }

  function init() {
    var overlay = document.getElementById('intro');
    var docEl = document.documentElement;

    var prefersReduced = false;
    try {
      prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { prefersReduced = false; }

    // Reduced motion (or overlay missing): show everything immediately, no animation.
    if (!shouldPlayIntro(prefersReduced) || !overlay) {
      if (overlay) overlay.classList.remove('is-playing');
      return;
    }

    // Animation-capable: hide hero + reveal targets (via CSS), then play the intro.
    docEl.classList.add('js-anim');

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      overlay.classList.remove('is-playing');
      docEl.classList.add('intro-done');
    }

    var skip = document.getElementById('introSkip');
    if (skip) skip.addEventListener('click', finish);

    overlay.classList.add('is-playing');
    setTimeout(finish, 2500); // veil fade starts ~1.9s, lasts .6s — finish exactly as it ends

    var targets = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); }
        });
      }, { threshold: 0.15 });
      targets.forEach(function (t) { obs.observe(t); });
    } else {
      targets.forEach(function (t) { t.classList.add('in'); });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { shouldPlayIntro: shouldPlayIntro };
  } else {
    root.Intro = { shouldPlayIntro: shouldPlayIntro };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
