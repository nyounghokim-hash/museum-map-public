const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#020617';
const SEARCH_CHROME_REAPPLY_DELAYS = [80, 180, 320, 600, 1000, 1600, 2400] as const;

type SearchChromeTheme = 'light' | 'dark';

function getCurrentTheme(): SearchChromeTheme {
  const root = document.documentElement;
  if (root.dataset.theme === 'dark') return 'dark';
  if (root.dataset.theme === 'light') return 'light';
  if (root.classList.contains('dark')) return 'dark';

  try {
    const savedThemeMode = localStorage.getItem('themeMode');
    if (savedThemeMode === 'dark') return 'dark';
    if (savedThemeMode === 'light') return 'light';
    if (savedThemeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') return 'dark';
    if (savedDarkMode === 'false') return 'light';
  } catch { }

  // If the user has never opted into "system", Museum Map defaults to light.
  // Falling back to the OS dark preference here made the iOS status bar turn
  // black during search focus before AppContext re-applied the in-app theme.
  return 'light';
}

function getSearchChromeValues() {
  const theme = getCurrentTheme();
  return {
    theme,
    themeColor: theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    statusBarStyle: theme === 'dark' ? 'black-translucent' : 'default',
  };
}

// Recreate a JS-owned meta (remove + re-append) so iOS Safari / in-app webviews
// re-read it. Mutating `content` alone is not enough on iOS — the status bar only
// updates when the meta NODE itself changes, which is why a stale dark tint
// lingered on search focus after a detail round-trip. Safe because this meta is
// JS-owned (never the React/Next-managed ones → no removeChild crash).
function recreateOwnedMeta(id: string, name: string, content: string) {
  document.getElementById(id)?.remove();
  const meta = document.createElement('meta');
  meta.id = id;
  meta.setAttribute('name', name);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function setDynamicStatusBarStyle(style: string) {
  recreateOwnedMeta('mm-dynamic-status-bar-style', 'apple-mobile-web-app-status-bar-style', style);
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    .forEach((m) => m.setAttribute('content', style));
}

function setDynamicThemeColor(color: string) {
  recreateOwnedMeta('mm-dynamic-theme-color', 'theme-color', color);

  // iOS Safari and standalone PWAs may prefer the first or media-matched
  // theme-color meta when an input receives focus. Mutate every existing meta's
  // content so app-light mode wins even when the phone's system theme is dark.
  // Content mutation is safe for React/Next-managed head nodes; removing them is not.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', color));
}

function setDynamicColorScheme(theme: SearchChromeTheme) {
  recreateOwnedMeta('mm-dynamic-color-scheme', 'color-scheme', theme);
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="color-scheme"]')
    .forEach((m) => m.setAttribute('content', theme));
}

function applyChromeValues(values = getSearchChromeValues()) {
  setDynamicThemeColor(values.themeColor);
  setDynamicStatusBarStyle(values.statusBarStyle);
  setDynamicColorScheme(values.theme);

  const html = document.documentElement;
  const body = document.body;
  html.style.setProperty('color-scheme', values.theme, 'important');
  html.style.setProperty('background-color', values.themeColor, 'important');
  html.style.setProperty('background', values.themeColor, 'important');
  if (body) {
    body.style.setProperty('color-scheme', values.theme, 'important');
    body.style.setProperty('background-color', values.theme === 'dark' ? DARK_THEME_COLOR : '#ffffff', 'important');
    body.style.setProperty('background', values.theme === 'dark' ? DARK_THEME_COLOR : '#ffffff', 'important');
  }
}

function applySearchChrome() {
  const values = getSearchChromeValues();
  document.documentElement.setAttribute('data-search-chrome', values.theme);
  applyChromeValues(values);
}

function restoreAppChrome() {
  applyChromeValues();
}

export function reassertMobileChrome() {
  if (typeof document === 'undefined') return;
  // While search owns the chrome, leave it alone — its own reapply loop handles it.
  if (document.documentElement.classList.contains('mm-search-locking')) return;
  applyChromeValues();
}

export function primeMobileSearchChrome() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Run before the native focus/keyboard transition. This closes the tiny iOS
  // window where WebKit can repaint the status bar from the phone's dark system
  // theme before React's focused-state effect has mounted the full search lock.
  applySearchChrome();
  [40, 90, 160, 280, 520, 900, 1400, 2200].forEach((delay) => {
    window.setTimeout(() => applySearchChrome(), delay);
  });
}

function addEventListenerSafe(
  target: EventTarget | null | undefined,
  type: string,
  listener: EventListener,
) {
  if (!target) return () => {};
  target.addEventListener(type, listener, { passive: true });
  return () => target.removeEventListener(type, listener);
}

export function lockMobileSearchChrome() {
  if (typeof document === 'undefined') return () => {};

  const html = document.documentElement;
  const body = document.body;
  const previousHtmlBackground = html.style.backgroundColor;
  const previousHtmlBackgroundShorthand = html.style.background;
  const previousBodyBackground = body.style.backgroundColor;
  const previousBodyBackgroundShorthand = body.style.background;
  const previousColorScheme = html.style.colorScheme;
  const previousBodyColorScheme = body.style.colorScheme;
  const previousSearchChrome = html.getAttribute('data-search-chrome');
  html.classList.add('mm-search-locking');
  body.classList.add('mm-search-locking');
  applySearchChrome();

  let frame = 0;
  const timeouts: number[] = [];
  let burstScheduled = false;
  const reapply = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (html.classList.contains('mm-search-locking')) applySearchChrome();
    });
  };
  const reapplySoon = () => {
    reapply();
    if (burstScheduled) return;
    burstScheduled = true;
    SEARCH_CHROME_REAPPLY_DELAYS.forEach((delay, index) => {
      timeouts.push(window.setTimeout(() => {
        reapply();
        if (index === SEARCH_CHROME_REAPPLY_DELAYS.length - 1) burstScheduled = false;
      }, delay));
    });
  };
  const removeListeners = [
    addEventListenerSafe(window, 'resize', reapplySoon),
    addEventListenerSafe(window, 'orientationchange', reapplySoon),
    addEventListenerSafe(window, 'focusin', reapplySoon),
    addEventListenerSafe(window.visualViewport, 'resize', reapplySoon),
    addEventListenerSafe(window.visualViewport, 'scroll', reapplySoon),
  ];
  reapplySoon();

  return () => {
    removeListeners.forEach((remove) => remove());
    timeouts.forEach((timer) => window.clearTimeout(timer));
    if (frame) window.cancelAnimationFrame(frame);
    html.classList.remove('mm-search-locking');
    body.classList.remove('mm-search-locking');
    if (previousSearchChrome === null) {
      html.removeAttribute('data-search-chrome');
    } else {
      html.setAttribute('data-search-chrome', previousSearchChrome);
    }
    html.style.backgroundColor = previousHtmlBackground;
    html.style.background = previousHtmlBackgroundShorthand;
    html.style.colorScheme = previousColorScheme;
    body.style.colorScheme = previousBodyColorScheme;
    body.style.backgroundColor = previousBodyBackground;
    body.style.background = previousBodyBackgroundShorthand;
    restoreAppChrome();
  };
}
