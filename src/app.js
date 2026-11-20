// Shared app state and mutations used by every view.
import { store, DEFAULT_SETTINGS } from './store.js';
import { setCurrency } from './ui.js';
import { computeCosts, CONSUMES_STOCK, today } from './calc.js';

export const state = {
  user: null,
  settings: { ...DEFAULT_SETTINGS },
  printers: [],
  filaments: [],
  orders: [],
  loadedFor: null,
};

export async function loadData() {
  const [settings, printers, filaments, orders] = await Promise.all([
    store.getSettings(),
    store.list('printers'),
    store.list('filaments'),
    store.list('orders'),
  ]);
  Object.assign(state, { settings, printers, filaments, orders, loadedFor: state.user?.id });
  setCurrency(settings.currency);
}

export function go(path) {
  if (location.hash !== '#' + path) location.hash = '#' + path;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
}

let rerender = () => {};
export const setRerender = (fn) => (rerender = fn);
export async function refresh() {
  await loadData();
  rerender();
}

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

// Saves an order, snapshots its costs, and keeps spool stock in sync:
// filament is subtracted when an order is Done/Delivered and given back
// if it moves back to an earlier status.
export async function saveOrder(data, existing) {
  const costs = computeCosts(data, state);
  const row = {
    ...data,
    costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, r2(v)])),
    cost_total: r2(costs.total),
  };

  const deltas = new Map();
  const add = (o, sign) => {
    const q = Math.max(1, Number(o.quantity) || 1);
    for (const m of o.materials || []) {
      if (m.filament_id) deltas.set(m.filament_id, (deltas.get(m.filament_id) || 0) + sign * (Number(m.grams) || 0) * q);
    }
  };
  if (existing?.stock_deducted) add(existing, +1);
  const consume = CONSUMES_STOCK.has(row.status);
  if (consume) add(row, -1);
  row.stock_deducted = consume;

  for (const [id, d] of deltas) {
    if (Math.abs(d) < 0.05) continue;
    const f = state.filaments.find((x) => x.id === id);
    if (f) await store.update('filaments', id, { remaining_g: Math.max(0, r1((Number(f.remaining_g) || 0) + d)) });
  }
  return existing ? store.update('orders', existing.id, row) : store.insert('orders', row);
}

export async function setOrderStatus(order, status) {
  const patch = { ...order, status };
  for (const k of ['id', 'user_id', 'created_at', 'updated_at', 'costs', 'cost_total', 'stock_deducted']) delete patch[k];
  return saveOrder(patch, order);
}

export const PRINTER_PRESETS = [
  { name: 'Bambu Lab X2D', power_w: 350 },
  { name: 'Bambu Lab H2D', power_w: 400 },
  { name: 'Bambu Lab X1 Carbon', power_w: 200 },
  { name: 'Bambu Lab P1S', power_w: 150 },
  { name: 'Bambu Lab A1', power_w: 110 },
  { name: 'Prusa Core One', power_w: 140 },
  { name: 'Prusa MK4S', power_w: 100 },
  { name: 'Creality K1', power_w: 200 },
];

// Realistic sample shop, used by "Load sample data" in demo mode.
export async function loadSample() {
  const p = await store.insert('printers', {
    name: 'Bambu Lab X2D', model: 'X2D', power_w: 350, purchase_price: 9000, lifetime_hours: 6000, maintenance_per_hour: 0.4,
  });
  const fil = await store.insertMany('filaments', [
    { brand: 'Bambu Lab', material: 'PLA', color: 'Matte Charcoal', color_hex: '#2b2b2b', price_per_kg: 115, spool_weight_g: 1000, remaining_g: 640 },
    { brand: 'Bambu Lab', material: 'PLA', color: 'Ivory White', color_hex: '#f1ede4', price_per_kg: 115, spool_weight_g: 1000, remaining_g: 820 },
    { brand: 'Bambu Lab', material: 'PETG', color: 'Translucent Orange', color_hex: '#f07a2b', price_per_kg: 125, spool_weight_g: 1000, remaining_g: 120 },
    { brand: 'Polymaker', material: 'TPU', color: 'Ocean Blue', color_hex: '#2d6cb5', price_per_kg: 190, spool_weight_g: 750, remaining_g: 560 },
    { brand: 'eSun', material: 'PLA', color: 'Sage Green', color_hex: '#9caf88', price_per_kg: 95, spool_weight_g: 1000, remaining_g: 910 },
  ]);
  state.printers = [p];
  state.filaments = fil;

  const models = [
    ['Articulated dragon', 'makerworld', 'https://makerworld.com/en/models/19535-articulated-dragon', 0, 95, 340],
    ['Headphone stand', 'printables', 'https://www.printables.com/model/123456-headphone-stand', 1, 120, 210],
    ['Custom name keychains ×20', 'custom', '', 4, 40, 180],
    ['Planter with drainage', 'printables', 'https://www.printables.com/model/234567-minimal-planter', 4, 160, 300],
    ['Cable organizer set', 'makerworld', 'https://makerworld.com/en/models/345678-cable-organizer', 0, 35, 85],
    ['Replacement gear', 'custom', '', 2, 18, 45],
    ['Phone grip TPU', 'makerworld', 'https://makerworld.com/en/models/456789-phone-grip', 3, 25, 60],
    ['Desk lamp shade', 'printables', 'https://www.printables.com/model/567890-lamp-shade', 1, 190, 380],
    ['Cosplay helmet parts', 'custom', '', 0, 720, 1450],
    ['Wall hooks ×12', 'makerworld', 'https://makerworld.com/en/models/678901-wall-hooks', 2, 50, 150],
  ];
  const statuses = ['delivered', 'delivered', 'delivered', 'done', 'delivered', 'printing', 'queued', 'quote', 'delivered', 'delivered'];
  const customers = ['Andrei P.', 'Maria I.', 'Etsy order', 'Café Lumen', 'Radu C.', 'Ioana M.', 'Local market', 'Vlad S.'];
  const rows = [];
  const now = new Date();
  for (let i = 0; i < 26; i++) {
    const [title, source, url, fi, g, mins] = models[i % models.length];
    const d = new Date(now.getFullYear(), now.getMonth() - Math.floor(i / 2.4), 3 + ((i * 7) % 24));
    const status = i < 4 ? ['queued', 'printing', 'quote', 'done'][i] : statuses[i % statuses.length] === 'quote' ? 'delivered' : statuses[i % statuses.length];
    const o = {
      title, source, source_url: url, customer: customers[i % customers.length], status,
      printer_id: p.id, quantity: i % 5 === 0 ? 2 : 1, print_minutes: mins, labor_minutes: 10 + (i % 3) * 10, extra_costs: i % 4 === 0 ? 8 : 0,
      materials: [{ filament_id: fil[fi].id, label: `${fil[fi].material} ${fil[fi].color}`, price_per_kg: fil[fi].price_per_kg, grams: g }],
      order_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      due_date: i < 3 ? today() : '', paid: status === 'delivered' || i % 3 === 0, notes: '', thumbnail_url: '',
    };
    const c = computeCosts(o, state);
    o.price = Math.max(c.suggested + ((i * 13) % 20) - 8, Math.ceil(c.total + 5));
    o.costs = c;
    o.cost_total = r2(c.total);
    o.stock_deducted = false; // sample stock levels are already set
    rows.push(o);
  }
  await store.insertMany('orders', rows);
}
