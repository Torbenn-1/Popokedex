import { monta_shell, capitalize } from "../boot.js";
import { t } from "../i18n.js";
import { JOGOS, jogo_por_slug } from "../../data/jogos.js";
import { mapa_da_regiao, pokemaps_url } from "../../data/mapa_pins.js";
import {
  pega_regiao,
  pega_location,
  pega_location_area,
  sprite_url,
} from "../buceta_api.js";
import { abre_ficha } from "../cuzin_dex.js";

monta_shell({ active: "maps" });

const sel = document.getElementById("jogo-mapa");
const areasUl = document.getElementById("areas");
const encontros = document.getElementById("encontros");
const buscaArea = document.getElementById("busca-area");
const chkVersao = document.getElementById("filtro-versao");
const mapStage = document.getElementById("map-stage");
const painelTitulo = document.getElementById("painel-titulo");
const painelSub = document.getElementById("painel-sub");
const linkPokemaps = document.getElementById("link-pokemaps");

sel.innerHTML =
  `<option value="">—</option>` +
  JOGOS.map((j) => `<option value="${j.slug}">${j.name}</option>`).join("");

/** @type {{name:string,label:string,loc:string}[]} */
let areasCache = [];
let jogoAtual = null;
let mapaMeta = null;
let pinAtivo = null;

function asset_prefix() {
  return "../assets/maps/";
}

function atualiza_link_pokemaps() {
  const url = pokemaps_url(jogoAtual);
  linkPokemaps.href = url;
}

function pinta_lista_areas(filtro = "") {
  const q = filtro.trim().toLowerCase();
  let lista = areasCache;
  if (pinAtivo) {
    lista = lista.filter((a) =>
      pinAtivo.match.some((m) => a.loc.includes(m) || a.name.includes(m))
    );
  }
  if (q) lista = lista.filter((a) => a.label.toLowerCase().includes(q));

  if (!lista.length) {
    areasUl.innerHTML = `<li class="muted">${t("maps_empty")}</li>`;
    return;
  }

  areasUl.innerHTML = lista
    .map(
      (a) =>
        `<li><button type="button" data-name="${a.name}">${a.label}</button></li>`
    )
    .join("");

  areasUl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => mostra_area(btn.dataset.name, btn));
  });
}

function monta_mapa_visual() {
  if (!jogoAtual) {
    mapStage.innerHTML = `<p class="map-empty muted">${t("maps_empty")}</p>`;
    return;
  }

  mapaMeta = mapa_da_regiao(jogoAtual.region);
  const img = mapaMeta?.image
    ? `${asset_prefix()}${mapaMeta.image}`
    : null;

  if (!img) {
    mapStage.innerHTML = `
      <div class="region-banner map-fallback">${jogoAtual.name}<br><span class="muted">${t("maps_no_art")}</span></div>`;
    return;
  }

  const pins = (mapaMeta.pins || [])
    .map(
      (p) =>
        `<button type="button" class="map-pin" style="left:${p.x}%;top:${p.y}%" data-pin="${p.id}" title="${p.label}" aria-label="${p.label}"></button>`
    )
    .join("");

  mapStage.innerHTML = `
    <div class="map-board">
      <img class="map-art" src="${img}" alt="${capitalize(jogoAtual.region)} map" draggable="false">
      <div class="map-pins">${pins}</div>
    </div>`;

  mapStage.querySelectorAll(".map-pin").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pin = mapaMeta.pins.find((p) => p.id === btn.dataset.pin);
      if (!pin) return;
      seleciona_pin(pin, btn);
    });
  });
}

function seleciona_pin(pin, btn) {
  pinAtivo = pin;
  mapStage.querySelectorAll(".map-pin").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  painelTitulo.textContent = pin.label;
  painelSub.textContent = t("maps_lives_here");
  pinta_lista_areas(buscaArea?.value || "");

  // auto-abre a primeira area que bater
  const hit = areasCache.find((a) =>
    pin.match.some((m) => a.loc.includes(m) || a.name.includes(m))
  );
  if (hit) {
    const listBtn = areasUl.querySelector(`[data-name="${hit.name}"]`);
    mostra_area(hit.name, listBtn);
  } else {
    encontros.innerHTML = `<p class="muted">${t("no_encounters")}</p>`;
  }
}

async function carrega_regiao(slugJogo) {
  const jogo = jogo_por_slug(slugJogo);
  if (!jogo) return;
  jogoAtual = jogo;
  pinAtivo = null;
  atualiza_link_pokemaps();
  monta_mapa_visual();

  painelTitulo.textContent = jogo.name;
  painelSub.textContent = t("maps_loading_n");
  areasUl.innerHTML = `<li class="muted">${t("maps_loading_n")}</li>`;
  encontros.textContent = t("maps_click_hint");
  areasCache = [];
  if (buscaArea) buscaArea.value = "";

  const reg = await pega_regiao(jogo.region);
  const locs = reg.locations || [];

  const BATCH = 8;
  for (let i = 0; i < locs.length; i += BATCH) {
    const slice = locs.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (loc) => {
        try {
          const L = await pega_location(loc.name);
          for (const a of L.areas || []) {
            areasCache.push({
              name: a.name,
              loc: loc.name,
              label: `${loc.name.replace(/-/g, " ")} · ${a.name.replace(/-/g, " ")}`,
            });
          }
        } catch (_) {}
      })
    );
    areasCache.sort((a, b) => a.label.localeCompare(b.label));
    painelSub.textContent = `${areasCache.length} ${t("maps_areas").toLowerCase()}`;
    // marca pins que já têm area
    if (mapaMeta?.pins) {
      mapStage.querySelectorAll(".map-pin").forEach((btn) => {
        const pin = mapaMeta.pins.find((p) => p.id === btn.dataset.pin);
        if (!pin) return;
        const tem = areasCache.some((a) =>
          pin.match.some((m) => a.loc.includes(m) || a.name.includes(m))
        );
        btn.classList.toggle("map-pin_ready", tem);
      });
    }
    pinta_lista_areas(buscaArea?.value || "");
  }

  if (!areasCache.length) {
    areasUl.innerHTML = `<li class="muted">${t("no_encounters")}</li>`;
  }
  painelSub.textContent = t("maps_click_hint");
}

async function mostra_area(areaName, btn) {
  areasUl.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  btn?.classList.add("on");
  const area = areasCache.find((a) => a.name === areaName);
  if (area) {
    painelTitulo.textContent = area.label;
  }
  encontros.innerHTML = `<p class="muted">${t("loading")}</p>`;
  try {
    const data = await pega_location_area(areaName);
    let mons = data.pokemon_encounters || [];
    const versoes = new Set(jogoAtual?.versions || []);
    const soVersao = chkVersao?.checked && versoes.size;

    if (soVersao) {
      mons = mons
        .map((m) => {
          const details = (m.version_details || []).filter((v) =>
            versoes.has(v.version.name)
          );
          return details.length ? { ...m, version_details: details } : null;
        })
        .filter(Boolean);
    }

    if (!mons.length) {
      encontros.innerHTML = `<p class="muted">${t("no_encounters")}</p>`;
      return;
    }

    painelSub.textContent = `${t("maps_lives_here")} · ${mons.length}`;

    encontros.innerHTML = `
      <div class="dex-grid dex-grid_compact">
        ${mons
          .map((m) => {
            const name = m.pokemon.name;
            const idMatch = m.pokemon.url.match(/\/(\d+)\/?$/);
            const id = idMatch ? idMatch[1] : name;
            const versions = (m.version_details || [])
              .map((v) => v.version.name)
              .slice(0, 3)
              .join(", ");
            return `<button type="button" class="dex-cell" data-id="${id}">
              <img src="${sprite_url(id)}" alt="" loading="lazy" width="64" height="64">
              <span class="dex-cell__name">${capitalize(name)}</span>
              <span class="dex-cell__num">${versions}</span>
            </button>`;
          })
          .join("")}
      </div>`;

    encontros.querySelectorAll(".dex-cell").forEach((cell) => {
      cell.addEventListener("click", () => abre_ficha(cell.dataset.id));
    });
  } catch (err) {
    console.error(err);
    encontros.innerHTML = `<p class="muted">${t("err_load")}</p>`;
  }
}

sel.addEventListener("change", async () => {
  if (!sel.value) {
    jogoAtual = null;
    pinAtivo = null;
    atualiza_link_pokemaps();
    monta_mapa_visual();
    painelTitulo.textContent = t("maps_panel_title");
    painelSub.textContent = t("maps_click_hint");
    areasUl.innerHTML = "";
    encontros.textContent = t("maps_empty");
    return;
  }
  try {
    await carrega_regiao(sel.value);
  } catch (err) {
    console.error(err);
    areasUl.innerHTML = `<li class="muted">${t("err_load")}</li>`;
  }
});

buscaArea?.addEventListener("input", () => {
  // busca limpa filtro de pin se digitar
  if (buscaArea.value.trim()) {
    pinAtivo = null;
    mapStage.querySelectorAll(".map-pin").forEach((b) => b.classList.remove("on"));
  }
  pinta_lista_areas(buscaArea.value);
});

chkVersao?.addEventListener("change", () => {
  const on = areasUl.querySelector("button.on");
  if (on) mostra_area(on.dataset.name, on);
});

atualiza_link_pokemaps();
