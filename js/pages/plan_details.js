/** Página: detalhes de todo o time (set competitivo). */

import { monta_shell } from "../boot.js";
import { t } from "../i18n.js";
import { art3d_url, artwork_url, sprite_url } from "../buceta_api.js";
import { JOGOS } from "../../data/jogos.js";
import { nome_jogo } from "../team_display.js";
import {
  abre_editor_detalhes,
  normaliza_moves,
  tem_detalhe,
} from "../team_moves.js";
import { rotulo_nature, rotulo_item } from "../../data/natures_items.js";
import {
  normaliza_ivs,
  normaliza_evs,
  rotulo_ev_spread,
  rotulo_iv_resumo,
  STAT_KEYS,
  STAT_SHORT,
  ivs_padrao,
} from "../team_stats.js";

monta_shell({ active: "team" });

const TEAMS_KEY = "caraio_teams_by_game_v1";
const LAST_GAME = "caraio_last_game";

const grid = document.getElementById("details-grid");
const empty = document.getElementById("details-empty");
const gameLabel = document.getElementById("details-game");
const drawer = document.getElementById("drawer");
const drawerBg = document.getElementById("drawer-bg");

function load_store() {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (_) {
    return {};
  }
}

function save_store(store) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(store));
}

function game_slug() {
  const q = new URLSearchParams(location.search).get("game");
  if (q && JOGOS.some((j) => j.slug === q)) return q;
  const last = localStorage.getItem(LAST_GAME);
  if (last && JOGOS.some((j) => j.slug === last)) return last;
  return JOGOS[0]?.slug || "sv";
}

function slot_art(p) {
  const id = p.id || p.slug;
  const shiny = !!p.shiny;
  const opts = { shiny };
  return {
    src: art3d_url(id, opts),
    onerror: `if(!this.dataset.fb){this.dataset.fb='1';this.src='${artwork_url(id, opts)}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${sprite_url(id, opts)}'}`,
  };
}

function html_ev_bars(evs) {
  const n = normaliza_evs(evs);
  return `<div class="set-ev-bars" aria-label="${t("evs")}">
    ${STAT_KEYS.map((k) => {
      const v = n[k];
      const pct = Math.round((v / 252) * 100);
      return `<div class="set-ev-bar" title="${STAT_SHORT[k]} ${v}">
        <span class="set-ev-bar__lab">${STAT_SHORT[k]}</span>
        <span class="set-ev-bar__track"><span style="width:${pct}%"></span></span>
        <span class="set-ev-bar__val">${v}</span>
      </div>`;
    }).join("")}
  </div>`;
}

let store = load_store();
let game = game_slug();
let time = (store[game]?.team || []).slice(0, 6);
while (time.length < 6) time.push(null);
time = time.map((p) =>
  p
    ? {
        ...p,
        moves: normaliza_moves(p.moves),
        ivs: normaliza_ivs(p.ivs),
        evs: normaliza_evs(p.evs),
      }
    : null
);

function persist() {
  const snap = store[game] || {};
  store[game] = {
    ...snap,
    team: time.map((p) =>
      p
        ? {
            id: p.id,
            slug: p.slug,
            name: p.name,
            types: p.types || [],
            shiny: !!p.shiny,
            moves: normaliza_moves(p.moves),
            nature: p.nature || "",
            item: p.item || "",
            itemName: p.itemName || "",
            ivs: normaliza_ivs(p.ivs),
            evs: normaliza_evs(p.evs),
          }
        : null
    ),
  };
  save_store(store);
}

function pinta() {
  gameLabel.textContent = nome_jogo(game) || game;
  if (!time.some(Boolean)) {
    empty.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = time
    .map((p, i) => {
      if (!p) {
        return `<article class="details-card details-card_empty">
          <p class="muted">${t("empty_slot")}</p>
        </article>`;
      }
      const art = slot_art(p);
      const t1 = (p.types || [])[0] || "normal";
      const t2 = (p.types || [])[1] || t1;
      const moves = normaliza_moves(p.moves);
      const ivs = normaliza_ivs(p.ivs);
      const evs = normaliza_evs(p.evs);
      return `<article class="details-card set-card" data-i="${i}" style="--slot-t1:var(--type-${t1});--slot-t2:var(--type-${t2})">
        <div class="details-card__top">
          <img class="details-card__art" src="${art.src}" alt="" onerror="${art.onerror}">
          <div>
            <h2 class="details-card__name">${p.name}${p.shiny ? " ✦" : ""}</h2>
            <div class="slot__types">${(p.types || [])
              .map(
                (tp) =>
                  `<span class="type-pill" data-type="${tp}" style="background:var(--type-${tp})">${tp}</span>`
              )
              .join("")}</div>
            <dl class="set-meta">
              <div><dt>${t("nature")}</dt><dd>${p.nature ? rotulo_nature(p.nature) : "—"}</dd></div>
              <div><dt>${t("held_item")}</dt><dd>${p.item ? p.itemName || rotulo_item(p.item) : "—"}</dd></div>
              <div><dt>${t("ivs")}</dt><dd>${ivs_padrao(ivs) ? t("ivs_maxed") : rotulo_iv_resumo(ivs)}</dd></div>
              <div><dt>${t("evs")}</dt><dd>${rotulo_ev_spread(evs)}</dd></div>
            </dl>
          </div>
        </div>
        <h3 class="details-card__moves-title">${t("evs")}</h3>
        ${html_ev_bars(evs)}
        <h3 class="details-card__moves-title">${t("moves")}</h3>
        <ul class="slot__moves">
          ${moves
            .map((m) => {
              if (!m) {
                return `<li class="slot__move slot__move_empty"><span class="muted">—</span></li>`;
              }
              return `<li class="slot__move" style="--move-type:var(--type-${m.type || "normal"})">
                <span class="type-pill ana-bar__pill" style="background:var(--type-${m.type || "normal"})">${m.type || "?"}</span>
                <span class="slot__move-name">${m.name}</span>
              </li>`;
            })
            .join("")}
        </ul>
        <button type="button" class="btn" data-edit>${tem_detalhe(p) ? t("details_edit") + " · ✓" : t("details_edit")}</button>
      </article>`;
    })
    .join("");

  grid.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-i]");
      const i = Number(card.dataset.i);
      const p = time[i];
      if (!p) return;
      abre_editor_detalhes({
        mon: p,
        gameSlug: game,
        drawer,
        drawerBg,
        onSave: (det) => {
          time[i] = {
            ...time[i],
            moves: normaliza_moves(det.moves),
            nature: det.nature || "",
            item: det.item || "",
            itemName: det.itemName || "",
            ivs: normaliza_ivs(det.ivs),
            evs: normaliza_evs(det.evs),
          };
          persist();
          pinta();
        },
      });
    });
  });
}

pinta();
