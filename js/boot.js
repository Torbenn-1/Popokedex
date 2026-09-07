import { t, cuzin_lang, set_cuzin_lang } from "./i18n.js";
import { theme_mode, toggle_theme } from "./theme.js";

function path_prefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  const subs = new Set(["dex", "maps", "plan", "roms"]);
  const leaf = parts[parts.length - 1] || "";
  if (subs.has(leaf)) return "../";
  if (leaf.endsWith(".html") && parts.length >= 2 && subs.has(parts[parts.length - 2]))
    return "../";
  return "";
}

export function monta_shell({ active } = {}) {
  const pre = path_prefix();
  const links = [
    { id: "home", href: `${pre}index.html`, key: "nav_home" },
    { id: "dex", href: `${pre}dex/`, key: "nav_dex" },
    { id: "maps", href: `${pre}maps/`, key: "nav_maps" },
    { id: "team", href: `${pre}plan/`, key: "nav_team" },
    { id: "roms", href: `${pre}roms/`, key: "nav_roms" },
  ];

  document.documentElement.lang = cuzin_lang() === "pt" ? "pt-BR" : "en";

  const dark = theme_mode() === "dark";
  const header = document.querySelector("[data-shell-header]");
  if (header) {
    header.innerHTML = `
      <div class="topbar">
        <a class="brand" href="${pre}index.html">${t("brand")}</a>
        <nav class="nav">
          ${links
            .map(
              (l) =>
                `<a class="nav__link${active === l.id ? " nav__link_on" : ""}" href="${l.href}">${t(l.key)}</a>`
            )
            .join("")}
        </nav>
        <div class="topbar__actions">
          <button type="button" class="icon-btn" data-theme-toggle title="${t("theme_toggle")}" aria-label="${t("theme_toggle")}">
            ${dark ? "☀" : "☾"}
          </button>
          <button type="button" class="lang-btn" data-lang-toggle>${t("lang_toggle")}</button>
        </div>
      </div>
    `;
  }

  const footer = document.querySelector("[data-shell-footer]");
  if (footer) {
    footer.innerHTML = `<p class="footer__line">${t("footer_credit")}</p>`;
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  const btn = document.querySelector("[data-lang-toggle]");
  if (btn) {
    btn.addEventListener("click", () => {
      set_cuzin_lang(cuzin_lang() === "pt" ? "en" : "pt");
      location.reload();
    });
  }

  const themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      toggle_theme();
      themeBtn.textContent = theme_mode() === "dark" ? "☀" : "☾";
    });
  }
}

export function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}
