import { EditorBackdrop, RecentEdit, ThemeMode } from '../types';

const EDITOR_BACKDROP_KEY = 'auvori_editor_backdrop_v1';
const THEME_KEY = 'auvori_theme_v1';
const FAVORITES_KEY = 'auvori_favorites_v1';
const RECENTS_KEY = 'auvori_recents_v1';
const WATERMARK_KEY = 'auvori_default_watermark_v1';

export function loadEditorBackdrop(): EditorBackdrop {
  try {
    const saved = localStorage.getItem(EDITOR_BACKDROP_KEY);
    return saved === 'chalk' ? 'chalk' : 'graphite';
  } catch {
    return 'graphite';
  }
}

export function saveEditorBackdrop(backdrop: EditorBackdrop): void {
  try {
    localStorage.setItem(EDITOR_BACKDROP_KEY, backdrop);
  } catch {
    // ignore storage errors
  }
}

export function syncThemeColorMeta(inEditor: boolean, backdrop: EditorBackdrop): void {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const color = inEditor && backdrop === 'graphite' ? '#252724' : '#F2F2ED';
    metaTheme.setAttribute('content', color);
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyThemeToDom(_theme: ThemeMode): void {
  syncThemeColorMeta(false, 'graphite');
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function loadFavoritePresetIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavoritePresetIds(ids: string[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function loadRecentEdits(): RecentEdit[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentEdits(items: RecentEdit[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // ignore quota errors
  }
}

export function clearRecentEdits(): void {
  try {
    localStorage.removeItem(RECENTS_KEY);
  } catch {
    // ignore
  }
}

export function loadDefaultWatermark(): boolean {
  try {
    return localStorage.getItem(WATERMARK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveDefaultWatermark(show: boolean): void {
  try {
    localStorage.setItem(WATERMARK_KEY, String(show));
  } catch {
    // ignore
  }
}
