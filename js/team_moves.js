/** Detalhes do time: golpes + nature + item + IVs/EVs. */

import { t } from "./i18n.js";
import { capitalize } from "./boot.js";
import {
  pega_pokemon,
  pega_move,
  nome_localizado,
  mapa_em_lotes,
} from "./buceta_api.js";
import { version_groups_do_jogo } from "../data/jogos.js";
import { type_icon_html } from "./type_icons.js";
import {
  NATURES,
  HELD_ITEMS,
  rotulo_nature,
  rotulo_item,
} from "../data/natures_items.js";
import {
  STAT_KEYS,
  STAT_SHORT,
  EV_CAP,
  EV_TOTAL,
  IV_CAP,
  ivs_default,
  evs_default,
  normaliza_ivs,
  normaliza_evs,
  soma_evs,
  rotulo_ev_spread,
  rotulo_iv_resumo,
  tem_stats,
} from "./team_stats.js";

const poolCache = new Map();

function pick_learn(details, vgs) {
  if (!details?.length) return null;
  if (vgs?.length) {
    const hit = details.find((d) => vgs.includes(d.version_group?.name));
    if (hit) return hit;
  }
  return (
    details.find((d) => d.move_learn_method?.name === "level-up") || details[0]
  );
}

function aprende_no_jogo(m, vgs) {
  const dets = m.version_group_details || [];
  if (!vgs.length) return dets.length > 0;
  return dets.some((d) => vgs.includes(d.version_group?.name));
}

export async function carrega_pool_golpes(idOuSlug, gameSlug) {
  const key = `${idOuSlug}::${gameSlug || "*"}`;
  if (poolCache.has(key)) return poolCache.get(key);

  const vgs = version_groups_do_jogo(gameSlug);
  const mon = await pega_pokemon(idOuSlug);
  let raw = (mon.moves || []).filter((m) => aprende_no_jogo(m, vgs));
  if (!raw.length && vgs.length) raw = mon.moves || [];

  const rows = await mapa_em_lotes(
    raw,
    async (m) => {
      try {
        const mv = await pega_move(m.move.name);
        const learn = pick_learn(m.version_group_details, vgs);
        return {
          slug: m.move.name,
          name: nome_localizado(mv.names, m.move.name),
          type: mv.type?.name || "",
          power: mv.power,
          accuracy: mv.accuracy,
          pp: mv.pp,
          damage: mv.damage_class?.name || "",
          method: learn?.move_learn_method?.name || "",
          level: learn?.level_learned_at ?? 0,
        };
      } catch (_) {
        return null;
      }
    },
    4
  );

  const pool = rows
    .filter(Boolean)
    .sort((a, b) => {
      if (a.method === "level-up" && b.method !== "level-up") return -1;
      if (b.method === "level-up" && a.method !== "level-up") return 1;
      return (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name);
    });

  poolCache.set(key, pool);
  return pool;
}

export function moves_vazios() {
  return [null, null, null, null];
}

export function normaliza_moves(arr) {
  const out = moves_vazios();
  (arr || []).slice(0, 4).forEach((m, i) => {
    if (!m) return;
    if (typeof m === "string") {
      out[i] = { slug: m, name: capitalize(m.replace(/-/g, " ")), type: "" };
    } else if (m.slug) {
      out[i] = {
        slug: m.slug,
        name: m.name || capitalize(m.slug.replace(/-/g, " ")),
        type: m.type || "",
        damage: m.damage || "",
        power: m.power ?? null,
      };
    }
  });
  return out;
}

export function html_move_chips(moves) {
  const list = normaliza_moves(moves);
  return `<ol class="slot__moves">
    ${list
      .map((m, i) => {
        if (!m) {
          return `<li class="slot__move slot__move_empty" data-slot="${i}">
            <span class="slot__move-num">${i + 1}</span>
            <span class="muted">—</span>
          </li>`;
        }
        const tip = m.type
          ? `style="--move-type:var(--type-${m.type})"`
          : "";
        return `<li class="slot__move" data-slot="${i}" data-type="${m.type || ""}" ${tip} title="${m.name}">
          <span class="slot__move-num">${i + 1}</span>
          ${m.type ? type_icon_html(m.type) : ""}
          <span class="slot__move-name">${m.name}</span>
        </li>`;
      })
      .join("")}
  </ol>`;
}

export function html_slot_details(mon, { show = true } = {}) {
  if (!show) return "";
  const nature = mon.nature
    ? `<div class="slot__meta"><span class="muted">${t("nature")}</span> <strong>${rotulo_nature(mon.nature)}</strong></div>`
    : `<div class="slot__meta muted">${t("nature")}: —</div>`;
  const item = mon.item
    ? `<div class="slot__meta"><span class="muted">${t("held_item")}</span> <strong>${mon.itemName || rotulo_item(mon.item)}</strong></div>`
    : `<div class="slot__meta muted">${t("held_item")}: —</div>`;
  return `<div class="slot__details">
    ${nature}
    ${item}
    ${html_move_chips(mon.moves)}
  </div>`;
}

export function tem_detalhe(mon) {
  if (!mon) return false;
  if (mon.nature || mon.item) return true;
  if (tem_stats(mon)) return true;
  return (mon.moves || []).some(Boolean);
}

function method_label(method) {
  const map = {
    "level-up": t("method_level"),
    machine: t("method_tm"),
    egg: t("method_egg"),
    tutor: t("method_tutor"),
  };
  return map[method] || capitalize(String(method || "").replace(/-/g, " "));
}

function html_stat_grid(kind, values, { max, totalLabel = "" } = {}) {
  const rows = STAT_KEYS.map((k) => {
    const v = values[k] ?? 0;
    return `<label class="stat-cell">
      <span class="stat-cell__lab">${STAT_SHORT[k]}</span>
      <input type="number" inputmode="numeric" min="0" max="${max}" step="1"
        data-stat="${kind}" data-key="${k}" value="${v}">
    </label>`;
  }).join("");
  return `<div class="stat-grid">${rows}</div>${totalLabel}`;
}

export async function abre_editor_detalhes({
  mon,
  gameSlug,
  drawer,
  drawerBg,
  onSave,
}) {
  if (!drawer || !drawerBg || !mon) return;

  const fecha = () => {
    drawerBg.classList.remove("drawer-bg_open");
    drawer.classList.remove("drawer_open");
  };

  drawer.innerHTML = `<p class="status-line">${t("loading")}</p>`;
  drawerBg.classList.add("drawer-bg_open");
  drawer.classList.add("drawer_open");
  drawerBg.onclick = fecha;

  let pool = [];
  try {
    pool = await carrega_pool_golpes(mon.id || mon.slug, gameSlug);
  } catch (err) {
    console.error(err);
    drawer.innerHTML = `<p class="status-line">${t("err_load")}</p>
      <button type="button" class="btn btn_ghost" data-fecha>${t("close")}</button>`;
    drawer.querySelector("[data-fecha]")?.addEventListener("click", fecha);
    return;
  }

  let escolhidos = normaliza_moves(mon.moves);
  let nature = mon.nature || "";
  let item = mon.item || "";
  let ivs = normaliza_ivs(mon.ivs);
  let evs = normaliza_evs(mon.evs);
  let filtro = "";
  let method = "";
  let itemFiltro = "";
  let aba = "moves";

  function aplica_ev(key, raw) {
    const next = clamp_ev_value(raw);
    const outros = soma_evs(evs) - (evs[key] || 0);
    const room = Math.max(0, EV_TOTAL - outros);
    evs = { ...evs, [key]: Math.min(next, room, EV_CAP) };
  }

  function clamp_ev_value(raw) {
    const x = Number(raw);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(EV_CAP, Math.round(x)));
  }

  function pinta() {
    const q = filtro.trim().toLowerCase();
    let lista = pool;
    if (method) lista = lista.filter((m) => m.method === method);
    if (q) {
      lista = lista.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.slug.includes(q) ||
          m.type.includes(q)
      );
    }

    const selectedSlugs = new Set(
      escolhidos.filter(Boolean).map((m) => m.slug)
    );
    const cheio = escolhidos.filter(Boolean).length >= 4;

    const iq = itemFiltro.trim().toLowerCase();
    const itens = HELD_ITEMS.filter(
      (slug) =>
        !iq ||
        slug.includes(iq) ||
        rotulo_item(slug).toLowerCase().includes(iq)
    );

    const evSum = soma_evs(evs);
    const evOver = evSum > EV_TOTAL;

    const movesPanel = `
      <div class="move-picked">
        ${escolhidos
          .map((m, i) => {
            if (!m) {
              return `<button type="button" class="move-picked__slot move-picked__slot_empty" data-clear="${i}">
                <span>${i + 1}</span><span class="muted">${t("moves_pick")}</span>
              </button>`;
            }
            return `<button type="button" class="move-picked__slot" data-clear="${i}" style="--move-type:var(--type-${m.type || "normal"})" title="${t("moves_clear_slot")}">
              <span>${i + 1}</span>
              ${m.type ? type_icon_html(m.type) : ""}
              <strong>${m.name}</strong>
            </button>`;
          })
          .join("")}
      </div>
      <div class="toolbar dex-toolbar" style="margin:0.75rem 0">
        <input type="search" data-busca placeholder="${t("moves_search")}" value="${filtro.replace(/"/g, "&quot;")}">
        <label>
          <span class="muted">${t("learn_method")}</span>
          <select data-method>
            <option value="">${t("filter_all")}</option>
            <option value="level-up"${method === "level-up" ? " selected" : ""}>${t("method_level")}</option>
            <option value="machine"${method === "machine" ? " selected" : ""}>${t("method_tm")}</option>
            <option value="egg"${method === "egg" ? " selected" : ""}>${t("method_egg")}</option>
            <option value="tutor"${method === "tutor" ? " selected" : ""}>${t("method_tutor")}</option>
          </select>
        </label>
      </div>
      <div class="move-pick-list">
        ${
          lista.length
            ? lista
                .map((m) => {
                  const on = selectedSlugs.has(m.slug);
                  const disabled = !on && cheio;
                  return `<button type="button" class="move-pick-row${on ? " move-pick-row_on" : ""}" data-slug="${m.slug}" ${disabled ? "disabled" : ""}>
                    <span class="move-pick-row__type">${m.type ? type_icon_html(m.type) : ""}</span>
                    <span class="move-pick-row__name">${m.name}</span>
                    <span class="muted move-pick-row__meta">${method_label(m.method)}${m.method === "level-up" && m.level ? ` ${m.level}` : ""} · ${m.damage || "—"} · ${m.power ?? "—"}</span>
                  </button>`;
                })
                .join("")
            : `<p class="muted">${t("moves_none")}</p>`
        }
      </div>`;

    const itemPanel = `
      <div class="toolbar dex-toolbar" style="margin:0.75rem 0">
        <input type="search" data-item-busca placeholder="${t("item_search")}" value="${itemFiltro.replace(/"/g, "&quot;")}">
      </div>
      <div class="move-pick-list">
        <button type="button" class="move-pick-row${!item ? " move-pick-row_on" : ""}" data-pick-item="">
          <span class="move-pick-row__name">${t("details_none")}</span>
        </button>
        ${itens
          .map((slug) => {
            const on = slug === item;
            return `<button type="button" class="move-pick-row${on ? " move-pick-row_on" : ""}" data-pick-item="${slug}">
              <span class="move-pick-row__name">${rotulo_item(slug)}</span>
            </button>`;
          })
          .join("")}
      </div>`;

    const statsPanel = `
      <div class="stat-block">
        <div class="stat-block__head">
          <h3>${t("ivs")}</h3>
          <button type="button" class="btn btn_ghost btn_sm" data-iv-max>${t("ivs_max")}</button>
        </div>
        <p class="muted ana-note">${t("ivs_note")}</p>
        ${html_stat_grid("iv", ivs, { max: IV_CAP })}
      </div>
      <div class="stat-block">
        <div class="stat-block__head">
          <h3>${t("evs")}</h3>
          <button type="button" class="btn btn_ghost btn_sm" data-ev-zero>${t("evs_zero")}</button>
        </div>
        <p class="muted ana-note">${t("evs_note")}</p>
        ${html_stat_grid("ev", evs, {
          max: EV_CAP,
          totalLabel: `<p class="stat-total${evOver ? " stat-total_bad" : ""}">${t("evs_total")}: <strong>${evSum}</strong> / ${EV_TOTAL}</p>`,
        })}
        <p class="muted ana-note">${t("evs_spread")}: <strong>${rotulo_ev_spread(evs)}</strong></p>
      </div>`;

    drawer.innerHTML = `
      <div class="drawer__head">
        <div>
          <h2>${t("details_edit_title")}</h2>
          <p class="muted">${mon.name}</p>
        </div>
        <button type="button" class="btn btn_ghost" data-fecha>${t("close")}</button>
      </div>

      <div class="detail-fields">
        <label class="detail-field">
          <span class="muted">${t("nature")}</span>
          <select data-nature>
            <option value="">${t("details_none")}</option>
            ${NATURES.map((n) => {
              const sel = n.slug === nature ? " selected" : "";
              return `<option value="${n.slug}"${sel}>${rotulo_nature(n.slug)}</option>`;
            }).join("")}
          </select>
        </label>
        <label class="detail-field">
          <span class="muted">${t("held_item")}</span>
          <select data-item>
            <option value="">${t("details_none")}</option>
            ${HELD_ITEMS.map((slug) => {
              const sel = slug === item ? " selected" : "";
              return `<option value="${slug}"${sel}>${rotulo_item(slug)}</option>`;
            }).join("")}
          </select>
        </label>
      </div>

      <div class="detail-tabs">
        <button type="button" class="detail-tab${aba === "moves" ? " detail-tab_on" : ""}" data-aba="moves">${t("moves")} · ${escolhidos.filter(Boolean).length}/4</button>
        <button type="button" class="detail-tab${aba === "stats" ? " detail-tab_on" : ""}" data-aba="stats">${t("stats_tab")}</button>
        <button type="button" class="detail-tab${aba === "item" ? " detail-tab_on" : ""}" data-aba="item">${t("held_item")}</button>
      </div>

      ${aba === "item" ? itemPanel : aba === "stats" ? statsPanel : movesPanel}

      <div class="toolbar" style="margin-top:1rem">
        <button type="button" class="btn" data-ok>${t("details_save")}</button>
        <button type="button" class="btn btn_ghost" data-limpa>${t("details_clear")}</button>
      </div>
    `;

    drawer.querySelector("[data-fecha]")?.addEventListener("click", fecha);
    drawer.querySelector("[data-ok]")?.addEventListener("click", () => {
      onSave?.({
        moves: normaliza_moves(escolhidos),
        nature: nature || "",
        item: item || "",
        itemName: item ? rotulo_item(item) : "",
        ivs: normaliza_ivs(ivs),
        evs: normaliza_evs(evs),
      });
      fecha();
    });
    drawer.querySelector("[data-limpa]")?.addEventListener("click", () => {
      escolhidos = moves_vazios();
      nature = "";
      item = "";
      ivs = ivs_default();
      evs = evs_default();
      pinta();
    });

    drawer.querySelector("[data-nature]")?.addEventListener("change", (e) => {
      nature = e.target.value;
    });
    drawer.querySelector("[data-item]")?.addEventListener("change", (e) => {
      item = e.target.value;
    });

    drawer.querySelectorAll("[data-aba]").forEach((btn) => {
      btn.addEventListener("click", () => {
        aba = btn.dataset.aba;
        pinta();
      });
    });

    const refocus = (sel) => {
      const el = drawer.querySelector(sel);
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    };

    drawer.querySelector("[data-busca]")?.addEventListener("input", (e) => {
      filtro = e.target.value;
      pinta();
      refocus("[data-busca]");
    });
    drawer.querySelector("[data-item-busca]")?.addEventListener("input", (e) => {
      itemFiltro = e.target.value;
      pinta();
      refocus("[data-item-busca]");
    });
    drawer.querySelector("[data-method]")?.addEventListener("change", (e) => {
      method = e.target.value;
      pinta();
    });

    drawer.querySelector("[data-iv-max]")?.addEventListener("click", () => {
      ivs = ivs_default();
      pinta();
    });
    drawer.querySelector("[data-ev-zero]")?.addEventListener("click", () => {
      evs = evs_default();
      pinta();
    });

    drawer.querySelectorAll("input[data-stat]").forEach((inp) => {
      const commit = () => {
        const key = inp.dataset.key;
        if (inp.dataset.stat === "iv") {
          const x = Number(inp.value);
          ivs = {
            ...ivs,
            [key]: Number.isFinite(x)
              ? Math.max(0, Math.min(IV_CAP, Math.round(x)))
              : 0,
          };
        } else {
          aplica_ev(key, inp.value);
        }
        pinta();
        const again = drawer.querySelector(
          `input[data-stat="${inp.dataset.stat}"][data-key="${key}"]`
        );
        again?.focus();
        again?.select();
      };
      inp.addEventListener("change", commit);
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      });
    });

    drawer.querySelectorAll("[data-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        escolhidos[Number(btn.dataset.clear)] = null;
        pinta();
      });
    });
    drawer.querySelectorAll("[data-pick-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        item = btn.dataset.pickItem || "";
        pinta();
      });
    });
    drawer.querySelectorAll(".move-pick-row[data-slug]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.slug;
        const row = pool.find((m) => m.slug === slug);
        if (!row) return;
        const idx = escolhidos.findIndex((m) => m?.slug === slug);
        if (idx >= 0) {
          escolhidos[idx] = null;
          pinta();
          return;
        }
        const free = escolhidos.findIndex((m) => !m);
        if (free < 0) return;
        escolhidos[free] = {
          slug: row.slug,
          name: row.name,
          type: row.type,
          damage: row.damage,
          power: row.power,
        };
        pinta();
      });
    });
  }

  pinta();
}

export async function abre_editor_golpes(opts) {
  return abre_editor_detalhes({
    ...opts,
    onSave: (det) => opts.onSave?.(det.moves),
  });
}

export { rotulo_ev_spread, rotulo_iv_resumo, normaliza_ivs, normaliza_evs };

