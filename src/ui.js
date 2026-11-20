// Tiny DOM + formatting helpers. No framework.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const icon = (name, size = 18) => {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    orders: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    spool: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6"/>',
    printer: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 13h8M12 13v5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<path d="M12 3 2 21h20zM12 10v4M12 17.5v.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};
export const ico = (name, size) => h('span', { class: 'ico-wrap', html: icon(name, size) });

let currency = 'RON';
export const setCurrency = (c) => (currency = c || 'RON');
export const money = (v, digits) => {
  const x = Number(v) || 0;
  const r = Math.round(x * 100) / 100;
  const d = digits ?? (Math.abs(r) < 1000 && !Number.isInteger(r) ? 2 : 0);
  const opts = { minimumFractionDigits: d, maximumFractionDigits: d };
  if (currency === 'RON') return `${new Intl.NumberFormat('en-GB', opts).format(x)} lei`;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, ...opts }).format(x);
  } catch {
    return `${x.toFixed(d)} ${currency}`;
  }
};
export const num = (v, d = 0) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: d }).format(Number(v) || 0);
export const pct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;
export const duration = (mins) => {
  const m = Math.round(Number(mins) || 0);
  if (m < 60) return `${m}m`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
};
export const grams = (g) => (g >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g, 0)} g`);
export const shortDate = (s) => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export function toast(msg, kind = 'ok') {
  let wrap = document.querySelector('.toasts');
  if (!wrap) document.body.append((wrap = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' })));
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  wrap.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export function modal({ title, body, footer, wide = false, onClose }) {
  const close = () => {
    overlay.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 160);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => e.target === overlay && close() },
    h('div', { class: `dialog ${wide ? 'dialog-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'dialog-head' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close, html: icon('x') })),
      h('div', { class: 'dialog-body' }, body),
      footer && h('footer', { class: 'dialog-foot' }, footer)));
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  setTimeout(() => overlay.querySelector('input,select,textarea')?.focus(), 30);
  return { close, el: overlay };
}

export function confirmDialog(text, { okLabel = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'Are you sure?',
      body: h('p', { class: 'muted' }, text),
      footer: [
        h('button', { class: 'btn btn-ghost', onclick: () => { done = true; m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { done = true; m.close(); resolve(true); } }, okLabel),
      ],
      onClose: () => !done && resolve(false),
    });
  });
}

// Labeled form field
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('span', { class: 'field-hint' }, hint));
}

export function readForm(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim();
  }
  return out;
}

export function download(filename, text, type = 'text/plain') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const logo = (size = 28) => h('img', { src: 'assets/logo.svg', width: size, height: size, alt: '', class: 'logo-img' });
