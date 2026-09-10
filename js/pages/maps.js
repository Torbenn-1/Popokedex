import { monta_shell, capitalize } from "../boot.js";
import { t } from "../i18n.js";
import { jogo_por_slug } from "../../data/jogos.js";
import { mapa_da_regiao, pokemaps_url } from "../../data/mapa_pins.js";
import { MAP_CARDS, map_card_by_id } from "../../data/map_cards.js";
import { external_link } from "../../data/mapgenie.js";
import {
  pega_regiao,
  pega_location,
  pega_location_area,
  sprite_url,
} from "../buceta_api.js";
import { abre_ficha } from "../cuzin_dex.js";

monta_shell({ active: "maps" });

const picker = document.getElementById("map-picker");
const explorer = document.getElementById("map-explorer");
const cardsEl = document.getElementById("map-cards");
const btnVoltar = document.getElementById("btn-voltar-picker");
const explorerTitle = document.getElementById("explorer-title");
const areasUl = document.getElementById("areas");
const encontros = document.getElementById("encontros");
const buscaArea = document.getElementById("busca-area");
const chkVersao = document.getElementById("filtro-versao");
const mapStage = document.getElementById("map-stage");
const painelTitulo = document.getElementById("painel-titulo");
const painelSub = document.getElementById("painel-sub");
const linkPokemaps = document.getElementById("link-pokemaps");
const hintEl = document.querySelector(".map-hint");

/** @type {{name:string,label:string,loc:string}[]} */
let areasCache = [];
let jogoAtual = null;
/** @type {ReturnType<typeof map_card_by_id>} */
let cardAtual = null;
let mapaMeta = null;
let pinAtivo = null;
/** @type {string[] | null} */
let versoesOverride = null;

/** @type {import("leaflet").Map | null} */
let leafletMap = null;
/** @type {Map<string, import("leaflet").Marker>} */
let leafletMarkers = new Map();
/** @type {Record<string, any>} */
const packCache = {};
/** @type {any} */
let leafletPack = null;

function asset_prefix() {
  return "../assets/maps/";
}

function markers_url(slug) {
  return `../data/maps/${slug}_markers.json`;
}

function atualiza_link_externo() {
  const ext = jogoAtual ? external_link(jogoAtual.slug) : null;
  if (ext?.page) {
    linkPokemaps.href = ext.page;
    linkPokemaps.textContent = t(ext.labelKey || "maps_pokemaps");
  } else {
    linkPokemaps.href = pokemaps_url(jogoAtual);
    linkPokemaps.textContent = t("maps_pokemaps");
  }
}

function pinta_galeria() {
  const rby = MAP_CARDS.filter((c) => c.group === "rby");
  const rest = MAP_CARDS.filter((c) => c.group !== "rby");

  const cardHtml = (c) => `
    <button type="button" class="map-card map-card_${c.tone}" data-card="${c.id}">
      <span class="map-card__art-wrap">
        <img class="map-card__art" src="${asset_prefix()}${c.preview}" alt="" loading="lazy">
      </span>
      <span class="map-card__label">${c.label}</span>
    </button>`;

  cardsEl.innerHTML = `
    <div class="map-cards__row map-cards__row_hero">
      ${rby.map(cardHtml).join("")}
    </div>
    <h2 class="map-cards__section">${t("maps_more_games")}</h2>
    <div class="map-cards__row map-cards__row_grid">
      ${rest.map(cardHtml).join("")}
    </div>`;

  cardsEl.querySelectorAll("[data-card]").forEach((btn) => {
    btn.addEventListener("click", () => abre_card(btn.dataset.card));
  });
}

function mostra_picker() {
  destroi_leaflet();
  jogoAtual = null;
  cardAtual = null;
  versoesOverride = null;
  pinAtivo = null;
  areasCache = [];
  picker.hidden = false;
  explorer.hidden = true;
  document.body.classList.remove("maps-exploring");
}

async function abre_card(cardId) {
  const card = map_card_by_id(cardId);
  if (!card) return;
  const jogo = jogo_por_slug(card.slug);
  if (!jogo) return;

  cardAtual = card;
  jogoAtual = jogo;
  versoesOverride = card.versions || null;
  pinAtivo = null;

  picker.hidden = true;
  explorer.hidden = false;
  document.body.classList.add("maps-exploring");
  explorerTitle.textContent = card.label;
  atualiza_link_externo();
  if (hintEl) hintEl.textContent = t("maps_click_hint");

  await carrega_regiao();
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

function destroi_leaflet() {
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }
  leafletMarkers.clear();
  leafletPack = null;
  mapStage.classList.remove("map-stage-inner_leaflet");
}

async function carrega_pack(slug) {
  if (packCache[slug] !== undefined) return packCache[slug];
  try {
    const res = await fetch(markers_url(slug));
    if (!res.ok) {
      packCache[slug] = null;
      return null;
    }
    packCache[slug] = await res.json();
    return packCache[slug];
  } catch {
    packCache[slug] = null;
    return null;
  }
}

function image_url_from_pack(pack) {
  const rel = String(pack.image || "").replace(/^assets\/maps\//, "");
  if (!rel) return null;
  return `${asset_prefix()}${rel}`;
}

function atualiza_leaflet_pin_ready() {
  if (!leafletMap || !leafletPack) return;
  for (const pin of leafletPack.markers) {
    const marker = leafletMarkers.get(pin.id);
    if (!marker) continue;
    const el = marker.getElement();
    if (!el) continue;
    const tem = areasCache.some((a) =>
      pin.match.some((m) => a.loc.includes(m) || a.name.includes(m))
    );
    el.classList.toggle("rby-pin_ready", tem);
    el.classList.toggle("rby-pin_on", pinAtivo?.id === pin.id);
  }
}

function monta_mapa_leaflet() {
  const pack = leafletPack;
  destroi_leaflet();
  leafletPack = pack;
  if (!pack || typeof L === "undefined") {
    monta_mapa_overview();
    return;
  }

  const imgUrl = image_url_from_pack(pack);
  const w = pack.imageWidth;
  const h = pack.imageHeight;
  if (!imgUrl || !w || !h) {
    monta_mapa_overview();
    return;
  }

  mapStage.classList.add("map-stage-inner_leaflet");
  mapStage.innerHTML = `<div id="map-leaflet" class="map-leaflet" role="application" aria-label="Game map"></div>`;

  const minZ = pack.minZoom ?? -3;
  const maxZ = pack.maxZoom ?? 2;

  leafletMap = L.map("map-leaflet", {
    crs: L.CRS.Simple,
    minZoom: minZ,
    maxZoom: maxZ,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    attributionControl: true,
  });

  const bounds = L.latLngBounds(L.latLng(h, 0), L.latLng(0, w));
  L.imageOverlay(imgUrl, bounds, {
    opacity: 1,
    interactive: false,
    attribution: "pret decomp · Pokémon © Nintendo",
  }).addTo(leafletMap);

  leafletMap.setMaxBounds(bounds.pad(0.08));
  leafletMap.fitBounds(bounds);

  const icon = () =>
    L.divIcon({
      className: "rby-pin",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

  for (const pin of pack.markers) {
    const marker = L.marker(L.latLng(pin.y, pin.x), {
      icon: icon(),
      title: pin.label,
      keyboard: true,
    });
    marker.bindTooltip(pin.label, { direction: "top", offset: [0, -8] });
    marker.on("click", () => seleciona_pin(pin));
    marker.addTo(leafletMap);
    leafletMarkers.set(pin.id, marker);
  }

  atualiza_leaflet_pin_ready();
}

function monta_mapa_overview() {
  destroi_leaflet();
  if (!jogoAtual) {
    mapStage.innerHTML = `<p class="map-empty muted">${t("maps_empty")}</p>`;
    return;
  }

  mapaMeta = mapa_da_regiao(jogoAtual.region);
  const img = mapaMeta?.image ? `${asset_prefix()}${mapaMeta.image}` : null;
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

async function monta_mapa_visual() {
  if (jogoAtual?.slug) {
    const pack = await carrega_pack(jogoAtual.slug);
    if (pack?.markers?.length && pack?.image && pack?.imageWidth && pack?.imageHeight) {
      leafletPack = pack;
      monta_mapa_leaflet();
      return;
    }
  }
  monta_mapa_overview();
}

function seleciona_pin(pin, btn) {
  pinAtivo = pin;

  if (leafletMap) {
    atualiza_leaflet_pin_ready();
    const marker = leafletMarkers.get(pin.id);
    if (marker) leafletMap.panTo(marker.getLatLng(), { animate: true });
  } else {
    mapStage.querySelectorAll(".map-pin").forEach((b) => b.classList.remove("on"));
    btn?.classList.add("on");
  }

  painelTitulo.textContent = pin.label;
  painelSub.textContent = t("maps_lives_here");
  pinta_lista_areas(buscaArea?.value || "");

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

function versoes_ativas() {
  if (versoesOverride?.length) return new Set(versoesOverride);
  return new Set(jogoAtual?.versions || []);
}

async function carrega_regiao() {
  if (!jogoAtual) return;
  pinAtivo = null;
  await monta_mapa_visual();

  painelTitulo.textContent = cardAtual?.label || jogoAtual.name;
  painelSub.textContent = t("maps_loading_n");
  areasUl.innerHTML = `<li class="muted">${t("maps_loading_n")}</li>`;
  encontros.textContent = t("maps_click_hint");
  areasCache = [];
  if (buscaArea) buscaArea.value = "";

  const reg = await pega_regiao(jogoAtual.region);
  const locs = reg.locations || [];

  const BATCH = 8;
  for (let i = 0; i < locs.length; i += BATCH) {
    const slice = locs.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (loc) => {
        try {
          const locData = await pega_location(loc.name);
          for (const a of locData.areas || []) {
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

    if (leafletMap) atualiza_leaflet_pin_ready();
    else if (mapaMeta?.pins) {
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
  if (area) painelTitulo.textContent = area.label;
  encontros.innerHTML = `<p class="muted">${t("loading")}</p>`;
  try {
    const data = await pega_location_area(areaName);
    let mons = data.pokemon_encounters || [];
    const versoes = versoes_ativas();
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

    const pretty = (s) =>
      String(s || "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    encontros.innerHTML = `
      <div class="enc-grid">
        ${mons
          .map((m) => {
            const name = m.pokemon.name;
            const idMatch = m.pokemon.url.match(/\/(\d+)\/?$/);
            const id = idMatch ? idMatch[1] : name;
            const versions = (m.version_details || [])
              .map((v) => pretty(v.version.name))
              .slice(0, 4);
            return `
              <button type="button" class="enc-card" data-id="${id}" title="${capitalize(name)}">
                <img class="enc-card__art" src="${sprite_url(id)}" alt="" loading="lazy" width="56" height="56">
                <span class="enc-card__body">
                  <span class="enc-card__name">${capitalize(name)}</span>
                  <span class="enc-card__vers">${versions.map((v) => `<i>${v}</i>`).join("")}</span>
                </span>
              </button>`;
          })
          .join("")}
      </div>`;

    encontros.querySelectorAll(".enc-card").forEach((cell) => {
      cell.addEventListener("click", () => abre_ficha(cell.dataset.id));
    });
  } catch (err) {
    console.error(err);
    encontros.innerHTML = `<p class="muted">${t("err_load")}</p>`;
  }
}

btnVoltar?.addEventListener("click", () => mostra_picker());

buscaArea?.addEventListener("input", () => {
  if (buscaArea.value.trim()) {
    pinAtivo = null;
    mapStage.querySelectorAll(".map-pin").forEach((b) => b.classList.remove("on"));
    if (leafletMap) atualiza_leaflet_pin_ready();
  }
  pinta_lista_areas(buscaArea.value);
});

chkVersao?.addEventListener("change", () => {
  const on = areasUl.querySelector("button.on");
  if (on) mostra_area(on.dataset.name, on);
});

pinta_galeria();
mostra_picker();
