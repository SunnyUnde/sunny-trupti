// Sign-in gate. gateState is pure (unit-tested); mountGate renders it.
import { isInAppBrowser } from './planner-core.js';
import { HELP_WHATSAPP } from './planner-config.js';

export function gateState({ ua, user, member, request }) {
  if (isInAppBrowser(ua)) return 'in_app_browser';
  if (!user) return 'signed_out';
  if (member) return 'member';
  if (request) return 'pending';
  return 'no_access';
}

// Pure: what the gate body shows. An error must never hide behind Loading.
export function gateBody({ state, authKnown, ready, error }) {
  if (state === 'in_app_browser') return 'in_app_browser';
  if (state === 'signed_out') return authKnown ? 'signed_out' : 'loading';
  if (!ready) return error ? 'error' : 'loading';
  return state;
}

const COPY = {
  loading: ['Loading', 'लोड होत आहे'],
  welcome: ['Welcome to our wedding planner.', 'आमच्या लग्नाच्या नियोजनात स्वागत आहे.'],
  signIn: ['Sign in with Google', 'Google ने साइन इन करा'],
  inApp: ['Please open this page in Chrome or Safari.', 'कृपया हे पान Chrome किंवा Safari मध्ये उघडा.'],
  copy: ['Copy link', 'लिंक कॉपी करा'],
  copied: ['Link copied.', 'लिंक कॉपी झाली.'],
  copyManual: ['Copy the link below.', 'खालील लिंक कॉपी करा.'],
  noAccess: ["You don't have access yet.", 'तुमच्याकडे अजून प्रवेश नाही.'],
  request: ['Request access', 'प्रवेशासाठी विनंती करा'],
  sent: ['Request sent. Sunny or Trupti will approve it soon.', 'विनंती पाठवली. सनी किंवा तृप्ती लवकरच मान्य करतील.'],
  pending: ['Your request is waiting for approval.', 'तुमची विनंती मंजुरीची वाट पाहत आहे.'],
  signOut: ['Sign out', 'साइन आउट'],
  error: ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'],
};

const httpUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

function el(tag, copyKey, attrs = {}) {
  const n = document.createElement(tag);
  if (copyKey) {
    const [en, mr] = COPY[copyKey];
    n.textContent = en;
    n.dataset.en = en;
    n.dataset.mr = mr;
  }
  Object.assign(n, attrs);
  return n;
}

const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());

export function helpUrl() {
  return `https://wa.me/${HELP_WHATSAPP}`;
}

// `data` is a factory: uid -> createPlannerData({db, fs, uid}).
// Resolves with {member, user} the first time an approved member is signed in.
// onState(state, {user, member}) fires on every change, so the app can hide
// its view the moment access is removed.
export function mountGate(root, { auth, authFns, data, onState = () => {}, ua = navigator.userAgent }) {
  const s = { user: null, member: null, request: null, ready: false, sent: false, error: false, fallbackUrl: false };
  let stop = [];
  let resolveFn;
  let resolved = false;
  const done = new Promise((r) => { resolveFn = r; });

  const flag = (key) => (v) => { s[key] = v; };
  const fail = () => { s.error = true; render(); };

  function render() {
    const state = gateState({ ua, user: s.user, member: s.member, request: s.request });
    onState(state, { user: s.user, member: s.member });
    if (state === 'member') {
      root.hidden = true;
      if (!resolved) { resolved = true; resolveFn({ member: s.member, user: s.user }); }
      return;
    }
    root.hidden = false;
    root.replaceChildren(...view(state));
    retranslate();
  }

  function view(state) {
    const body = gateBody({ state, authKnown: s.authKnown, ready: s.ready, error: s.error });
    if (body === 'loading') return [el('p', 'loading')];
    if (body === 'error') return [...errorLine(), signOutBtn()];
    if (body === 'in_app_browser') return inApp();
    if (body === 'signed_out') return signedOut();
    if (state === 'pending') {
      return [el('p', s.sent ? 'sent' : 'pending', { className: 'gate-msg' }), signOutBtn()];
    }
    return noAccess();
  }

  const errorLine = () => (s.error ? [el('p', 'error', { className: 'gate-error', role: 'alert' })] : []);

  function signOutBtn() {
    const b = el('button', 'signOut', { type: 'button', className: 'btn-quiet' });
    b.onclick = () => { s.error = false; authFns.signOut(auth); };
    return b;
  }

  function signedOut() {
    const b = el('button', 'signIn', { type: 'button', className: 'btn-main' });
    b.onclick = signIn;
    return [el('p', 'welcome', { className: 'gate-msg' }), b, ...errorLine()];
  }

  function noAccess() {
    const b = el('button', 'request', { type: 'button', className: 'btn-main' });
    b.onclick = async () => {
      b.disabled = true;
      s.error = false;
      try {
        const u = s.user;
        await data(u.uid).requestAccess({ email: u.email, name: u.displayName || u.email, photoURL: httpUrl(u.photoURL) });
        s.sent = true;
        s.error = false;
        render();
      } catch (e) { b.disabled = false; fail(); }
    };
    return [el('p', 'noAccess', { className: 'gate-msg' }), b, ...errorLine(), signOutBtn()];
  }

  function inApp() {
    const url = location.href;
    const b = el('button', 'copy', { type: 'button', className: 'btn-main' });
    const note = el('p', null, { className: 'gate-note', role: 'status' });
    const input = el('input', null, { type: 'text', readOnly: true, value: url, className: 'gate-url' });
    const label = el('span', null, { id: 'gate-url-label', className: 'sr-only' });
    label.dataset.en = 'Page link';
    label.dataset.mr = 'पानाची लिंक';
    label.textContent = 'Page link';
    input.setAttribute('aria-labelledby', 'gate-url-label');
    input.hidden = !s.fallbackUrl;
    const say = (k) => { note.dataset.en = COPY[k][0]; note.dataset.mr = COPY[k][1]; retranslate(); };
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        say('copied');
      } catch (e) {
        s.fallbackUrl = true;
        input.hidden = false;
        input.focus();
        input.select();
        say('copyManual');
      }
    };
    return [el('p', 'inApp', { className: 'gate-msg' }), b, note, label, input];
  }

  async function signIn() {
    s.error = false;
    const provider = new authFns.GoogleAuthProvider();
    try {
      await authFns.signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        try { await authFns.signInWithRedirect(auth, provider); return; } catch (e2) { /* falls to error */ }
      } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return;
      }
      fail();
    }
  }

  authFns.getRedirectResult(auth).catch(fail);

  authFns.onAuthStateChanged(auth, (user) => {
    stop.forEach((f) => f());
    stop = [];
    Object.assign(s, { user, member: null, request: null, ready: false, sent: false, authKnown: true });
    if (user) {
      const d = data(user.uid);
      const got = { member: false, request: false };
      const arrive = (k) => (v) => {
        s[k] = v;
        got[k] = true;
        s.ready = got.member && got.request;
        render();
      };
      stop = [d.watchMember(arrive('member'), fail), d.watchMyRequest(arrive('request'), fail)];
    }
    render();
  });

  return done;
}
