import { t, cuzin_lang, set_cuzin_lang } from "./i18n.js";
import { theme_mode, toggle_theme } from "./theme.js";

function path_prefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  const leaf = parts[parts.length - 1] || "";
  const dirParts = leaf.includes(".") ? parts.slice(0, -1) : parts;
  const subs = new Set(["dex", "maps", "plan", "roms", "donate"]);
  const subIdx = dirParts.findIndex((p) => subs.has(p));
  if (subIdx < 0) return "";
  const nest = dirParts.length - subIdx;
  return "../".repeat(Math.max(1, nest));
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
    header.classList.add("site-header");
    header.innerHTML = `
      <div class="topbar">
        <a class="brand" href="${pre}index.html">
          <span class="brand__mark" aria-hidden="true"></span>
          <span class="brand__txt">${t("brand")}</span>
        </a>
        <nav class="nav" aria-label="Main">
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
    if (footer.parentElement !== document.body) {
      document.body.appendChild(footer);
    }
    footer.classList.add("site-foot");
    footer.innerHTML = `
      <div class="site-foot__inner">
        <div class="site-foot__grid">
          <div class="site-foot__brand">
            <a class="site-foot__logo" href="${pre}index.html">${t("brand")}</a>
            <p class="site-foot__tag">${t("tagline")}</p>
            <p class="site-foot__lead">${t("home_lead")}</p>
          </div>
          <div class="site-foot__col">
            <h3 class="site-foot__h">${t("foot_explore")}</h3>
            <ul class="site-foot__list">
              <li><a href="${pre}index.html">${t("nav_home")}</a></li>
              <li><a href="${pre}dex/">${t("nav_dex")}</a></li>
              <li><a href="${pre}maps/">${t("nav_maps")}</a></li>
              <li><a href="${pre}plan/">${t("nav_team")}</a></li>
              <li><a href="${pre}roms/">${t("nav_roms")}</a></li>
            </ul>
          </div>
          <div class="site-foot__col">
            <h3 class="site-foot__h">${t("foot_support")}</h3>
            <ul class="site-foot__list">
              <li><a href="${pre}donate/">${t("donate_cta")}</a></li>
            </ul>
            <p class="site-foot__note">${t("donate_blurb")}</p>
          </div>
          <div class="site-foot__col">
            <h3 class="site-foot__h">${t("foot_about")}</h3>
            <ul class="site-foot__list">
              <li><a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">PokéAPI</a></li>
              <li><a href="https://github.com/richi3f/pokemon-team-planner" target="_blank" rel="noopener noreferrer">${t("foot_inspired")}</a></li>
            </ul>
          </div>
        </div>
        <div class="site-foot__bottom">
          <p>${t("footer_credit")}</p>
        </div>
      </div>
    `;
  }

  document.body.classList.add("has-site-foot");

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
