(() => {
  'use strict';

  const ACCESS_HASH = 'ed946f65d2c785d90e827c5ffd879ce3b49c68d4c88013074176a7e73bc58bcf';
  const ACCESS_STORAGE_KEY = 'ytm_photo_ledger_access_until';
  const ACCESS_DAYS = 30;

  const gate = document.createElement('section');
  gate.className = 'accessGate';
  gate.setAttribute('aria-labelledby', 'accessTitle');
  gate.innerHTML = `
    <form class="accessPanel" autocomplete="off">
      <img class="accessIcon" src="./icons/icon-180.png" alt="">
      <h1 id="accessTitle">工事写真台帳</h1>
      <p>パスワードを入力してください</p>
      <label for="accessPassword">パスワード</label>
      <input id="accessPassword" class="accessInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" enterkeyhint="go" required>
      <button class="accessButton" type="submit">開く</button>
      <div class="accessError" role="alert" aria-live="polite"></div>
    </form>`;
  document.body.prepend(gate);

  const form = gate.querySelector('form');
  const input = gate.querySelector('#accessPassword');
  const error = gate.querySelector('.accessError');

  function unlock() {
    document.body.classList.remove('access-locked');
    gate.hidden = true;
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  const accessUntil = Number(localStorage.getItem(ACCESS_STORAGE_KEY));
  if (accessUntil > Date.now()) unlock();
  else {
    localStorage.removeItem(ACCESS_STORAGE_KEY);
    requestAnimationFrame(() => input.focus());
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.textContent = '';
    if (await sha256(input.value) === ACCESS_HASH) {
      localStorage.setItem(ACCESS_STORAGE_KEY, String(Date.now() + ACCESS_DAYS * 86400000));
      input.value = '';
      unlock();
      return;
    }
    input.value = '';
    error.textContent = 'パスワードが違います';
    input.focus();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
})();
