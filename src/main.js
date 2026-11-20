import { initStore, store } from './store.js';
import { state, loadData, go, setRerender } from './app.js';
import { renderLanding } from './views/landing.js';
import { renderAuth, renderReset } from './views/auth.js';
import { renderShell } from './views/shell.js';

const root = document.getElementById('app');
let lastPath = null;

async function route() {
  const path = location.hash.slice(1) || '/';
  state.user = await store.user();

  if (path.startsWith('/app')) {
    if (!state.user) return go('/login');
    if (state.loadedFor !== state.user.id) {
      root.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
      try {
        await loadData();
      } catch (e) {
        root.innerHTML = `<div class="boot"><p>Could not load your data: ${e.message}</p></div>`;
        return;
      }
    }
    renderShell(root, path);
    setRerender(() => renderShell(root, location.hash.slice(1)));
  } else if (path === '/login' || path === '/signup') {
    if (state.user) return go('/app');
    renderAuth(root, path.slice(1));
  } else if (path === '/reset') {
    renderReset(root);
  } else {
    renderLanding(root, state.user);
    if (path.startsWith('/#')) document.getElementById(path.slice(2))?.scrollIntoView();
  }
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

(async () => {
  // Supabase puts auth tokens in the hash after email confirmation / recovery.
  const authHash = location.hash.includes('access_token') ? location.hash : '';
  await initStore();
  if (authHash) {
    history.replaceState(null, '', location.pathname);
    location.hash = authHash.includes('type=recovery') ? '#/reset' : '#/app';
  }
  window.addEventListener('hashchange', route);
  route();
})();
