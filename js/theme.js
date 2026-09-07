const KEY = "popo_theme";

/** @returns {"light"|"dark"} */
export function theme_mode() {
  const v = localStorage.getItem(KEY);
  if (v === "light" || v === "dark") return v;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function set_theme_mode(mode) {
  const next = mode === "dark" ? "dark" : "light";
  localStorage.setItem(KEY, next);
  aplica_theme(next);
}

export function aplica_theme(mode = theme_mode()) {
  document.documentElement.dataset.theme = mode;
}

export function toggle_theme() {
  set_theme_mode(theme_mode() === "dark" ? "light" : "dark");
}

aplica_theme();
