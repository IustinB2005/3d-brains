import { h, icon, money, pct, duration, grams, shortDate, toast, esc } from '../ui.js';
import { isDemo } from '../store.js';
import { state, refresh, loadSample, go } from '../app.js';
import { summarize, monthly, STATUSES, statusLabel } from '../calc.js';
import { SOURCES } from '../integrations.js';
import { revenueChart } from './chart.js';
import { openOrderEditor } from './order-editor.js';
import { openPrinterEditor } from './printers.js';
import { openFilamentEditor } from './filaments.js';

let period = '30d';
const PERIODS = [['30d', '30 days'], ['90d', '90 days'], ['year', 'This year'], ['all', 'All time']];

function greeting() {
  const hr = new Date().getHours();
  const part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const name = (state.user?.name || '').split(' ')[0];
  return name ? `${part}, ${name}` : part;
}

function onboarding(el) {
  const step = (done, n, title, desc, action) =>
    h('li', { class: `ob-step ${done ? 'done' : ''}` },
      h('span', { class: 'ob-n', html: done ? icon('check', 14) : String(n) }),
      h('div', {}, h('b', {}, title), h('p', { class: 'muted' }, desc)),
      !done && action);
  const hasP = state.printers.length > 0, hasF = state.filaments.length > 0;
  el.append(h('section', { class: 'card onboarding' },
    h('div', { class: 'ob-head' },
      h('h2', {}, 'Set up your print shop'),
      h('p', { class: 'muted' }, 'Three quick steps and 3D Brains starts calculating real costs and profit for every order.')),
    h('ol', { class: 'ob-steps' },
      step(hasP, 1, 'Add your printer', 'Power draw and price give you energy and machine-wear cost per hour.',
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => openPrinterEditor() }, 'Add printer')),
      step(hasF, 2, 'Add your filament', 'Price per kilo for each spool you print with.',
        h('button', { class: 'btn btn-sm', onclick: () => openFilamentEditor() }, 'Add spool')),
      step(false, 3, 'Log your first order', 'Paste a Printables / MakerWorld link or drop a sliced file.',
        h('button', { class: 'btn btn-sm', onclick: () => openOrderEditor() }, 'New order'))),
    isDemo && h('div', { class: 'ob-sample' },
      h('span', { class: 'muted' }, 'Just looking around?'),
      h('button', { class: 'link-btn', onclick: async () => { await loadSample(); toast('Sample shop loaded'); refresh(); } }, 'Load a sample shop'))));
}

function kpi(label, value, sub) {
  return h('div', { class: 'kpi' }, h('span', { class: 'kpi-l' }, label), h('b', { class: 'kpi-v' }, value), sub && h('span', { class: 'kpi-s' }, sub));
}

export function renderOverview(el) {
  const s = summarize(state.orders, period);
  const empty = state.orders.length === 0;

  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, greeting()), h('p', { class: 'muted' }, new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))),
    h('div', { class: 'head-actions' },
      h('div', { class: 'seg', role: 'tablist' },
        PERIODS.map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(period === id), class: period === id ? 'on' : '', onclick: () => { period = id; refresh(); } }, label))),
      h('button', { class: 'btn btn-primary', onclick: () => openOrderEditor(), html: icon('plus', 16) + 'New order' }))));

  if (empty) onboarding(el);

  el.append(h('section', { class: 'kpis' },
    kpi('Revenue', money(s.revenue), `${s.count} completed order${s.count === 1 ? '' : 's'}`),
    kpi('Profit', money(s.profit), s.revenue ? `${pct(s.margin)} margin` : '—'),
    kpi('Printer time', duration(s.minutes), 'on completed orders'),
    kpi('Filament used', grams(s.grams), 'across all spools'),
    kpi('Unpaid', money(s.unpaid), 'done but not paid yet')));

  // Pipeline: active statuses with counts and value
  const active = ['quote', 'queued', 'printing', 'done'];
  const pipe = h('section', { class: 'card pipeline' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Pipeline'), h('a', { href: '#/app/orders', class: 'link' }, 'All orders')),
    h('ul', { class: 'pipe-list' }, active.map((st) => {
      const list = state.orders.filter((o) => o.status === st);
      return h('li', {},
        h('span', { class: `pill pill-${st}` }, statusLabel(st)),
        h('b', {}, String(list.length)),
        h('span', { class: 'muted' }, money(list.reduce((a, o) => a + (Number(o.price) || 0), 0))));
    })));

  el.append(h('div', { class: 'grid-2-1' },
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Revenue & costs'), h('span', { class: 'muted' }, 'Last 12 months')),
      revenueChart(monthly(state.orders))),
    pipe));

  // Up next: queued/printing sorted by due date
  const next = state.orders
    .filter((o) => ['queued', 'printing', 'quote'].includes(o.status))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    .slice(0, 6);
  const upNext = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Up next'), h('a', { href: '#/app/orders', class: 'link' }, 'View all')),
    next.length
      ? h('ul', { class: 'mini-list' }, next.map((o) => h('li', { onclick: () => openOrderEditor(o), tabindex: 0, onkeydown: (e) => e.key === 'Enter' && openOrderEditor(o) },
          h('span', { class: `pill pill-${o.status}` }, statusLabel(o.status)),
          h('div', { class: 'ml-t' }, h('b', {}, o.title || 'Untitled'), h('span', { class: 'muted' }, [o.customer, o.due_date && `due ${shortDate(o.due_date)}`].filter(Boolean).join(' · ') || duration(o.print_minutes))),
          h('b', {}, money(o.price)))))
      : h('p', { class: 'empty-sm muted' }, 'Nothing queued. Enjoy the quiet.'));

  // Low stock
  const low = state.filaments
    .map((f) => ({ f, ratio: (Number(f.remaining_g) || 0) / (Number(f.spool_weight_g) || 1000) }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 4);
  const stock = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Filament'), h('a', { href: '#/app/filaments', class: 'link' }, 'Manage')),
    low.length
      ? h('ul', { class: 'stock-list' }, low.map(({ f, ratio }) => h('li', {},
          h('span', { class: 'swatch', style: { background: f.color_hex || '#999' } }),
          h('div', { class: 'ml-t' }, h('b', {}, `${f.material} ${f.color || ''}`), h('span', { class: 'muted' }, `${grams(f.remaining_g)} left`)),
          h('div', { class: `meter ${ratio < 0.15 ? 'low' : ''}`, role: 'meter', 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Remaining' },
            h('i', { style: { width: `${Math.min(100, ratio * 100)}%` } })),
          ratio < 0.15 && h('span', { class: 'warn', html: icon('alert', 14) + 'Low' }))))
      : h('p', { class: 'empty-sm muted' }, 'No spools yet.'));

  // Sources
  const bySource = {};
  state.orders.forEach((o) => { if (o.status !== 'cancelled') bySource[o.source || 'custom'] = (bySource[o.source || 'custom'] || 0) + 1; });
  const total = Object.values(bySource).reduce((a, b) => a + b, 0) || 1;
  const sources = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Where designs come from')),
    Object.keys(bySource).length
      ? h('ul', { class: 'share-list' }, Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('li', {},
          h('span', {}, SOURCES[k]?.label || k),
          h('div', { class: 'share' }, h('i', { style: { width: `${(v / total) * 100}%` } })),
          h('b', {}, String(v)))))
      : h('p', { class: 'empty-sm muted' }, 'Link orders to Printables or MakerWorld to see this.'));

  el.append(h('div', { class: 'grid-3' }, upNext, stock, sources));
}
