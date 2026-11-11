// Add / edit task sheet. Pure helpers first, DOM after.
import { visibleSet } from './planner-core.js';
import { openDialog } from './planner-ui.js';
import { el, text, dual, retranslate } from './view-family.js';

// ===== PURE HELPERS =====
const VIS = {
  everyone: ['Everyone', 'सर्वजण'],
  planners: ['Planners only', 'फक्त नियोजक'],
  groom: ['Groom side only', 'फक्त वराकडची बाजू'],
  bride: ['Bride side only', 'फक्त वधूकडची बाजू'],
};
const FAMILY = [
  ['groom_family', "Groom's family", 'वराचे कुटुंब'],
  ['bride_family', "Bride's family", 'वधूचे कुटुंब'],
  ['both', 'Both families', 'दोन्ही कुटुंबे'],
];
const STATUSES = [
  ['todo', 'To do', 'करायचे आहे'],
  ['progress', 'In progress', 'सुरू आहे'],
  ['done', 'Done', 'झाले'],
];

export const visibilityLabel = (v) => VIS[v];

export const visibilityChoices = (member) =>
  visibleSet(member).map((value) => ({ value, en: VIS[value][0], mr: VIS[value][1] }));

// Self, the three family options, other planners when the caller can list members,
// and the task's current owner if it is none of those.
export function ownerChoices(member, members, current) {
  const choices = [{ value: member.uid, name: member.name, en: member.name, mr: member.name }];
  for (const [value, en, mr] of FAMILY) choices.push({ value, name: en, en, mr });
  for (const m of members) {
    if (m.role !== 'reader' && m.uid !== member.uid) choices.push({ value: m.uid, name: m.name, en: m.name, mr: m.name });
  }
  if (current && !choices.some((c) => c.value === current.owner)) {
    choices.push({ value: current.owner, name: current.ownerName, en: current.ownerName, mr: current.ownerName });
  }
  return choices;
}

// An edit draft has no status: changing it goes through setStatus, which writes history.
export const draftFromTask = (task, member) => task
  ? {
    title: task.title, due: task.due || '', owner: task.owner,
    labels: [...(task.labels || [])], visibility: task.visibility, notes: '',
  }
  : { title: '', due: '', owner: member.uid, status: 'todo', labels: [], visibility: 'everyone', notes: '' };

export const draftError = (d) => (d.title.trim() ? null : 'title');

// Unknown label ids are dropped here so a task never carries a dead one.
export function buildTask(d, choices, labels) {
  const known = new Set(labels.map((l) => l.id));
  return {
    title: d.title.trim(),
    due: d.due,
    owner: d.owner,
    ownerName: choices.find((c) => c.value === d.owner).name,
    ...('status' in d && { status: d.status }),
    labels: d.labels.filter((id) => known.has(id)),
    visibility: d.visibility,
  };
}

// Creates the task once (state.id remembers it), then updates and saves notes.
// A retry after a partial failure never creates a second task, and an update
// never carries status (a new task's initial status is set only on creation).
export async function persistTask(data, task, fields, notes, state) {
  const id = state.id ?? task?.id;
  if (id) {
    const { status, ...rest } = fields;
    await data.updateTask(id, rest);
  } else {
    state.id = await data.addTask(fields);
  }
  if (notes.trim() || task) await data.saveNotes(state.id ?? id, notes);
}

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];

export function field(labelEn, labelMr, input) {
  const wrap = el('div', undefined, undefined, 'pf-field');
  const lab = el('label', labelEn, labelMr);
  input.id = input.id || `f-${Math.random().toString(36).slice(2)}`;
  lab.htmlFor = input.id;
  wrap.append(lab, input);
  return wrap;
}

export function select(choices, value, onChange) {
  const s = document.createElement('select');
  for (const c of choices) {
    const o = el('option', c.en, c.mr);
    o.value = c.value;
    s.append(o);
  }
  s.value = value;
  s.onchange = () => onChange(s.value);
  return s;
}

export function openTaskEditor(ctx, task) {
  const { member, data, toast } = ctx;
  const draft = draftFromTask(task, member);
  const s = { labels: [], members: [] };
  const ready = { labels: false, notes: !task };
  const saved = {};
  const stops = [];
  const { dlg, body } = task
    ? openDialog('Edit task', 'काम बदला')
    : openDialog('Add task', 'काम जोडा');
  dlg.addEventListener('close', () => stops.forEach((stop) => stop()));

  const form = document.createElement('form');
  form.noValidate = true;
  const err = el('p', undefined, undefined, 'pf-error');
  err.setAttribute('role', 'alert');

  const title = document.createElement('input');
  title.type = 'text';
  title.value = draft.title;
  title.oninput = () => { draft.title = title.value; };
  const due = document.createElement('input');
  due.type = 'date';
  due.value = draft.due;
  due.onchange = () => { draft.due = due.value; };
  const ownerWrap = el('div');
  const status = select(STATUSES.map(([value, en, mr]) => ({ value, en, mr })), draft.status, (v) => { draft.status = v; });
  const vis = select(visibilityChoices(member), draft.visibility, (v) => { draft.visibility = v; });
  const notes = document.createElement('textarea');
  notes.rows = 4;
  notes.oninput = () => { draft.notes = notes.value; };
  const labelsBox = el('div', undefined, undefined, 'pf-labels');
  const newLabel = el('div', undefined, undefined, 'pf-newlabel');

  const choices = () => ownerChoices(member, s.members, task);
  function renderOwner() {
    ownerWrap.replaceChildren(field('Owner', 'जबाबदार', select(choices(), draft.owner, (v) => { draft.owner = v; })));
    retranslate();
  }

  function renderLabels() {
    labelsBox.replaceChildren();
    for (const group of ['day', 'category']) {
      const row = el('div', undefined, undefined, 'fv-chips');
      row.setAttribute('role', 'group');
      row.append(group === 'day' ? el('span', 'Day', 'दिवस', 'fv-chips-title') : el('span', 'Category', 'प्रकार', 'fv-chips-title'));
      for (const l of s.labels.filter((x) => x.group === group)) {
        const b = text('button', l.name, 'fv-chip');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(draft.labels.includes(l.id)));
        b.onclick = () => {
          draft.labels = draft.labels.includes(l.id) ? draft.labels.filter((x) => x !== l.id) : [...draft.labels, l.id];
          renderLabels();
        };
        row.append(b);
      }
      labelsBox.append(row);
    }
    const add = el('button', 'New label', 'नवीन लेबल', 'btn-quiet');
    add.type = 'button';
    add.onclick = () => { add.hidden = true; newLabel.hidden = false; nameIn.focus(); };
    labelsBox.append(add);
    retranslate();
  }

  const nameIn = document.createElement('input');
  nameIn.type = 'text';
  const groupSel = select(
    [{ value: 'day', en: 'Day', mr: 'दिवस' }, { value: 'category', en: 'Category', mr: 'प्रकार' }], 'category', () => {},
  );
  const save = el('button', 'Add label', 'लेबल जोडा', 'btn-main');
  save.type = 'button';
  save.onclick = () => {
    const name = nameIn.value.trim();
    if (!name) return;
    const group = groupSel.value;
    data.addLabel({ name, group, color: group === 'day' ? 'gold' : 'maroon' }).then((id) => {
      draft.labels.push(id);
      nameIn.value = '';
      newLabel.hidden = true;
      renderLabels();
    }, showWrong);
  };
  newLabel.hidden = true;
  newLabel.append(
    field('Label name', 'लेबलचे नाव', nameIn),
    field('Group', 'गट', groupSel),
    dual('p', ['Everyone with access can see label names.', 'प्रवेश असलेले सर्वजण लेबलची नावे पाहू शकतात.'], 'pf-note'),
    save,
  );

  const submit = el('button', 'Save', 'जतन करा', 'btn-main');
  submit.type = 'submit';
  const cancel = el('button', 'Cancel', 'रद्द करा', 'btn-quiet');
  cancel.type = 'button';
  cancel.onclick = () => dlg.close();
  const actions = el('div', undefined, undefined, 'pf-actions');
  actions.append(submit, cancel);

  form.append(
    field('Title', 'शीर्षक', title), field('Due date', 'मुदत', due), ownerWrap,
    ...(task ? [] : [field('Status', 'स्थिती', status)]),
    el('p', 'Labels', 'लेबल', 'pf-sub'), labelsBox, newLabel,
    field('Notes (planners only)', 'नोंदी (फक्त नियोजक)', notes),
    field('Who can see this', 'हे कोण पाहू शकेल', vis),
    actions,
  );
  function showWrong() {
    err.dataset.en = WRONG[0];
    err.dataset.mr = WRONG[1];
    retranslate();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (draftError(draft)) {
      err.dataset.en = 'Please add a title.';
      err.dataset.mr = 'कृपया शीर्षक लिहा.';
      retranslate();
      title.focus();
      return;
    }
    submit.disabled = true;
    const fields = buildTask(draft, choices(), s.labels);
    await persistTask(data, task, fields, draft.notes, saved).then(() => {
      dlg.close();
      toast(task ? 'Task saved.' : 'Task added.', task ? 'काम जतन केले.' : 'काम जोडले.');
    }, () => { submit.disabled = false; showWrong(); });
  };

  // The form shows only once labels (and notes, when editing) have loaded, so a
  // save can never overwrite them with blanks.
  const loading = dual('p', ['Loading', 'लोड होत आहे'], 'pf-note');
  body.append(err, loading);
  const show = () => { if (ready.labels && ready.notes) { loading.replaceWith(form); title.focus(); } };
  stops.push(data.watchLabels((l) => { s.labels = l; ready.labels = true; renderLabels(); show(); }, showWrong));
  if (member.role === 'owner') stops.push(data.watchMembers((m) => { s.members = m.map((x) => ({ ...x, uid: x.id })); renderOwner(); }, showWrong));
  if (task) {
    // Notes live in their own document; prefill once, then stop listening.
    const stopNotes = data.watchNotes(task.id, (n) => {
      notes.value = n ? n.text : '';
      draft.notes = notes.value;
      ready.notes = true;
      stopNotes();
      show();
    }, showWrong);
    stops.push(stopNotes);
  }
  renderOwner();
  renderLabels();
  retranslate();
}
