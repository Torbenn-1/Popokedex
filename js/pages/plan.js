import { monta_shell, capitalize } from "../boot.js";
import { t } from "../i18n.js";
import { sprite_url, art3d_url, artwork_url } from "../buceta_api.js";
import {
  JOGOS,
  set_ids_do_jogo,
  set_ids_nacional_gen,
  dexes_regionais_do_jogo,
  nome_da_dex,
  cap_nacional_do_jogo,
  mapa_ordem_dex,
  rotulo_jogo,
  rotulo_tipo,
} from "../../data/jogos.js";
import { abre_ficha, cell_html } from "../cuzin_dex.js";
import {
  carrega_slim,
  slim_como_catalogo,
  slim_por_id,
  slim_por_slug,
  slim_nome,
} from "../slim_dex.js";
import {
  css_display,
  html_display_card,
  display_do_time_atual,
  salva_display,
  baixa_html,
  nome_jogo,
} from "../team_display.js";
import { sprite_mode } from "../sprite_mode.js";
import { pinta_analise_Rica } from "../team_analise.js";
import {
  normaliza_moves,
  moves_vazios,
} from "../team_moves.js";
import { normaliza_ivs, normaliza_evs, ivs_default, evs_default } from "../team_stats.js";
import { bind_inject_controls, can_inject_team, team_gen } from "../team_inject.js";

monta_shell({ active: "team" });

const LAST_GAME = "caraio_last_game";
const TEAMS_KEY = "caraio_teams_by_game_v1";

const jogoSel = document.getElementById("jogo");
const slotsEl = document.getElementById("slots");
const grade = document.getElementById("grade");
const status = document.getElementById("status");
const busca = document.getElementById("busca-time");
const btnAnalise = document.getElementById("btn-analise");
const teamStack = document.getElementById("team-stack");
const displayNome = document.getElementById("display-nome");
const displayNota = document.getElementById("display-nota");
const displaySprite = document.getElementById("display-sprite");
const displayStatus = document.getElementById("display-status");
const planNational = document.getElementById("plan-national");
const planDex = document.getElementById("plan-dex");
const wrapPlanDex = document.getElementById("wrap-plan-dex");
const wrapPlanNational = document.getElementById("wrap-plan-national");

let catalogo = [];
/** @type {{id:number,slug:string,name:string,types:string[],shiny?:boolean,moves?:any[]}[]} */
let time = empty_team();
let dragFrom = null;
let displayIdAtual = null;
/** @type {Record<string, object>} */
let teamsByGame = load_store();
const movesHint = document.getElementById("moves-hint");
const btnDetailsPage = document.getElementById("btn-details-page");
const btnInjectSave = document.getElementById("btn-inject-save");
const injectSaveFile = document.getElementById("inject-save-file");
const analiseRoot = document.getElementById("analise");

if (!document.getElementById("td-display-css")) {
  const s = document.createElement("style");
  s.id = "td-display-css";
  s.textContent = css_display();
  document.head.appendChild(s);
}

jogoSel.innerHTML = JOGOS.map(
  (j) => `<option value="${j.slug}">${rotulo_jogo(j)}</option>`
).join("");

const salvo = localStorage.getItem(LAST_GAME);
if (salvo && JOGOS.some((j) => j.slug === salvo)) jogoSel.value = salvo;

displaySprite.value = sprite_mode() === "2d" ? "2d" : "3d";

function empty_team() {
  return [null, null, null, null, null, null];
}

function load_store() {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (_) {
    return {};
  }
}

function save_store() {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teamsByGame));
}

function clone_team(arr) {
  return (arr || empty_team()).map((p) =>
    p
      ? {
          id: p.id,
          slug: p.slug,
          name: p.name,
          types: [...(p.types || [])],
          shiny: !!p.shiny,
          moves: normaliza_moves(p.moves),
          nature: p.nature || "",
          item: p.item || "",
          itemName: p.itemName || "",
          ivs: normaliza_ivs(p.ivs),
          evs: normaliza_evs(p.evs),
        }
      : null
  );
}

function snapshot_atual() {
  return {
    team: clone_team(time),
    title: (displayNome.value || "").trim(),
    note: (displayNota.value || "").trim(),
    sprite: displaySprite.value === "2d" ? "2d" : "3d",
    displayId: displayIdAtual || null,
  };
}

function apply_snapshot(snap, gameSlug) {
  const s = snap || {};
  time = clone_team(s.team);
  while (time.length < 6) time.push(null);
  time = time.slice(0, 6);
  displayNome.value = s.title || "";
  displayNota.value = s.note || "";
  displaySprite.value = s.sprite === "2d" ? "2d" : "3d";
  displayIdAtual = s.displayId || null;
  displayNome.placeholder = `Time ${nome_jogo(gameSlug)}`;
}

function persiste_jogo_atual() {
  const slug = jogoSel.value;
  if (!slug) return;
  const snap = snapshot_atual();
  const hasMons = snap.team.some(Boolean);
  if (!hasMons && !snap.title && !snap.note) {
    delete teamsByGame[slug];
  } else {
    teamsByGame[slug] = snap;
  }
  save_store();
}

function monta_display_payload(gameSlug = jogoSel.value, snap = null) {
  const s = snap || (gameSlug === jogoSel.value ? snapshot_atual() : teamsByGame[gameSlug]);
  const team = s?.team || empty_team();
  return display_do_time_atual({
    id: s?.displayId || undefined,
    game: gameSlug,
    team,
    title: (s?.title || "").trim() || `Time ${nome_jogo(gameSlug)}`,
    note: (s?.note || "").trim(),
    sprite: s?.sprite || "3d",
  });
}

function jogos_com_time() {
  const order = JOGOS.map((j) => j.slug);
  const slugs = new Set(Object.keys(teamsByGame));
  if (time.some(Boolean)) slugs.add(jogoSel.value);
  return order.filter((slug) => {
    if (slug === jogoSel.value) return time.some(Boolean);
    const pack = teamsByGame[slug];
    return !!(pack?.team || []).some(Boolean);
  });
}

function pinta_stack() {
  if (!teamStack) return;
  persiste_jogo_atual();
  const list = jogos_com_time();
  if (!list.length) {
    teamStack.innerHTML = `<p class="muted">${t("display_stack_empty")}</p>`;
    return;
  }
  teamStack.innerHTML = list
    .map((slug) => {
      const on = slug === jogoSel.value ? " team-stack__item_on" : "";
      const payload = monta_display_payload(slug);
      return `<div class="team-stack__item${on}" data-game="${slug}" role="button" tabindex="0" title="${nome_jogo(slug)}">
        ${html_display_card(payload)}
      </div>`;
    })
    .join("");

  teamStack.querySelectorAll("[data-game]").forEach((el) => {
    const go = () => {
      const slug = el.dataset.game;
      if (!slug || slug === jogoSel.value) return;
      troca_jogo(slug);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });
}

function pinta_display() {
  pinta_stack();
}

function national_on() {
  return !!(planNational && planNational.checked);
}

function sync_plan_dex({ reset = false } = {}) {
  const jogo = jogoSel.value;
  const regionais = jogo ? dexes_regionais_do_jogo(jogo) : [];

  if (wrapPlanNational) {
    wrapPlanNational.hidden = !jogo;
    if (!jogo && planNational) planNational.checked = false;
  }

  const showDex = !!(jogo && !national_on() && regionais.length > 1);
  if (wrapPlanDex) wrapPlanDex.hidden = !showDex;

  if (!jogo || national_on()) {
    if (planDex) {
      planDex.innerHTML = "";
      planDex.value = "";
    }
    return;
  }

  if (regionais.length === 1) {
    planDex.innerHTML = `<option value="${regionais[0].slug}">${nome_da_dex(regionais[0])}</option>`;
    planDex.value = regionais[0].slug;
    return;
  }

  if (regionais.length === 0) {
    planDex.innerHTML = "";
    planDex.value = "";
    return;
  }

  const prev = planDex.value;
  planDex.innerHTML =
    `<option value="__regional__">${t("filter_dex_all")}</option>` +
    regionais.map((d) => `<option value="${d.slug}">${nome_da_dex(d)}</option>`).join("");

  if (reset) {
    planDex.value = "__regional__";
  } else if (prev === "__regional__" || prev === "") {
    planDex.value = "__regional__";
  } else if (regionais.some((d) => d.slug === prev)) {
    planDex.value = prev;
  } else {
    planDex.value = "__regional__";
  }
}

function ids_pool_atual() {
  const jogo = jogoSel.value;
  if (!jogo) return null;
  if (national_on()) return set_ids_nacional_gen(jogo);
  const dex = planDex?.value || "__regional__";
  if (dex === "__regional__") return set_ids_do_jogo(jogo, "__regional__");
  return set_ids_do_jogo(jogo, dex);
}

function mon_no_pool(id) {
  const set = ids_pool_atual();
  if (!set) return true;
  return set.has(Number(id));
}

function ordem_pool_atual() {
  const jogo = jogoSel.value;
  if (!jogo || national_on()) return null;
  const dex = planDex?.value || "__regional__";
  return mapa_ordem_dex(jogo, dex === "" ? "__regional__" : dex);
}

function pool_do_jogo() {
  const noJogo = ids_pool_atual();
  let lista = noJogo ? catalogo.filter((p) => noJogo.has(p.id)) : catalogo;
  const ordem = ordem_pool_atual();
  if (ordem) {
    lista = [...lista].sort(
      (a, b) => (ordem.get(a.id) || 1e9) - (ordem.get(b.id) || 1e9)
    );
  } else {
    lista = [...lista].sort((a, b) => a.id - b.id);
  }
  return lista;
}

function limpa_time_fora_do_jogo() {
  time = time.map((p) => (p && p.id && !mon_no_pool(p.id) ? null : p));
  time = [...time.filter(Boolean), null, null, null, null, null, null].slice(0, 6);
}

async function troca_jogo(slug, { fromHash = false } = {}) {
  if (!JOGOS.some((j) => j.slug === slug)) return;
  if (!fromHash) persiste_jogo_atual();
  jogoSel.value = slug;
  localStorage.setItem(LAST_GAME, slug);
  apply_snapshot(teamsByGame[slug], slug);
  planNational.checked = false;
  sync_plan_dex({ reset: true });
  limpa_time_fora_do_jogo();
  for (let i = 0; i < 6; i++) await hidrata_slot(i);
  update_hash();
  pinta_slots();
  pinta_analise();
  pinta_grade();
  pinta_stack();
}

jogoSel.addEventListener("change", () => {
  troca_jogo(jogoSel.value);
});

function parse_hash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return false;
  const parts = h.split("+").filter(Boolean);
  if (!parts.length) return false;
  let game = jogoSel.value;
  if (JOGOS.some((j) => j.slug === parts[0])) {
    game = parts[0];
    parts.shift();
  }
  const team = empty_team();
  parts.slice(0, 6).forEach((token, i) => {
    const shiny = token.endsWith("*");
    const slug = shiny ? token.slice(0, -1) : token;
    if (!slug) return;
    team[i] = {
      id: 0,
      slug,
      name: capitalize(slug),
      types: [],
      shiny,
      moves: moves_vazios(),
      nature: "",
      item: "",
      itemName: "",
      ivs: ivs_default(),
      evs: evs_default(),
    };
  });
  if (team.some(Boolean)) {
    teamsByGame[game] = {
      ...(teamsByGame[game] || {}),
      team: clone_team(team),
      title: teamsByGame[game]?.title || "",
      note: teamsByGame[game]?.note || "",
      sprite: teamsByGame[game]?.sprite || displaySprite.value,
      displayId: teamsByGame[game]?.displayId || null,
    };
    save_store();
  }
  jogoSel.value = game;
  apply_snapshot(teamsByGame[game], game);
  return true;
}

function update_hash() {
  const tokens = time.filter(Boolean).map((p) => (p.shiny ? `${p.slug}*` : p.slug));
  const hash = [jogoSel.value, ...tokens].join("+");
  history.replaceState(null, "", "#" + hash);
  persiste_jogo_atual();
}

async function hidrata_slot(i) {
  const p = time[i];
  if (!p || (p.types && p.types.length)) return;
  const mon =
    (p.id && slim_por_id(p.id)) ||
    (p.slug && slim_por_slug(p.slug)) ||
    null;
  if (!mon) return;
  time[i] = {
    id: mon.id,
    slug: mon.slug,
    name: slim_nome(mon) || capitalize(mon.slug),
    types: mon.types || [],
    shiny: !!p.shiny,
    moves: normaliza_moves(p.moves),
    nature: p.nature || "",
    item: p.item || "",
    itemName: p.itemName || "",
    ivs: normaliza_ivs(p.ivs),
    evs: normaliza_evs(p.evs),
  };
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

function pinta_slots() {
  if (movesHint) {
    movesHint.textContent = time.some(Boolean) ? t("details_hint") : "";
  }
  if (btnDetailsPage) {
    btnDetailsPage.href = `details/?game=${encodeURIComponent(jogoSel.value)}`;
    btnDetailsPage.classList.toggle("btn_disabled", !time.some(Boolean));
  }
  if (btnInjectSave) {
    const can = can_inject_team(jogoSel.value, time);
    btnInjectSave.disabled = false;
    btnInjectSave.classList.toggle("btn_disabled", !can);
    btnInjectSave.setAttribute("aria-disabled", can ? "false" : "true");
    const gen = team_gen(jogoSel.value);
    btnInjectSave.title =
      gen > 5 ? t("inject_need_gen") : !time.some(Boolean) ? t("inject_need_team") : "";
  }

  slotsEl.innerHTML = time
    .map((p, i) => {
      if (!p) {
        return `<div class="slot slot_empty" data-i="${i}" draggable="true">
          <div class="slot__empty-label muted">${t("empty_slot")}</div>
        </div>`;
      }
      const art = slot_art(p);
      const t1 = (p.types || [])[0] || "normal";
      const t2 = (p.types || [])[1] || t1;
      const shinyOn = p.shiny ? " slot__shiny_on" : "";
      return `<div class="slot slot_full${p.shiny ? " slot_shiny" : ""}" data-i="${i}" data-id="${p.id}" data-type="${t1}" draggable="true" style="--slot-t1:var(--type-${t1});--slot-t2:var(--type-${t2})" title="${p.name}">
        <div class="slot__actions">
          <button type="button" class="slot__shiny${shinyOn}" data-shiny title="${t("shiny")}" aria-pressed="${p.shiny ? "true" : "false"}">✦</button>
          <button type="button" class="slot__rm" data-rm title="${t("remove_slot")}" aria-label="${t("remove_slot")}">×</button>
        </div>
        <img class="slot__art" src="${art.src}" alt="" onerror="${art.onerror}">
        <div class="slot__name">${p.name}</div>
        <div class="slot__types">${(p.types || []).map((tp) => `<span class="type-pill" data-type="${tp}" style="background:var(--type-${tp})">${rotulo_tipo(tp)}</span>`).join("")}</div>
      </div>`;
    })
    .join("");

  slotsEl.querySelectorAll(".slot").forEach((el) => {
    const i = Number(el.dataset.i);

    el.querySelector("[data-shiny]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!time[i]) return;
      time[i] = { ...time[i], shiny: !time[i].shiny };
      update_hash();
      pinta_slots();
      pinta_display();
    });

    el.querySelector("[data-rm]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      time[i] = null;
      time = [...time.filter(Boolean), null, null, null, null, null, null].slice(0, 6);
      update_hash();
      pinta_slots();
      pinta_analise();
      pinta_display();
    });

    if (time[i]) {
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        abre_ficha(time[i].id || time[i].slug, { onPick: add_mon });
      });
    }

    el.addEventListener("dragstart", (e) => {
      if (e.target.closest("button")) {
        e.preventDefault();
        return;
      }
      dragFrom = i;
    });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", () => {
      const to = Number(el.dataset.i);
      if (dragFrom == null || dragFrom === to) return;
      const tmp = time[to];
      time[to] = time[dragFrom];
      time[dragFrom] = tmp;
      dragFrom = null;
      update_hash();
      pinta_slots();
      pinta_analise();
      pinta_display();
    });
  });
}

function pinta_analise() {
  if (!analiseRoot) return;
  pinta_analise_Rica(analiseRoot, time);
}

async function add_mon(fichaOuSlug) {
  const vazio = time.findIndex((x) => !x);
  if (vazio < 0) {
    time.shift();
    time.push(null);
  }
  const idx = time.findIndex((x) => !x);
  if (typeof fichaOuSlug === "object") {
    time[idx] = {
      id: fichaOuSlug.id,
      slug: fichaOuSlug.slug,
      name: fichaOuSlug.name,
      types: fichaOuSlug.types,
      shiny: !!fichaOuSlug.shiny,
      moves: normaliza_moves(fichaOuSlug.moves),
      nature: fichaOuSlug.nature || "",
      item: fichaOuSlug.item || "",
      itemName: fichaOuSlug.itemName || "",
      ivs: normaliza_ivs(fichaOuSlug.ivs),
      evs: normaliza_evs(fichaOuSlug.evs),
    };
  } else {
    time[idx] = {
      id: 0,
      slug: fichaOuSlug,
      name: capitalize(fichaOuSlug),
      types: [],
      shiny: false,
      moves: moves_vazios(),
      nature: "",
      item: "",
      itemName: "",
      ivs: ivs_default(),
      evs: evs_default(),
    };
    await hidrata_slot(idx);
  }
  update_hash();
  pinta_slots();
  pinta_analise();
  pinta_display();
}

document.getElementById("btn-clear").addEventListener("click", () => {
  time = empty_team();
  displayIdAtual = null;
  update_hash();
  pinta_slots();
  pinta_analise();
  pinta_display();
});

bind_inject_controls({
  btn: btnInjectSave,
  input: injectSaveFile,
  getTeam: () => time,
  getGameSlug: () => jogoSel.value,
});

document.getElementById("btn-copy").addEventListener("click", async () => {
  update_hash();
  try {
    await navigator.clipboard.writeText(location.href);
    const b = document.getElementById("btn-copy");
    b.textContent = t("copied");
    setTimeout(() => (b.textContent = t("copy_link")), 1200);
  } catch (_) {}
});

document.getElementById("btn-rand").addEventListener("click", async () => {
  time = empty_team();
  const pool = pool_do_jogo();
  const ids = ids_pool_atual();
  const base =
    pool.length > 0
      ? pool
      : ids
        ? [...ids].map((id) => ({ id, slug: String(id), name: String(id) }))
        : Array.from({ length: 151 }, (_, i) => ({
            id: i + 1,
            slug: String(i + 1),
            name: String(i + 1),
          }));
  for (let i = 0; i < 6; i++) {
    const pick = base[Math.floor(Math.random() * base.length)];
    time[i] = {
      id: pick.id,
      slug: pick.slug || pick.id,
      name: pick.name,
      types: [],
      shiny: false,
      moves: moves_vazios(),
      nature: "",
      item: "",
      itemName: "",
      ivs: ivs_default(),
      evs: evs_default(),
    };
    await hidrata_slot(i);
  }
  update_hash();
  pinta_slots();
  pinta_analise();
  pinta_display();
});

btnAnalise.addEventListener("click", () => {
  const on = analiseRoot.classList.toggle("hidden");
  btnAnalise.textContent = on ? t("show_analysis") : t("hide_analysis");
  if (!on) pinta_analise();
});

displayNome?.addEventListener("input", () => {
  persiste_jogo_atual();
  pinta_stack();
});
displayNota?.addEventListener("input", () => {
  persiste_jogo_atual();
  pinta_stack();
});
displaySprite?.addEventListener("change", () => {
  persiste_jogo_atual();
  pinta_stack();
});

document.getElementById("btn-save-display")?.addEventListener("click", () => {
  const mons = time.filter(Boolean);
  if (!mons.length) {
    displayStatus.textContent = t("display_need_team");
    return;
  }
  const saved = salva_display(monta_display_payload());
  displayIdAtual = saved.id;
  persiste_jogo_atual();
  displayStatus.textContent = t("display_saved");
  setTimeout(() => {
    if (displayStatus.textContent === t("display_saved")) displayStatus.textContent = "";
  }, 1800);
});

document.getElementById("btn-dl-display")?.addEventListener("click", () => {
  const mons = time.filter(Boolean);
  if (!mons.length) {
    displayStatus.textContent = t("display_need_team");
    return;
  }
  baixa_html(monta_display_payload());
  displayStatus.textContent = t("display_downloaded");
  setTimeout(() => {
    if (displayStatus.textContent === t("display_downloaded")) displayStatus.textContent = "";
  }, 1800);
});

function pinta_grade() {
  const q = (busca.value || "").trim().toLowerCase();
  const ordem = ordem_pool_atual();
  let lista = pool_do_jogo();
  if (q) {
    lista = lista.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.nameJa && p.nameJa.includes(q)) ||
        (p.nameRoma && p.nameRoma.toLowerCase().includes(q)) ||
        String(p.id) === q ||
        (ordem && String(ordem.get(p.id)) === q) ||
        p.slug.includes(q)
    );
  }
  grade.innerHTML = lista
    .map((p) =>
      cell_html(p.id, p.name, {
        types: p.types || [],
        dexNum: ordem?.get(p.id),
      })
    )
    .join("");
  const total = ids_pool_atual()?.size || lista.length;
  const extra = national_on()
    ? ` · Nat. #${cap_nacional_do_jogo(jogoSel.value)}`
    : "";
  status.textContent = `${t("pool_for_game")}: ${lista.length}/${total}${extra}`;
  grade.querySelectorAll(".poke-card").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const hit = catalogo.find((c) => c.id == id);
      await add_mon({
        id: Number(id),
        slug: hit?.slug || id,
        name: hit?.name || btn.title,
        types: hit?.types || [],
      });
      const i = time.findIndex((x) => x && (x.id == id || x.slug == id));
      if (i >= 0) await hidrata_slot(i);
      pinta_slots();
      pinta_analise();
      pinta_display();
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      abre_ficha(btn.dataset.id, { onPick: add_mon });
    });
  });
}

busca.addEventListener("input", pinta_grade);
planNational?.addEventListener("change", () => {
  sync_plan_dex();
  limpa_time_fora_do_jogo();
  pinta_slots();
  pinta_analise();
  pinta_grade();
  pinta_display();
});
planDex?.addEventListener("change", () => {
  limpa_time_fora_do_jogo();
  pinta_slots();
  pinta_analise();
  pinta_grade();
  pinta_display();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== busca) {
    e.preventDefault();
    busca.focus();
  }
});

(async () => {
  parse_hash();
  apply_snapshot(teamsByGame[jogoSel.value], jogoSel.value);
  sync_plan_dex({ reset: true });
  pinta_slots();
  pinta_stack();
  try {
    await carrega_slim();
    catalogo = slim_como_catalogo();
    for (let i = 0; i < 6; i++) await hidrata_slot(i);
    limpa_time_fora_do_jogo();
    persiste_jogo_atual();
    pinta_slots();
    pinta_analise();
    pinta_display();
    update_hash();
    pinta_grade();
  } catch (err) {
    console.error(err);
    status.textContent = t("err_load");
  }
})();
