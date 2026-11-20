import { h, logo, toast, field } from '../ui.js';
import { store, isDemo } from '../store.js';
import { go } from '../app.js';

function frame(...children) {
  return h('div', { class: 'auth' },
    h('a', { class: 'brand auth-brand', href: '#/' }, logo(30), h('span', {}, '3D Brains')),
    h('div', { class: 'auth-card card' }, ...children),
    isDemo && h('p', { class: 'auth-note' }, 'Demo mode: your account and data are stored only in this browser.'));
}

export function renderAuth(root, mode) {
  const signup = mode === 'signup';
  const err = h('p', { class: 'form-error', role: 'alert' });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, signup ? 'Create account' : 'Sign in');

  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (password.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
    btn.disabled = true;
    try {
      if (signup) {
        const r = await store.signUp({ email, password, name: String(fd.get('name') || '').trim() });
        if (r.needsConfirm) {
          root.replaceChildren(frame(
            h('h1', {}, 'Check your inbox'),
            h('p', { class: 'muted' }, `We sent a confirmation link to ${email}. Open it to activate your account.`),
            h('a', { class: 'btn btn-ghost btn-block', href: '#/login' }, 'Back to sign in')));
          return;
        }
      } else {
        await store.signIn({ email, password });
      }
      go('/app');
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  } },
    signup && field('Your name', h('input', { name: 'name', autocomplete: 'name', placeholder: 'Bogdan' })),
    field('Email', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email', placeholder: 'you@example.com' })),
    field('Password', h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: signup ? 'new-password' : 'current-password' })),
    err, btn);

  const forgot = !signup && !isDemo && h('button', { class: 'link-btn', type: 'button', onclick: async () => {
    const email = form.querySelector('[name=email]').value.trim();
    if (!email) { err.textContent = 'Type your email above, then click “Forgot password”.'; return; }
    try { await store.resetPassword(email); toast('Password reset email sent.'); } catch (ex) { err.textContent = ex.message; }
  } }, 'Forgot password?');

  root.replaceChildren(frame(
    h('h1', {}, signup ? 'Create your account' : 'Welcome back'),
    h('p', { class: 'muted' }, signup ? 'Start organising your print business. It’s free.' : 'Sign in to your print shop.'),
    form,
    h('div', { class: 'auth-alt' },
      signup ? ['Already have an account? ', h('a', { href: '#/login' }, 'Sign in')] : ['New here? ', h('a', { href: '#/signup' }, 'Create an account')],
      forgot)));
}

export function renderReset(root) {
  const err = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const pw = form.querySelector('[name=password]').value;
    if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
    try { await store.updatePassword(pw); toast('Password updated.'); go('/app'); } catch (ex) { err.textContent = ex.message; }
  } },
    field('New password', h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' })),
    err, h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Save password'));
  root.replaceChildren(frame(h('h1', {}, 'Choose a new password'), form));
}
