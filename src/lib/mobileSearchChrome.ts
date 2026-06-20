const LIGHT_THEME_COLOR = '#f8fbff';
const DARK_THEME_COLOR = '#020617';
const LIGHT_SEARCH_BACKGROUND = '#fff';
const DARK_SEARCH_BACKGROUND = '#020617';

type SearchChromeTheme = 'light' | 'dark';

function getOrCreateMeta(name: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  return meta;
}

function getCurrentTheme(): SearchChromeTheme {
  const root = document.documentElement;
  if (root.dataset.theme === 'dark' || root.classList.contains('dark')) return 'dark';
  if (root.dataset.theme === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function getSearchChromeValues() {
  const theme = getCurrentTheme();
  return {
    theme,
    themeColor: theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    backgroundColor: theme === 'dark' ? DARK_SEARCH_BACKGROUND : LIGHT_SEARCH_BACKGROUND,
    statusBarStyle: theme === 'dark' ? 'black-translucent' : 'default',
    colorScheme: theme,
  };
}

function applySearchChrome() {
  const values = getSearchChromeValues();
  const themeMetas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const primaryThemeMeta = themeMetas[0] || getOrCreateMeta('theme-color');
  primaryThemeMeta.setAttribute('content', values.themeColor);
  primaryThemeMeta.removeAttribute('media');
  themeMetas.slice(1).forEach((meta) => meta.remove());

  const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
  statusBarMeta.setAttribute('content', values.statusBarStyle);

  const html = document.documentElement;
  const body = document.body;
  html.setAttribute('data-search-chrome', values.theme);
  html.style.backgroundColor = values.backgroundColor;
  html.style.colorScheme = values.colorScheme;
  body.style.backgroundColor = values.backgroundColor;
}

function restoreAppChrome() {
  const theme = getCurrentTheme();
  const themeColor = theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  const themeMetas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const primaryThemeMeta = themeMetas[0] || getOrCreateMeta('theme-color');
  primaryThemeMeta.setAttribute('content', themeColor);
  primaryThemeMeta.removeAttribute('media');
  themeMetas.slice(1).forEach((meta) => meta.remove());

  const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
  statusBarMeta.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
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
  const previousBodyBackground = body.style.backgroundColor;
  const previousColorScheme = html.style.colorScheme;
  const previousSearchChrome = html.getAttribute('data-search-chrome');

  html.classList.add('mm-search-locking');
  body.classList.add('mm-search-locking');
  applySearchChrome();

  let frame = 0;
  const timeouts: number[] = [];
  const reapply = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (html.classList.contains('mm-search-locking')) applySearchChrome();
    });
  };
  const reapplySoon = () => {
    reapply();
    timeouts.push(window.setTimeout(reapply, 80));
    timeouts.push(window.setTimeout(reapply, 240));
    timeouts.push(window.setTimeout(reapply, 600));
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
    html.style.colorScheme = previousColorScheme;
    body.style.backgroundColor = previousBodyBackground;
    restoreAppChrome();
  };
}
