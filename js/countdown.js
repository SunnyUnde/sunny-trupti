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

  function start() {
    var target = new Date('2026-07-04T11:00:00+05:30').getTime();
    var el = {
      d: document.querySelector('[data-cd-days]'),
      h: document.querySelector('[data-cd-hours]'),
      m: document.querySelector('[data-cd-minutes]'),
      s: document.querySelector('[data-cd-seconds]')
    };
    if (!el.d) return;
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      var r = getRemaining(target, Date.now());
      el.d.textContent = pad(r.days);
      el.h.textContent = pad(r.hours);
      el.m.textContent = pad(r.minutes);
      var s = pad(r.seconds);
      if (el.s.textContent !== s) {
        el.s.textContent = s;
        el.s.classList.remove('tick');
        void el.s.offsetWidth; // force reflow so the animation restarts
        el.s.classList.add('tick');
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getRemaining: getRemaining };
  } else {
    root.Countdown = { getRemaining: getRemaining };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof window !== 'undefined' ? window : this);
