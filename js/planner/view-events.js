// Events tab (planners only): day-by-day list, add / edit / delete, day label link.
// Pure helpers first, DOM after.
import { visibilityChoices, visibilityLabel, field, select } from './task-editor.js';
import { openDialog } from './planner-ui.js';
import { groupEventsByDate, statusWords, formatDate, el, text, dual, retranslate } from './view-family.js';

// ===== PURE HELPERS =====
export const dayLabelOf = (labels, eventId) =>
  labels.find((l) => l.group === 'day' && l.eventId === eventId) || null;

// Day labels that are free, or already point at this event.
export const linkableLabels = (labels, eventId) =>
  labels.filter((l) => l.group === 'day' && (!l.eventId || l.eventId === eventId));

// The tasks (already limited to what the caller can see) carrying the event's day label.
export function tasksForEvent(tasks, labels, eventId) {
  const label = dayLabelOf(labels, eventId);
  return label ? tasks.filter((t) => (t.labels || []).includes(label.id)) : [];
}

// [labelId, eventId or null] writes. Only 'everyone' events may be linked; a hidden
// event is unlinked by the data layer, so there is nothing to do here.
export function linkOps({ eventId, visibility, labels, chosen }) {
  if (visibility !== 'everyone') return [];
  const current = dayLabelOf(labels, eventId);
  const target = linkableLabels(labels, eventId).find((l) => l.id === chosen) || null;
  if ((current && current.id) === (target && target.id)) return [];
  return [...(current ? [[current.id, null]] : []), ...(target ? [[target.id, eventId]] : [])];
}

export const eventDraft = (event, labels) => event
  ? {
    date: event.date, time: event.time || '', title: event.title, place: event.place || '', host: event.host || '',
    note: event.note || '', visibility: event.visibility, labelId: dayLabelOf(labels, event.id)?.id || '',
  }
  : { date: '', time: '', title: '', place: '', host: '', note: '', visibility: 'everyone', labelId: '' };

export const buildEvent = (d) => ({
  date: d.date, time: d.time.trim(), title: d.title.trim(), place: d.place.trim(),
  host: d.host.trim(), note: d.note.trim(), visibility: d.visibility,
});

export const eventError = (d) => (!d.title.trim() ? 'title' : !d.date ? 'date' : null);

// Creates the event once (state.id remembers it), then updates it and moves the label link.
export async function persistEvent(data, event, draft, labels, state) {
  const id = state.id ?? event?.id;
  const fields = buildEvent(draft);
  if (id) await data.updateEvent(id, fields);
  else state.id = await data.addEvent(fields);
  const ops = linkOps({ eventId: state.id ?? id, visibility: draft.visibility, labels, chosen: draft.labelId });
  for (const [labelId, eventId] of ops) await data.updateLabel(labelId, { eventId });
}

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const NOTHING = ['Nothing here yet.', 'इथे अजून काही नाही.'];

export function openEventEditor(ctx, event, { labels, tasks }) {
  const { member, data, toast } = ctx;
  const draft = eventDraft(event, labels);
  const saved = {};
  const { dlg, body } = event ? openDialog('Edit event', 'कार्यक्रम बदला') : openDialog('Add event', 'कार्यक्रम जोडा');
  const err = el('p', undefined, undefined, 'pf-error');
  err.setAttribute('role', 'alert');
  const showWrong = () => { err.dataset.en = WRONG[0]; err.dataset.mr = WRONG[1]; retranslate(); };

  const input = (key, type = 'text') => {
    const i = document.createElement('input');
    i.type = type;
    i.value = draft[key];
    i.oninput = () => { draft[key] = i.value; };
    return i;
  };
  const titleIn = input('title');
  const note = document.createElement('textarea');
  note.rows = 3;
  note.value = draft.note;
  note.oninput = () => { draft.note = note.value; };

  const linkBox = el('div');
  function renderLink() {
    linkBox.replaceChildren();
    if (draft.visibility === 'everyone') {
      const choices = [{ value: '', en: 'No day label', mr: 'दिवसाचे लेबल नाही' },
        ...linkableLabels(labels, event?.id).map((l) => ({ value: l.id, en: l.name, mr: l.name }))];
      linkBox.append(field('Day label', 'दिवसाचे लेबल', select(choices, draft.labelId, (v) => { draft.labelId = v; })));
    } else {
      linkBox.append(dual('p', ['Only events everyone can see can have a day label.', 'फक्त सर्वांना दिसणाऱ्या कार्यक्रमाला दिवसाचे लेबल देता येते.'], 'pf-note'));
    }
    retranslate();
  }
  const vis = select(visibilityChoices(member), draft.visibility, (v) => { draft.visibility = v; renderLink(); });

  const submit = el('button', 'Save', 'जतन करा', 'btn-main');
  submit.type = 'submit';
  const cancel = el('button', 'Cancel', 'रद्द करा', 'btn-quiet');
  cancel.type = 'button';
  cancel.onclick = () => dlg.close();
  const actions = el('div', undefined, undefined, 'pf-actions');
  actions.append(submit, cancel);

  const form = document.createElement('form');
  form.noValidate = true;
  form.append(
    field('Title', 'शीर्षक', titleIn), field('Date', 'तारीख', input('date', 'date')),
    field('Time (or "to confirm")', 'वेळ (किंवा "ठरायची आहे")', input('time')),
    field('Place', 'ठिकाण', input('place')), field('Host', 'यजमान', input('host')),
    field('Note', 'नोंद', note), field('Who can see this', 'हे कोण पाहू शकेल', vis), linkBox, actions,
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const bad = eventError(draft);
    if (bad) {
      err.dataset.en = bad === 'title' ? 'Please add a title.' : 'Please pick a date.';
      err.dataset.mr = bad === 'title' ? 'कृपया शीर्षक लिहा.' : 'कृपया तारीख निवडा.';
      retranslate();
      return;
    }
    submit.disabled = true;
    await persistEvent(data, event, draft, labels, saved).then(() => {
      dlg.close();
      toast(event ? 'Event saved.' : 'Event added.', event ? 'कार्यक्रम जतन केला.' : 'कार्यक्रम जोडला.');
    }, () => { submit.disabled = false; showWrong(); });
  };
  body.append(err, form);

  if (event) {
    const linked = tasksForEvent(tasks, labels, event.id);
    if (dayLabelOf(labels, event.id)) {
      const sec = el('section', undefined, undefined, 'pf-section');
      sec.append(dual('h3', ['Tasks for this day', 'या दिवसाची कामे'], 'pf-sub'));
      if (!linked.length) sec.append(dual('p', NOTHING, 'pf-note'));
      for (const t of linked) {
        const row = el('p', undefined, undefined, 'pf-meta');
        row.append(text('strong', t.title), el('span', ` · ${statusWords(t.status)[0]}`, ` · ${statusWords(t.status)[1]}`));
        sec.append(row);
      }
      body.append(sec);
    }
    const delBox = el('div', undefined, undefined, 'pf-delete');
    const renderDelete = (confirming) => {
      delBox.replaceChildren();
      if (!confirming) {
        const b = el('button', 'Delete this event', 'हा कार्यक्रम काढून टाका', 'btn-quiet pf-danger');
        b.type = 'button';
        b.onclick = () => renderDelete(true);
        delBox.append(b);
      } else {
        const yes = el('button', 'Yes, delete', 'होय, काढून टाका', 'btn-main pf-danger-fill');
        yes.type = 'button';
        yes.onclick = () => {
          yes.disabled = true;
          data.deleteEvent(event.id).then(() => {
            dlg.close();
            toast('Event deleted.', 'कार्यक्रम काढून टाकला.');
          }, () => { yes.disabled = false; showWrong(); });
        };
        const keep = el('button', 'Keep it', 'ठेवा', 'btn-quiet');
        keep.type = 'button';
        keep.onclick = () => renderDelete(false);
        delBox.append(dual('p', ['Delete this event?', 'हा कार्यक्रम काढून टाकायचा?'], 'pf-sub'), yes, keep);
      }
      retranslate();
    };
    renderDelete(false);
    body.append(delBox);
  }
  renderLink();
  titleIn.focus();
  retranslate();
}

export function renderEvents(ctx, { events, labels, tasks }) {
  const wrap = el('div', undefined, undefined, 'fv-stack');
  const add = el('button', '+ Add event', '+ कार्यक्रम जोडा', 'btn-main');
  add.type = 'button';
  add.onclick = () => openEventEditor(ctx, null, { labels, tasks });
  wrap.append(add);
  const byId = new Map(events.map((e) => [e.id, e]));
  const days = groupEventsByDate(events);
  if (!days.length) wrap.append(dual('p', NOTHING, 'fv-empty'));
  for (const day of days) {
    const group = el('section', undefined, undefined, 'fv-day');
    group.append(el('h3', formatDate(day.date, 'en'), formatDate(day.date, 'mr'), 'fv-date'));
    for (const g of day.events) {
      const e = byId.get(g.id);
      const card = el('article', undefined, undefined, 'fv-card');
      const name = text('button', e.title, 'pf-title');
      name.type = 'button';
      name.onclick = () => openEventEditor(ctx, e, { labels, tasks });
      card.append(name, g.time ? text('p', g.time, 'fv-time') : el('p', 'Time to be confirmed', 'वेळ अजून ठरायची आहे', 'fv-time'));
      if (g.place) card.append(text('p', g.place, 'fv-line'));
      if (g.host) {
        const p = el('p', undefined, undefined, 'fv-line');
        p.append(el('span', 'Host: ', 'यजमान: '), text('span', g.host));
        card.append(p);
      }
      const tags = el('p', undefined, undefined, 'fv-tags');
      tags.append(dual('span', visibilityLabel(e.visibility), 'fv-tag'));
      const label = dayLabelOf(labels, e.id);
      if (label) tags.append(text('span', label.name, 'fv-tag'));
      card.append(tags);
      group.append(card);
    }
    wrap.append(group);
  }
  return wrap;
}
