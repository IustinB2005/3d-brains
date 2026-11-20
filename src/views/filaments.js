import { h, icon, money, grams, modal, field, toast, confirmDialog, readForm } from '../ui.js';
import { store } from '../store.js';
import { state, refresh } from '../app.js';
import { orderGrams, EARNED } from '../calc.js';

const MATERIALS = ['PLA', 'PLA+', 'PLA Silk', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC', 'PLA-CF', 'PETG-CF', 'PA-CF', 'PVA', 'Other'];

export function openFilamentEditor(existing) {
  const f = existing || { brand: '', material: 'PLA', color: '', color_hex: '#2b2b2b', price_per_kg: '', spool_weight_g: 1000, remaining_g: 1000 };
  const form = h('form', { class: 'grid-f', onsubmit: (e) => { e.preventDefault(); save(); } },
    field('Material', h('select', { name: 'material', value: MATERIALS.includes(f.material) ? f.material : 'Other' }, MATERIALS.map((m) => h('option', { value: m }, m)))),
    field('Brand', h('input', { name: 'brand', value: f.brand || '', placeholder: 'Bambu Lab, Prusament, eSun…' })),
    field('Colour name', h('input', { name: 'color', value: f.color || '', placeholder: 'Matte Charcoal' })),
    field('Colour', h('input', { name: 'color_hex', type: 'color', value: f.color_hex || '#2b2b2b' })),
    field(`Price per kg (${state.settings.currency})`, h('input', { name: 'price_per_kg', type: 'number', min: 0, step: 'any', required: true, value: f.price_per_kg ?? '', inputmode: 'decimal' })),
    field('Spool size (g)', h('input', { name: 'spool_weight_g', type: 'number', min: 1, step: 1, value: f.spool_weight_g ?? 1000 })),
    h('div', { class: 'span-2' }, field('Remaining (g)', h('input', { name: 'remaining_g', type: 'number', min: 0, step: 'any', value: f.remaining_g ?? 1000 }), 'Deducted automatically when an order is marked Done.')));

  async function save() {
    const d = readForm(form);
    try {
      if (existing) await store.update('filaments', existing.id, d);
      else await store.insert('filaments', d);
      m.close();
      toast(existing ? 'Spool updated' : 'Spool added');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  }
  const m = modal({
    title: existing ? 'Edit spool' : 'Add spool',
    body: form,
    footer: [
      existing && h('button', { class: 'btn btn-ghost btn-danger-text', html: icon('trash', 16) + 'Delete', onclick: async () => {
        if (!(await confirmDialog('Delete this spool? Orders keep their saved cost.'))) return;
        await store.remove('filaments', existing.id); m.close(); toast('Spool deleted'); refresh();
      } }),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: save }, existing ? 'Save' : 'Add spool'),
    ],
  });
}

export function renderFilaments(el) {
  const used = {};
  state.orders.filter((o) => EARNED.has(o.status)).forEach((o) => {
    const q = Math.max(1, Number(o.quantity) || 1);
    (o.materials || []).forEach((m) => { if (m.filament_id) used[m.filament_id] = (used[m.filament_id] || 0) + (Number(m.grams) || 0) * q; });
  });
  const stockValue = state.filaments.reduce((s, f) => s + ((Number(f.remaining_g) || 0) * (Number(f.price_per_kg) || 0)) / 1000, 0);

  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Filament'), h('p', { class: 'muted' }, `${state.filaments.length} spool${state.filaments.length === 1 ? '' : 's'} · ${money(stockValue)} on the shelf`)),
    h('div', { class: 'head-actions' }, h('button', { class: 'btn btn-primary', onclick: () => openFilamentEditor(), html: icon('plus', 16) + 'Add spool' }))));

  if (!state.filaments.length) {
    el.append(h('section', { class: 'card' }, h('div', { class: 'empty' },
      h('span', { class: 'empty-ico', html: icon('spool', 26) }), h('h3', {}, 'No spools yet'),
      h('p', { class: 'muted' }, 'Add the filament you print with and its price per kilo. 3D Brains uses it to cost every gram.'),
      h('button', { class: 'btn btn-primary', onclick: () => openFilamentEditor(), html: icon('plus', 16) + 'Add spool' }))));
    return;
  }

  el.append(h('div', { class: 'spools' }, state.filaments.map((f) => {
    const ratio = (Number(f.remaining_g) || 0) / (Number(f.spool_weight_g) || 1000);
    const low = ratio < 0.15;
    return h('button', { class: 'card spool', onclick: () => openFilamentEditor(f) },
      h('div', { class: 'spool-top' },
        h('span', { class: 'spool-disc', style: { '--c': f.color_hex || '#999' } }),
        low && h('span', { class: 'warn', html: icon('alert', 14) + 'Low stock' })),
      h('b', { class: 'spool-name' }, `${f.material} ${f.color || ''}`),
      h('span', { class: 'muted' }, f.brand || '—'),
      h('div', { class: `meter ${low ? 'low' : ''}`, role: 'meter', 'aria-label': 'Remaining', 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
        h('i', { style: { width: `${Math.min(100, ratio * 100)}%` } })),
      h('div', { class: 'spool-meta' },
        h('span', {}, `${grams(f.remaining_g)} / ${grams(f.spool_weight_g)}`),
        h('span', {}, `${money(f.price_per_kg)}/kg`)),
      used[f.id] > 0 && h('span', { class: 'muted small' }, `${grams(used[f.id])} used on orders`));
  })));
}
