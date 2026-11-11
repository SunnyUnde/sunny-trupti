// Vendors tab (planners only): vendor table, budget total, summary cards.
// Money lives only here and on Home; the Family view never imports it.
// Pure helpers first, DOM after.
import { formatRupees } from './planner-core.js';
import { ownerChoices, field, select } from './task-editor.js';
import { openDialog } from './planner-ui.js';
import { el, text, dual, mrDigits, retranslate } from './view-family.js';

// ===== PURE HELPERS =====
export const VENDOR_STATUS = {
  to_find: ['To find', 'शोधायचा आहे'],
  shortlisted: ['Shortlisted', 'निवडक यादीत'],
  booked: ['Booked', 'नक्की केला'],
  paid: ['Paid', 'पैसे दिले'],
};

// Whole rupees, commas allowed. Blank or anything else is null.
export const parseAmount = (s) => {
  const t = String(s ?? '').trim().replace(/,/g, '');
  return /^\d+$/.test(t) ? Number(t) : null;
};

export const amountOrZero = (s) => (String(s ?? '').trim() === '' ? 0 : parseAmount(s));

export const vendorDraft = (v) => v
  ? {
    category: v.category || '', name: v.name, contact: v.contact || '', status: v.status,
    quote: String(v.quote ?? 0), paid: String(v.paid ?? 0), owner: v.owner, notes: v.notes || '',
  }
  : { category: '', name: '', contact: '', status: 'to_find', quote: '', paid: '', owner: 'both', notes: '' };

export const vendorError = (d) =>
  !d.name.trim() ? 'name' : amountOrZero(d.quote) === null ? 'quote' : amountOrZero(d.paid) === null ? 'paid' : null;

export const buildVendor = (d) => ({
  category: d.category.trim(), name: d.name.trim(), contact: d.contact.trim(), status: d.status,
  quote: amountOrZero(d.quote), paid: amountOrZero(d.paid), owner: d.owner, notes: d.notes.trim(),
});

export function budgetFigures(vendors, budget) {
  const sum = (key) => vendors.reduce((n, v) => n + (v[key] || 0), 0);
  const total = budget ? budget.total : null;
  return { total, quoted: sum('quote'), paid: sum('paid'), left: total === null ? null : total - sum('paid') };
}

// {en, mr} for a vendor's owner, or null when it is a member this planner cannot name.
export function vendorOwner(owner, member, members) {
  const c = ownerChoices(member, members, null).find((x) => x.value === owner);
  return c ? { en: c.en, mr: c.mr } : null;
}

// ===== DOM =====
const WRONG = ['Something went wrong. Please try again.', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'];
const NOTHING = ['No vendors yet.', 'अजून विक्रेते नाहीत.'];
const OTHER = ['A planner', 'एक नियोजक'];
const COLUMNS = [
  ['Category', 'प्रकार'], ['Name', 'नाव'], ['Contact', 'संपर्क'], ['Status', 'स्थिती'],
  ['Quote', 'अंदाजित रक्कम'], ['Paid', 'दिलेले'], ['Owner', 'जबाबदार'],
];

function openVendorEditor(ctx, vendor, members) {
  const { member, data, toast } = ctx;
  const draft = vendorDraft(vendor);
  const { dlg, body } = vendor ? openDialog('Edit vendor', 'विक्रेता बदला') : openDialog('Add vendor', 'विक्रेता जोडा');
  const err = el('p', undefined, undefined, 'pf-error');
  err.setAttribute('role', 'alert');
  const say = (en, mr) => { err.dataset.en = en; err.dataset.mr = mr; retranslate(); };
  const showWrong = () => say(WRONG[0], WRONG[1]);

  const input = (key, extra = {}) => {
    const i = document.createElement('input');
    i.type = 'text';
    Object.assign(i, extra);
    i.value = draft[key];
    i.oninput = () => { draft[key] = i.value; };
    return i;
  };
  const nameIn = input('name');
  const notes = document.createElement('textarea');
  notes.rows = 3;
  notes.value = draft.notes;
  notes.oninput = () => { draft.notes = notes.value; };
  const owners = ownerChoices(member, members, vendor && !vendorOwner(vendor.owner, member, members)
    ? { owner: vendor.owner, ownerName: OTHER[0] } : null);
  const statuses = Object.entries(VENDOR_STATUS).map(([value, [en, mr]]) => ({ value, en, mr }));

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
    field('Name', 'नाव', nameIn), field('Category', 'प्रकार', input('category')), field('Contact', 'संपर्क', input('contact')),
    field('Status', 'स्थिती', select(statuses, draft.status, (v) => { draft.status = v; })),
    field('Quote (₹)', 'अंदाजित रक्कम (₹)', input('quote', { inputMode: 'numeric' })),
    field('Paid so far (₹)', 'आतापर्यंत दिलेले (₹)', input('paid', { inputMode: 'numeric' })),
    field('Owner', 'जबाबदार', select(owners, draft.owner, (v) => { draft.owner = v; })),
    field('Notes', 'नोंदी', notes), actions,
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const bad = vendorError(draft);
    if (bad) {
      if (bad === 'name') say('Please add a name.', 'कृपया नाव लिहा.');
      else say('Please use whole rupees, like 25000.', 'कृपया पूर्ण रुपये लिहा, उदा. २५०००.');
      return;
    }
    submit.disabled = true;
    const fields = buildVendor(draft);
    await (vendor ? data.updateVendor(vendor.id, fields) : data.addVendor(fields)).then(() => {
      dlg.close();
      toast(vendor ? 'Vendor saved.' : 'Vendor added.', vendor ? 'विक्रेता जतन केला.' : 'विक्रेता जोडला.');
    }, () => { submit.disabled = false; showWrong(); });
  };
  body.append(err, form);

  if (vendor) {
    const delBox = el('div', undefined, undefined, 'pf-delete');
    const renderDelete = (confirming) => {
      delBox.replaceChildren();
      if (!confirming) {
        const b = el('button', 'Delete this vendor', 'हा विक्रेता काढून टाका', 'btn-quiet pf-danger');
        b.type = 'button';
        b.onclick = () => renderDelete(true);
        delBox.append(b);
      } else {
        const yes = el('button', 'Yes, delete', 'होय, काढून टाका', 'btn-main pf-danger-fill');
        yes.type = 'button';
        yes.onclick = () => {
          yes.disabled = true;
          data.deleteVendor(vendor.id).then(() => {
            dlg.close();
            toast('Vendor deleted.', 'विक्रेता काढून टाकला.');
          }, () => { yes.disabled = false; showWrong(); });
        };
        const keep = el('button', 'Keep it', 'ठेवा', 'btn-quiet');
        keep.type = 'button';
        keep.onclick = () => renderDelete(false);
        delBox.append(dual('p', ['Delete this vendor?', 'हा विक्रेता काढून टाकायचा?'], 'pf-sub'), yes, keep);
      }
      retranslate();
    };
    renderDelete(false);
    body.append(delBox);
  }
  nameIn.focus();
  retranslate();
}

const rupees = (n) => el('span', formatRupees(n), formatRupees(n).replace(/\d/g, (d) => mrDigits(d)));

// The budget draft lives here so a snapshot re-render never wipes what is being typed.
export function createVendors(ctx, rerender) {
  const { data, toast } = ctx;
  let budgetDraft = null;
  let budgetError = false;

  function saveBudget() {
    const n = parseAmount(budgetDraft);
    budgetError = n === null;
    if (budgetError) { rerender(); return; }
    data.setBudget(n).then(() => {
      budgetDraft = null;
      toast('Budget saved.', 'बजेट जतन केले.');
    }, () => toast(WRONG[0], WRONG[1]));
  }

  function summary(f) {
    const cards = el('div', undefined, undefined, 'pv-cards');
    for (const [en, mr, v] of [['Total', 'एकूण', f.total], ['Quoted', 'अंदाजित', f.quoted], ['Paid', 'दिलेले', f.paid], ['Left', 'शिल्लक', f.left]]) {
      const c = el('article', undefined, undefined, 'fv-card');
      c.append(el('h4', en, mr), v === null ? el('p', 'Not set', 'ठरवले नाही', 'fv-line') : rupees(v));
      cards.append(c);
    }
    return cards;
  }

  function table(vendors, members) {
    const box = el('div', undefined, undefined, 'pv-scroll');
    box.tabIndex = 0;
    const t = document.createElement('table');
    t.className = 'pv-table';
    const head = t.createTHead().insertRow();
    for (const [en, mr] of COLUMNS) head.append(el('th', en, mr));
    const tb = t.createTBody();
    const sorted = [...vendors].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
    for (const v of sorted) {
      const row = tb.insertRow();
      const name = text('button', v.name, 'pf-title');
      name.type = 'button';
      name.onclick = () => openVendorEditor(ctx, v, members);
      const owner = vendorOwner(v.owner, ctx.member, members) || { en: OTHER[0], mr: OTHER[1] };
      const [sen, smr] = VENDOR_STATUS[v.status];
      row.insertCell().textContent = v.category || '';
      row.insertCell().append(name);
      row.insertCell().textContent = v.contact || '';
      row.insertCell().append(el('span', sen, smr));
      row.insertCell().append(rupees(v.quote || 0));
      row.insertCell().append(rupees(v.paid || 0));
      row.insertCell().append(el('span', owner.en, owner.mr));
    }
    box.append(t);
    return box;
  }

  return {
    render({ vendors, budget, members }) {
      const wrap = el('div', undefined, undefined, 'fv-stack');
      wrap.append(summary(budgetFigures(vendors, budget)));

      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.value = budgetDraft ?? (budget ? String(budget.total) : '');
      input.oninput = () => { budgetDraft = input.value; };
      const save = el('button', 'Save budget', 'बजेट जतन करा', 'btn-main');
      save.type = 'button';
      save.onclick = saveBudget;
      const form = el('div', undefined, undefined, 'pv-budget');
      form.append(field('Total budget (₹)', 'एकूण बजेट (₹)', input), save);
      if (budgetError) {
        const e = el('p', 'Please use whole rupees, like 2500000.', 'कृपया पूर्ण रुपये लिहा, उदा. २५००००.', 'pf-error');
        e.setAttribute('role', 'alert');
        form.append(e);
      }
      wrap.append(form);

      const add = el('button', '+ Add vendor', '+ विक्रेता जोडा', 'btn-main');
      add.type = 'button';
      add.onclick = () => openVendorEditor(ctx, null, members);
      wrap.append(add);
      wrap.append(vendors.length ? table(vendors, members) : dual('p', NOTHING, 'fv-empty'));
      return wrap;
    },
  };
}
