// Detects Gmail's active theme (light / dark) and keeps the tab bar in sync.

const PinboxTheme = (() => {
  let currentTheme = 'light';
  let changeCallback = null;

  function watch(cb) {
    changeCallback = cb;
    currentTheme = detect();
    cb(currentTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      notify(detect());
    });

    const observer = new MutationObserver(() => {
      const detected = detect();
      if (detected !== currentTheme) notify(detected);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }

  /**
   * Returns 'dark' or 'light'.
   *
   * Walks up from [role="main"] looking for the first element with a
   * non-transparent background color, then checks its luminance.
   * Defaults to 'light' if nothing conclusive is found — transparent
   * backgrounds must not be treated as dark.
   */
  function detect() {
    const candidates = [
      document.querySelector('[role="main"]'),
      document.querySelector('.nH'),
      document.querySelector('.bkK'),
      document.body,
    ];

    for (const el of candidates) {
      if (!el) continue;
      const bg = window.getComputedStyle(el).backgroundColor;
      const rgba = parseRgba(bg);
      if (!rgba) continue;

      // Skip transparent / near-transparent backgrounds
      if (rgba.a < 0.1) continue;

      const luminance = (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255;
      return luminance < 0.5 ? 'dark' : 'light';
    }

    // No opaque background found — fall back to system preference, but
    // only trust it if the user hasn't explicitly set a light Gmail theme.
    return 'light';
  }

  function parseRgba(str) {
    if (!str) return null;
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }

  function notify(theme) {
    currentTheme = theme;
    if (changeCallback) changeCallback(theme);
  }

  function current() { return currentTheme; }

  return { watch, detect, current };
})();
