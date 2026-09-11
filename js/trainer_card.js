/** Trainer Card visual — layout no estilo do card in-game (Gen 1–5). */

import { art3d_url, artwork_url, sprite_url } from "./buceta_api.js";
import { t } from "./i18n.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function theme_class(save) {
  const fmt = String(save?.format || "");
  const gen = save?.gen ?? 0;
  if (gen === 1 || fmt.includes("gen1")) return "tcard_rby";
  if (fmt.includes("crystal") || fmt.includes("gen2")) return "tcard_gsc";
  if (fmt.includes("frlg")) return "tcard_frlg";
  if (fmt.includes("gen3")) return "tcard_rse";
  if (fmt.includes("hgss")) return "tcard_hgss";
  if (fmt.includes("gen4")) return "tcard_dp";
  if (fmt.includes("b2w2") || fmt.includes("gen5-b2")) return "tcard_bw2";
  if (fmt.includes("gen5")) return "tcard_bw";
  return `tcard_g${gen || 1}`;
}

function fmt_money(n) {
  return `₽${Number(n || 0).toLocaleString()}`;
}

function fmt_play(pt) {
  if (!pt) return "0:00";
  const h = Number(pt.hours) || 0;
  const m = String(Number(pt.minutes) || 0).padStart(2, "0");
  return `${h}:${m}`;
}

function fmt_tid(save) {
  if (save.playerId == null) return "00000";
  return String(save.playerId).padStart(5, "0");
}

const REGIONS = {
  kanto: ["Boulder", "Cascade", "Thunder", "Rainbow", "Soul", "Marsh", "Volcano", "Earth"],
  johto: ["Zephyr", "Hive", "Plain", "Fog", "Storm", "Mineral", "Glacier", "Rising"],
  hoenn: ["Stone", "Knuckle", "Dynamo", "Heat", "Balance", "Feather", "Mind", "Rain"],
  sinnoh: ["Coal", "Forest", "Cobble", "Fen", "Relic", "Mine", "Icicle", "Beacon"],
  unova: ["Trio", "Basic", "Insect", "Bolt", "Quake", "Jet", "Freeze", "Legend"],
  unova2: ["Basic", "Toxic", "Insect", "Bolt", "Quake", "Jet", "Legend", "Wave"],
};

/** Abreviações curtas pra medalhas (estilo ícone). */
const BADGE_SHORT = {
  Boulder: "Bo",
  Cascade: "Ca",
  Thunder: "Th",
  Rainbow: "Ra",
  Soul: "So",
  Marsh: "Ma",
  Volcano: "Vo",
  Earth: "Ea",
  Zephyr: "Ze",
  Hive: "Hi",
  Plain: "Pl",
  Fog: "Fo",
  Storm: "St",
  Mineral: "Mi",
  Glacier: "Gl",
  Rising: "Ri",
  Stone: "St",
  Knuckle: "Kn",
  Dynamo: "Dy",
  Heat: "He",
  Balance: "Ba",
  Feather: "Fe",
  Mind: "Mn",
  Rain: "Rn",
  Coal: "Co",
  Forest: "Fr",
  Cobble: "Cb",
  Fen: "Fn",
  Relic: "Re",
  Mine: "Mn",
  Icicle: "Ic",
  Beacon: "Be",
  Trio: "Tr",
  Basic: "Ba",
  Insect: "In",
  Bolt: "Bt",
  Quake: "Qu",
  Jet: "Je",
  Freeze: "Fz",
  Legend: "Lg",
  Toxic: "Tx",
  Wave: "Wv",
};

/**
 * Faixas de badges no card: slots fixos (ganhos / vazios), como no jogo.
 * @returns {{ label?: string, names: string[], earned: Set<string> }[]}
 */
export function badge_tracks(save) {
  if (!save) return [];
  const fmt = String(save.format || "");
  const earned = new Set();

  if (Array.isArray(save.badges)) {
    for (const b of save.badges) earned.add(b);
  }
  if (Array.isArray(save.badgesJohtoNames)) {
    for (const b of save.badgesJohtoNames) earned.add(b);
  }
  if (Array.isArray(save.badgesKantoNames)) {
    for (const b of save.badgesKantoNames) earned.add(b);
  }

  if (save.gen === 1 || fmt.includes("frlg")) {
    return [{ names: REGIONS.kanto, earned }];
  }
  if (save.gen === 2 || fmt.includes("hgss")) {
    // Contagens sem nomes → preenche primeiros N slots
    if (!earned.size) {
      const j = save.badgesJohto ?? 0;
      const k = save.badgesKanto ?? 0;
      REGIONS.johto.slice(0, j).forEach((n) => earned.add(n));
      REGIONS.kanto.slice(0, k).forEach((n) => earned.add(n));
    }
    return [
      { label: "Johto", names: REGIONS.johto, earned },
      { label: "Kanto", names: REGIONS.kanto, earned },
    ];
  }
  if (fmt.includes("gen3") || save.gen === 3) {
    return [{ names: REGIONS.hoenn, earned }];
  }
  if (save.gen === 4) {
    return [{ names: REGIONS.sinnoh, earned }];
  }
  if (fmt.includes("b2w2") || fmt.includes("gen5-b2")) {
    return [{ names: REGIONS.unova2, earned }];
  }
  if (save.gen === 5) {
    return [{ names: REGIONS.unova, earned }];
  }
  // fallback: só os ganhos
  if (earned.size) {
    return [{ names: [...earned], earned }];
  }
  return [{ names: REGIONS.kanto, earned }];
}

/** Lista plana de insígnias obtidas (overview). */
export function badge_list(save) {
  const tracks = badge_tracks(save);
  const out = [];
  for (const tr of tracks) {
    for (const n of tr.names) if (tr.earned.has(n)) out.push(n);
  }
  return out;
}

function star_rank(save) {
  const n = badge_list(save).length;
  // Espelha a ideia do card: mais badges → mais estrelas (cap 5)
  if (n >= 16) return 5;
  if (n >= 12) return 4;
  if (n >= 8) return 3;
  if (n >= 4) return 2;
  if (n >= 1) return 1;
  return 0;
}

function party_sprite(mon, cls = "tcard-mon") {
  const id = mon?.spriteId || mon?.dexId;
  if (!id) return `<span class="${cls} ${cls}_empty" aria-hidden="true"></span>`;
  const shiny = !!mon.shiny;
  const src = sprite_url(id, { shiny });
  const fb = art3d_url(id, { shiny });
  const fb2 = artwork_url(mon.dexId || id, { shiny });
  const tip = esc(mon.nickname || mon.speciesName || "");
  return `<img class="${cls}${shiny ? ` ${cls}_shiny` : ""}" src="${src}" alt="${tip}" title="${tip}" loading="lazy"
    onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${fb}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${fb2}'}">`;
}

function badge_slot(name, on) {
  const short = BADGE_SHORT[name] || String(name).slice(0, 2);
  return `<span class="tcard-medal${on ? " tcard-medal_on" : ""}" title="${esc(name)}" aria-label="${esc(name)}${on ? "" : " (—)"}">
    <span class="tcard-medal__gem" aria-hidden="true"></span>
    <span class="tcard-medal__txt">${esc(short)}</span>
  </span>`;
}

/**
 * Markup do Trainer Card (layout in-game).
 * @param {object} save
 * @param {{ labels?: Record<string,string> }} [opts]
 */
export function html_trainer_card(save, opts = {}) {
  if (!save) return "";
  const L = {
    title: opts.labels?.title ?? t("tcard_title"),
    name: opts.labels?.name ?? t("tcard_name"),
    id: opts.labels?.id ?? t("tcard_idno"),
    money: opts.labels?.money ?? t("tcard_money"),
    dex: opts.labels?.dex ?? t("tcard_pokedex"),
    time: opts.labels?.time ?? t("tcard_time"),
  };

  const theme = theme_class(save);
  const stars = star_rank(save);
  const tracks = badge_tracks(save);
  const party = (save.party || []).slice(0, 6);
  const lead = party.find(Boolean) || null;

  const starHtml = Array.from({ length: 5 }, (_, i) =>
    `<span class="tcard-star${i < stars ? " tcard-star_on" : ""}" aria-hidden="true">★</span>`
  ).join("");

  const dexVal =
    save.owned != null ? String(save.owned) : "—";

  const rows = [
    [L.name, save.player || "—"],
    [L.id, fmt_tid(save)],
    [L.money, fmt_money(save.money)],
    [L.dex, dexVal],
    [L.time, fmt_play(save.playtime)],
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="tcard-line"><span class="tcard-lab">${esc(k)}</span><span class="tcard-val">${esc(v)}</span></div>`
    )
    .join("");

  const badgeRows = tracks
    .map((tr) => {
      const lab = tr.label
        ? `<p class="tcard-badge-lab">${esc(tr.label)}</p>`
        : "";
      const slots = tr.names.map((n) => badge_slot(n, tr.earned.has(n))).join("");
      return `<div class="tcard-badge-row">${lab}<div class="tcard-medals">${slots}</div></div>`;
    })
    .join("");

  const partyStrip = party.length
    ? `<div class="tcard-party" title="${esc(t("roms_party_count"))}">${party
        .concat(Array(Math.max(0, 6 - party.length)).fill(null))
        .slice(0, 6)
        .map((m) => party_sprite(m, "tcard-party__mon"))
        .join("")}</div>`
    : "";

  return `<article class="tcard ${theme}" data-gen="${save.gen ?? ""}" role="img" aria-label="${esc(L.title)} — ${esc(save.player || "")}">
  <header class="tcard-bar">
    <h3 class="tcard-title">${esc(L.title)}</h3>
    <div class="tcard-stars" aria-label="${stars}/5">${starHtml}</div>
  </header>
  <div class="tcard-main">
    <div class="tcard-info">${rowsHtml}</div>
    <div class="tcard-portrait">
      <div class="tcard-portrait__frame">
        ${lead ? party_sprite(lead, "tcard-portrait__img") : `<span class="tcard-portrait__silhouette" aria-hidden="true"></span>`}
      </div>
      <p class="tcard-portrait__cap">${esc(save.label || "")}</p>
    </div>
  </div>
  <div class="tcard-badges">${badgeRows}</div>
  ${partyStrip}
</article>`;
}

/** CSS embutido no HTML de download (espelha app.css .tcard*). */
export function css_trainer_card() {
  return `
.tcard{
  --tc-ink:#202020;--tc-muted:#4a4a4a;--tc-paper:#f0e6c8;--tc-panel:#fff8e7;
  --tc-bar:#c9a227;--tc-bar-ink:#1a1408;--tc-line:#8a7040;--tc-accent:#b8860b;
  --tc-medal:#d0c4a0;--tc-medal-on:#e8c547;--tc-medal-gem:#f5e6a8;
  --tc-star:#cfc3a0;--tc-star-on:#e8b923;
  font-family:"Press Start 2P","Courier New",ui-monospace,monospace;
  width:min(100%,26rem);margin:0 auto;color:var(--tc-ink);
  border:4px solid var(--tc-line);border-radius:6px;overflow:hidden;
  background:var(--tc-paper);
  box-shadow:0 0 0 2px color-mix(in srgb,var(--tc-bar) 50%,#000),0 12px 28px rgba(0,0,0,.22);
  image-rendering:pixelated;
}
.tcard-bar{
  display:flex;align-items:center;justify-content:space-between;gap:.5rem;
  padding:.55rem .75rem;background:linear-gradient(180deg,color-mix(in srgb,var(--tc-bar) 85%,#fff),var(--tc-bar));
  color:var(--tc-bar-ink);border-bottom:3px solid var(--tc-line);
}
.tcard-title{margin:0;font-size:.55rem;letter-spacing:.04em;text-transform:uppercase;font-weight:700;line-height:1.4}
.tcard-stars{display:flex;gap:.12rem;font-size:.7rem;line-height:1;font-family:system-ui,sans-serif}
.tcard-star{color:var(--tc-star);opacity:.45}
.tcard-star_on{color:var(--tc-star-on);opacity:1;text-shadow:0 0 4px color-mix(in srgb,var(--tc-star-on) 50%,transparent)}
.tcard-main{
  display:grid;grid-template-columns:minmax(0,1.35fr) minmax(5.5rem,0.85fr);
  gap:.65rem;padding:.75rem .8rem .55rem;background:var(--tc-panel);
}
.tcard-info{display:grid;gap:.42rem;align-content:start;min-width:0}
.tcard-line{
  display:grid;grid-template-columns:5.2rem minmax(0,1fr);gap:.35rem;
  align-items:baseline;font-size:.52rem;line-height:1.45;
  border-bottom:1px dotted color-mix(in srgb,var(--tc-line) 35%,transparent);
  padding-bottom:.22rem;
}
.tcard-lab{color:var(--tc-muted);font-size:.45rem;letter-spacing:.02em;text-transform:uppercase}
.tcard-val{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tcard-portrait{display:grid;justify-items:center;align-content:start;gap:.35rem}
.tcard-portrait__frame{
  width:5.6rem;height:5.6rem;border:3px solid var(--tc-line);border-radius:4px;
  background:
    repeating-linear-gradient(0deg,transparent,transparent 3px,color-mix(in srgb,var(--tc-line) 8%,transparent) 3px,color-mix(in srgb,var(--tc-line) 8%,transparent) 4px),
    linear-gradient(160deg,color-mix(in srgb,var(--tc-panel) 70%,#fff),color-mix(in srgb,var(--tc-accent) 18%,var(--tc-panel)));
  display:grid;place-items:center;overflow:hidden;
}
.tcard-portrait__img{width:90%;height:90%;object-fit:contain;image-rendering:pixelated}
.tcard-portrait__img_shiny{filter:drop-shadow(0 0 3px #e8b923)}
.tcard-portrait__silhouette{
  width:58%;height:72%;border-radius:40% 40% 28% 28%;
  background:color-mix(in srgb,var(--tc-ink) 22%,transparent);
  clip-path:polygon(50% 8%,78% 28%,78% 55%,68% 55%,72% 92%,28% 92%,32% 55%,22% 55%,22% 28%);
}
.tcard-portrait__cap{margin:0;font-size:.48rem;color:var(--tc-muted);text-align:center;line-height:1.3;max-width:6.2rem}
.tcard-badges{padding:.35rem .7rem .55rem;background:color-mix(in srgb,var(--tc-paper) 88%,var(--tc-accent));border-top:2px solid var(--tc-line)}
.tcard-badge-row{display:grid;gap:.25rem}
.tcard-badge-row + .tcard-badge-row{margin-top:.4rem}
.tcard-badge-lab{margin:0;font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:var(--tc-muted)}
.tcard-medals{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:.28rem}
.tcard-medal{
  aspect-ratio:1;border-radius:50%;border:2px solid color-mix(in srgb,var(--tc-line) 55%,transparent);
  background:radial-gradient(circle at 35% 30%,#eee8d5,var(--tc-medal));
  display:grid;place-items:center;position:relative;opacity:.38;filter:grayscale(.7);
}
.tcard-medal_on{opacity:1;filter:none;border-color:var(--tc-line);background:radial-gradient(circle at 35% 28%,#fff6c8,var(--tc-medal-on));box-shadow:inset 0 -2px 0 rgba(0,0,0,.15),0 1px 2px rgba(0,0,0,.2)}
.tcard-medal__gem{position:absolute;inset:18%;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,var(--tc-medal-gem) 55%,transparent 70%);opacity:.55;pointer-events:none}
.tcard-medal_on .tcard-medal__gem{opacity:.85}
.tcard-medal__txt{position:relative;z-index:1;font-size:.42rem;font-weight:700;letter-spacing:-.02em;line-height:1}
.tcard-party{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.2rem;padding:.35rem .7rem .55rem;border-top:1px dashed color-mix(in srgb,var(--tc-line) 40%,transparent);background:var(--tc-panel)}
.tcard-party__mon{width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:color-mix(in srgb,var(--tc-paper) 60%,transparent);border:1px solid color-mix(in srgb,var(--tc-line) 25%,transparent);border-radius:3px}
.tcard-party__mon_empty{display:block;background:color-mix(in srgb,var(--tc-line) 8%,transparent)}
.tcard-party__mon_shiny{outline:1px solid #e8b923}
.tcard_rby{--tc-paper:#f6e2b8;--tc-panel:#fff1d0;--tc-bar:#c62828;--tc-bar-ink:#fff8f0;--tc-line:#7a1f1f;--tc-accent:#e53935;--tc-medal-on:#ef9a9a;--tc-medal-gem:#ffcdd2;--tc-star-on:#ffd54f}
.tcard_gsc{--tc-paper:#dce6f5;--tc-panel:#eef3fb;--tc-bar:#2f6fed;--tc-bar-ink:#f4f8ff;--tc-line:#1e3a6e;--tc-accent:#5b8def;--tc-medal-on:#90caf9;--tc-medal-gem:#e3f2fd;--tc-star-on:#ffd54f}
.tcard_rse{--tc-paper:#d9eedc;--tc-panel:#eef8f0;--tc-bar:#2e7d4f;--tc-bar-ink:#f2fbf4;--tc-line:#1b4d32;--tc-accent:#43a066;--tc-medal-on:#a5d6a7;--tc-medal-gem:#e8f5e9;--tc-star-on:#ffd54f}
.tcard_frlg{--tc-paper:#f8d9d0;--tc-panel:#ffece6;--tc-bar:#d84315;--tc-bar-ink:#fff5f0;--tc-line:#6d2c14;--tc-accent:#ff7043;--tc-medal-on:#ffab91;--tc-medal-gem:#fbe9e7;--tc-star-on:#ffd54f}
.tcard_dp{--tc-paper:#e4d8f2;--tc-panel:#f3ecfa;--tc-bar:#6a3d9a;--tc-bar-ink:#f8f2ff;--tc-line:#3a2158;--tc-accent:#8e64bf;--tc-medal-on:#ce93d8;--tc-medal-gem:#f3e5f5;--tc-star-on:#ffd54f}
.tcard_hgss{--tc-paper:#f5e4b8;--tc-panel:#fff6df;--tc-bar:#c9a227;--tc-bar-ink:#1a1408;--tc-line:#5a4410;--tc-accent:#e0b93c;--tc-medal-on:#ffe082;--tc-medal-gem:#fff8e1;--tc-star-on:#ffecb3}
.tcard_bw{--tc-paper:#e8e8e8;--tc-panel:#f5f5f5;--tc-bar:#1a1a1a;--tc-bar-ink:#f0f0f0;--tc-line:#000;--tc-accent:#444;--tc-ink:#111;--tc-muted:#555;--tc-medal:#bbb;--tc-medal-on:#fff;--tc-medal-gem:#ddd;--tc-star:#777;--tc-star-on:#fff}
.tcard_bw2{--tc-paper:#e4e8f0;--tc-panel:#eef2f8;--tc-bar:#0d47a1;--tc-bar-ink:#e3f2fd;--tc-line:#0a2a5c;--tc-accent:#1976d2;--tc-medal-on:#90caf9;--tc-medal-gem:#e3f2fd;--tc-star-on:#ffd54f}
`.trim();
}

export function html_pagina_trainer_card(save) {
  const name = save?.player || "trainer";
  const card = html_trainer_card(save);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — Trainer Card · Popokedex</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
html,body{margin:0;min-height:100%;background:#0c1018;color:#e8eef5}
body{padding:1.5rem 1rem 2.5rem;display:grid;place-items:center}
${css_trainer_card()}
</style>
</head>
<body>
${card}
</body>
</html>`;
}

export function baixa_trainer_card_html(save) {
  const html = html_pagina_trainer_card(save);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  const safe = String(save?.player || "trainer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  a.href = URL.createObjectURL(blob);
  a.download = `popokedex-trainer-card-gen${save?.gen || ""}-${safe || "card"}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * Tenta PNG via SVG foreignObject; se falhar, cai no HTML.
 * @param {HTMLElement} el
 * @param {object} save
 */
export async function baixa_trainer_card_png(el, save) {
  if (!el) {
    baixa_trainer_card_html(save);
    return;
  }
  try {
    const rect = el.getBoundingClientRect();
    const w = Math.max(320, Math.ceil(rect.width));
    const h = Math.max(280, Math.ceil(rect.height));
    const clone = el.cloneNode(true);
    clone.querySelectorAll("img").forEach((img) => {
      img.removeAttribute("onerror");
      img.removeAttribute("loading");
    });
    const markup = new XMLSerializer().serializeToString(clone);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${css_trainer_card()}
      .tcard{margin:0;width:${w}px;max-width:none;box-shadow:none}</style>
      ${markup}
    </div>
  </foreignObject>
</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#0c1018";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("toBlob failed");
    const a = document.createElement("a");
    const safe = String(save?.player || "trainer")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    a.href = URL.createObjectURL(png);
    a.download = `popokedex-trainer-card-gen${save?.gen || ""}-${safe || "card"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (_) {
    baixa_trainer_card_html(save);
  }
}
