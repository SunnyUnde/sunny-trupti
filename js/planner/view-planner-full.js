// Planner view, Full mode: Home and Tasks, plus the Planner | Family toggle.
// Pure helpers first, DOM after.
import { applyFilters, progress, deadlineWindow, daysTo, todayIST, formatRupees } from './planner-core.js';
import { WEDDING_DATE } from './planner-config.js';
import {
  mountFamily, groupEventsByDate, filterByLabels, usedLabels, activeFilterCount, statusWords,
  formatDate, mrDigits, el, text, dual, retranslate,
} from './view-family.js';
import { openTaskEditor, visibilityChoices, visibilityLabel } from './task-editor.js';
import { openTaskDetail, statusMessage } from './task-detail.js';
import { viewToggle, modeLink } from './planner-ui.js';
import { renderEvents } from './view-events.js';
import { createVendors } from './view-vendors.js';
import { createAccess } from './view-access.js';

// ===== PURE HELPERS =====
export const WINDOWS = {
  w1: ['By 22 Nov', '२२ नोव्हेंबरपर्यंत'],
  w2: ['23 Nov to 15 Dec', '२३ नोव्हेंबर ते १५ डिसेंबर'],
  w3: ['16 Dec to 10 Jan', '१६ डिसेंबर ते १० जानेवारी'],
  w4: ['11 to 22 Jan', '११ ते २२ जानेवारी'],
  w5: ['Wedding weekend', 'लग्नाचा आठवडा-अखेर'],
  w6: ['After', 'त्यानंतर'],
};

const byDueThenTitle = (a, b) => (a.due || '9').localeCompare(b.due || '9') || a.title.localeCompare(b.title);

export function groupByWindow(tasks) {
  return Object.keys(WINDOWS)
    .map((key) => ({ key, tasks: tasks.filter((t) => deadlineWindow(t.due) === key).sort(byDueThenTitle) }))
    .filter((g) => g.tasks.length);
}

export function homeSummary(tasks, vendors, today) {
  const open = tasks.filter((t) => t.status !== 'done' && t.due);
  return {
    ...progress(tasks),
    booked: vendors.filter((v) => ['booked', 'paid'].includes(v.status)).length,
    vendorTotal: vendors.length,
    overdue: open.filter((t) => t.due < today).sort(byDueThenTitle),
    nextDue: open.filter((t) => t.due >= today).sort(byDueThenTitle)[0] || null,
  };
}

export const budgetSummary = (vendors, budget) => ({
  paid: vendors.reduce((sum, v) => sum + (v.paid || 0), 0),
  total: budget ? budget.total : null,
});

export function nextEvent(events, today) {
  const day = groupEventsByDate(events.filter((e) => e.date >= today))[0];
  return day ? { ...day.events[0], date: day.date } : null;
}

export function ownerChips(tasks) {
  const seen = new Map();
  for (const t of tasks) if (!seen.has(t.owner)) seen.set(t.owner, t.ownerName);
  return [...seen].map(([value, name]) => ({ value, name }));
}

export function filterTasks(tasks, f, labels) {
  const byId = new Map(labels.map((l) => [l.id, l]));
  return filterByLabels(
    applyFilters(tasks, { statuses: f.statuses, owners: f.owners, visibilities: f.visibilities }),
    byId,
    f,
  );
}

export const filterCount = (f, labels) =>
  f.statuses.length + f.owners.length + f.visibilities.length + activeFilterCount(f, labels);

export { statusMessage };

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const LOADING = ['Loading', 'लोड होत आहे'];
const NOTHING = ['Nothing here yet.', 'इथे अजून काही नाही.'];
const NEEDS = {
  home: ['tasks', 'vendors', 'events', 'budget'],
  tasks: ['tasks', 'labels'],
  events: ['events', 'labels', 'tasks'],
  vendors: ['vendors', 'budget'],
  access: ['requests', 'members'],
};
const STATUS_IDS = ['todo', 'progress', 'done'];

function chipRow(titleEnMr, items, selected, onToggle) {
  const row = el('div', undefined, undefined, 'fv-chips');
  row.setAttribute('role', 'group');
  row.append(dual('span', titleEnMr, 'fv-chips-title'));
  for (const it of items) {
    const b = it.en ? el('button', it.en, it.mr, 'fv-chip') : text('button', it.name, 'fv-chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(selected.includes(it.value)));
    b.onclick = () => onToggle(it.value);
    row.append(b);
  }
  return row;
}

function toggleList(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function mountFull(root, ctx, startTab = 'home') {
  const { member, data, toast } = ctx;
  const s = {
    tasks: null, labels: [], events: null, vendors: null, budget: null, failed: {}, loaded: {},
    requests: [], members: [], mode: 'planner', tab: startTab, filterOpen: false,
    f: { statuses: [], owners: [], visibilities: [], day: [], category: [] },
  };
  const owner = member.role === 'owner';
  const stops = [];
  let stopFamily = null;
  const vendorsView = createVendors(ctx, () => render());
  const accessView = createAccess(ctx, () => render());

  const toggle = viewToggle(setMode);
  const tablist = el('div', undefined, undefined, 'fv-tabs');
  tablist.setAttribute('role', 'tablist');
  const tabDefs = [['home', 'Home', 'मुख्य'], ['tasks', 'Tasks', 'कामे'], ['events', 'Events', 'कार्यक्रम'], ['vendors', 'Vendors', 'विक्रेते']];
  if (owner) tabDefs.push(['access', 'Access', 'प्रवेश']);
  const tabButtons = tabDefs.map(([id, en, mr]) => {
    const b = el('button', en, mr, 'fv-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.onclick = () => { s.tab = id; render(); };
    tablist.append(b);
    return [id, b];
  });
  const plannerBox = el('div');
  const panel = el('div', undefined, undefined, 'fv-panel');
  panel.setAttribute('role', 'tabpanel');
  plannerBox.append(tablist, panel, modeLink('full', ctx.switchMode));
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

  const open = (id) => openTaskDetail(ctx, id);

  function advance(t) {
    const to = { todo: 'progress', progress: 'done' }[t.status];
    data.setStatus(t.id, t.status, to).then(() => {
      const [en, mr] = statusMessage(to);
      toast(en, mr, { undo: () => data.setStatus(t.id, to, t.status).catch(() => toast(WRONG[0], WRONG[1])) });
    }, () => toast(WRONG[0], WRONG[1]));
  }

  function dueLine(t, today) {
    const overdue = t.status !== 'done' && t.due && t.due < today;
    const p = el('p', undefined, undefined, overdue ? 'fv-line pf-overdue' : 'fv-line');
    p.append(t.due
      ? el('span', `Due ${formatDate(t.due, 'en', { weekday: false })}`, `मुदत ${formatDate(t.due, 'mr', { weekday: false })}`)
      : el('span', 'No due date', 'मुदत नाही'));
    if (overdue) p.append(el('strong', ' Overdue', ' मुदत उलटली', 'fv-wait-word'));
    return p;
  }

  function taskCard(t, today, labelsById) {
    const card = el('article', undefined, undefined, 'fv-card');
    const name = text('button', t.title, 'pf-title');
    name.type = 'button';
    name.onclick = () => open(t.id);
    card.append(name, text('p', t.ownerName || '', 'fv-line'), dueLine(t, today));
    const [sen, smr] = statusWords(t.status);
    if (t.status === 'done') {
      card.append(el('p', sen, smr, 'fv-status fv-status-done'));
    } else {
      const pill = el('button', undefined, undefined, `pf-pill pf-pill-${t.status}`);
      pill.type = 'button';
      pill.append(el('span', sen, smr));
      const nx = statusWords({ todo: 'progress', progress: 'done' }[t.status]);
      pill.append(el('span', `, tap for ${nx[0]}`, `, पुढे: ${nx[1]}`));
      pill.onclick = () => advance(t);
      card.append(pill);
    }
    const chips = el('p', undefined, undefined, 'fv-tags');
    for (const id of t.labels || []) if (labelsById.has(id)) chips.append(text('span', labelsById.get(id).name, 'fv-tag'));
    chips.append(dual('span', visibilityLabel(t.visibility), 'fv-tag'));
    card.append(chips);
    return card;
  }

  function renderTasks(today) {
    const wrap = el('div', undefined, undefined, 'fv-stack');
    const add = el('button', '+ Add task', '+ काम जोडा', 'btn-main');
    add.type = 'button';
    add.onclick = () => openTaskEditor(ctx, null);
    const labels = usedLabels(s.tasks, s.labels);
    const n = filterCount(s.f, labels);
    const fbtn = el('button', n ? `Filter (${n})` : 'Filter', n ? `निवडा (${mrDigits(n)})` : 'निवडा', 'fv-filter-btn');
    fbtn.type = 'button';
    fbtn.setAttribute('aria-expanded', String(s.filterOpen));
    fbtn.onclick = () => { s.filterOpen = !s.filterOpen; render(); };
    wrap.append(add, fbtn);
    if (s.filterOpen) {
      const set = (key) => (v) => { s.f[key] = toggleList(s.f[key], v); render(); };
      const box = el('div', undefined, undefined, 'fv-filters');
      box.append(
        chipRow(['Status', 'स्थिती'], STATUS_IDS.map((value) => ({ value, en: statusWords(value)[0], mr: statusWords(value)[1] })), s.f.statuses, set('statuses')),
        chipRow(['Owner', 'जबाबदार'], ownerChips(s.tasks), s.f.owners, set('owners')),
      );
      for (const g of ['day', 'category']) {
        const items = labels.filter((l) => l.group === g).map((l) => ({ value: l.id, name: l.name }));
        if (items.length) box.append(chipRow(g === 'day' ? ['Day', 'दिवस'] : ['Category', 'प्रकार'], items, s.f[g], set(g)));
      }
      box.append(chipRow(['Who can see', 'कोण पाहू शकेल'], visibilityChoices(member), s.f.visibilities, set('visibilities')));
      wrap.append(box);
    }
    const byId = new Map(s.labels.map((l) => [l.id, l]));
    const groups = groupByWindow(filterTasks(s.tasks, s.f, s.labels));
    if (!groups.length) wrap.append(dual('p', NOTHING, 'fv-empty'));
    for (const g of groups) {
      const sec = el('section', undefined, undefined, 'fv-day');
      sec.append(dual('h3', WINDOWS[g.key], 'fv-date'));
      for (const t of g.tasks) sec.append(taskCard(t, today, byId));
      wrap.append(sec);
    }
    return wrap;
  }

  function renderHome(today) {
    const wrap = el('div', undefined, undefined, 'fv-stack');
    const days = daysTo(WEDDING_DATE, today);
    if (days >= 0) {
      wrap.append(el('p', days === 0 ? 'The wedding is today' : `${days} ${days === 1 ? 'day' : 'days'} to go`,
        days === 0 ? 'आज लग्न आहे' : `लग्नाला ${mrDigits(days)} दिवस`, 'pf-countdown'));
    }
    const h = homeSummary(s.tasks, s.vendors, today);
    wrap.append(el('p', `${h.done} of ${h.total} tasks done · ${h.booked} of ${h.vendorTotal} vendors booked`,
      `${mrDigits(h.total)} पैकी ${mrDigits(h.done)} कामे झाली · ${mrDigits(h.vendorTotal)} पैकी ${mrDigits(h.booked)} विक्रेते नक्की`, 'fv-progress-label'));

    const attention = el('article', undefined, undefined, 'fv-card');
    attention.append(el('h4', 'Needs attention', 'लक्ष द्यायचे'));
    const byId = new Map(s.labels.map((l) => [l.id, l]));
    const items = [...h.overdue, ...(h.nextDue ? [h.nextDue] : [])];
    if (!items.length) attention.append(dual('p', ['Nothing is waiting.', 'काहीही प्रलंबित नाही.'], 'fv-line'));
    for (const t of items) attention.append(taskCard(t, today, byId));
    wrap.append(attention);

    const ev = nextEvent(s.events, today);
    const evCard = el('article', undefined, undefined, 'fv-card');
    evCard.append(el('h4', 'Next event', 'पुढचा कार्यक्रम'));
    if (ev) {
      evCard.append(text('p', ev.title, 'fv-line'), el('p', formatDate(ev.date, 'en'), formatDate(ev.date, 'mr'), 'fv-time'));
      if (ev.time) evCard.append(text('p', ev.time, 'fv-line'));
    } else evCard.append(dual('p', NOTHING, 'fv-line'));
    wrap.append(evCard);

    const b = budgetSummary(s.vendors, s.budget);
    const bCard = el('article', undefined, undefined, 'fv-card');
    bCard.append(el('h4', 'Budget used', 'वापरलेले बजेट'));
    bCard.append(b.total === null
      ? dual('p', ['Budget not set yet.', 'बजेट अजून ठरवलेले नाही.'], 'fv-line')
      : el('p', `${formatRupees(b.paid)} of ${formatRupees(b.total)} paid`, `${formatRupees(b.total)} पैकी ${formatRupees(b.paid)} दिले`, 'fv-line'));
    wrap.append(bCard);
    return wrap;
  }

  function renderTab(today) {
    if (s.tab === 'home') return renderHome(today);
    if (s.tab === 'tasks') return renderTasks(today);
    if (s.tab === 'events') return renderEvents(ctx, { events: s.events, labels: s.labels, tasks: s.tasks });
    if (s.tab === 'vendors') return vendorsView.render({ vendors: s.vendors, budget: s.budget, members: s.members });
    return accessView.render({ requests: s.requests, members: s.members });
  }

  function render() {
    if (s.mode !== 'planner') return;
    for (const [id, b] of tabButtons) b.setAttribute('aria-selected', String(id === s.tab));
    const access = tabButtons.find(([id]) => id === 'access');
    if (access) {
      const n = s.requests.length;
      access[1].dataset.en = n ? `Access (${n})` : 'Access';
      access[1].dataset.mr = n ? `प्रवेश (${mrDigits(n)})` : 'प्रवेश';
      access[1].textContent = access[1].dataset.en;
    }
    const needs = s.tab === 'vendors' && owner ? [...NEEDS.vendors, 'members'] : NEEDS[s.tab];
    let body;
    if (needs.some((w) => s.failed[w])) body = dual('p', WRONG, 'fv-empty');
    else if (needs.some((w) => !s.loaded[w])) body = dual('p', LOADING, 'fv-empty');
    else body = renderTab(todayIST(new Date()));
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
  stops.push(data.watchVendors(...watcher('vendors', (v) => { s.vendors = v; })));
  stops.push(data.watchBudget(...watcher('budget', (b) => { s.budget = b; })));
  if (owner) {
    stops.push(data.watchRequests(...watcher('requests', (r) => { s.requests = r; })));
    stops.push(data.watchMembers(...watcher('members', (m) => { s.members = m.map((x) => ({ ...x, uid: x.id })); })));
  }

  root.replaceChildren(toggle.node, plannerBox, familyBox);
  setMode('planner');

  return () => {
    if (stopFamily) stopFamily();
    stops.forEach((stop) => stop());
    root.replaceChildren();
  };
}
