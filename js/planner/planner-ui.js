// Shared UI helpers for the planner.
let current = null;

// The live region is in planner.html from load, so screen readers register it.
const region = () => document.getElementById('toast-region');

const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());

// One plain sentence for about 5 seconds, in the current language.
export function toast(msgEn, msgMr, { undo } = {}) {
  if (current) current.dismiss();
  const box = document.createElement('div');
  box.className = 'toast';
  const text = document.createElement('span');
  text.dataset.en = msgEn;
  text.dataset.mr = msgMr;
  text.textContent = msgEn;
  box.append(text);
  const timer = setTimeout(() => dismiss(), 5000);
  function dismiss() {
    clearTimeout(timer);
    box.remove();
    if (current && current.box === box) current = null;
  }
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.en = 'Undo';
    b.dataset.mr = 'पूर्ववत करा';
    b.textContent = 'Undo';
    b.onclick = () => { dismiss(); undo(); };
    box.append(b);
  }
  region().replaceChildren(box);
  current = { box, dismiss };
  retranslate();
  return dismiss;
}
