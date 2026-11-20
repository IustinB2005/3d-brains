// Grouped bar chart: revenue vs cost per month, with hover tooltip.
// Colours come from CSS tokens (--series-revenue / --series-cost) so
// light and dark mode each use their own validated steps.
import { h, money, esc } from '../ui.js';

export function revenueChart(buckets) {
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'chart-tip', role: 'tooltip' });
  const legend = h('div', { class: 'legend' },
    h('span', {}, h('i', { class: 'sw sw-rev' }), 'Revenue'),
    h('span', {}, h('i', { class: 'sw sw-cost' }), 'Costs'));
  const holder = h('div', { class: 'chart-holder' });
  wrap.append(legend, holder, tip);

  const draw = () => {
    const W = Math.max(280, holder.clientWidth || 600);
    const H = 220, padL = 52, padR = 8, padT = 10, padB = 26;
    const max = Math.max(1, ...buckets.map((b) => Math.max(b.revenue, b.cost)));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    const colW = (W - padL - padR) / buckets.length;
    const barW = Math.max(3, Math.min(16, colW * 0.3));
    const gap = 2;
    const short = W < 480;

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue and costs for the last ${buckets.length} months">`;
    for (let v = 0; v <= top + 0.001; v += step) {
      svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
      svg += `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" class="axis">${esc(compact(v))}</text>`;
    }
    buckets.forEach((b, i) => {
      const cx = padL + colW * i + colW / 2;
      const bar = (v, x, cls) => {
        if (v <= 0) return '';
        const top = y(v), hgt = y(0) - top;
        const r = Math.min(4, barW / 2, hgt);
        return `<path class="${cls}" d="M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z"/>`;
      };
      svg += bar(b.revenue, cx - barW - gap / 2, 'bar-rev');
      svg += bar(b.cost, cx + gap / 2, 'bar-cost');
      if (!short || i % 2 === buckets.length % 2) {
        svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="axis">${b.date.toLocaleDateString('en-GB', { month: 'short' })}</text>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${padL + colW * i}" y="${padT}" width="${colW}" height="${H - padT - padB}"/>`;
    });
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" class="baseline"/></svg>`;
    holder.innerHTML = svg;

    holder.querySelectorAll('.hit').forEach((r) => {
      const show = () => {
        const b = buckets[+r.dataset.i];
        holder.querySelectorAll('.hit').forEach((x) => x.classList.toggle('on', x === r));
        tip.innerHTML = `<b>${b.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
          <div><i class="sw sw-rev"></i>Revenue <span>${money(b.revenue)}</span></div>
          <div><i class="sw sw-cost"></i>Costs <span>${money(b.cost)}</span></div>
          <div class="tip-sum">Profit <span>${money(b.revenue - b.cost)}</span></div>
          <div class="tip-sub">${b.count} order${b.count === 1 ? '' : 's'}</div>`;
        const x = +r.getAttribute('x') + +r.getAttribute('width') / 2;
        tip.style.left = `${Math.min(Math.max(x, 80), W - 80)}px`;
        tip.classList.add('show');
      };
      r.addEventListener('mouseenter', show);
      r.addEventListener('click', show);
    });
    holder.onmouseleave = () => {
      tip.classList.remove('show');
      holder.querySelectorAll('.hit').forEach((x) => x.classList.remove('on'));
    };
  };

  requestAnimationFrame(draw);
  const ro = new ResizeObserver(() => draw());
  requestAnimationFrame(() => ro.observe(holder));
  return wrap;
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x || 1)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const compact = (v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v)));
