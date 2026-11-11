// Planner entry: header, sign-in gate, then the view for the member's role.
import { auth, db, fs, authFns } from '../firebase-init.js';
import { createPlannerData } from './planner-data.js';
import { mountGate, helpUrl } from './planner-gate.js';
import { todayIST, daysTo } from './planner-core.js';
import { WEDDING_DATE } from './planner-config.js';
import { mountFamily } from './view-family.js';
import { mountFull } from './view-planner-full.js';
import { toast } from './planner-ui.js';

const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());
const mrDigits = (n) => String(n).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);

function countdown() {
  const n = daysTo(WEDDING_DATE, todayIST(new Date()));
  const node = document.getElementById('days-to-go');
  if (n < 0) { node.hidden = true; return; }
  node.dataset.en = n === 0 ? 'The wedding is today' : `${n} ${n === 1 ? 'day' : 'days'} to go`;
  node.dataset.mr = n === 0 ? 'आज लग्न आहे' : `लग्नाला ${mrDigits(n)} दिवस`;
}

let unmount = null;
function showView(member, user) {
  if (unmount) { unmount(); unmount = null; }
  const ctx = { member, user, data: createPlannerData({ db, fs, uid: user.uid }), toast };
  unmount = (member.role === 'reader' ? mountFamily : mountFull)(appEl, ctx);
  retranslate();
}

const appEl = document.getElementById('app');
countdown();
retranslate();
document.getElementById('help-link').href = helpUrl();
const gateEl = document.getElementById('gate');
let shownRole = null;

await mountGate(gateEl, {
  auth,
  authFns,
  data: (uid) => createPlannerData({ db, fs, uid }),
  onState: (state, { user, member }) => {
    if (state !== 'member') {
      if (unmount) { unmount(); unmount = null; }
      appEl.hidden = true; shownRole = null; return;
    }
    appEl.hidden = false;
    if (shownRole !== member.role) {
      shownRole = member.role;
      showView(member, user);
    }
  },
});
