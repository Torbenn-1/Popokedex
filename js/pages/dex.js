import { monta_shell } from "../boot.js";
import { t } from "../i18n.js";
import { TIPOS, JOGOS, dex_cap_do_jogo } from "../../data/jogos.js";
import { abre_ficha, cell_html, row_html, list_header_html } from "../cuzin_dex.js";
import { capitalize } from "../boot.js";
import { sprite_mode, set_sprite_mode } from "../sprite_mode.js";
import { carrega_slim, slim_como_catalogo } from "../slim_dex.js";

monta_shell({ active: "dex" });

const grade = document.getElementById("grade");
const status = document.getElementById("status");
const busca = document.getElementById("busca");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroJogo = document.getElementById("filtro-gen");

const LAYOUT_KEY = "caraio_dex_layout";
const CHUNK_GRID = 60;
const CHUNK_LIST = 40;

let catalogo = [];
let listaAtual = [];
let mostrado = 0;
let sentinel = null;
let observer = null;
let carregando = false;

function layout_mode() {
  return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid";
}

function set_layout_mode(m) {
  localStorage.setItem(LAYOUT_KEY, m === "list" ? "list" : "grid");
}

function sync_toggles() {
  const sm = sprite_mode();
  const lm = layout_mode();
  document.querySelectorAll("[data-sprite]").forEach((b) => {
    b.classList.toggle("seg__btn_on", b.dataset.sprite === sm);
  });
  document.querySelectorAll("[data-layout]").forEach((b) => {
    b.classList.toggle("seg__btn_on", b.dataset.layout === lm);
  });
  grade.classList.toggle("dex-grid", lm === "grid");
  grade.classList.toggle("dex-list", lm === "list");
}

filtroTipo.innerHTML =
  `<option value="">${t("filter_all")}</option>` +
  TIPOS.map((tp) => `<option value="${tp}">${capitalize(tp)}</option>`).join("");

filtroJogo.innerHTML =
  `<option value="">${t("filter_all")}</option>` +
  JOGOS.map((j) => `<option value="${j.slug}">${j.name}</option>`).join("");

async function monta_catalogo() {
  status.textContent = t("loading");
  await carrega_slim();
  catalogo = slim_como_catalogo();
}

let ids_do_tipo = null;

function atualiza_filtro_tipo() {
  const tipo = filtroTipo.value;
  if (!tipo) {
    ids_do_tipo = null;
    pinta(true);
    return;
  }
  ids_do_tipo = new Set(
    catalogo.filter((p) => (p.types || []).includes(tipo)).map((p) => p.id)
  );
  pinta(true);
}

function filtra() {
  const q = (busca.value || "").trim().toLowerCase();
  const jogo = filtroJogo.value;
  const cap = jogo ? dex_cap_do_jogo(jogo) : 0;
  let lista = catalogo;
  if (q) {
    lista = lista.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.id) === q ||
        p.slug.includes(q.replace(/\s+/g, "-"))
    );
  }
  if (cap) lista = lista.filter((p) => p.id <= cap);
  if (ids_do_tipo) lista = lista.filter((p) => ids_do_tipo.has(p.id));
  return lista;
}

function garante_sentinel() {
  if (sentinel && sentinel.isConnected) return;
  sentinel = document.createElement("div");
  sentinel.className = "dex-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  grade.after(sentinel);

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) carrega_mais();
    },
    { rootMargin: "400px 0px" }
  );
  observer.observe(sentinel);
}

function garante_list_header() {
  if (layout_mode() !== "list") return;
  if (grade.querySelector(".dex-list-head")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = list_header_html();
  grade.prepend(wrap.firstElementChild);
}

function anexa_chunk(slice) {
  const lm = layout_mode();
  if (lm === "list") garante_list_header();
  const wrap = document.createElement("div");
  wrap.innerHTML =
    lm === "list"
      ? slice.map((p) => row_html(p)).join("")
      : slice.map((p) => cell_html(p.id, p.name, { types: p.types })).join("");
  const nodes = [...wrap.children];
  grade.append(...nodes);
  nodes.forEach((btn) => {
    btn.addEventListener("click", () => abre_ficha(btn.dataset.id));
  });
}

async function carrega_mais() {
  if (carregando) return;
  if (mostrado >= listaAtual.length) {
    if (sentinel) sentinel.hidden = true;
    return;
  }
  carregando = true;
  try {
    const chunk = layout_mode() === "list" ? CHUNK_LIST : CHUNK_GRID;
    const slice = listaAtual.slice(mostrado, mostrado + chunk);
    mostrado += slice.length;
    status.textContent = `${mostrado} / ${listaAtual.length}`;
    anexa_chunk(slice);
    if (sentinel) sentinel.hidden = mostrado >= listaAtual.length;
  } finally {
    carregando = false;
    if (mostrado < listaAtual.length && sentinel && !sentinel.hidden) {
      const rect = sentinel.getBoundingClientRect();
      if (rect.top < window.innerHeight + 400) carrega_mais();
    }
  }
}

function pinta(reset = true) {
  listaAtual = filtra();
  sync_toggles();
  if (reset) {
    grade.innerHTML = "";
    mostrado = 0;
    carregando = false;
  }
  status.textContent =
    listaAtual.length === 0 ? "0" : `0 / ${listaAtual.length}`;
  garante_sentinel();
  if (sentinel) sentinel.hidden = false;
  carrega_mais();
}

document.querySelectorAll("[data-sprite]").forEach((btn) => {
  btn.addEventListener("click", () => {
    set_sprite_mode(btn.dataset.sprite);
    pinta(true);
  });
});

document.querySelectorAll("[data-layout]").forEach((btn) => {
  btn.addEventListener("click", () => {
    set_layout_mode(btn.dataset.layout);
    pinta(true);
  });
});

busca.addEventListener("input", () => pinta(true));
filtroTipo.addEventListener("change", atualiza_filtro_tipo);
filtroJogo.addEventListener("change", () => pinta(true));

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== busca) {
    e.preventDefault();
    busca.focus();
  }
});

sync_toggles();

(async () => {
  try {
    await monta_catalogo();
    pinta(true);
  } catch (err) {
    console.error(err);
    status.textContent = t("err_load");
  }
})();
