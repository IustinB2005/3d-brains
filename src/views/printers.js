import { h, icon, money, duration, modal, field, toast, confirmDialog, readForm } from '../ui.js';
import { store } from '../store.js';
import { state, refresh, PRINTER_PRESETS } from '../app.js';
import { machineRate, EARNED, orderMinutes, orderProfit } from '../calc.js';

export function openPrinterEditor(existing) {
  const p = existing || { name: '', model: '', power_w: '', purchase_price: '', lifetime_hours: 5000, maintenance_per_hour: 0.3 };
  const rate = h('p', { class: 'rate-hint' });
  const form = h('form', { class: 'grid-f', oninput: () => upd(), onsubmit: (e) => { e.preventDefault(); save(); } },
    !existing && h('div', { class: 'span-2 presets' },
      h('span', { class: 'field-label' }, 'Quick pick'),
      h('div', { class: 'chips' }, PRINTER_PRESETS.map((pr) => h('button', { type: 'button', class: 'chip', onclick: () => {
        form.name.value = pr.name; form.power_w.value = pr.power_w; upd(); form.purchase_price.focus();
      } }, pr.name)))),
    h('div', { class: 'span-2' }, field('Name', h('input', { name: 'name', required: true, value: p.name, placeholder: 'Bambu Lab X2D' }))),
    field('Average power (W)', h('input', { name: 'power_w', type: 'number', min: 0, step: 'any', value: p.power_w ?? '' }), 'Typical draw while printing. A smart plug tells you exactly.'),
    field(`Purchase price (${state.settings.currency})`, h('input', { name: 'purchase_price', type: 'number', min: 0, step: 'any', value: p.purchase_price ?? '' })),
    field('Expected lifetime (h)', h('input', { name: 'lifetime_hours', type: 'number', min: 1, step: 1, value: p.lifetime_hours ?? 5000 }), 'Hours until you would replace it.'),
    field(`Maintenance per hour (${state.settings.currency})`, h('input', { name: 'maintenance_per_hour', type: 'number', min: 0, step: 'any', value: p.maintenance_per_hour ?? 0 }), 'Nozzles, belts, plates, lubricant.'),
    h('div', { class: 'span-2' }, rate));
  const upd = () => {
    const d = readForm(form);
    const energy = ((Number(d.power_w) || 0) / 1000) * (Number(state.settings.electricity_price) || 0);
    rate.innerHTML = `Machine cost <b>${money(machineRate(d), 2)}/h</b> + electricity <b>${money(energy, 2)}/h</b> = <b>${money(machineRate(d) + energy, 2)}</b> per printing hour`;
  };
  async function save() {
    const d = readForm(form);
    if (!d.name) { form.name.focus(); return; }
    try {
      if (existing) await store.update('printers', existing.id, d);
      else await store.insert('printers', d);
      m.close();
      toast(existing ? 'Printer updated' : 'Printer added');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  }
  const m = modal({
    title: existing ? 'Edit printer' : 'Add printer',
    body: form,
    footer: [
      existing && h('button', { class: 'btn btn-ghost btn-danger-text', html: icon('trash', 16) + 'Delete', onclick: async () => {
        if (!(await confirmDialog('Delete this printer? Orders keep their saved cost.'))) return;
        await store.remove('printers', existing.id); m.close(); toast('Printer deleted'); refresh();
      } }),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: save }, existing ? 'Save' : 'Add printer'),
    ],
  });
  upd();
}

export function renderPrinters(el) {
  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Printers'), h('p', { class: 'muted' }, 'Power and wear turn printer hours into real cost.')),
    h('div', { class: 'head-actions' }, h('button', { class: 'btn btn-primary', onclick: () => openPrinterEditor(), html: icon('plus', 16) + 'Add printer' }))));

  if (!state.printers.length) {
    el.append(h('section', { class: 'card' }, h('div', { class: 'empty' },
      h('span', { class: 'empty-ico', html: icon('printer', 26) }), h('h3', {}, 'No printers yet'),
      h('p', { class: 'muted' }, 'Add your printer to include electricity and machine wear in every order’s cost.'),
      h('button', { class: 'btn btn-primary', onclick: () => openPrinterEditor(), html: icon('plus', 16) + 'Add printer' }))));
    return;
  }

  el.append(h('div', { class: 'printers' }, state.printers.map((p) => {
    const done = state.orders.filter((o) => o.printer_id === p.id && EARNED.has(o.status));
    const mins = done.reduce((s, o) => s + orderMinutes(o), 0);
    const profit = done.reduce((s, o) => s + orderProfit(o), 0);
    const energy = ((Number(p.power_w) || 0) / 1000) * (Number(state.settings.electricity_price) || 0);
    const payback = Number(p.purchase_price) > 0 ? Math.min(1, profit / Number(p.purchase_price)) : null;
    return h('button', { class: 'card printer', onclick: () => openPrinterEditor(p) },
      h('div', { class: 'printer-head' }, h('span', { class: 'printer-ico', html: icon('printer', 22) }), h('div', {}, h('b', {}, p.name), h('span', { class: 'muted' }, `${p.power_w || 0} W · ${money(machineRate(p) + energy, 2)} per hour`))),
      h('dl', { class: 'stats' },
        h('div', {}, h('dt', {}, 'Printed'), h('dd', {}, duration(mins))),
        h('div', {}, h('dt', {}, 'Orders'), h('dd', {}, String(done.length))),
        h('div', {}, h('dt', {}, 'Profit'), h('dd', {}, money(profit)))),
      payback != null && h('div', { class: 'payback' },
        h('div', { class: 'payback-t' }, h('span', { class: 'muted' }, 'Paid itself back'), h('b', {}, `${Math.round(payback * 100)}%`)),
        h('div', { class: 'meter good', role: 'meter', 'aria-label': 'Payback', 'aria-valuenow': Math.round(payback * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: `${payback * 100}%` } }))));
  })));
}
