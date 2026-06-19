const LIGHT_THEME_COLOR = '#f8fbff';
const DARK_THEME_COLOR = '#020617';
const SEARCH_THEME_COLOR = '#f8fbff';
const SEARCH_STATUS_BAR_STYLE = 'default';

function getOrCreateMeta(name: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  return meta;
}

function getCurrentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applySearchChrome() {
  const themeMetas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const primaryThemeMeta = themeMetas[0] || getOrCreateMeta('theme-color');
  primaryThemeMeta.setAttribute('content', SEARCH_THEME_COLOR);
  primaryThemeMeta.removeAttribute('media');
  themeMetas.slice(1).forEach((meta) => {
    meta.setAttribute('content', SEARCH_THEME_COLOR);
  });

  const statusBarMeta = getOrCreateMeta('apple-mobile-web-app-status-bar-style');
  statusBarMeta.setAttribute('content', SEARCH_STATUS_BAR_STYLE);
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
  html.setAttribute('data-search-chrome', 'light');
  html.style.backgroundColor = '#fff';
  html.style.colorScheme = 'light';
  body.style.backgroundColor = '#fff';
  applySearchChrome();

  return () => {
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
