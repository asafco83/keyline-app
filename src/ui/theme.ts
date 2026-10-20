// Keyline — ui/theme
// Light / dark theme. Until the user picks one, the editor follows the system setting; the
// button at the bottom of the tool rail switches to the other theme and remembers the choice.
// (index.html applies a saved choice before the first paint, so there is no flash.)
export type Theme = 'light' | 'dark';
const STORE = 'keyline:theme';

const MOON =
  '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.2 9.6A5.6 5.6 0 016.4 2.8 5.6 5.6 0 1013.2 9.6z"/></svg>';
const SUN =
  '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>';

/** The theme on screen now: the saved choice, else the system's. */
export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(STORE, t);
  } catch (_) {}
  syncThemeButton();
}
export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
/** Markup for the rail button (the rail re-renders, so it is rebuilt each time). */
export function themeButton() {
  const dark = currentTheme() === 'dark',
    label = dark ? 'Switch to light theme' : 'Switch to dark theme';
  return `<button class="tool" id="bTheme" title="${label}" aria-label="${label}">${dark ? SUN : MOON}</button>`;
}
export function syncThemeButton() {
  const b = document.getElementById('bTheme');
  if (b) b.outerHTML = themeButton();
}
export function initTheme() {
  try {
    const t = localStorage.getItem(STORE);
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (_) {}
  document.addEventListener('click', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest?.('#bTheme')) toggleTheme();
  });
  // following the system: keep the icon right when the system theme changes
  if (typeof matchMedia === 'function')
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeButton);
  syncThemeButton();
}
