import { h, icon, money, duration, grams, shortDate, toast, download, esc } from '../ui.js';
import { state, refresh, setOrderStatus } from '../app.js';
import { STATUSES, orderGrams, orderProfit, statusLabel } from '../calc.js';
import { SOURCES } from '../integrations.js';
import { openOrderEditor } from './order-editor.js';

let filter = 'active';
let query = '';

const FILTERS = [
  ['active', 'Active', (o) => ['quote', 'queued', 'printing', 'done'].includes(o.status)],
  ['all', 'All', () => true],
  ...STATUSES.map((s) => [s.id, s.label, (o) => o.status === s.id]),
  ['unpaid', 'Unpaid', (o) => !o.paid && o.status !== 'cancelled' && o.status !== 'quote'],
];

function exportCsv() {
  const cols = ['order_date', 'title', 'customer', 'status', 'source', 'source_url', 'quantity', 'print_minutes', 'grams', 'cost_total', 'price', 'profit', 'paid', 'due_date', 'notes'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(',')].concat(state.orders.map((o) =>
    cols.map((c) => q(c === 'grams' ? orderGrams(o) : c === 'profit' ? orderProfit(o).toFixed(2) : o[c])).join(',')));
  download(`3dbrains-orders-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
}

export function sourceBadge(o) {
  const src = SOURCES[o.source] ? o.source : 'custom';
  return h('span', { class: `src src-${src}`, title: SOURCES[src].label }, SOURCES[src].label);
}

export function thumb(o, size = 40) {
  if (o.thumbnail_url) return h('img', { class: 'thumb', src: o.thumbnail_url, width: size, height: size, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  const sw = (o.materials || []).map((m) => state.filaments.find((f) => f.id === m.filament_id)?.color_hex).find(Boolean);
  return h('span', { class: 'thumb thumb-ph', style: { '--sw': sw || 'var(--line)' } }, (o.title || '?').charAt(0).toUpperCase());
}

export function renderOrders(el) {
  const counts = Object.fromEntries(FILTERS.map(([id, , fn]) => [id, state.orders.filter(fn).length]));
  const fn = FILTERS.find(([id]) => id === filter)?.[2] || (() => true);
  const ql = query.toLowerCase();
  const list = state.orders
    .filter(fn)
    .filter((o) => !ql || `${o.title} ${o.customer} ${o.notes}`.toLowerCase().includes(ql))
    .sort((a, b) => (b.order_date || b.created_at || '').localeCompare(a.order_date || a.created_at || ''));

  const body = h('div', { class: 'order-list' });
  const draw = () => {
    body.replaceChildren();
    if (!list.length) {
      body.append(h('div', { class: 'empty' },
        h('span', { class: 'empty-ico', html: icon('orders', 26) }),
        h('h3', {}, state.orders.length ? 'No orders match' : 'No orders yet'),
        h('p', { class: 'muted' }, state.orders.length ? 'Try another filter or search.' : 'Paste a Printables or MakerWorld link, or drop a sliced file to create your first order.'),
        !state.orders.length && h('button', { class: 'btn btn-primary', onclick: () => openOrderEditor(), html: icon('plus', 16) + 'New order' })));
      return;
    }
    body.append(h('div', { class: 'orow orow-head', 'aria-hidden': 'true' },
      h('span', {}), h('span', {}, 'Order'), h('span', {}, 'Status'), h('span', { class: 'num' }, 'Time'), h('span', { class: 'num' }, 'Filament'),
      h('span', { class: 'num' }, 'Price'), h('span', { class: 'num' }, 'Profit')));
    for (const o of list) {
      const profit = orderProfit(o);
      const statusSel = h('select', {
        class: `status-select pill-${o.status}`, 'aria-label': 'Status', value: o.status,
        onclick: (e) => e.stopPropagation(),
        onchange: async (e) => {
          await setOrderStatus(o, e.target.value);
          toast(`Moved to ${statusLabel(e.target.value)}`);
          refresh();
        },
      }, STATUSES.map((s) => h('option', { value: s.id }, s.label)));
      body.append(h('div', { class: 'orow', tabindex: 0, role: 'button', onclick: () => openOrderEditor(o), onkeydown: (e) => e.key === 'Enter' && e.target === e.currentTarget && openOrderEditor(o) },
        thumb(o),
        h('div', { class: 'o-main' },
          h('b', { class: 'o-title' }, o.title || 'Untitled', Number(o.quantity) > 1 && h('span', { class: 'qty' }, `×${o.quantity}`)),
          h('span', { class: 'o-sub' }, sourceBadge(o),
            o.customer && h('span', {}, o.customer),
            h('span', {}, shortDate(o.order_date || o.created_at)),
            o.due_date && !['done', 'delivered', 'cancelled'].includes(o.status) && h('span', { class: o.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : '' }, `due ${shortDate(o.due_date)}`))),
        h('div', { class: 'o-status' }, statusSel, !o.paid && !['quote', 'cancelled'].includes(o.status) && h('span', { class: 'unpaid' }, 'Unpaid')),
        h('span', { class: 'num o-time' }, duration((Number(o.print_minutes) || 0) * (Number(o.quantity) || 1))),
        h('span', { class: 'num o-fil' }, grams(orderGrams(o))),
        h('b', { class: 'num o-price' }, money(o.price)),
        h('span', { class: `num o-profit ${profit < 0 ? 'neg' : ''}` }, money(profit))));
    }
  };
  draw();

  const search = h('label', { class: 'search' }, h('span', { html: icon('search', 16) }),
    h('input', { type: 'search', placeholder: 'Search orders, customers…', value: query, 'aria-label': 'Search orders',
      oninput: (e) => { query = e.target.value; const pos = e.target.selectionStart; refresh().then(() => { const i = document.querySelector('.search input'); i?.focus(); i?.setSelectionRange(pos, pos); }); } }));

  el.append(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Orders'), h('p', { class: 'muted' }, `${state.orders.length} total`)),
      h('div', { class: 'head-actions' },
        h('button', { class: 'btn btn-ghost', onclick: exportCsv, html: icon('download', 16) + 'Export CSV' }),
        h('button', { class: 'btn btn-primary', onclick: () => openOrderEditor(), html: icon('plus', 16) + 'New order' }))),
    h('div', { class: 'toolbar' },
      h('div', { class: 'chips', role: 'tablist' },
        FILTERS.filter(([id]) => ['active', 'all', 'unpaid'].includes(id) || counts[id] > 0).map(([id, label]) =>
          h('button', { role: 'tab', 'aria-selected': String(filter === id), class: `chip ${filter === id ? 'on' : ''}`, onclick: () => { filter = id; refresh(); } },
            label, h('span', { class: 'chip-n' }, String(counts[id]))))),
      search),
    h('section', { class: 'card card-flush' }, body));
}
