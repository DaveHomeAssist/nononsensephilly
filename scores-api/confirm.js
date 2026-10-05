(function () {
  const token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname);
  const button = document.getElementById('confirm'), status = document.getElementById('status');
  const toggle = document.getElementById('theme');
  toggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  });
  if (!/^[a-f0-9]{64}$/.test(token)) {
    status.textContent = 'Open the full link from your confirmation email. If it expired, request a new one on the site.';
    return;
  }
  button.disabled = false;
  status.textContent = 'Press Confirm to join. Opening this page does not subscribe you.';
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Confirming your signup…';
    try {
      const response = await fetch('/api/confirm-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok || !result.confirmed) throw new Error(result.error || 'Confirmation failed. Please try again.');
      status.textContent = 'You’re confirmed. Watch your inbox for the next drop.';
      button.textContent = 'Signup confirmed';
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'That took too long. Please try again shortly.' : error.message;
      button.disabled = false;
    }
  });
})();
