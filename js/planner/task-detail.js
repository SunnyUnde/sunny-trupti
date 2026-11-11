// Task detail sheet: status switch, notes, comments, history, delete.
import { openDialog } from './planner-ui.js';
import { openTaskEditor, visibilityLabel } from './task-editor.js';
import { statusWords, formatDate, el, text, dual, retranslate } from './view-family.js';

// ===== PURE HELPERS =====
export const safePhoto = (url) => (/^https?:\/\//i.test(url || '') ? url : null);

// Editors cannot read the members list, so another planner may be unnamed (null).
export function personName(uid, self, membersById) {
  if (uid === self.uid) return self.name;
  return membersById.get(uid)?.name ?? null;
}

const LOCALES = { en: 'en-IN', mr: 'mr-IN' };
const JUST_NOW = { en: 'just now', mr: 'आत्ताच' };
// A write still waiting for the server has no timestamp yet.
export function formatStamp(date, lang) {
  if (!date) return JUST_NOW[lang];
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
}

const STATUS_MSG = {
  todo: ['Moved back to To do.', 'पुन्हा करायचे आहे मध्ये हलवले.'],
  progress: ['Moved to In progress.', 'सुरू आहे मध्ये हलवले.'],
  done: ['Marked as done.', 'झाले म्हणून नोंदवले.'],
};
export const statusMessage = (status) => STATUS_MSG[status];

// ===== DOM =====
const STATUS_ORDER = ['todo', 'progress', 'done'];
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const OTHER = ['A planner', 'एक नियोजक'];
const stamp = (d) => el('span', formatStamp(d, 'en'), formatStamp(d, 'mr'), 'pf-stamp');

export function openTaskDetail(ctx, id) {
  const { member, data, toast } = ctx;
  const s = { task: null, labels: [], members: new Map() };
  const stops = [];
  const { dlg, body, title } = openDialog('Task', 'काम');
  dlg.addEventListener('close', () => stops.forEach((stop) => stop()));

  const meta = el('div', undefined, undefined, 'pf-meta');
  const statusRow = el('div', undefined, undefined, 'pf-status');
  statusRow.setAttribute('role', 'group');
  const tags = el('p', undefined, undefined, 'fv-tags');
  const editBtn = el('button', 'Edit task', 'काम बदला', 'btn-quiet');
  editBtn.type = 'button';
  editBtn.onclick = () => openTaskEditor(ctx, s.task);
  const err = el('p', undefined, undefined, 'pf-error');
  err.setAttribute('role', 'alert');
  const showWrong = () => { err.dataset.en = WRONG[0]; err.dataset.mr = WRONG[1]; retranslate(); };
  const clearWrong = () => { err.dataset.en = ''; err.dataset.mr = ''; err.textContent = ''; };

  // Notes: one textarea built once, filled from the first snapshot, so typing is never overwritten.
  const notesBox = document.createElement('textarea');
  notesBox.rows = 4;
  notesBox.id = 'pf-notes';
  const notesLabel = el('label', 'Notes (planners only)', 'नोंदी (फक्त नियोजक)');
  notesLabel.htmlFor = 'pf-notes';
  const notesSave = el('button', 'Save notes', 'नोंदी जतन करा', 'btn-quiet');
  notesSave.type = 'button';
  notesSave.onclick = () => data.saveNotes(id, notesBox.value).then(
    () => toast('Notes saved.', 'नोंदी जतन केल्या.'), showWrong);

  const comments = el('div', undefined, undefined, 'pf-list');
  const commentIn = document.createElement('textarea');
  commentIn.rows = 2;
  commentIn.id = 'pf-comment';
  const commentLabel = el('label', 'Add a comment', 'टिप्पणी लिहा');
  commentLabel.htmlFor = 'pf-comment';
  const commentBtn = el('button', 'Send comment', 'टिप्पणी पाठवा', 'btn-main');
  commentBtn.type = 'button';
  commentBtn.onclick = () => {
    const t = commentIn.value.trim();
    if (!t) return;
    commentBtn.disabled = true;
    data.addComment(id, t, ctx.user).then(() => {
      commentIn.value = '';
      toast('Comment added.', 'टिप्पणी जोडली.');
    }, showWrong).finally(() => { commentBtn.disabled = false; });
  };
  const history = el('div', undefined, undefined, 'pf-list');

  const delBox = el('div', undefined, undefined, 'pf-delete');
  function renderDelete(confirming) {
    delBox.replaceChildren();
    if (!confirming) {
      const b = el('button', 'Delete this task', 'हे काम काढून टाका', 'btn-quiet pf-danger');
      b.type = 'button';
      b.onclick = () => renderDelete(true);
      delBox.append(b);
    } else {
      const yes = el('button', 'Yes, delete', 'होय, काढून टाका', 'btn-main pf-danger-fill');
      yes.type = 'button';
      yes.onclick = () => {
        yes.disabled = true;
        data.deleteTask(id).then(() => {
          dlg.close();
          toast('Task deleted.', 'काम काढून टाकले.');
        }, () => { yes.disabled = false; showWrong(); });
      };
      const keep = el('button', 'Keep it', 'ठेवा', 'btn-quiet');
      keep.type = 'button';
      keep.onclick = () => renderDelete(false);
      delBox.append(dual('p', ['Delete this task?', 'हे काम काढून टाकायचे?'], 'pf-sub'), yes, keep);
    }
    retranslate();
  }
  renderDelete(false);

  const who = (uid) => {
    const n = personName(uid, member, s.members);
    return n ? text('strong', n) : el('strong', OTHER[0], OTHER[1]);
  };

  function renderTask() {
    const t = s.task;
    title.dataset.en = t.title;
    title.dataset.mr = t.title;
    title.textContent = t.title;
    meta.replaceChildren(
      text('p', t.ownerName || ''),
      t.due ? el('p', formatDate(t.due, 'en', { weekday: false }), formatDate(t.due, 'mr', { weekday: false })) : el('p', 'No due date', 'मुदत नाही'),
      dual('p', visibilityLabel(t.visibility)),
    );
    statusRow.replaceChildren(...STATUS_ORDER.map((st) => {
      const [en, mr] = statusWords(st);
      const b = el('button', en, mr, 'fv-chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(st === t.status));
      b.onclick = () => {
        if (st === t.status) return;
        const from = t.status;
        data.setStatus(id, from, st).then(() => {
          toast(...statusMessage(st), { undo: () => data.setStatus(id, st, from) });
        }, showWrong);
      };
      return b;
    }));
    const known = new Map(s.labels.map((l) => [l.id, l]));
    tags.replaceChildren(...(t.labels || []).filter((l) => known.has(l)).map((l) => text('span', known.get(l).name, 'fv-tag')));
    retranslate();
  }

  function renderComments(list) {
    comments.replaceChildren();
    if (!list.length) comments.append(dual('p', ['No comments yet.', 'अजून टिप्पण्या नाहीत.'], 'pf-note'));
    for (const c of list) {
      const row = el('article', undefined, undefined, 'pf-comment');
      const head = el('p', undefined, undefined, 'pf-comment-head');
      const photo = safePhoto(c.byPhoto);
      if (photo) {
        const img = document.createElement('img');
        img.src = photo;
        img.alt = '';
        img.width = 28;
        img.height = 28;
        head.append(img);
      }
      head.append(c.byName ? text('strong', c.byName) : el('strong', OTHER[0], OTHER[1]), stamp(c.at ? c.at.toDate() : null));
      row.append(head, text('p', c.text));
      if (c.by === member.uid) {
        const del = el('button', 'Delete', 'काढा', 'btn-quiet');
        del.type = 'button';
        del.onclick = () => data.deleteComment(id, c.id).then(
          () => toast('Comment deleted.', 'टिप्पणी काढली.'), showWrong);
        row.append(del);
      }
      comments.append(row);
    }
    retranslate();
  }

  function renderHistory(list) {
    history.replaceChildren();
    if (!list.length) history.append(dual('p', ['No changes yet.', 'अजून बदल नाहीत.'], 'pf-note'));
    for (const h of list) {
      const row = el('p', undefined, undefined, 'pf-history');
      const [fen, fmr] = statusWords(h.from);
      const [ten, tmr] = statusWords(h.to);
      row.append(who(h.by), el('span', ` moved it from ${fen} to ${ten}. `, ` ${fmr} वरून ${tmr} मध्ये हलवले. `), stamp(h.at ? h.at.toDate() : null));
      history.append(row);
    }
    retranslate();
  }

  const section = (en, mr, ...kids) => {
    const sec = el('section', undefined, undefined, 'pf-section');
    sec.append(el('h3', en, mr, 'pf-sub'), ...kids);
    return sec;
  };
  const noteField = el('div', undefined, undefined, 'pf-field');
  noteField.hidden = true; // shown after the first notes snapshot, so it never shows a blank that could overwrite
  noteField.append(notesLabel, notesBox, notesSave);
  const commentField = el('div', undefined, undefined, 'pf-field');
  commentField.append(commentLabel, commentIn, commentBtn);
  body.append(
    meta, tags, statusRow, editBtn, err,
    noteField,
    section('Comments', 'टिप्पण्या', comments, commentField),
    section('History', 'इतिहास', history),
    delBox,
  );

  stops.push(data.watchTasks(member, {}, (tasks) => {
    s.task = tasks.find((t) => t.id === id);
    if (!s.task) { dlg.close(); return; }
    clearWrong();
    renderTask();
  }, showWrong));
  stops.push(data.watchLabels((l) => { s.labels = l; if (s.task) renderTask(); }, showWrong));
  stops.push(data.watchNotes(id, (n) => {
    notesBox.value = n ? n.text : '';
    noteField.hidden = false;
  }, showWrong));
  stops.push(data.watchComments(id, renderComments, showWrong));
  stops.push(data.watchHistory(id, renderHistory, showWrong));
  if (member.role === 'owner') {
    stops.push(data.watchMembers((list) => {
      s.members = new Map(list.map((m) => [m.id, m]));
      if (s.task) renderTask();
    }, showWrong));
  }
  retranslate();
}
