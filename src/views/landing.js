import { h, icon, logo, esc } from '../ui.js';
import { isDemo } from '../store.js';
import { roundPrice } from '../calc.js';

const scrollTo = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const FEATURES = [
  ['orders', 'Orders, structured', 'Every job moves through Quote → Queued → Printing → Done → Delivered. See what is due, what is unpaid and what is next at a glance.'],
  ['sparkle', 'True cost per print', 'Filament by the gram, electricity by the kWh, machine wear by the hour, labour and a failure buffer. Get a suggested price before you quote.'],
  ['link', 'Printables & MakerWorld', 'Paste a model link and 3D Brains fills in the title, preview and source, so you always know where a design came from.'],
  ['upload', 'Drop a sliced file', 'Drag in a .gcode.3mf from Bambu Studio or OrcaSlicer, or a PrusaSlicer .gcode. Print time, grams and colours fill in automatically.'],
  ['spool', 'Filament that tracks itself', 'Spools are deducted when an order is done. Low-stock spools surface on your dashboard before you run out mid-print.'],
  ['home', 'Know what you earn', 'Revenue, real profit, margin, hours on the printer and kilograms used, by month. Export everything to CSV whenever you need it.'],
];

function calculator() {
  const out = h('div', { class: 'calc-out' });
  const inputs = {
    grams: h('input', { type: 'number', value: 120, min: 0, inputmode: 'decimal' }),
    hours: h('input', { type: 'number', value: 4, min: 0, step: 0.5, inputmode: 'decimal' }),
    price: h('input', { type: 'number', value: 115, min: 0, inputmode: 'decimal' }),
  };
  const update = () => {
    const g = +inputs.grams.value || 0, hr = +inputs.hours.value || 0, ppk = +inputs.price.value || 0;
    const filament = (g * ppk) / 1000;
    const power = hr * 0.35 * 1.3;
    const machine = hr * 1.9;
    const total = (filament + power + machine) * 1.05;
    out.innerHTML = `
      <div class="calc-row"><span>Filament</span><b>${filament.toFixed(2)} lei</b></div>
      <div class="calc-row"><span>Electricity</span><b>${power.toFixed(2)} lei</b></div>
      <div class="calc-row"><span>Machine wear</span><b>${machine.toFixed(2)} lei</b></div>
      <div class="calc-row calc-total"><span>Real cost</span><b>${total.toFixed(2)} lei</b></div>
      <div class="calc-row calc-suggest"><span>Suggested price</span><b>${esc(roundPrice(total * 2))} lei</b></div>`;
  };
  Object.values(inputs).forEach((i) => i.addEventListener('input', update));
  update();
  return h('div', { class: 'calc card' },
    h('div', { class: 'calc-in' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Filament used (g)'), inputs.grams),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Print time (h)'), inputs.hours),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Spool price (lei / kg)'), inputs.price),
      h('p', { class: 'field-hint' }, 'Assumes a 350 W printer, 1.30 lei/kWh, a 5% failure buffer and 100% markup. All of it is configurable inside.')),
    out);
}

function heroMock() {
  const row = (title, sub, status, price, sw) => `
    <div class="mock-row">
      <span class="mock-sw" style="background:${sw}"></span>
      <div class="mock-t"><b>${title}</b><span>${sub}</span></div>
      <span class="pill pill-${status.toLowerCase()}">${status}</span>
      <b class="mock-p">${price}</b>
    </div>`;
  return h('div', { class: 'mock', 'aria-hidden': 'true', html: `
    <div class="mock-bar"><span></span><span></span><span></span></div>
    <div class="mock-kpis">
      <div><span>Revenue · 30d</span><b>4,820 lei</b></div>
      <div><span>Profit</span><b>2,915 lei</b></div>
      <div><span>On the printer</span><b>96h</b></div>
    </div>
    <div class="mock-list">
      ${row('Articulated dragon', 'MakerWorld · 95 g · 5h 40m', 'Printing', '149 lei', '#2b2b2b')}
      ${row('Planter with drainage', 'Printables · 160 g · 5h', 'Queued', '95 lei', '#9caf88')}
      ${row('Name keychains ×20', 'Custom · 40 g · 3h', 'Done', '120 lei', '#f1ede4')}
      ${row('Lamp shade', 'Printables · 190 g · 6h 20m', 'Quote', '160 lei', '#f07a2b')}
    </div>` });
}

export function renderLanding(root, user) {
  const primary = user ? { href: '#/app', label: 'Open dashboard' } : { href: '#/signup', label: 'Start free' };
  root.replaceChildren(
    h('div', { class: 'landing' },
      h('nav', { class: 'lnav' },
        h('a', { class: 'brand', href: '#/' }, logo(28), h('span', {}, '3D Brains')),
        h('div', { class: 'lnav-links' },
          h('a', { href: '#', onclick: scrollTo('features') }, 'Features'),
          h('a', { href: '#', onclick: scrollTo('how') }, 'How it works'),
          h('a', { href: '#', onclick: scrollTo('pricing') }, 'Pricing')),
        h('div', { class: 'lnav-cta' },
          !user && h('a', { class: 'btn btn-ghost', href: '#/login' }, 'Sign in'),
          h('a', { class: 'btn btn-primary', href: primary.href }, primary.label))),

      h('header', { class: 'hero' },
        h('div', { class: 'hero-copy' },
          h('span', { class: 'eyebrow' }, 'For makers who sell their prints'),
          h('h1', { html: 'The calm way to run your <em>3D&nbsp;printing</em> business.' }),
          h('p', { class: 'lead' }, 'Track every order from quote to delivery, know the real cost of each print, and see what you actually earn. Import models from Printables and MakerWorld, or drop in a sliced file and let 3D Brains fill in the rest.'),
          h('div', { class: 'hero-cta' },
            h('a', { class: 'btn btn-primary btn-lg', href: primary.href }, primary.label, h('span', { html: icon('arrow', 16) })),
            !user && isDemo && h('a', { class: 'btn btn-ghost btn-lg', href: '#/signup' }, 'Try the demo')),
          h('p', { class: 'fine' }, 'Free. No credit card. Your data stays yours.')),
        heroMock()),

      h('section', { class: 'works-with' },
        h('span', {}, 'Works with'),
        ['Printables', 'MakerWorld', 'Bambu Studio', 'OrcaSlicer', 'PrusaSlicer'].map((n) => h('b', {}, n))),

      h('section', { id: 'features', class: 'section' },
        h('div', { class: 'section-head' },
          h('h2', {}, 'Everything a print shop needs. Nothing it doesn’t.'),
          h('p', { class: 'lead' }, 'Built by a maker with a Bambu Lab X2D and a growing list of orders, for anyone who has outgrown the spreadsheet.')),
        h('div', { class: 'features' },
          FEATURES.map(([ic, t, d]) => h('article', { class: 'feature' }, h('span', { class: 'feature-ico', html: icon(ic, 20) }), h('h3', {}, t), h('p', {}, d))))),

      h('section', { class: 'section' },
        h('div', { class: 'section-head' },
          h('h2', {}, 'What does that print really cost?'),
          h('p', { class: 'lead' }, 'Most makers only count filament. Try it.')),
        calculator()),

      h('section', { id: 'how', class: 'section' },
        h('div', { class: 'section-head' }, h('h2', {}, 'Up and running in three minutes')),
        h('ol', { class: 'steps' },
          [['Add your printer and spools', 'Pick your printer from the presets and add the filament you have on the shelf with its price per kilo.'],
           ['Log an order', 'Paste a Printables or MakerWorld link or drop a sliced file. Costs and a suggested price appear instantly.'],
           ['Move it along', 'Advance the status as you print and deliver. Stock, revenue and profit update on their own.']]
            .map(([t, d], i) => h('li', { class: 'step' }, h('span', { class: 'step-n' }, String(i + 1)), h('h3', {}, t), h('p', {}, d))))),

      h('section', { id: 'pricing', class: 'section' },
        h('div', { class: 'pricing card' },
          h('div', {},
            h('span', { class: 'eyebrow' }, 'Pricing'),
            h('h2', {}, 'Free for makers.'),
            h('p', { class: 'lead' }, 'Unlimited orders, printers and spools. Create an account and organise your print business in minutes.')),
          h('ul', { class: 'checks' },
            ['Unlimited orders & printers', 'Cost and price calculator', 'Printables & MakerWorld import', 'Slicer file auto-fill', 'CSV & JSON export'].map((t) => h('li', { html: icon('check', 16) + esc(t) }))),
          h('a', { class: 'btn btn-primary btn-lg', href: primary.href }, primary.label))),

      h('footer', { class: 'lfoot' },
        h('a', { class: 'brand', href: '#/' }, logo(22), h('span', {}, '3D Brains')),
        h('span', { class: 'muted' }, `© ${new Date().getFullYear()} 3dbrains.ro · Made for makers`))));
}
