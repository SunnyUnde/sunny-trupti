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
  function localizeDigits(str) {
    if (typeof document === 'undefined') return str;
    if (document.documentElement.getAttribute('lang') !== 'mr') return str;
    return str.replace(/[0-9]/g, function (d) { return DEVANAGARI.charAt(d); });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  var el = null;
  var last = null;

  function render() {
    if (!el || !el.d || !last) return;
    el.d.textContent = localizeDigits(pad(last.days));
    el.h.textContent = localizeDigits(pad(last.hours));
    el.m.textContent = localizeDigits(pad(last.minutes));
    var s = localizeDigits(pad(last.seconds));
    if (el.s.textContent !== s) {
      el.s.textContent = s;
      el.s.classList.remove('tick');
      void el.s.offsetWidth; // force reflow so the animation restarts
      el.s.classList.add('tick');
    }
  }

  function start() {
    var target = new Date('2026-07-04T11:00:00+05:30').getTime();
    el = {
      d: document.querySelector('[data-cd-days]'),
      h: document.querySelector('[data-cd-hours]'),
      m: document.querySelector('[data-cd-minutes]'),
      s: document.querySelector('[data-cd-seconds]')
    };
    if (!el.d) return;
    function tick() {
      last = getRemaining(target, Date.now());
      render();
    }
    tick();
    setInterval(tick, 1000);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getRemaining: getRemaining };
  } else {
    root.Countdown = { getRemaining: getRemaining, refresh: render };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : this);
