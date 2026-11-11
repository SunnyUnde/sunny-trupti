// Pure planner logic. No DOM, no Firebase. ES module for browser and Node.

const DAY_MS = 86400000;
const WINDOW_ENDS = [
  ['w1', '2026-11-22'],
  ['w2', '2026-12-15'],
  ['w3', '2027-01-10'],
  ['w4', '2027-01-22'],
  ['w5', '2027-01-24'],
];
const NEXT = { todo: 'progress', progress: 'done', done: 'done' };
const IN_APP_RE = /WhatsApp|Instagram|FBAN|FBAV|\bLine\/|; wv\)/i;

const dayNumber = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

export const todayIST = (now) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

export const daysTo = (dateStr, today) => dayNumber(dateStr) - dayNumber(today);

export const visibleSet = ({ role, side }) =>
  role === 'reader' ? ['everyone'] : ['everyone', 'planners', side];

export const familySet = () => ['everyone'];

export const canSee = (item, member) => visibleSet(member).includes(item.visibility);

export const nextStatus = (s) => NEXT[s];

export function thisWeek(tasks, member, today) {
  const family = member.side ? `${member.side}_family` : null;
  const mine = tasks.filter(
    (t) => t.status !== 'done' && (t.owner === member.uid || t.owner === family || t.owner === 'both'),
  );
  const stack = mine
    .filter((t) => t.due >= today && daysTo(t.due, today) <= 7)
    .sort(
      (a, b) =>
        (b.status === 'progress') - (a.status === 'progress') ||
        a.due.localeCompare(b.due) ||
        a.title.localeCompare(b.title),
    );
  return { stack, olderCount: mine.filter((t) => t.due < today).length, total: stack.length };
}

export const deadlineWindow = (due) =>
  (due && WINDOW_ENDS.find(([, end]) => due <= end)?.[0]) || 'w6';

export function applyFilters(tasks, { statuses, owners, labelIds, visibilities } = {}) {
  const on = (g) => g && g.length;
  return tasks.filter(
    (t) =>
      (!on(statuses) || statuses.includes(t.status)) &&
      (!on(owners) || owners.includes(t.owner)) &&
      (!on(labelIds) || (t.labels || []).some((l) => labelIds.includes(l))) &&
      (!on(visibilities) || visibilities.includes(t.visibility)),
  );
}

export function progress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function formatRupees(n) {
  const v = Math.round(n ?? 0);
  return `${v < 0 ? '-' : ''}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(v))}`;
}

export const isInAppBrowser = (ua) => IN_APP_RE.test(ua || '');
