// Planner view, Simple mode: a swipeable card stack for this week, plus Schedule and Add.
// Pure helpers first, DOM after.
import { thisWeek, nextUp, orderStack, todayIST } from './planner-core.js';
import {
  renderSchedule, mountFamily, formatDate, mrDigits, el, text, dual, retranslate,
} from './view-family.js';
import { openTaskEditor } from './task-editor.js';
import { openTaskDetail } from './task-detail.js';
import { attachSwipe } from './swipe.js';
import { viewToggle, modeSwitch } from './planner-ui.js';

// ===== PURE HELPERS =====
export function greeting(hour, name) {
  const part = hour < 12 ? ['morning', 'सकाळ'] : hour < 17 ? ['afternoon', 'दुपार'] : ['evening', 'संध्याकाळ'];
  return { en: `Good ${part[0]}, ${name}`, mr: `शुभ ${part[1]}, ${name}` };
}

// 1-based place of the top card in the week's own order, so Not now moves the count.
export const badgeNumbers = (ordered, base) => ({
  i: ordered.length ? base.findIndex((t) => t.id === ordered[0].id) + 1 : 0,
  total: base.length,
});

export const olderLine = (n) => ({
  en: `${n} older ${n === 1 ? 'task is' : 'tasks are'} waiting.`,
  mr: `${mrDigits(n)} जुन्या ${n === 1 ? 'कामाची' : 'कामांची'} प्रतीक्षा आहे.`,
});

export const requestsLine = (n) => ({
  en: `${n} ${n === 1 ? 'person' : 'people'} asked for access`,
  mr: `${mrDigits(n)} ${n === 1 ? 'व्यक्तीने' : 'जणांनी'} प्रवेश मागितला`,
});

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const LOADING = ['Loading', 'लोड होत आहे'];
const NEEDS = { today: ['tasks', 'labels'], schedule: ['events'], add: [] };

export function mountSimple(root, ctx) {
  const { member, user, data, toast } = ctx;
  const s = {
    tasks: null, labels: [], events: null, failed: {}, loaded: {}, tab: 'today', mode: 'planner',
    deferred: [], requests: 0, comments: new Map(),
  };
  const stops = [];
  let stopFamily = null;

  const toggle = viewToggle(setMode);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const hello = greeting(hour, member.name || user.displayName || '');
  const hi = el('p', hello.en, hello.mr, 'sp-hello');
  const badge = el('p', undefined, undefined, 'sp-badge');
  const banner = el('button', undefined, undefined, 'btn-quiet sp-banner');
  banner.type = 'button';
  banner.onclick = () => ctx.switchMode('full');
  const tablist = el('div', undefined, undefined, 'fv-tabs');
  tablist.setAttribute('role', 'tablist');
  const tabButtons = [['today', 'Today', 'आज'], ['schedule', 'Schedule', 'कार्यक्रम'], ['add', 'Add', 'जोडा']].map(([id, en, mr]) => {
    const b = el('button', en, mr, 'fv-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.onclick = () => { s.tab = id; render(); };
    tablist.append(b);
    return [id, b];
  });
  const panel = el('div', undefined, undefined, 'fv-panel');
  panel.setAttribute('role', 'tabpanel');
  const plannerBox = el('div');
  plannerBox.append(badge, banner, tablist, panel);
  const familyBox = el('div');

  function setMode(mode) {
    s.mode = mode;
    if (stopFamily) { stopFamily(); stopFamily = null; }
    plannerBox.hidden = mode !== 'planner';
    familyBox.hidden = mode !== 'family';
    toggle.set(mode);
    if (mode === 'family') stopFamily = mountFamily(familyBox, ctx);
    else render();
    retranslate();
  }

  const fail = () => toast(WRONG[0], WRONG[1]);
  function change(t, to, doneEn, doneMr) {
    const from = t.status;
    data.setStatus(t.id, from, to).then(
      () => toast(`${t.title} ${doneEn}`, `${t.title} ${doneMr}`, { undo: () => data.setStatus(t.id, to, from).catch(fail) }),
      fail,
    );
  }
  const done = (t) => change(t, 'done', 'marked done.', 'झाले म्हणून नोंदवले.');
  const started = (t) => change(t, 'progress', 'started.', 'सुरू केले.');
  function notNow(t) {
    s.deferred = [...s.deferred.filter((id) => id !== t.id), t.id];
    toast(`${t.title} moved to the back for now.`, `${t.title} सध्या मागे ठेवले.`);
    render();
  }

  // Comment counts for the cards in the stack only.
  function syncComments(ids) {
    for (const [id, c] of s.comments) {
      if (!ids.includes(id)) { c.stop(); s.comments.delete(id); }
    }
    for (const id of ids) {
      if (s.comments.has(id)) continue;
      const c = { n: 0, stop: null };
      s.comments.set(id, c);
      c.stop = data.watchComments(id, (list) => { c.n = list.length; render(); }, () => {}); // a denied count just stays off the card
    }
  }

  function card(t, labelsById) {
    const c = el('article', undefined, undefined, 'fv-card sp-card');
    c.append(text('h3', t.title, 'sp-title'));
    const tags = el('p', undefined, undefined, 'fv-tags');
    for (const id of t.labels || []) if (labelsById.has(id)) tags.append(text('span', labelsById.get(id).name, 'fv-tag'));
    const due = el('p', undefined, undefined, 'fv-line');
    due.append(el('span', `Due ${formatDate(t.due, 'en', { weekday: false })}`, `मुदत ${formatDate(t.due, 'mr', { weekday: false })}`));
    const n = s.comments.get(t.id)?.n || 0;
    c.append(tags, due, text('p', t.ownerName || '', 'fv-line'));
    if (t.status === 'progress') c.append(el('p', 'In progress', 'सुरू आहे', 'fv-status'));
    if (n) c.append(el('p', `${n} ${n === 1 ? 'comment' : 'comments'}`, `${mrDigits(n)} ${n === 1 ? 'टिप्पणी' : 'टिप्पण्या'}`, 'fv-status'));
    return c;
  }

  function actionButton(en, mr, cls, fn) {
    const b = el('button', en, mr, cls);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }

  function renderToday(today) {
    const wrap = el('div', undefined, undefined, 'fv-stack');
    const week = thisWeek(s.tasks, member, today);
    const ordered = orderStack(week.stack, s.deferred);
    syncComments(ordered.map((t) => t.id));
    const labelsById = new Map(s.labels.map((l) => [l.id, l]));
    const { i, total } = badgeNumbers(ordered, week.stack);
    badge.hidden = !total;
    badge.dataset.en = `This week · ${i} of ${total}`;
    badge.dataset.mr = `या आठवड्यात · ${mrDigits(total)} पैकी ${mrDigits(i)}`;

    if (ordered.length) {
      const top = ordered[0];
      const stack = el('div', undefined, undefined, 'sp-stack');
      for (const t of ordered.slice(1, 3).reverse()) {
        const peek = el('div', undefined, undefined, 'fv-card sp-peek');
        peek.setAttribute('aria-hidden', 'true');
        stack.append(peek);
      }
      const front = card(top, labelsById);
      attachSwipe(front, { onRight: () => done(top), onLeft: () => notNow(top), threshold: 0.3 });
      stack.append(front);
      const dots = el('p', undefined, undefined, 'sp-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (const t of week.stack) dots.append(el('span', undefined, undefined, t.id === top.id ? 'sp-dot sp-dot-on' : 'sp-dot'));
      const row = el('div', undefined, undefined, 'sp-actions');
      row.append(
        actionButton('Done', 'झाले', 'btn-main sp-done', () => done(top)),
        ...(top.status === 'todo' ? [actionButton('Started', 'सुरू केले', 'btn-quiet', () => started(top))] : []),
        actionButton('Not now', 'आत्ता नाही', 'btn-quiet', () => notNow(top)),
        actionButton('Comment', 'टिप्पणी', 'btn-quiet', () => openTaskDetail(ctx, top.id)),
      );
      wrap.append(stack, dots, row);
    } else {
      const empty = el('article', undefined, undefined, 'fv-card');
      empty.append(dual('p', ['All done for this week.', 'या आठवड्याची सर्व कामे झाली.'], 'fv-line'));
      const next = nextUp(s.tasks, member, today);
      if (next) {
        const p = el('p', undefined, undefined, 'fv-line');
        p.append(el('span', 'Next up: ', 'पुढचे: '), text('span', next.title),
          el('span', ` on ${formatDate(next.due, 'en', { weekday: false })}.`, ` ${formatDate(next.due, 'mr', { weekday: false })} रोजी.`));
        empty.append(p);
      }
      wrap.append(empty);
    }
    if (week.olderCount) {
      const o = olderLine(week.olderCount);
      wrap.append(el('p', o.en, o.mr, 'fv-line fv-waiting'));
    }
    return wrap;
  }

  function renderAdd() {
    const wrap = el('div', undefined, undefined, 'fv-stack');
    wrap.append(actionButton('Add a task', 'काम जोडा', 'btn-main', () => openTaskEditor(ctx, null)));
    return wrap;
  }

  function render() {
    if (s.mode !== 'planner') return;
    for (const [id, b] of tabButtons) b.setAttribute('aria-selected', String(id === s.tab));
    const r = requestsLine(s.requests);
    banner.hidden = !s.requests || s.tab !== 'today';
    banner.dataset.en = r.en;
    banner.dataset.mr = r.mr;
    badge.hidden = s.tab !== 'today';
    const needs = NEEDS[s.tab];
    let body;
    if (needs.some((w) => s.failed[w])) body = dual('p', WRONG, 'fv-empty');
    else if (needs.some((w) => !s.loaded[w])) body = dual('p', LOADING, 'fv-empty');
    else if (s.tab === 'today') body = renderToday(todayIST(new Date()));
    else if (s.tab === 'schedule') body = renderSchedule(s.events);
    else body = renderAdd();
    panel.replaceChildren(body);
    retranslate();
  }

  const watcher = (name, set) => [
    (v) => { set(v); s.loaded[name] = true; s.failed[name] = false; render(); },
    () => { s.failed[name] = true; render(); },
  ];
  stops.push(data.watchTasks(member, {}, ...watcher('tasks', (t) => { s.tasks = t; })));
  stops.push(data.watchEvents(member, {}, ...watcher('events', (e) => { s.events = e; })));
  stops.push(data.watchLabels(...watcher('labels', (l) => { s.labels = l; })));
  // Only owners may read requests. A denial just leaves the banner off.
  if (member.role === 'owner') stops.push(data.watchRequests((r) => { s.requests = r.length; render(); }, () => {}));

  root.replaceChildren(hi, modeSwitch('simple', ctx.switchMode), toggle.node, plannerBox, familyBox);
  setMode('planner');

  return () => {
    if (stopFamily) stopFamily();
    stops.forEach((stop) => stop());
    s.comments.forEach((c) => c.stop());
    root.replaceChildren();
  };
}
