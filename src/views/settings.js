import { h, field, toast, readForm, download, confirmDialog, icon } from '../ui.js';
import { store, isDemo } from '../store.js';
import { state, refresh, loadSample } from '../app.js';

const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'HUF', 'CZK', 'BGN', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD'];

export function renderSettings(el) {
  const s = state.settings;
  const nf = (name, attrs = {}) => h('input', { name, type: 'number', min: 0, step: 'any', value: s[name] ?? '', inputmode: 'decimal', ...attrs });
  const form = h('form', { class: 'grid-f', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await store.saveSettings({ ...s, ...readForm(form) });
      toast('Settings saved');
      refresh();
    } catch (ex) { toast(ex.message, 'err'); }
  } },
    h('div', { class: 'span-2' }, field('Business name', h('input', { name: 'business_name', value: s.business_name || '', placeholder: 'Your print shop' }))),
    field('Currency', h('select', { name: 'currency', value: s.currency }, CURRENCIES.map((c) => h('option', { value: c }, c)))),
    field('Electricity price per kWh', nf('electricity_price'), 'Check your latest bill. Romania 2026: ~1.3 lei'),
    field('Labour rate per hour', nf('labor_rate'), 'What your hands-on time is worth'),
    field('Default markup (%)', nf('markup'), '100% = price is double the cost'),
    field('Failure buffer (%)', nf('failure_rate'), 'Covers failed prints and purging'),
    h('div', { class: 'span-2 form-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save settings')));

  const exportJson = () => download(`3dbrains-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ exported_at: new Date().toISOString(), settings: state.settings, printers: state.printers, filaments: state.filaments, orders: state.orders }, null, 2), 'application/json');

  el.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Settings'), h('p', { class: 'muted' }, 'These numbers drive every cost and price calculation.'))),
    h('section', { class: 'card card-pad' }, h('h2', {}, 'Business & pricing'), form),
    h('section', { class: 'card card-pad' },
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, isDemo ? 'Demo mode keeps everything in this browser. Export a backup before clearing your browser data.' : 'Your data is stored securely in the cloud and only you can see it.'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: exportJson, html: icon('download', 16) + 'Download backup (JSON)' }),
        isDemo && h('button', { class: 'btn', onclick: async () => { await loadSample(); toast('Sample shop loaded'); refresh(); } }, 'Load sample shop'),
        h('button', { class: 'btn btn-ghost btn-danger-text', onclick: async () => {
          if (!(await confirmDialog('Delete all orders, spools and printers? This cannot be undone.', { okLabel: 'Delete everything' }))) return;
          await store.wipe();
          toast('All data deleted');
          refresh();
        } }, 'Delete all data'))),
    h('section', { class: 'card card-pad' },
      h('h2', {}, 'Account'),
      h('p', { class: 'muted' }, `Signed in as ${state.user?.email}.`)));
}
