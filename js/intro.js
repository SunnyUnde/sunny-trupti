(function (root) {
  'use strict';

  // The overlay is a 2.5s veil. It was replaying on every load, so a guest
  // hopping to /engagement and back sat through the mandala three times.
  function shouldPlayIntro(prefersReduced, alreadySeen) {
    return !prefersReduced && !alreadySeen;
  }

  // Fired on every path (played, skipped, already seen, reduced motion) so the
  // hero's own entrance animations have one signal to hang off.
  function announceDone() {
    try { document.dispatchEvent(new CustomEvent('intro:done')); } catch (e) {}
  }

  var SEEN_KEY = 'introSeen';
  function seenThisSession() {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }

  function observeReveals() {
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

  function init() {
    var overlay = document.getElementById('intro');
    var docEl = document.documentElement;

    var prefersReduced = false;
    try {
      prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { prefersReduced = false; }

    // Reduced motion (or overlay missing): show everything immediately, no animation.
    if (!shouldPlayIntro(prefersReduced, seenThisSession()) || !overlay) {
      if (overlay) overlay.classList.remove('is-playing');
      // Still reveal on scroll: only the veil is skipped, not the page.
      docEl.classList.add('js-anim', 'intro-done');
      observeReveals();
      announceDone();
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
      announceDone();
    }

    var skip = document.getElementById('introSkip');
    if (skip) skip.addEventListener('click', finish);

    overlay.classList.add('is-playing');
    markSeen();
    setTimeout(finish, 2500); // veil fade starts ~1.9s and lasts .6s, so this lands as it ends

    observeReveals();
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
