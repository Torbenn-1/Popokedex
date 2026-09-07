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

function destroi_leaflet() {
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }
  leafletMarkers.clear();
  leafletPack = null;
  mapStage.classList.remove("map-stage-inner_leaflet");
}

function usa_leaflet() {
  return Boolean(jogoAtual && leafletPack?.markers?.length && leafletPack?.tiles);
}

async function carrega_pack(slug) {
  if (packCache[slug]) return packCache[slug];
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

  // CRS.Simple + imageOverlay: lat grows downward (y from top of PNG), lng = x
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

  const southWest = L.latLng(h, 0);
  const northEast = L.latLng(0, w);
  const bounds = L.latLngBounds(southWest, northEast);

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
    // image pixels from top-left → LatLng(y, x)
    const latlng = L.latLng(pin.y, pin.x);
    const marker = L.marker(latlng, {
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
    if (pack?.markers?.length && pack?.tiles) {
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

async function carrega_regiao(slugJogo) {
  const jogo = jogo_por_slug(slugJogo);
  if (!jogo) return;
  jogoAtual = jogo;
  pinAtivo = null;
  atualiza_link_pokemaps();
  await monta_mapa_visual();

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

    if (leafletMap) {
      atualiza_leaflet_pin_ready();
    } else if (mapaMeta?.pins) {
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

sel.addEventListener("change", async () => {
  if (!sel.value) {
    jogoAtual = null;
    pinAtivo = null;
    atualiza_link_pokemaps();
    await monta_mapa_visual();
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

atualiza_link_pokemaps();
