// Gear guide theme preference. Dark by default at Dave's request; "auto" follows the system.
// Stored under its own key so it never collides with other sites' choices. Load in <head> so the
// first paint is right. Exposes window.fmpTheme because the shared model shell reads that name.
(() => {
  const KEY = 'nncGearTheme';
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  let preference = read(KEY);
  if (!['light', 'dark', 'auto'].includes(preference)) preference = 'dark';
  const resolved = () => preference === 'auto' ? (media?.matches ? 'dark' : 'light') : preference;
  const apply = () => {
    root.dataset.theme = resolved();
    root.dataset.avTheme = preference === 'auto' ? 'system' : preference;
    document.dispatchEvent(new CustomEvent('fmp-theme', { detail: { preference, theme: resolved() } }));
  };
  window.fmpTheme = {
    get preference() { return preference; },
    get theme() { return resolved(); },
    set(next) {
      preference = ['light', 'dark', 'auto'].includes(next) ? next : 'dark';
      try { localStorage.setItem(KEY, preference); } catch { /* The choice still applies on this page. */ }
      apply();
    },
    toggle() { this.set(resolved() === 'dark' ? 'light' : 'dark'); }
  };
  media?.addEventListener?.('change', () => { if (preference === 'auto') apply(); });
  document.addEventListener('DOMContentLoaded', apply);
  apply();
})();
