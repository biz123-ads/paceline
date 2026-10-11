/**
 * Theme preference, kept in localStorage and applied as data-theme on <html>.
 * Dark is the default; "system" follows the operating system.
 */
export const THEME_PREFERENCES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_STORAGE_KEY = "projectpulse:theme";
const CHANGE_EVENT = "projectpulse:theme-change";

/**
 * Runs inline in <head>, before the first paint, so the page never flashes
 * the wrong theme. Keep it small and dependency-free.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},m=window.matchMedia("(prefers-color-scheme: light)");function a(){var p=localStorage.getItem(k)||"dark";d.setAttribute("data-theme",p==="system"?(m.matches?"light":"dark"):p==="light"?"light":"dark")}a();m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})()`;

function isPreference(value: string | null): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function applyThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: still apply it for this page view.
  }
  const light =
    preference === "light" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore. */
export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
