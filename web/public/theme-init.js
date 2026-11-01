// Runs synchronously before first paint (CSP forbids inline scripts).
// Keep in sync with src/shell/theme.ts (THEME_KEY, colours, resolution rules).
(function () {
  try {
    var stored = localStorage.getItem('myfood.theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', dark ? '#0a0a0a' : '#ffffff');
  } catch (e) {
    /* storage or matchMedia unavailable: fall back to CSS defaults */
  }
})();
