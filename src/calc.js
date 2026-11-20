// Pure business logic: costs, pricing, statuses, aggregation.

export const STATUSES = [
  { id: 'quote', label: 'Quote' },
  { id: 'queued', label: 'Queued' },
  { id: 'printing', label: 'Printing' },
  { id: 'done', label: 'Done' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

// Orders whose money counts as earned.
export const EARNED = new Set(['done', 'delivered']);
// Orders that consume filament from stock.
export const CONSUMES_STOCK = new Set(['done', 'delivered']);

const n = (v) => Number(v) || 0;

export function machineRate(p) {
  if (!p) return 0;
  const dep = n(p.lifetime_hours) > 0 ? n(p.purchase_price) / n(p.lifetime_hours) : 0;
  return dep + n(p.maintenance_per_hour);
}

export function roundPrice(x) {
  if (x <= 0) return 0;
  if (x < 20) return Math.ceil(x * 2) / 2;
  if (x < 200) return Math.ceil(x);
  return Math.ceil(x / 5) * 5;
}

export function computeCosts(o, { settings, printers, filaments }) {
  const qty = Math.max(1, Math.round(n(o.quantity)) || 1);
  const printer = printers.find((p) => p.id === o.printer_id);
  const hours = n(o.print_minutes) / 60;
  const filament = (o.materials || []).reduce((sum, m) => {
    const f = filaments.find((x) => x.id === m.filament_id);
    const ppk = f ? n(f.price_per_kg) : n(m.price_per_kg);
    return sum + (n(m.grams) * ppk) / 1000;
  }, 0) * qty;
  const energy = ((hours * n(printer?.power_w)) / 1000) * n(settings.electricity_price) * qty;
  const machine = hours * machineRate(printer) * qty;
  const failure = ((filament + energy + machine) * n(settings.failure_rate)) / 100;
  const labor = (n(o.labor_minutes) / 60) * n(settings.labor_rate);
  const extras = n(o.extra_costs);
  const total = filament + energy + machine + failure + labor + extras;
  const suggested = roundPrice(total * (1 + n(settings.markup) / 100));
  return { filament, energy, machine, failure, labor, extras, total, suggested };
}

export const orderGrams = (o) =>
  (o.materials || []).reduce((s, m) => s + n(m.grams), 0) * Math.max(1, n(o.quantity) || 1);
export const orderMinutes = (o) => n(o.print_minutes) * Math.max(1, n(o.quantity) || 1);
export const orderProfit = (o) => n(o.price) - n(o.cost_total);

export function inPeriod(dateStr, period) {
  if (period === 'all') return true;
  const d = new Date(dateStr || 0);
  const now = new Date();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  const days = { '30d': 30, '90d': 90 }[period] || 30;
  return now - d <= days * 86400000;
}

export function summarize(orders, period) {
  const earned = orders.filter((o) => EARNED.has(o.status) && inPeriod(o.order_date || o.created_at, period));
  const revenue = earned.reduce((s, o) => s + n(o.price), 0);
  const cost = earned.reduce((s, o) => s + n(o.cost_total), 0);
  return {
    count: earned.length,
    revenue,
    cost,
    profit: revenue - cost,
    margin: revenue > 0 ? (revenue - cost) / revenue : 0,
    minutes: earned.reduce((s, o) => s + orderMinutes(o), 0),
    grams: earned.reduce((s, o) => s + orderGrams(o), 0),
    unpaid: orders.filter((o) => EARNED.has(o.status) && !o.paid).reduce((s, o) => s + n(o.price), 0),
  };
}

export function monthly(orders, months = 12) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, date: d, revenue: 0, cost: 0, count: 0 });
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  for (const o of orders) {
    if (!EARNED.has(o.status)) continue;
    const k = (o.order_date || o.created_at || '').slice(0, 7);
    if (k in idx) {
      const b = buckets[idx[k]];
      b.revenue += n(o.price);
      b.cost += n(o.cost_total);
      b.count++;
    }
  }
  return buckets;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
