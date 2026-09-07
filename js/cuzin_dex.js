import { t } from "./i18n.js";
import {
  caraioo_ficha,
  footprint_url,
  pega_move,
  nome_localizado,
  mapa_em_lotes,
} from "./buceta_api.js";
import { capitalize } from "./boot.js";
import { sprite_mode, art_src, art_onerror_attr } from "./sprite_mode.js";
import { TIPOS, mult_ataque } from "../data/jogos.js";
import { type_icon_html } from "./type_icons.js";

function type_pill(type) {
  return `<span class="type-pill" data-type="${type}" style="background:var(--type-${type})">${type}</span>`;
}

function flatten_evo(chain, out = []) {
  if (!chain) return out;
  out.push(chain.species.name);
  for (const next of chain.evolves_to || []) flatten_evo(next, out);
  return out;
}

function fraquezas(defTypes) {
  return TIPOS.filter((atk) => mult_ataque(atk, defTypes || []) >= 2);
}

function pick_art(ficha, { shiny = false, mode = sprite_mode() } = {}) {
  const a = ficha.sprites_all || {};
  if (mode === "2d") {
    if (shiny) return a.pixel_shiny || a.artwork_shiny || a.pixel || ficha.sprites.shiny;
    return a.pixel || a.artwork || ficha.sprites.default;
  }
  if (shiny) return a.home_shiny || a.artwork_shiny || a.pixel_shiny || ficha.sprites.shiny;
  return a.home || a.artwork || a.pixel || ficha.sprites.front;
}

function pick_learn(details, preferVg) {
  if (!details?.length) return null;
  if (preferVg) {
    const hit = details.find((d) => d.version_group?.name === preferVg);
    if (hit) return hit;
  }
  return (
    details.find((d) => d.move_learn_method?.name === "level-up") || details[0]
  );
}

async function carrega_moves(moves_raw, { method = "", versionGroup = "" } = {}) {
  let pool = moves_raw || [];
  if (method) {
    pool = pool.filter((m) =>
      (m.version_group_details || []).some(
        (d) => d.move_learn_method?.name === method
      )
    );
  }
  if (versionGroup) {
    pool = pool.filter((m) =>
      (m.version_group_details || []).some(
        (d) => d.version_group?.name === versionGroup
      )
    );
  }

  // lotes pra não estourar rate limit
  const rows = await mapa_em_lotes(
    pool,
    async (m) => {
      try {
        const mv = await pega_move(m.move.name);
        const learn = pick_learn(m.version_group_details, versionGroup);
        return {
          slug: m.move.name,
          name: nome_localizado(mv.names, m.move.name),
          type: mv.type?.name || "",
          power: mv.power ?? "—",
          accuracy: mv.accuracy ?? "—",
          pp: mv.pp ?? "—",
          damage: mv.damage_class?.name || "",
          method: learn?.move_learn_method?.name || "",
          level: learn?.level_learned_at ?? 0,
          version: learn?.version_group?.name || "",
        };
      } catch (_) {
        return null;
      }
    },
    4
  );

  return rows
    .filter(Boolean)
    .sort((a, b) => {
      if (a.method === "level-up" && b.method !== "level-up") return -1;
      if (b.method === "level-up" && a.method !== "level-up") return 1;
      return (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name);
    });
}

function lista_version_groups(moves_raw) {
  const set = new Set();
  for (const m of moves_raw || []) {
    for (const d of m.version_group_details || []) {
      if (d.version_group?.name) set.add(d.version_group.name);
    }
  }
  return [...set].sort();
}

function pretty_slug(s) {
  return capitalize(String(s || "").replace(/-/g, " "));
}

function render_move_rows(moves) {
  if (!moves.length) return `<tr><td colspan="7" class="muted">${t("moves_none")}</td></tr>`;
  return moves
    .map(
      (m) =>
        `<tr>
          <td class="data-table__name">${m.name}</td>
          <td>${m.type ? type_pill(m.type) : "—"}</td>
          <td>${m.level || "—"}</td>
          <td>${m.power}</td>
          <td>${m.accuracy}</td>
          <td>${m.pp}</td>
          <td><span class="cat-pill cat-pill_${m.damage || "status"}">${pretty_slug(m.damage || "—")}</span></td>
        </tr>`
    )
    .join("");
}

function cry_block(label, src) {
  if (!src) return "";
  return `
    <div class="cry-card">
      <div class="cry-card__label">${label}</div>
      <button type="button" class="cry-btn" data-cry="${src}">
        <span class="cry-btn__ico" aria-hidden="true">▶</span>
        <span class="cry-btn__txt">${t("play_cry")}</span>
      </button>
      <audio preload="none" src="${src}" hidden></audio>
    </div>`;
}

function wire_cries(drawer) {
  drawer.querySelectorAll(".cry-btn").forEach((btn) => {
    const card = btn.closest(".cry-card");
    const audio = card?.querySelector("audio");
    if (!audio) return;
    btn.addEventListener("click", () => {
      drawer.querySelectorAll(".cry-card audio").forEach((a) => {
        if (a !== audio) {
          a.pause();
          a.currentTime = 0;
          const b = a.closest(".cry-card")?.querySelector(".cry-btn");
          if (b) {
            b.classList.remove("cry-btn_on");
            b.querySelector(".cry-btn__ico").textContent = "▶";
            b.querySelector(".cry-btn__txt").textContent = t("play_cry");
          }
        }
      });
      if (audio.paused) {
        audio.play();
        btn.classList.add("cry-btn_on");
        btn.querySelector(".cry-btn__ico").textContent = "❚❚";
        btn.querySelector(".cry-btn__txt").textContent = t("pause_cry");
      } else {
        audio.pause();
        audio.currentTime = 0;
        btn.classList.remove("cry-btn_on");
        btn.querySelector(".cry-btn__ico").textContent = "▶";
        btn.querySelector(".cry-btn__txt").textContent = t("play_cry");
      }
    });
    audio.addEventListener("ended", () => {
      btn.classList.remove("cry-btn_on");
      btn.querySelector(".cry-btn__ico").textContent = "▶";
      btn.querySelector(".cry-btn__txt").textContent = t("play_cry");
    });
  });
}

async function wire_moves(drawer, ficha) {
  const tbody = drawer.querySelector("[data-moves-body]");
  const methodSel = drawer.querySelector("[data-move-method]");
  const vgSel = drawer.querySelector("[data-move-vg]");
  const status = drawer.querySelector("[data-moves-status]");
  if (!tbody || !methodSel || !vgSel) return;

  const vgs = lista_version_groups(ficha.moves_raw);
  vgSel.innerHTML =
    `<option value="">${t("filter_all")}</option>` +
    vgs
      .map((v) => `<option value="${v}">${pretty_slug(v)}</option>`)
      .join("");

  let busy = false;
  const refresh = async () => {
    if (busy) return;
    busy = true;
    status.textContent = t("loading");
    tbody.innerHTML = `<tr><td colspan="7" class="muted">${t("loading")}</td></tr>`;
    try {
      const moves = await carrega_moves(ficha.moves_raw, {
        method: methodSel.value,
        versionGroup: vgSel.value,
      });
      tbody.innerHTML = render_move_rows(moves);
      status.textContent = `${moves.length}`;
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">${t("err_load")}</td></tr>`;
      status.textContent = "";
    } finally {
      busy = false;
    }
  };

  methodSel.addEventListener("change", refresh);
  vgSel.addEventListener("change", refresh);
  methodSel.value = "level-up";
  await refresh();
}

const STAT_LABELS = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

export async function abre_ficha(idOuSlug, { onPick } = {}) {
  const bg = document.getElementById("drawer-bg");
  const drawer = document.getElementById("drawer");
  if (!bg || !drawer) return;

  drawer.innerHTML = `<p class="status-line">${t("loading")}</p>`;
  bg.classList.add("drawer-bg_open");
  drawer.classList.add("drawer_open");

  const fecha = () => {
    bg.classList.remove("drawer-bg_open");
    drawer.classList.remove("drawer_open");
  };
  bg.onclick = fecha;

  try {
    const ficha = await caraioo_ficha(idOuSlug);
    const evoNames = flatten_evo(ficha.evo?.chain);
    const weak = fraquezas(ficha.types);
    const mode = sprite_mode();
    const art0 = pick_art(ficha, { mode });

    const encRows = (ficha.encounters || [])
      .slice(0, 25)
      .map((e) => {
        const versions = (e.version_details || [])
          .map((v) => pretty_slug(v.version.name))
          .join(", ");
        const det = e.version_details?.[0];
        const method = pretty_slug(det?.encounter_details?.[0]?.method?.name || "—");
        return `<tr>
          <td>${pretty_slug(e.location_area.name)}</td>
          <td>${method}</td>
          <td>${det?.max_chance ?? "—"}%</td>
          <td class="enc-games">${versions}</td>
        </tr>`;
      })
      .join("");

    drawer.innerHTML = `
      <div class="drawer__head">
        <button type="button" class="btn btn_ghost" data-fecha>${t("close")}</button>
      </div>

      <div class="portal-hero">
        <div class="portal-hero__art">
          <img class="art" data-art src="${art0}" alt="${ficha.name}">
        </div>
        <div class="portal-hero__meta">
          <p class="portal-num">No. ${String(ficha.id).padStart(4, "0")}</p>
          <h2 class="portal-name">${ficha.name}</h2>
          ${ficha.genus ? `<p class="portal-genus">${ficha.genus}</p>` : ""}
          <div class="portal-types">${ficha.types.map(type_pill).join("")}</div>
          <div class="toolbar" style="margin-top:0.75rem">
            ${onPick ? `<button type="button" class="btn" data-add>${t("add_to_team")}</button>` : ""}
            <button type="button" class="btn btn_ghost" data-shiny>${t("shiny")}</button>
          </div>
        </div>
      </div>

      <div class="portal-facts">
        <div><span class="muted">${t("height")}</span><strong>${(ficha.height / 10).toFixed(1)} m</strong></div>
        <div><span class="muted">${t("weight")}</span><strong>${(ficha.weight / 10).toFixed(1)} kg</strong></div>
        <div><span class="muted">${t("habitat")}</span><strong>${pretty_slug(ficha.habitat) || "—"}</strong></div>
      </div>

      ${
        weak.length
          ? `<h3 class="section-title">${t("weakness")}</h3>
             <div class="portal-types">${weak.map(type_pill).join("")}</div>`
          : ""
      }

      <p class="portal-flavor">${ficha.flavor || ""}</p>

      <h3 class="section-title">${t("abilities")}</h3>
      <ul class="portal-abilities">
        ${ficha.abilities
          .map(
            (a) =>
              `<li><strong>${a.name}</strong>${a.hidden ? ` <span class="muted">(${t("hidden")})</span>` : ""}
              <div class="muted">${a.effect || ""}</div></li>`
          )
          .join("")}
      </ul>

      <h3 class="section-title">${t("stats")}</h3>
      <div class="portal-stats">
        ${Object.entries(ficha.stats)
          .map(([k, v]) => {
            const pct = Math.min(100, (v / 180) * 100);
            return `<div class="stat-row"><span>${STAT_LABELS[k] || k}</span><strong>${v}</strong><div class="stat-bar"><span style="width:${pct}%"></span></div></div>`;
          })
          .join("")}
      </div>

      <div class="foot-cry">
        <div class="foot-card">
          <div class="muted">${t("footprint")}</div>
          <img class="footprint" src="${footprint_url(ficha.species_id)}" alt=""
            onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'muted',textContent:'${t("footprint_none")}'}))">
        </div>
        ${cry_block(t("cry_latest"), ficha.cries.latest)}
        ${cry_block(t("cry_legacy"), ficha.cries.legacy)}
      </div>

      <h3 class="section-title">${t("evolution")}</h3>
      <div class="evo-chain">
        ${evoNames
          .map(
            (n, i) =>
              `${i ? `<span class="evo-chain__sep" aria-hidden="true">→</span>` : ""}
               <button type="button" class="evo-btn${n === ficha.slug ? " evo-btn_on" : ""}" data-evo="${n}">${capitalize(n)}</button>`
          )
          .join("")}
      </div>

      <h3 class="section-title">${t("moves")}</h3>
      <div class="toolbar drawer-toolbar">
        <label>
          <span class="muted">${t("learn_method")}</span>
          <select data-move-method>
            <option value="">${t("filter_all")}</option>
            <option value="level-up">${t("method_level")}</option>
            <option value="machine">${t("method_tm")}</option>
            <option value="egg">${t("method_egg")}</option>
            <option value="tutor">${t("method_tutor")}</option>
          </select>
        </label>
        <label>
          <span class="muted">${t("version_group")}</span>
          <select data-move-vg></select>
        </label>
        <span class="muted" data-moves-status></span>
      </div>
      <div class="data-scroll">
        <table class="data-table move-table">
          <thead><tr>
            <th>${t("moves")}</th><th>${t("filter_type")}</th><th>${t("level")}</th><th>${t("power")}</th><th>${t("accuracy")}</th><th>${t("pp")}</th><th>${t("category")}</th>
          </tr></thead>
          <tbody data-moves-body>
            <tr><td colspan="7" class="muted">${t("loading")}</td></tr>
          </tbody>
        </table>
      </div>

      <h3 class="section-title">${t("locations")}</h3>
      ${
        encRows
          ? `<div class="data-scroll"><table class="data-table enc-table"><thead><tr><th>${t("maps_areas")}</th><th>${t("method")}</th><th>${t("chance")}</th><th>${t("games")}</th></tr></thead><tbody>${encRows}</tbody></table></div>`
          : `<p class="muted">${t("no_encounters")}</p>`
      }
    `;

    drawer.querySelector("[data-fecha]")?.addEventListener("click", fecha);
    drawer.querySelector("[data-shiny]")?.addEventListener("click", (ev) => {
      const img = drawer.querySelector("[data-art]");
      const btn = ev.currentTarget;
      const on = !!btn.dataset.on;
      img.src = pick_art(ficha, { shiny: !on, mode: sprite_mode() });
      btn.dataset.on = on ? "" : "1";
      btn.textContent = on ? t("shiny") : t("normal_sprite");
    });
    drawer.querySelector("[data-add]")?.addEventListener("click", () => {
      onPick?.(ficha);
      fecha();
    });
    drawer.querySelectorAll("[data-evo]").forEach((btn) => {
      btn.addEventListener("click", () => abre_ficha(btn.dataset.evo, { onPick }));
    });
    wire_cries(drawer);
    await wire_moves(drawer, ficha);
  } catch (err) {
    console.error(err);
    drawer.innerHTML = `<p class="status-line">${t("err_load")}</p>
      <button type="button" class="btn btn_ghost" data-fecha>${t("close")}</button>`;
    drawer.querySelector("[data-fecha]")?.addEventListener("click", fecha);
  }
}

/** card estilo portal — capa ondulada + tipo + círculo + arte */
export function cell_html(id, name, { types = [] } = {}) {
  const mode = sprite_mode();
  const src = art_src(id, mode);
  const pix = mode === "2d" ? " poke-card_pixel" : "";
  const num = String(id).padStart(4, "0");
  const primary = types[0] || "normal";
  const typeBadge = type_icon_html(primary);
  return `
    <button type="button" class="poke-card${pix}" data-id="${id}" data-type="${primary}" title="${name}">
      <span class="poke-card__cap">
        <span class="poke-card__num">No.${num}</span>
        ${typeBadge}
      </span>
      <span class="poke-card__name">${name}</span>
      <span class="poke-card__stage">
        <span class="poke-card__orb" aria-hidden="true"></span>
        <img class="poke-card__art" src="${src}" alt="" loading="lazy" width="140" height="140" ${art_onerror_attr(id, mode)}>
      </span>
    </button>`;
}

/** linha densa (serebii-ish) */
export function row_html(p) {
  const mode = sprite_mode();
  const src = art_src(p.id, mode);
  const stats = p.stats || {};
  const st = (k) => (stats[k] != null ? stats[k] : "—");
  const keys = [
    "hp",
    "attack",
    "defense",
    "special-attack",
    "special-defense",
    "speed",
  ];
  return `
    <button type="button" class="dex-row" data-id="${p.id}" title="${p.name}">
      <span class="dex-row__num">No. ${String(p.id).padStart(4, "0")}</span>
      <img class="dex-row__art" src="${src}" alt="" loading="lazy" width="56" height="56" ${art_onerror_attr(p.id, mode)}>
      <span class="dex-row__name">${p.name}</span>
      <span class="dex-row__types">${(p.types || []).map(type_pill).join("")}</span>
      ${keys.map((k) => `<span class="dex-row__stat">${st(k)}</span>`).join("")}
    </button>`;
}

export function list_header_html() {
  const stats = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
  return `
    <div class="dex-list-head" aria-hidden="true">
      <span>${t("col_num")}</span>
      <span></span>
      <span>${t("col_name")}</span>
      <span>${t("col_types")}</span>
      ${stats.map((s) => `<span class="dex-list-head__stat">${s}</span>`).join("")}
    </div>`;
}

