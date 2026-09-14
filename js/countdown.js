(function (root) {
  'use strict';

  function getRemaining(targetMs, nowMs) {
    var diff = Math.max(0, targetMs - nowMs);
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000)
    };
  }

  var DEVANAGARI = '०१२३४५६७८९';

  // Pure: takes the remaining parts and the active language, returns the three
  // strings the hero shows. Seconds are computed but not displayed; the wedding
  // is months away, so a ticking seconds column was noise plus a repaint a
  // second, forever.
  function formatUnits(remaining, lang) {
    function render(n) {
      var s = String(n).padStart(2, '0');
      return lang === 'mr'
        ? s.replace(/[0-9]/g, function (d) { return DEVANAGARI.charAt(d); })
        : s;
    }
    return {
      days: render(remaining.days),
      hours: render(remaining.hours),
      minutes: render(remaining.minutes)
    };
  }

  // Standard ease-out. The number decelerates into its final value instead of
  // stopping dead, which is what makes a count-up read as arrival.
  function easeOutCubic(t) {
    var c = 1 - Math.min(1, Math.max(0, t));
    return 1 - c * c * c;
  }

  var COUNT_UP_MS = 700;

  // The tween is an enhancement, never the thing that puts the number on
  // screen. requestAnimationFrame does not tick in a hidden tab and is
  // throttled in some Android WebViews, so decide up front and keep a
  // guaranteed paint on the other branch.
  function shouldCountUp(reduced, hasRaf, hidden) {
    return !reduced && hasRaf && !hidden;
  }

  var el = null;
  var last = null;

  function paint() {
    if (!el || !el.d || !last) return;
    var out = formatUnits(last, document.documentElement.getAttribute('lang'));
    el.d.textContent = out.days;
    el.h.textContent = out.hours;
    el.m.textContent = out.minutes;
  }

  // Rolls the three numbers up from zero once the hero is actually on screen.
  // Motivation: it is the only number on the page that matters, so it gets the
  // one piece of motion that draws the eye. Skipped entirely under reduced motion.
  function countUp() {
    var target = last;
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var hidden = typeof document.visibilityState === 'string' && document.visibilityState === 'hidden';
    if (!target || !shouldCountUp(reduced, typeof requestAnimationFrame === 'function', hidden)) {
      paint();
      return;
    }
    // If the tween never completes, land the real value anyway.
    var guard = setTimeout(function () { last = target; paint(); }, COUNT_UP_MS + 400);
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = (ts - t0) / COUNT_UP_MS;
      var e = easeOutCubic(p);
      last = {
        days: Math.round(target.days * e),
        hours: Math.round(target.hours * e),
        minutes: Math.round(target.minutes * e),
        seconds: target.seconds
      };
      paint();
      if (p < 1) { requestAnimationFrame(frame); }
      else { clearTimeout(guard); last = target; paint(); }
    }
    requestAnimationFrame(frame);
  }

  function start() {
    var cdEl = document.querySelector('.countdown');
    var attr = cdEl && cdEl.getAttribute('data-target');
    var target = new Date(attr || '2027-01-24T00:00:00+05:30').getTime();
    el = {
      d: document.querySelector('[data-cd-days]'),
      h: document.querySelector('[data-cd-hours]'),
      m: document.querySelector('[data-cd-minutes]')
    };
    if (!el.d) return;
    var timer = null;
    function tick() {
      last = getRemaining(target, Date.now());
      paint();
      if (target - Date.now() <= 0) {
        if (timer) clearInterval(timer);
        var done = document.querySelector('.countdown-done');
        if (cdEl) cdEl.hidden = true;
        if (done) done.hidden = false;
      }
    }
    last = getRemaining(target, Date.now());
    // Wait for the intro veil to lift, or run anyway if intro.js never reports in.
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      countUp();
      timer = setInterval(tick, 30000);
    }
    document.addEventListener('intro:done', go);
    setTimeout(go, 3000);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getRemaining: getRemaining, formatUnits: formatUnits,
      easeOutCubic: easeOutCubic, shouldCountUp: shouldCountUp
    };
  } else {
    root.Countdown = { getRemaining: getRemaining, refresh: paint };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : this);
