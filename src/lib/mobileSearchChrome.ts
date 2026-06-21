const LIGHT_THEME_COLOR = '#f8fbff';
const DARK_THEME_COLOR = '#020617';

type SearchChromeTheme = 'light' | 'dark';
type ThemeMetaSnapshot = Array<{ content: string; media: string | null }>;

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
  try {
    const savedThemeMode = localStorage.getItem('themeMode');
    if (savedThemeMode === 'dark') return 'dark';
    if (savedThemeMode === 'light') return 'light';
    if (savedThemeMode !== 'system') {
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode === 'true') return 'dark';
      if (savedDarkMode === 'false') return 'light';
    }
  } catch { }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
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

function readThemeMetaSnapshot(): ThemeMetaSnapshot {
  return Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map((meta) => ({
    content: meta.getAttribute('content') || '',
    media: meta.getAttribute('media'),
  })).filter((item) => item.content);
}

function writeThemeMetas(snapshot: ThemeMetaSnapshot) {
  const currentMetas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const values = snapshot.length > 0
    ? snapshot
    : [{ content: getSearchChromeValues().themeColor, media: null }];
  values.forEach((value, index) => {
    const meta = currentMetas[index] || document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', value.content);
    if (value.media) meta.setAttribute('media', value.media);
    else meta.removeAttribute('media');
    if (!meta.parentNode) document.head.appendChild(meta);
  });
  currentMetas.slice(values.length).forEach((meta) => meta.remove());
}

function applySearchChrome() {
  const values = getSearchChromeValues();
  writeThemeMetas([{ content: values.themeColor, media: null }]);
  const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
  statusBarMeta.setAttribute('content', values.statusBarStyle);

  const html = document.documentElement;
  const body = document.body;
  html.setAttribute('data-search-chrome', values.theme);
  html.style.colorScheme = values.theme;
  html.style.backgroundColor = values.themeColor;
  body.style.backgroundColor = values.theme === 'dark' ? DARK_THEME_COLOR : '#ffffff';
}

function restoreAppChrome() {
  const values = getSearchChromeValues();
  writeThemeMetas([{ content: values.themeColor, media: null }]);

  const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
  statusBarMeta.setAttribute('content', values.statusBarStyle);
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
  const previousThemeMetas = readThemeMetaSnapshot();
  const previousStatusBarStyle = document
    .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.getAttribute('content') || null;

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
    if (previousThemeMetas.length > 0) writeThemeMetas(previousThemeMetas);
    else restoreAppChrome();
    const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
    statusBarMeta.setAttribute('content', previousStatusBarStyle || getSearchChromeValues().statusBarStyle);
  };
}
