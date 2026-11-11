// Read-only Family view. Always uses family queries, so an Editor previewing
// it sees exactly what a Reader sees. Pure helpers first, DOM after.
import { progress, todayIST, applyFilters } from './planner-core.js';
import { VENUE } from './planner-config.js';

// ===== PURE HELPERS =====
const STATUS = {
  todo: ['To do', 'करायचे आहे'],
  progress: ['In progress', 'सुरू आहे'],
  done: ['Done', 'झाले'],
};
const LOCALES = { en: 'en-IN', mr: 'mr-IN' };
const mrDigits = (n) => String(n).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);

export const statusWords = (status) => STATUS[status] || STATUS.todo;

// 'YYYY-MM-DD' to words in one language. UTC so the date never shifts.
export function formatDate(date, lang, { weekday = true } = {}) {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: 'UTC', weekday: weekday ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Dates ascending; inside a day, timed events first, then by title.
export function groupEventsByDate(events) {
  const byDate = new Map();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push({
      id: e.id,
      title: e.title,
      time: (e.time || '').trim(),
      place: (e.place || '').trim(),
      host: (e.host || '').trim(),
    });
  }
  return [...byDate.keys()].sort().map((date) => ({
    date,
    events: byDate.get(date).sort(
      (a, b) => (!a.time - !b.time) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title),
    ),
  }));
}

// A missed due date is not done and before today.
export const isWaiting = (task, today) => task.status !== 'done' && !!task.due && task.due < today;

export function taskRow(task, labelsById, today) {
  return {
    id: task.id,
    title: task.title,
    ownerName: (task.ownerName || '').trim() || null, // null shows "Former member"
    due: task.due || '',
    status: task.status,
    waiting: isWaiting(task, today),
    // Other-side tasks may keep deleted label ids; those are dropped.
    labels: (task.labels || []).filter((id) => labelsById.has(id)).map((id) => labelsById.get(id)),
  };
}

// Within a group a task needs any chosen label; across groups it needs both.
export function filterByLabels(tasks, labelsById, selected) {
  return ['day', 'category'].reduce((list, group) => {
    const ids = (selected[group] || []).filter((id) => labelsById.get(id)?.group === group);
    return applyFilters(list, { labelIds: ids });
  }, tasks);
}

export function taskRows(tasks, labels, selected, today) {
  const byId = new Map(labels.map((l) => [l.id, l]));
  return filterByLabels(tasks, byId, selected)
    .map((t) => taskRow(t, byId, today))
    .sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || a.title.localeCompare(b.title));
}

// ===== DOM =====
const retranslate = () => window.I18n && window.I18n.set(window.I18n.getLang());

function el(tag, en, mr, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (en !== undefined) { n.textContent = en; n.dataset.en = en; n.dataset.mr = mr; }
  return n;
}
const text = (tag, s, cls) => { const n = el(tag, undefined, undefined, cls); n.textContent = s; return n; };
const dual = (tag, enMr, cls) => el(tag, enMr[0], enMr[1], cls);

const NOTHING = ['Nothing here yet.', 'इथे अजून काही नाही.'];
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const LOADING = ['Loading', 'लोड होत आहे'];
const TABS = [
  ['schedule', 'Schedule', 'कार्यक्रम'],
  ['progress', 'Progress', 'तयारी'],
  ['venue', 'Venue', 'ठिकाण'],
];

function dateHeading(date) {
  const h = el('h3', formatDate(date, 'en'), formatDate(date, 'mr'), 'fv-date');
  return h;
}

function renderSchedule(events) {
  const wrap = el('div', undefined, undefined, 'fv-stack');
  const days = groupEventsByDate(events);
  if (!days.length) return dual('p', NOTHING, 'fv-empty');
  for (const day of days) {
    const group = el('section', undefined, undefined, 'fv-day');
    group.append(dateHeading(day.date));
    for (const e of day.events) {
      const card = el('article', undefined, undefined, 'fv-card');
      card.append(text('h4', e.title));
      card.append(e.time
        ? text('p', e.time, 'fv-time')
        : el('p', 'Time to be confirmed', 'वेळ अजून ठरायची आहे', 'fv-time'));
      if (e.place) card.append(text('p', e.place, 'fv-line'));
      if (e.host) {
        const p = el('p', undefined, undefined, 'fv-line');
        p.append(el('span', 'Host: ', 'यजमान: '), text('span', e.host));
        card.append(p);
      }
      group.append(card);
    }
    wrap.append(group);
  }
  return wrap;
}

function chipRow(labels, group, selected, onToggle) {
  const row = el('div', undefined, undefined, 'fv-chips');
  row.setAttribute('role', 'group');
  const title = group === 'day' ? ['Day', 'दिवस'] : ['Category', 'प्रकार'];
  row.append(dual('span', title, 'fv-chips-title'));
  for (const l of labels.filter((x) => x.group === group)) {
    const b = text('button', l.name, 'fv-chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(selected.includes(l.id)));
    b.onclick = () => onToggle(group, l.id);
    row.append(b);
  }
  return row;
}

function renderProgress(tasks, labels, selected, onToggle) {
  const wrap = el('div', undefined, undefined, 'fv-stack');
  const filters = el('div', undefined, undefined, 'fv-filters');
  for (const g of ['day', 'category']) {
    if (labels.some((l) => l.group === g)) filters.append(chipRow(labels, g, selected[g], onToggle));
  }
  wrap.append(filters);
  const rows = taskRows(tasks, labels, selected, todayIST(new Date()));
  if (!rows.length) { wrap.append(dual('p', NOTHING, 'fv-empty')); return wrap; }
  for (const r of rows) {
    const card = el('article', undefined, undefined, 'fv-card');
    card.append(text('h4', r.title));
    const owner = el('p', undefined, undefined, 'fv-line');
    owner.append(r.ownerName ? text('span', r.ownerName) : el('span', 'Former member', 'माजी सदस्य'));
    card.append(owner);
    if (r.due) {
      const due = el('p', undefined, undefined, r.waiting ? 'fv-line fv-waiting' : 'fv-line');
      due.append(el('span', 'Due ', 'मुदत '));
      due.append(el('span', formatDate(r.due, 'en', { weekday: false }), formatDate(r.due, 'mr', { weekday: false })));
      if (r.waiting) due.append(el('strong', ' Waiting', ' प्रतीक्षेत', 'fv-wait-word'));
      card.append(due);
    }
    card.append(dual('p', statusWords(r.status), `fv-status fv-status-${r.status}`));
    if (r.labels.length) {
      const chips = el('p', undefined, undefined, 'fv-tags');
      for (const l of r.labels) chips.append(text('span', l.name, 'fv-tag'));
      card.append(chips);
    }
    wrap.append(card);
  }
  return wrap;
}

function renderVenue() {
  const card = el('article', undefined, undefined, 'fv-card');
  card.append(text('h4', VENUE.name));
  const a = el('a', 'Open in Maps', 'नकाशात उघडा', 'btn-main fv-map');
  a.href = VENUE.mapUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  card.append(a);
  return card;
}

export function mountFamily(root, ctx) {
  const { member, data } = ctx;
  const s = { tasks: null, events: null, labels: [], tab: 'schedule', selected: { day: [], category: [] }, failed: false };
  const stops = [];

  const badge = el('p', 'View only', 'फक्त पाहण्यासाठी', 'fv-badge');
  const barWrap = el('div', undefined, undefined, 'fv-progress');
  const barLabel = el('p', undefined, undefined, 'fv-progress-label');
  const track = el('div', undefined, undefined, 'fv-track');
  const fill = el('div', undefined, undefined, 'fv-fill');
  track.append(fill);
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  barWrap.append(barLabel, track);

  const tablist = el('div', undefined, undefined, 'fv-tabs');
  tablist.setAttribute('role', 'tablist');
  const panel = el('div', undefined, undefined, 'fv-panel');
  panel.setAttribute('role', 'tabpanel');
  const buttons = TABS.map(([id, en, mr]) => {
    const b = el('button', en, mr, 'fv-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.onclick = () => { s.tab = id; render(); };
    tablist.append(b);
    return [id, b];
  });

  function toggle(group, id) {
    const list = s.selected[group];
    s.selected[group] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    render();
  }

  function render() {
    for (const [id, b] of buttons) b.setAttribute('aria-selected', String(id === s.tab));
    const p = s.tasks ? progress(s.tasks) : { pct: 0 };
    barLabel.dataset.en = `Preparations ${p.pct}% done`;
    barLabel.dataset.mr = `तयारी ${mrDigits(p.pct)}% पूर्ण`;
    fill.style.width = `${p.pct}%`;
    track.setAttribute('aria-valuenow', String(p.pct));
    track.setAttribute('aria-label', barLabel.dataset.en);
    let body;
    if (s.failed) body = dual('p', WRONG, 'fv-empty');
    else if (s.tab === 'venue') body = renderVenue();
    else if ((s.tab === 'schedule' ? s.events : s.tasks) === null) body = dual('p', LOADING, 'fv-empty');
    else if (s.tab === 'schedule') body = renderSchedule(s.events);
    else body = renderProgress(s.tasks, s.labels, s.selected, toggle);
    panel.replaceChildren(body);
    retranslate();
  }

  const fail = () => { s.failed = true; render(); };
  stops.push(data.watchTasks(member, { family: true }, (t) => { s.tasks = t; render(); }, fail));
  stops.push(data.watchEvents(member, { family: true }, (e) => { s.events = e; render(); }, fail));
  stops.push(data.watchLabels((l) => { s.labels = l; render(); }, fail));

  root.replaceChildren(badge, barWrap, tablist, panel);
  render();

  return () => {
    stops.forEach((stop) => stop());
    root.replaceChildren();
  };
}
