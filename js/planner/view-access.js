// Access tab (owners only): pending requests and approved members. Rules are the
// authority; this page only shows the actions the rules would allow.
// Pure helpers first, DOM after.
import { safePhoto } from './task-detail.js';
import { el, text, dual, mrDigits } from './view-family.js';

// ===== PURE HELPERS =====
const ROLE = { owner: ['Owner', 'मालक'], editor: ['Editor', 'संपादक'], reader: ['Reader', 'वाचक'] };
const SIDE = { groom: ['Groom side', 'वराकडची बाजू'], bride: ['Bride side', 'वधूकडची बाजू'] };
const JOINS = {
  groom: ['Joins the groom side', 'वराकडच्या बाजूत सामील होतील'],
  bride: ['Joins the bride side', 'वधूकडच्या बाजूत सामील होतील'],
};
const RANK = { owner: 0, editor: 1, reader: 2 };
const LOCALES = { en: 'en-IN', mr: 'mr-IN' };

// Mirrors the members rules: any owner may remove or promote a reader; an owner may
// demote or remove only editors on their own side; owner docs are never changed.
export function allowedActions(owner, member) {
  if (member.role === 'reader') return ['promote', 'remove'];
  if (member.role === 'editor' && member.side === owner.side) return ['demote', 'remove'];
  return [];
}

export const joinsSide = (side) => ({ en: JOINS[side][0], mr: JOINS[side][1] });

export const sortMembers = (members) =>
  [...members].sort((a, b) => RANK[a.role] - RANK[b.role] || (a.name || '').localeCompare(b.name || ''));

export function requestedWhen(ts) {
  if (!ts) return null;
  const d = ts.toDate();
  const fmt = (lang) => new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(d);
  return { en: fmt('en'), mr: fmt('mr') };
}

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const NOTHING = ['Nothing here yet.', 'इथे अजून काही नाही.'];
const GONE = ['That request was already handled.', 'ती विनंती आधीच हाताळली आहे.'];

const person = (p) => {
  const box = el('div', undefined, undefined, 'pa-person');
  const photo = safePhoto(p.photoURL);
  if (photo) {
    const img = document.createElement('img');
    img.src = photo;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    box.append(img);
  }
  const who = el('div');
  who.append(text('strong', p.name || ''), text('p', p.email || '', 'pf-note'));
  box.append(who);
  return box;
};

const button = (en, mr, cls, onClick) => {
  const b = el('button', en, mr, cls);
  b.type = 'button';
  b.onclick = onClick;
  return b;
};

export function createAccess(ctx, rerender) {
  const { member, data, toast } = ctx;
  // A button with the owner's side beneath it: where an Editor would join.
  const withSideHint = (btn, id) => {
    const hint = joinsSide(member.side);
    const note = el('p', hint.en, hint.mr, 'pf-note');
    note.id = id;
    btn.setAttribute('aria-describedby', id);
    const box = el('div', undefined, undefined, 'pa-editor');
    box.append(btn, note);
    return box;
  };
  let sub = 'requested';
  let confirm = null; // { uid, action }
  const wrong = () => toast(WRONG[0], WRONG[1]);

  const approve = (r, role) => data.approve(r.id, role).then(
    () => toast(`${r.name} can now open the planner.`, `${r.name} आता नियोजक उघडू शकतात.`),
    (e) => (e.message === 'request_gone' ? toast(GONE[0], GONE[1]) : wrong()),
  );

  function requestCard(r) {
    const card = el('article', undefined, undefined, 'fv-card');
    card.append(person(r));
    const when = requestedWhen(r.requestedAt);
    if (when) card.append(el('p', `Asked ${when.en}`, `विनंती ${when.mr}`, 'pf-stamp'));
    const asEditor = button('Approve as Editor', 'संपादक म्हणून मान्य करा', 'btn-main', () => approve(r, 'editor'));
    if (confirm && confirm.uid === r.id) {
      const yes = button('Yes, decline', 'होय, नाकारा', 'btn-main pf-danger-fill', () => {
        yes.disabled = true;
        data.decline(r.id).then(() => { confirm = null; toast('Request declined.', 'विनंती नाकारली.'); },
          () => { yes.disabled = false; wrong(); });
      });
      const box = el('div', undefined, undefined, 'pf-actions');
      box.append(
        el('p', `Decline ${r.name}'s request?`, `${r.name} यांची विनंती नाकारायची?`, 'pf-sub'), yes,
        button('Keep it', 'ठेवा', 'btn-quiet', () => { confirm = null; rerender(); }),
      );
      card.append(box);
      return card;
    }
    const actions = el('div', undefined, undefined, 'pf-actions');
    actions.append(
      button('Approve as Reader', 'वाचक म्हणून मान्य करा', 'btn-main', () => approve(r, 'reader')),
      withSideHint(asEditor, `hint-${r.id}`),
      button('Decline', 'नाकारा', 'btn-quiet', () => { confirm = { uid: r.id, action: 'decline' }; rerender(); }),
    );
    card.append(actions);
    return card;
  }

  const ACTION_COPY = {
    demote: ['Make Reader', 'वाचक करा', 'Make {n} a Reader?', '{n} यांना वाचक करायचे?', 'Yes, make Reader', 'होय, वाचक करा'],
    remove: ['Remove', 'काढून टाका', 'Remove {n}?', '{n} यांना काढून टाकायचे?', 'Yes, remove', 'होय, काढून टाका'],
  };

  function memberCard(m) {
    const card = el('article', undefined, undefined, 'fv-card');
    card.append(person(m));
    const tags = el('p', undefined, undefined, 'fv-tags');
    tags.append(el('span', ROLE[m.role][0], ROLE[m.role][1], 'fv-tag'));
    if (m.side) tags.append(el('span', SIDE[m.side][0], SIDE[m.side][1], 'fv-tag'));
    card.append(tags);
    const actions = el('div', undefined, undefined, 'pf-actions');
    const run = (yes, fn, en, mr) => fn().then(
      () => { confirm = null; toast(en, mr); },
      () => { yes.disabled = false; wrong(); },
    );
    for (const a of allowedActions(member, m)) {
      if (confirm && confirm.uid === m.id && confirm.action === a) {
        const c = ACTION_COPY[a];
        const yes = button(c[4], c[5], 'btn-main pf-danger-fill', () => {
          yes.disabled = true;
          if (a === 'remove') run(yes, () => data.removeMember(m.id), `${m.name} removed.`, `${m.name} काढून टाकले.`);
          else run(yes, () => data.setRole(m.id, 'reader'), `${m.name} is now a Reader.`, `${m.name} आता वाचक आहेत.`);
        });
        actions.append(
          el('p', c[2].replace('{n}', m.name), c[3].replace('{n}', m.name), 'pf-sub'), yes,
          button('Keep as is', 'तसेच ठेवा', 'btn-quiet', () => { confirm = null; rerender(); }),
        );
      } else if (!confirm || confirm.uid !== m.id) {
        if (a === 'promote') {
          const make = button('Make Editor', 'संपादक करा', 'btn-main', () => data.setRole(m.id, 'editor').then(
            () => toast(`${m.name} is now an Editor.`, `${m.name} आता संपादक आहेत.`), wrong));
          actions.append(withSideHint(make, `side-${m.id}`));
        } else {
          actions.append(button(ACTION_COPY[a][0], ACTION_COPY[a][1], 'btn-quiet pf-danger', () => { confirm = { uid: m.id, action: a }; rerender(); }));
        }
      }
    }
    if (actions.childNodes.length) card.append(actions);
    return card;
  }

  return {
    render({ requests, members }) {
      const wrap = el('div', undefined, undefined, 'fv-stack');
      const tabs = el('div', undefined, undefined, 'pf-toggle');
      tabs.setAttribute('role', 'group');
      for (const [id, en, mr] of [['requested', `Requested (${requests.length})`, `विनंत्या (${mrDigits(requests.length)})`], ['approved', 'Approved', 'मान्य']]) {
        const b = el('button', en, mr, 'fv-tab');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(sub === id));
        b.onclick = () => { sub = id; confirm = null; rerender(); };
        tabs.append(b);
      }
      wrap.append(tabs);
      const list = sub === 'requested' ? requests : sortMembers(members);
      if (!list.length) wrap.append(dual('p', NOTHING, 'fv-empty'));
      for (const x of list) wrap.append(sub === 'requested' ? requestCard(x) : memberCard(x));
      return wrap;
    },
  };
}
