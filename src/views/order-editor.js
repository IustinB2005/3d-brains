import { h, icon, money, modal, field, toast, confirmDialog, duration, esc } from '../ui.js';
import { store } from '../store.js';
import { state, refresh, saveOrder } from '../app.js';
import { STATUSES, computeCosts, today, machineRate } from '../calc.js';
import { SOURCES, detectSource, fetchPreview, parseSlicerFile, matchFilament } from '../integrations.js';

const filLabel = (f) => `${f.material} · ${f.color || 'no colour'}${f.brand ? ` (${f.brand})` : ''}`;

export function openOrderEditor(existing, template) {
  const o = existing
    ? structuredClone(existing)
    : template
    ? structuredClone(template)
    : {
        title: '', customer: '', status: 'queued', source: 'custom', source_url: '', thumbnail_url: '',
        printer_id: state.printers[0]?.id || '', quantity: 1, print_minutes: 0, labor_minutes: 10, extra_costs: 0,
        materials: state.filaments[0] ? [{ filament_id: state.filaments[0].id, grams: 0 }] : [],
        price: null, paid: false, order_date: today(), due_date: '', notes: '',
      };
  o.materials = o.materials || [];
  let priceTouched = o.price != null;

  // ── Import zone: link + slicer file ─────────────────────────
  const preview = h('div', { class: 'import-preview' });
  const linkInput = h('input', { type: 'url', placeholder: 'Paste a Printables or MakerWorld link…', value: o.source_url || '', 'aria-label': 'Model link' });
  const fileInput = h('input', { type: 'file', accept: '.3mf,.gcode,.gco', hidden: true, onchange: (e) => e.target.files[0] && importFile(e.target.files[0]) });
  const fetchBtn = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => importLink() }, 'Fetch');

  async function importLink() {
    const url = linkInput.value.trim();
    if (!url) return;
    if (!detectSource(url)) { toast('That does not look like a link', 'err'); return; }
    fetchBtn.disabled = true; fetchBtn.textContent = '…';
    const p = await fetchPreview(url);
    fetchBtn.disabled = false; fetchBtn.textContent = 'Fetch';
    o.source_url = url;
    o.source = p.source;
    if (p.title) { o.title = p.title; form.title.value = p.title; }
    if (p.image) o.thumbnail_url = p.image;
    drawPreview();
    recalc();
  }

  async function importFile(file) {
    drop.classList.add('busy');
    try {
      const r = await parseSlicerFile(file);
      if (!form.title.value && r.title) { o.title = r.title; form.title.value = r.title; }
      if (r.url && !o.source_url) { o.source_url = r.url; o.source = 'makerworld'; linkInput.value = r.url; }
      if (r.thumbnail) o.thumbnail_url = r.thumbnail;
      if (r.minutes) { o.print_minutes = r.minutes; form.ph.value = Math.floor(r.minutes / 60); form.pm.value = r.minutes % 60; }
      if (r.filaments.length) {
        o.materials = r.filaments.map((sf) => {
          const f = matchFilament(sf, state.filaments);
          return { filament_id: f?.id || '', grams: sf.grams, slicer: `${sf.type} ${sf.color}` };
        });
        drawMaterials();
      }
      if (!r.sliced) toast('No slicing data found. Export the sliced plate (.gcode.3mf) for time and grams.', 'warn');
      else toast(`Imported ${duration(r.minutes)} · ${r.filaments.reduce((s, f) => s + f.grams, 0).toFixed(1)} g`);
      drawPreview();
      recalc();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      drop.classList.remove('busy');
    }
  }

  const drop = h('div', { class: 'drop', tabindex: 0, role: 'button', 'aria-label': 'Import a sliced file',
    onclick: () => fileInput.click(), onkeydown: (e) => e.key === 'Enter' && fileInput.click(),
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) importFile(f); } },
    h('span', { html: icon('upload', 18) }),
    h('div', {}, h('b', {}, 'Drop a sliced file'), h('span', {}, '.gcode.3mf · .3mf · .gcode — fills time & grams')),
    fileInput);

  function drawPreview() {
    preview.replaceChildren();
    if (!o.source_url && !o.thumbnail_url) return;
    preview.append(
      o.thumbnail_url ? h('img', { src: o.thumbnail_url, alt: '', referrerpolicy: 'no-referrer' }) : h('span', { class: 'thumb thumb-ph' }, (o.title || '?')[0]),
      h('div', {},
        h('span', { class: `src src-${o.source}` }, SOURCES[o.source]?.label || 'Custom'),
        o.source_url && h('a', { href: o.source_url, target: '_blank', rel: 'noopener', class: 'link' }, 'Open model ↗')),
      h('button', { class: 'icon-btn', type: 'button', title: 'Remove link', 'aria-label': 'Remove link', html: icon('x', 16),
        onclick: () => { o.source_url = ''; o.thumbnail_url = ''; o.source = 'custom'; linkInput.value = ''; drawPreview(); } }));
  }

  // ── Materials rows ─────────────────────────────────────────
  const matsEl = h('div', { class: 'mats' });
  function drawMaterials() {
    matsEl.replaceChildren();
    o.materials.forEach((m, i) => {
      const sel = h('select', { 'aria-label': 'Spool', value: m.filament_id || '', onchange: (e) => { m.filament_id = e.target.value; recalc(); } },
        h('option', { value: '' }, state.filaments.length ? 'Choose spool…' : 'No spools yet'),
        state.filaments.map((f) => h('option', { value: f.id }, filLabel(f))));
      const sw = state.filaments.find((f) => f.id === m.filament_id)?.color_hex;
      matsEl.append(h('div', { class: 'mat' },
        h('span', { class: 'swatch', style: { background: sw || 'var(--line)' } }),
        sel,
        h('div', { class: 'suffix' }, h('input', { type: 'number', min: 0, step: 0.1, value: m.grams ?? '', 'aria-label': 'Grams', inputmode: 'decimal',
          oninput: (e) => { m.grams = Number(e.target.value) || 0; recalc(); } }), h('span', {}, 'g')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove material', html: icon('x', 15), onclick: () => { o.materials.splice(i, 1); drawMaterials(); recalc(); } })));
      if (m.slicer && !m.filament_id) matsEl.append(h('p', { class: 'field-hint' }, `Slicer used ${m.slicer}: pick the matching spool.`));
    });
    matsEl.append(h('button', { class: 'link-btn', type: 'button', onclick: () => { o.materials.push({ filament_id: '', grams: 0 }); drawMaterials(); } }, '+ Add material'));
  }

  // ── Form ───────────────────────────────────────────────────
  const num = (name, value, attrs = {}) => h('input', { name, type: 'number', min: 0, step: 'any', value: value ?? '', inputmode: 'decimal', ...attrs });
  const form = h('form', { class: 'order-form', oninput: () => recalc(), onsubmit: (e) => { e.preventDefault(); save(); } },
    h('div', { class: 'import' }, h('div', { class: 'import-link' }, h('span', { html: icon('link', 16) }), linkInput, fetchBtn), drop),
    preview,
    h('div', { class: 'grid-f' },
      h('div', { class: 'span-2' }, field('Title', h('input', { name: 'title', required: true, value: o.title, placeholder: 'What are you printing?' }))),
      field('Customer', h('input', { name: 'customer', value: o.customer || '', placeholder: 'Name, shop or platform', list: 'customers' })),
      field('Status', h('select', { name: 'status', value: o.status }, STATUSES.map((s) => h('option', { value: s.id }, s.label)))),
      field('Order date', h('input', { name: 'order_date', type: 'date', value: o.order_date || today() })),
      field('Due date', h('input', { name: 'due_date', type: 'date', value: o.due_date || '' })),
      field('Printer', h('select', { name: 'printer_id', value: o.printer_id || '' },
        h('option', { value: '' }, state.printers.length ? 'Choose printer…' : 'No printers yet'),
        state.printers.map((p) => h('option', { value: p.id }, p.name)))),
      field('Quantity', num('quantity', o.quantity || 1, { min: 1, step: 1 })),
      field('Print time (per piece)', h('div', { class: 'time-in' },
        h('div', { class: 'suffix' }, num('ph', Math.floor((o.print_minutes || 0) / 60), { step: 1, 'aria-label': 'Hours' }), h('span', {}, 'h')),
        h('div', { class: 'suffix' }, num('pm', Math.round((o.print_minutes || 0) % 60), { step: 1, max: 59, 'aria-label': 'Minutes' }), h('span', {}, 'm')))),
      field('Hands-on time', h('div', { class: 'suffix' }, num('labor_minutes', o.labor_minutes ?? 0, { step: 1 }), h('span', {}, 'min')), 'Prep, post-processing, packing'),
      h('div', { class: 'span-2' }, h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Filament (per piece)'), matsEl)),
      field('Extra costs', num('extra_costs', o.extra_costs ?? 0), 'Magnets, inserts, packaging, shipping'),
      field('Price charged (total)', num('price', o.price ?? '')),
      h('div', { class: 'span-2' }, field('Notes', h('textarea', { name: 'notes', rows: 2, value: o.notes || '', placeholder: 'Colours, sizes, delivery details…' }))),
      h('label', { class: 'check span-2' }, h('input', { type: 'checkbox', name: 'paid', checked: !!o.paid }), h('span', {}, 'Paid'))),
    h('datalist', { id: 'customers' }, [...new Set(state.orders.map((x) => x.customer).filter(Boolean))].map((c) => h('option', { value: c }))));
  form.price.addEventListener('input', () => (priceTouched = form.price.value !== ''));

  // ── Live cost panel ────────────────────────────────────────
  const panel = h('aside', { class: 'cost-panel' });
  function collect() {
    return {
      ...o,
      title: form.title.value.trim(),
      customer: form.customer.value.trim(),
      status: form.status.value,
      order_date: form.order_date.value || today(),
      due_date: form.due_date.value || null,
      printer_id: form.printer_id.value || null,
      quantity: Math.max(1, Math.round(Number(form.quantity.value) || 1)),
      print_minutes: (Number(form.ph.value) || 0) * 60 + (Number(form.pm.value) || 0),
      labor_minutes: Number(form.labor_minutes.value) || 0,
      extra_costs: Number(form.extra_costs.value) || 0,
      price: form.price.value === '' ? null : Number(form.price.value),
      notes: form.notes.value.trim(),
      paid: form.paid.checked,
      materials: o.materials.filter((m) => m.filament_id || m.grams).map((m) => {
        const f = state.filaments.find((x) => x.id === m.filament_id);
        return { filament_id: m.filament_id || null, grams: Number(m.grams) || 0, label: f ? `${f.material} ${f.color || ''}`.trim() : m.label || m.slicer || '', price_per_kg: f ? Number(f.price_per_kg) : Number(m.price_per_kg) || 0 };
      }),
    };
  }
  function recalc() {
    const d = collect();
    const c = computeCosts(d, state);
    const price = d.price ?? c.suggested;
    const profit = price - c.total;
    const printer = state.printers.find((p) => p.id === d.printer_id);
    const row = (label, v, hint) => `<div class="cp-row"><span>${label}${hint ? `<small>${esc(hint)}</small>` : ''}</span><b>${money(v, 2)}</b></div>`;
    panel.innerHTML = `
      <h3>Cost breakdown</h3>
      ${row('Filament', c.filament)}
      ${row('Electricity', c.energy, printer ? `${printer.power_w || 0} W` : 'no printer')}
      ${row('Machine wear', c.machine, printer ? `${money(machineRate(printer), 2)}/h` : '')}
      ${row('Failure buffer', c.failure, `${state.settings.failure_rate || 0}%`)}
      ${row('Labour', c.labor)}
      ${row('Extras', c.extras)}
      <div class="cp-row cp-total"><span>Total cost</span><b>${money(c.total, 2)}</b></div>
      <div class="cp-suggest">
        <span>Suggested price<small>${state.settings.markup || 0}% markup</small></span>
        <button type="button" class="btn btn-sm" data-use>${money(c.suggested, 2)}</button>
      </div>
      <div class="cp-profit ${profit < 0 ? 'neg' : ''}">
        <span>${d.price == null ? 'Profit at suggested price' : 'Profit'}</span>
        <b>${money(profit, 2)}</b>
        <small>${price > 0 ? Math.round((profit / price) * 100) : 0}% margin · ${money(profit / Math.max(1, (d.print_minutes * d.quantity) / 60), 2)} per printer hour</small>
      </div>`;
    panel.querySelector('[data-use]').onclick = () => { form.price.value = c.suggested; priceTouched = true; recalc(); };
  }

  async function save() {
    const d = collect();
    if (!d.title) { form.title.focus(); return; }
    if (d.price == null) d.price = computeCosts(d, state).suggested;
    if (!d.source_url) d.source = 'custom';
    for (const k of ['id', 'user_id', 'created_at', 'updated_at', 'costs', 'cost_total', 'stock_deducted']) delete d[k];
    saveBtn.disabled = true;
    try {
      await saveOrder(d, existing);
      m.close();
      toast(existing ? 'Order updated' : 'Order added');
      refresh();
    } catch (e) {
      toast(e.message, 'err');
      saveBtn.disabled = false;
    }
  }

  const saveBtn = h('button', { class: 'btn btn-primary', onclick: save }, existing ? 'Save changes' : 'Add order');
  const footer = [
    existing && h('button', { class: 'btn btn-ghost btn-danger-text', onclick: async () => {
      if (!(await confirmDialog(`Delete “${existing.title}”? This cannot be undone.`))) return;
      await store.remove('orders', existing.id);
      m.close();
      toast('Order deleted');
      refresh();
    }, html: icon('trash', 16) + 'Delete' }),
    existing && h('button', { class: 'btn btn-ghost', onclick: () => {
      const copy = structuredClone(existing);
      for (const k of ['id', 'user_id', 'created_at', 'updated_at', 'stock_deducted', 'costs', 'cost_total']) delete copy[k];
      m.close();
      openOrderEditor(null, { ...copy, status: 'queued', paid: false, order_date: today(), due_date: '' });
    } }, 'Repeat order'),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
    saveBtn,
  ];

  const m = modal({ title: existing ? 'Edit order' : 'New order', wide: true, body: h('div', { class: 'order-editor' }, form, panel), footer });
  drawMaterials();
  drawPreview();
  recalc();
  linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); importLink(); } });
  linkInput.addEventListener('paste', () => setTimeout(importLink, 0));
  return m;
}

