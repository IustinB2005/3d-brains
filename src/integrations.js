// Printables / MakerWorld / slicer-file integrations.
import { store } from './store.js';

const FFLATE = '../vendor/fflate.js'; // fflate 0.8.2, vendored

export const SOURCES = {
  printables: { label: 'Printables', short: 'P' },
  makerworld: { label: 'MakerWorld', short: 'M' },
  thingiverse: { label: 'Thingiverse', short: 'T' },
  cults: { label: 'Cults3D', short: 'C' },
  thangs: { label: 'Thangs', short: 'Th' },
  other: { label: 'Web link', short: '↗' },
  custom: { label: 'Custom', short: '✎' },
};

export function detectSource(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('printables.com')) return 'printables';
    if (host.endsWith('makerworld.com') || host.endsWith('makerworld.com.cn')) return 'makerworld';
    if (host.endsWith('thingiverse.com')) return 'thingiverse';
    if (host.endsWith('cults3d.com')) return 'cults';
    if (host.endsWith('thangs.com')) return 'thangs';
    return 'other';
  } catch {
    return null;
  }
}

const humanize = (slug) => {
  const s = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/models?\/\d+-([^/?#]+)/);
    if (m) return humanize(m[1]);
    const cults = u.pathname.match(/\/3d-model\/[^/]+\/([^/?#]+)/);
    if (cults) return humanize(cults[1]);
    const thangs = u.pathname.match(/\/3d-model\/([^/?#]+?)-\d+$/);
    if (thangs) return humanize(thangs[1]);
  } catch { /* ignore */ }
  return '';
}

// Title from the URL slug, plus title/image from the link-preview edge
// function when cloud mode is configured.
export async function fetchPreview(url) {
  const source = detectSource(url);
  let title = titleFromUrl(url);
  let image = '';
  if (store?.invoke) {
    try {
      const d = await store.invoke('link-preview', { url });
      title = d?.title || title;
      image = d?.image || '';
    } catch { /* site blocked us or function not deployed: slug title is enough */ }
  }
  return { source, title, image };
}

// "1d 2h 3m 4s" → minutes
function parseDuration(str) {
  if (!str) return 0;
  let secs = 0;
  const re = /(\d+(?:\.\d+)?)\s*([dhms])/g;
  let m;
  while ((m = re.exec(str))) secs += +m[1] * { d: 86400, h: 3600, m: 60, s: 1 }[m[2]];
  return Math.round(secs / 60);
}

async function thumbFromBytes(bytes) {
  try {
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const size = 240;
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.82);
  } catch {
    return '';
  }
}

const cleanName = (name) => name.replace(/\.(gcode\.3mf|3mf|gcode)$/i, '').replace(/[_]+/g, ' ');

// Bambu Studio / OrcaSlicer sliced project (.gcode.3mf or .3mf)
async function parse3mf(file) {
  const { unzipSync, strFromU8 } = await import(FFLATE);
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(buf, {
    filter: (f) => /^(Metadata\/(slice_info\.config|plate_\d+\.png)|3D\/3dmodel\.model)$/i.test(f.name),
  });
  const out = { title: cleanName(file.name), minutes: 0, filaments: [], thumbnail: '', sliced: false, url: '' };

  const model = files['3D/3dmodel.model'];
  if (model) {
    const head = strFromU8(model.subarray(0, 30000));
    const t = head.match(/<metadata name="Title">([^<]+)<\/metadata>/);
    if (t && t[1].trim()) out.title = t[1].trim();
    const id = head.match(/<metadata name="DesignModelId">(\d+)<\/metadata>/);
    if (id) out.url = `https://makerworld.com/en/models/${id[1]}`;
  }

  const info = files['Metadata/slice_info.config'];
  if (info) {
    const doc = new DOMParser().parseFromString(strFromU8(info), 'application/xml');
    const agg = new Map();
    for (const plate of doc.querySelectorAll('plate')) {
      const meta = {};
      plate.querySelectorAll(':scope > metadata').forEach((m) => (meta[m.getAttribute('key')] = m.getAttribute('value')));
      if (meta.prediction) {
        out.sliced = true;
        out.minutes += Math.round(+meta.prediction / 60);
      }
      plate.querySelectorAll('filament').forEach((f) => {
        const type = f.getAttribute('type') || 'PLA';
        const color = (f.getAttribute('color') || '').slice(0, 7);
        const k = type + color;
        const prev = agg.get(k) || { type, color, grams: 0 };
        prev.grams += +f.getAttribute('used_g') || 0;
        agg.set(k, prev);
      });
    }
    out.filaments = [...agg.values()].filter((f) => f.grams > 0).map((f) => ({ ...f, grams: Math.round(f.grams * 10) / 10 }));
  }

  const plateKey = Object.keys(files).filter((k) => /plate_\d+\.png$/i.test(k)).sort()[0];
  if (plateKey) out.thumbnail = await thumbFromBytes(files[plateKey]);
  return out;
}

// Plain-text G-code from PrusaSlicer, OrcaSlicer, Bambu Studio, Cura
async function parseGcode(file) {
  const chunk = 400000;
  const head = await file.slice(0, chunk).text();
  const tail = file.size > chunk ? await file.slice(-chunk).text() : '';
  const text = head + '\n' + tail;
  const out = { title: cleanName(file.name), minutes: 0, filaments: [], thumbnail: '', sliced: true, url: '' };

  const time =
    text.match(/estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i) ||
    text.match(/total estimated time:\s*([^\n;]+)/i) ||
    text.match(/model printing time:\s*([^\n;]+)/i);
  if (time) out.minutes = parseDuration(time[1]);
  const cura = text.match(/;TIME:(\d+)/);
  if (!out.minutes && cura) out.minutes = Math.round(+cura[1] / 60);

  const types = (text.match(/;\s*filament_type\s*=\s*([^\n]+)/i)?.[1] || '').split(';').map((s) => s.trim());
  const colors = (text.match(/;\s*filament_colou?r\s*=\s*([^\n]+)/i)?.[1] || '').split(';').map((s) => s.trim());
  const grams =
    text.match(/;\s*filament used \[g\]\s*=\s*([^\n]+)/i) ||
    text.match(/;\s*total filament weight \[g\]\s*:\s*([^\n]+)/i);
  if (grams) {
    grams[1].split(/[,;]/).map((g) => parseFloat(g)).forEach((g, i) => {
      if (g > 0) out.filaments.push({ type: types[i] || types[0] || 'PLA', color: colors[i] || '', grams: Math.round(g * 10) / 10 });
    });
  }
  return out;
}

export async function parseSlicerFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.3mf')) return parse3mf(file);
  if (name.endsWith('.gcode') || name.endsWith('.gco')) return parseGcode(file);
  throw new Error('Unsupported file. Use a sliced .gcode.3mf, .3mf or .gcode file.');
}

// Pick the spool that best matches a slicer filament (same material, closest colour).
export function matchFilament(sf, filaments) {
  const same = filaments.filter((f) => (f.material || '').toLowerCase() === (sf.type || '').toLowerCase());
  const pool = same.length ? same : filaments;
  if (!pool.length) return null;
  const rgb = (hex) => {
    const m = /^#?([0-9a-f]{6})/i.exec(hex || '');
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const target = rgb(sf.color);
  if (!target) return pool[0];
  let best = pool[0], bestD = Infinity;
  for (const f of pool) {
    const c = rgb(f.color_hex);
    if (!c) continue;
    const d = (c[0] - target[0]) ** 2 + (c[1] - target[1]) ** 2 + (c[2] - target[2]) ** 2;
    if (d < bestD) { best = f; bestD = d; }
  }
  return best;
}
