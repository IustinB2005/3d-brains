// Data layer. Two adapters share one interface:
//  - local (demo): everything in localStorage, accounts are per-browser
//  - cloud: Supabase auth + Postgres with Row Level Security
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isDemo = !(SUPABASE_URL && SUPABASE_ANON_KEY);

export const DEFAULT_SETTINGS = {
  business_name: '',
  currency: 'RON',
  electricity_price: 1.3, // per kWh
  labor_rate: 30,         // per hour of hands-on work
  markup: 100,            // % over cost for the suggested price
  failure_rate: 5,        // % buffer for failed prints
};

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

async function sha(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'plain:' + text;
  }
}

const ls = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
  },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

function localAdapter() {
  const key = (uid, t) => `3db:${uid}:${t}`;
  const me = () => ls.get('3db:session', null);
  const rows = (t) => ls.get(key(me().id, t), []);
  const save = (t, r) => ls.set(key(me().id, t), r);
  const stamp = (row) => ({ id: uuid(), created_at: new Date().toISOString(), user_id: me().id, ...row });

  return {
    mode: 'demo',
    async user() { return me(); },
    async signUp({ email, password, name }) {
      email = email.trim().toLowerCase();
      const users = ls.get('3db:users', {});
      if (users[email]) throw new Error('An account with this email already exists in this browser.');
      const u = { id: uuid(), email, name };
      users[email] = { ...u, pw: await sha(password) };
      ls.set('3db:users', users);
      ls.set('3db:session', u);
      return { user: u };
    },
    async signIn({ email, password }) {
      email = email.trim().toLowerCase();
      const rec = ls.get('3db:users', {})[email];
      if (!rec || rec.pw !== (await sha(password))) throw new Error('Wrong email or password.');
      const u = { id: rec.id, email: rec.email, name: rec.name };
      ls.set('3db:session', u);
      return { user: u };
    },
    async signOut() { ls.del('3db:session'); },
    async resetPassword() { throw new Error('Password reset needs cloud mode. In demo mode, just create a new account.'); },
    async updatePassword() { throw new Error('Not available in demo mode.'); },
    async list(t) {
      return rows(t).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    },
    async insert(t, row) {
      const rec = stamp(row);
      save(t, [...rows(t), rec]);
      return rec;
    },
    async insertMany(t, list) {
      const recs = list.map(stamp);
      save(t, [...rows(t), ...recs]);
      return recs;
    },
    async update(t, id, patch) {
      let out = null;
      save(t, rows(t).map((r) => (r.id === id ? (out = { ...r, ...patch, updated_at: new Date().toISOString() }) : r)));
      return out;
    },
    async remove(t, id) { save(t, rows(t).filter((r) => r.id !== id)); },
    async getSettings() { return { ...DEFAULT_SETTINGS, ...ls.get(key(me().id, 'settings'), {}) }; },
    async saveSettings(s) { ls.set(key(me().id, 'settings'), s); return s; },
    async wipe() { ['printers', 'filaments', 'orders'].forEach((t) => ls.del(key(me().id, t))); },
    invoke: null,
  };
}

async function cloudAdapter() {
  // supabase-js 2.45.4 UMD build, vendored so the app has no CDN dependency
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Supabase client'));
    document.head.append(s);
  });
  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const map = (u) => u && { id: u.id, email: u.email, name: u.user_metadata?.name || '' };
  const settingsCols = Object.keys(DEFAULT_SETTINGS);

  return {
    mode: 'cloud',
    client: sb,
    async user() {
      const { data } = await sb.auth.getSession();
      return map(data.session?.user);
    },
    async signUp({ email, password, name }) {
      const d = must(await sb.auth.signUp({
        email, password,
        options: { data: { name }, emailRedirectTo: location.origin + '/' },
      }));
      return { user: d.session ? map(d.user) : null, needsConfirm: !d.session };
    },
    async signIn({ email, password }) {
      const d = must(await sb.auth.signInWithPassword({ email, password }));
      return { user: map(d.user) };
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }));
    },
    async updatePassword(password) { must(await sb.auth.updateUser({ password })); },
    async list(t) {
      return must(await sb.from(t).select('*').order('created_at', { ascending: false }));
    },
    async insert(t, row) { return must(await sb.from(t).insert(row).select().single()); },
    async insertMany(t, list) { return must(await sb.from(t).insert(list).select()); },
    async update(t, id, patch) {
      return must(await sb.from(t).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single());
    },
    async remove(t, id) { must(await sb.from(t).delete().eq('id', id)); },
    async getSettings() {
      const d = must(await sb.from('settings').select('*').maybeSingle());
      return { ...DEFAULT_SETTINGS, ...(d || {}) };
    },
    async saveSettings(s) {
      const { data } = await sb.auth.getSession();
      const row = { user_id: data.session.user.id, updated_at: new Date().toISOString() };
      settingsCols.forEach((k) => (row[k] = s[k]));
      must(await sb.from('settings').upsert(row));
      return s;
    },
    async wipe() {
      for (const t of ['orders', 'filaments', 'printers']) must(await sb.from(t).delete().not('id', 'is', null));
    },
    async invoke(fn, body) {
      const { data, error } = await sb.functions.invoke(fn, { body });
      if (error) throw error;
      return data;
    },
  };
}

export let store = null;

export async function initStore() {
  store = isDemo ? localAdapter() : await cloudAdapter();
  return store;
}
