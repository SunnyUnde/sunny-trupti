(function (root) {
  'use strict';

  var STORAGE_KEY = 'music';   // 'on' | 'off'  (unset => autostart on first gesture)
  var TARGET_VOL = 0.35;

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
  }

  function init() {
    var audio = document.getElementById('bgm');
    var btn = document.getElementById('musicToggle');
    if (!audio || !btn) return;

    var started = false;     // playback initiated at least once this page view
    var fadeTimer = null;

    // Reveal the control only once we know the track can actually load,
    // so the button never appears if audio/theme.mp3 is missing.
    function reveal() { btn.hidden = false; }
    audio.addEventListener('loadedmetadata', reveal);
    audio.addEventListener('canplay', reveal);
    audio.addEventListener('error', function () { btn.hidden = true; });
    // In case the track is cached and already loaded before listeners attached.
    if (audio.readyState >= 1) reveal();

    function fade(to, done) {
      if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
      var step = (to - audio.volume) / 20;
      if (step === 0) { if (done) done(); return; }
      fadeTimer = setInterval(function () {
        var v = audio.volume + step;
        if ((step > 0 && v >= to) || (step < 0 && v <= to)) {
          audio.volume = Math.max(0, Math.min(1, to));
          clearInterval(fadeTimer); fadeTimer = null;
          if (done) done();
        } else {
          audio.volume = Math.max(0, Math.min(1, v));
        }
      }, 25);
    }

    function setState(playing) {
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? 'Mute music' : 'Play music');
    }

    function play() {
      audio.volume = 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
      fade(TARGET_VOL);
      setState(true);
    }
    function stop() {
      fade(0, function () { audio.pause(); });
      setState(false);
    }

    btn.addEventListener('click', function () {
      started = true;
      if (audio.paused) { store('on'); play(); }
      else { store('off'); stop(); }
    });

    // Start on the visitor's first interaction (satisfies autoplay policy),
    // unless they previously chose to keep it off.
    function onFirstGesture(e) {
      if (e && btn.contains(e.target)) return;  // the button manages itself
      if (started) { teardown(); return; }
      started = true;
      if (stored() !== 'off') play();
      teardown();
    }
    function teardown() {
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        document.removeEventListener(ev, onFirstGesture);
      });
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, onFirstGesture);
    });

    setState(false);  // muted look until playback actually begins
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  } else {
    root.Music = {};
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
