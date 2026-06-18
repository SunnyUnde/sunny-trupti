(function (root) {
  'use strict';

  var STORAGE_KEY = 'lang';
  var SUPPORTED = ['mr', 'en'];
  var DEFAULT = 'mr';

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function getLang() {
    var s = stored();
    return SUPPORTED.indexOf(s) !== -1 ? s : DEFAULT;
  }

  function apply(lang) {
    document.documentElement.setAttribute('lang', lang);

    var nodes = document.querySelectorAll('[data-' + lang + ']');
    for (var i = 0; i < nodes.length; i++) {
      var val = nodes[i].getAttribute('data-' + lang);
      if (val !== null) nodes[i].textContent = val;
    }

    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute('aria-pressed', String(btns[j].getAttribute('data-lang-btn') === lang));
    }

    // Re-render the countdown so digits follow the active script.
    if (root.Countdown && typeof root.Countdown.refresh === 'function') {
      root.Countdown.refresh();
    }
  }

  function set(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply(lang);
  }

  function init() {
    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          set(btn.getAttribute('data-lang-btn'));
        });
      })(btns[i]);
    }
    apply(getLang());
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getLang: getLang };
  } else {
    root.I18n = { getLang: getLang, set: set };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
