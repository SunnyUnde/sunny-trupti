// Planner entry: header, sign-in gate, then the view for the member's role.
import { auth, db, fs, authFns } from '../firebase-init.js';
import { createPlannerData } from './planner-data.js';
import { mountGate, helpUrl } from './planner-gate.js';
import { todayIST, daysTo } from './planner-core.js';
import { WEDDING_DATE } from './planner-config.js';

const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());
const mrDigits = (n) => String(n).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);

function countdown() {
  const n = daysTo(WEDDING_DATE, todayIST(new Date()));
  const node = document.getElementById('days-to-go');
  if (n < 0) { node.hidden = true; return; }
  node.dataset.en = n === 0 ? 'The wedding is today' : `${n} ${n === 1 ? 'day' : 'days'} to go`;
  node.dataset.mr = n === 0 ? 'आज लग्न आहे' : `लग्नाला ${mrDigits(n)} दिवस`;
}

function viewFor(member) {
  const family = member.role === 'reader';
  const h = document.createElement('h2');
  const p = document.createElement('p');
  h.dataset.en = family ? 'Family view' : 'Planner view';
  h.dataset.mr = family ? 'कुटुंबाचे पान' : 'नियोजकाचे पान';
  p.dataset.en = 'Coming soon.';
  p.dataset.mr = 'लवकरच येत आहे.';
  return [h, p];
}

countdown();
retranslate();
document.getElementById('help-link').href = helpUrl();
const gateEl = document.getElementById('gate');
const appEl = document.getElementById('app');
let shownRole = null;

await mountGate(gateEl, {
  auth,
  authFns,
  data: (uid) => createPlannerData({ db, fs, uid }),
  onState: (state, { member }) => {
    if (state !== 'member') { appEl.hidden = true; shownRole = null; return; }
    appEl.hidden = false;
    if (shownRole !== member.role) {
      shownRole = member.role;
      appEl.replaceChildren(...viewFor(member));
      retranslate();
    }
  },
});
