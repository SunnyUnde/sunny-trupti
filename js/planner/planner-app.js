// Planner entry: header, sign-in gate, then the view for the member's role.
import { auth, db, fs, authFns } from '../firebase-init.js';
import { createPlannerData } from './planner-data.js';
import { mountGate, helpUrl } from './planner-gate.js';
import { todayIST, daysTo, viewMode } from './planner-core.js';
import { WEDDING_DATE } from './planner-config.js';
import { mountFamily, el } from './view-family.js';
import { mountFull } from './view-planner-full.js';
import { mountSimple } from './view-planner-simple.js';
import { toast, closeAllDialogs } from './planner-ui.js';

const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const mrDigits = (n) => String(n).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);

function countdown() {
  const n = daysTo(WEDDING_DATE, todayIST(new Date()));
  const node = document.getElementById('days-to-go');
  if (n < 0) { node.hidden = true; return; }
  node.dataset.en = n === 0 ? 'The wedding is today' : `${n} ${n === 1 ? 'day' : 'days'} to go`;
  node.dataset.mr = n === 0 ? 'आज लग्न आहे' : `लग्नाला ${mrDigits(n)} दिवस`;
}

let unmount = null;
const stop = () => { closeAllDialogs(); if (unmount) { unmount(); unmount = null; } };

// The one place that decides which view to mount. Readers see Family; everyone else
// follows prefs.mode, and a mode change (setMode) arrives here as a prefs snapshot.
function showView(member, user) {
  stop();
  const data = createPlannerData({ db, fs, uid: user.uid });
  const ctx = { member, user, data, toast };
  if (member.role === 'reader') {
    unmount = mountFamily(appEl, ctx);
    retranslate();
    return;
  }
  // The tab to open in Full, handed to mountFull when the prefs snapshot re-mounts the view.
  let startTab;
  ctx.switchMode = (mode, tab) => {
    startTab = tab;
    return data.setMode(mode).catch(() => toast(WRONG[0], WRONG[1]));
  };
  let mounted = null;
  let unmountView = null;
  const mountMode = (mode) => {
    if (mode === mounted) return;
    mounted = mode;
    closeAllDialogs();
    if (unmountView) unmountView();
    unmountView = mode === 'full' ? mountFull(appEl, ctx, startTab) : mountSimple(appEl, ctx);
    startTab = undefined;
    retranslate();
  };
  const stopPrefs = data.watchPrefs((prefs) => mountMode(viewMode(prefs)), () => { stop(); appEl.replaceChildren(el('p', WRONG[0], WRONG[1], 'fv-empty')); retranslate(); });
  unmount = () => { stopPrefs(); if (unmountView) unmountView(); };
}

const appEl = document.getElementById('app');
countdown();
retranslate();
document.getElementById('help-link').href = helpUrl();
const signOutEl = document.getElementById('signout-link');
const gateEl = document.getElementById('gate');
let shownRole = null;

signOutEl.onclick = () => authFns.signOut(auth);

await mountGate(gateEl, {
  auth,
  authFns,
  data: (uid) => createPlannerData({ db, fs, uid }),
  onState: (state, { user, member }) => {
    if (state !== 'member') {
      stop();
      appEl.hidden = true; signOutEl.hidden = true; shownRole = null; return;
    }
    appEl.hidden = false;
    signOutEl.hidden = false;
    if (shownRole !== member.role) {
      shownRole = member.role;
      showView(member, user);
    }
  },
});
