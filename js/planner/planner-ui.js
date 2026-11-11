// Shared UI helpers for the planner.
import { el } from './view-family.js';

let current = null;

// The live region is in planner.html from load, so screen readers register it.
// A modal dialog sits above it, so an open dialog carries its own live slot.
const region = () =>
  [...document.querySelectorAll('dialog[open] .toast-slot')].pop() || document.getElementById('toast-region');

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

// A modal sheet with a title and a Close button. Fill `body`; `dlg` fires 'close'.
export function openDialog(titleEn, titleMr) {
  const dlg = document.createElement('dialog');
  dlg.className = 'pl-dialog';
  const head = document.createElement('div');
  head.className = 'pl-dialog-head';
  const h = document.createElement('h2');
  h.dataset.en = titleEn;
  h.dataset.mr = titleMr;
  h.textContent = titleEn;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'btn-quiet';
  x.dataset.en = 'Close';
  x.dataset.mr = 'बंद करा';
  x.textContent = 'Close';
  x.onclick = () => dlg.close();
  head.append(h, x);
  const body = document.createElement('div');
  body.className = 'pl-dialog-body';
  const slot = document.createElement('div');
  slot.className = 'toast-slot';
  slot.setAttribute('aria-live', 'polite');
  dlg.append(head, body, slot);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  retranslate();
  return { dlg, body, title: h, close: () => dlg.close() };
}

const pressedGroup = (choices, onPick) => {
  const node = el('div', undefined, undefined, 'pf-toggle');
  node.setAttribute('role', 'group');
  const buttons = choices.map(([id, en, mr]) => {
    const b = el('button', en, mr, 'fv-tab');
    b.type = 'button';
    b.onclick = () => onPick(id);
    node.append(b);
    return [id, b];
  });
  const set = (current) => { for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === current)); };
  return { node, set };
};

// Planner | Family, shared by Simple and Full. onPick(id) decides; set(id) shows it.
export const viewToggle = (onPick) =>
  pressedGroup([['planner', 'Planner', 'नियोजक'], ['family', 'Family', 'कुटुंब']], onPick);

// Simple | Full, shared by both planner views. The caller persists and re-mounts.
export function modeSwitch(current, onPick) {
  const g = pressedGroup([['simple', 'Simple', 'सोपे'], ['full', 'Full', 'पूर्ण']], onPick);
  g.set(current);
  return g.node;
}
