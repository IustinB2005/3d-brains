import { h, icon, logo } from '../ui.js';
import { store, isDemo } from '../store.js';
import { state, go } from '../app.js';
import { renderOverview } from './overview.js';
import { renderOrders } from './orders.js';
import { renderFilaments } from './filaments.js';
import { renderPrinters } from './printers.js';
import { renderSettings } from './settings.js';

const NAV = [
  ['/app', 'Overview', 'home', renderOverview],
  ['/app/orders', 'Orders', 'orders', renderOrders],
  ['/app/filaments', 'Filament', 'spool', renderFilaments],
  ['/app/printers', 'Printers', 'printer', renderPrinters],
  ['/app/settings', 'Settings', 'settings', renderSettings],
];

export function renderShell(root, path) {
  const current = NAV.find(([p]) => p === path) || NAV[0];
  const link = ([p, label, ic]) =>
    h('a', { href: '#' + p, class: `nav-link ${p === current[0] ? 'active' : ''}`, 'aria-current': p === current[0] ? 'page' : null },
      h('span', { html: icon(ic, 18) }), h('span', {}, label));

  const signOut = async () => {
    await store.signOut();
    state.loadedFor = null;
    go('/');
  };

  const main = h('main', { class: 'main' });
  const shopName = state.settings.business_name || '3D Brains';
  root.replaceChildren(
    h('div', { class: 'shell' },
      h('aside', { class: 'side' },
        h('a', { class: 'brand', href: '#/app' }, logo(28), h('span', {}, '3D Brains')),
        h('nav', { class: 'nav', 'aria-label': 'Main' }, NAV.map(link)),
        h('div', { class: 'side-foot' },
          isDemo && h('span', { class: 'demo-tag' }, 'Demo mode'),
          h('div', { class: 'me' },
            h('span', { class: 'avatar' }, (state.user?.name || state.user?.email || '?').charAt(0).toUpperCase()),
            h('div', { class: 'me-t' }, h('b', {}, shopName), h('span', {}, state.user?.email || '')),
            h('button', { class: 'icon-btn', title: 'Sign out', 'aria-label': 'Sign out', onclick: signOut, html: icon('logout', 17) })))),
      main,
      h('nav', { class: 'tabbar', 'aria-label': 'Main' }, NAV.map(link))));
  current[3](main);
}
