import { monta_shell, capitalize } from "../boot.js";
import { t } from "../i18n.js";
import { sprite_url, art3d_url, artwork_url } from "../buceta_api.js";
import { JOGOS, TIPOS, mult_ataque, dex_cap_do_jogo } from "../../data/jogos.js";
import { abre_ficha, cell_html } from "../cuzin_dex.js";
import {
  carrega_slim,
  slim_como_catalogo,
  slim_por_id,
  slim_por_slug,
  slim_nome,
} from "../slim_dex.js";

monta_shell({ active: "team" });

const LAST_GAME = "caraio_last_game";
const jogoSel = document.getElementById("jogo");
const slotsEl = document.getElementById("slots");
const grade = document.getElementById("grade");
const status = document.getElementById("status");
const busca = document.getElementById("busca-time");
const analiseBox = document.getElementById("analise");
const btnAnalise = document.getElementById("btn-analise");

let catalogo = [];
/** @type {{id:number,slug:string,name:string,types:string[]}[]} */
let time = [null, null, null, null, null, null];
let dragFrom = null;

jogoSel.innerHTML = JOGOS.map(
  (j) => `<option value="${j.slug}">${j.name}</option>`
).join("");

const salvo = localStorage.getItem(LAST_GAME);
if (salvo && JOGOS.some((j) => j.slug === salvo)) jogoSel.value = salvo;

function pool_do_jogo() {
  const cap = dex_cap_do_jogo(jogoSel.value);
  return catalogo.filter((p) => p.id <= cap);
}

jogoSel.addEventListener("change", () => {
  localStorage.setItem(LAST_GAME, jogoSel.value);
  // tira do time quem não existe no dex desse jogo
  const cap = dex_cap_do_jogo(jogoSel.value);
  time = time.map((p) => (p && p.id && p.id > cap ? null : p));
  time = [...time.filter(Boolean), null, null, null, null, null, null].slice(0, 6);
  update_hash();
  pinta_slots();
  pinta_analise();
  pinta_grade();
});

function parse_hash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return;
  const parts = h.split("+").filter(Boolean);
  if (!parts.length) return;
  if (JOGOS.some((j) => j.slug === parts[0])) {
    jogoSel.value = parts[0];
    parts.shift();
  }
  parts.slice(0, 6).forEach((slug, i) => {
    time[i] = { id: 0, slug, name: capitalize(slug), types: [] };
  });
}

function update_hash() {
  const slugs = time.filter(Boolean).map((p) => p.slug);
  const hash = [jogoSel.value, ...slugs].join("+");
  history.replaceState(null, "", "#" + hash);
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
  };
}

function pinta_slots() {
  slotsEl.innerHTML = time
    .map((p, i) => {
      if (!p) {
        return `<div class="slot" data-i="${i}" draggable="true"><div class="muted">${t("empty_slot")}</div></div>`;
      }
      return `<div class="slot slot_full" data-i="${i}" draggable="true">
        <img class="slot__art" src="${art3d_url(p.id || p.slug)}" alt=""
          onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${artwork_url(p.id || p.slug)}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${sprite_url(p.id || p.slug)}'}">
        <div class="slot__name">${p.name}</div>
        <div>${(p.types || []).map((tp) => `<span class="type-pill" style="background:var(--type-${tp})">${tp}</span>`).join("")}</div>
        <button type="button" class="btn btn_ghost" data-rm="${i}" style="margin-top:0.35rem">×</button>
      </div>`;
    })
    .join("");

  slotsEl.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      time[Number(btn.dataset.rm)] = null;
      time = [...time.filter(Boolean), null, null, null, null, null, null].slice(0, 6);
      update_hash();
      pinta_slots();
      pinta_analise();
    });
  });

  slotsEl.querySelectorAll(".slot").forEach((el) => {
    el.addEventListener("dragstart", () => {
      dragFrom = Number(el.dataset.i);
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
    });
  });
}

function pinta_analise() {
  const mons = time.filter(Boolean);
  const def = document.getElementById("defesa");
  const cov = document.getElementById("cobertura");
  if (!mons.length) {
    def.innerHTML = "";
    cov.innerHTML = "";
    return;
  }

  def.innerHTML = TIPOS.map((atk) => {
    let weak = 0;
    let resist = 0;
    for (const m of mons) {
      const mul = mult_ataque(atk, m.types || []);
      if (mul > 1) weak++;
      if (mul < 1) resist++;
    }
    const cls =
      weak >= 2 ? "analysis-cell_weak" : resist >= 2 ? "analysis-cell_resist" : "";
    return `<div class="analysis-cell ${cls}"><strong>${atk}</strong><div>↓${weak} · ↑${resist}</div></div>`;
  }).join("");

  cov.innerHTML = TIPOS.map((defType) => {
    let hits = 0;
    for (const m of mons) {
      for (const atk of m.types || []) {
        if (mult_ataque(atk, [defType]) > 1) hits++;
      }
    }
    return `<div class="analysis-cell"><strong>${defType}</strong><div>×${hits}</div></div>`;
  }).join("");
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
    };
  } else {
    time[idx] = { id: 0, slug: fichaOuSlug, name: capitalize(fichaOuSlug), types: [] };
    await hidrata_slot(idx);
  }
  update_hash();
  pinta_slots();
  pinta_analise();
}

document.getElementById("btn-clear").addEventListener("click", () => {
  time = [null, null, null, null, null, null];
  update_hash();
  pinta_slots();
  pinta_analise();
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
  time = [null, null, null, null, null, null];
  const pool = pool_do_jogo();
  const base =
    pool.length > 0
      ? pool
      : Array.from({ length: Math.min(151, dex_cap_do_jogo(jogoSel.value)) }, (_, i) => ({
          id: i + 1,
          slug: String(i + 1),
          name: String(i + 1),
        }));
  for (let i = 0; i < 6; i++) {
    const pick = base[Math.floor(Math.random() * base.length)];
    time[i] = { id: pick.id, slug: pick.slug || pick.id, name: pick.name, types: [] };
    await hidrata_slot(i);
  }
  update_hash();
  pinta_slots();
  pinta_analise();
});

btnAnalise.addEventListener("click", () => {
  const on = analiseBox.classList.toggle("hidden");
  btnAnalise.textContent = on ? t("show_analysis") : t("hide_analysis");
});

function pinta_grade() {
  const q = (busca.value || "").trim().toLowerCase();
  let lista = pool_do_jogo();
  if (q) {
    lista = lista.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id) === q || p.slug.includes(q)
    );
  }
  grade.innerHTML = lista
    .slice(0, 300)
    .map((p) => cell_html(p.id, p.name))
    .join("");
  const cap = dex_cap_do_jogo(jogoSel.value);
  status.textContent = `${t("pool_for_game")}: ${Math.min(lista.length, 300)}/#${cap}`;
  grade.querySelectorAll(".dex-cell").forEach((btn) => {
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
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      abre_ficha(btn.dataset.id, { onPick: add_mon });
    });
  });
}

busca.addEventListener("input", pinta_grade);
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== busca) {
    e.preventDefault();
    busca.focus();
  }
});

(async () => {
  parse_hash();
  pinta_slots();
  try {
    await carrega_slim();
    catalogo = slim_como_catalogo();
    for (let i = 0; i < 6; i++) await hidrata_slot(i);
    const cap = dex_cap_do_jogo(jogoSel.value);
    time = time.map((p) => (p && p.id && p.id > cap ? null : p));
    time = [...time.filter(Boolean), null, null, null, null, null, null].slice(0, 6);
    pinta_slots();
    pinta_analise();
    update_hash();
    pinta_grade();
  } catch (err) {
    console.error(err);
    status.textContent = t("err_load");
  }
})();
