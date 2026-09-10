/** Display de time por jogo — preview, HTML autônomo e galeria. */

import { JOGOS, jogo_por_slug } from "../../data/jogos.js";
import { CREATOR_DISPLAYS } from "../../data/creator_displays.js";
import { art3d_url, artwork_url, sprite_url } from "./buceta_api.js";
import { sprite_mode } from "./sprite_mode.js";

const STORE_KEY = "caraio_team_displays_v1";
// TODO(release): tirar localStorage — galeria só CREATOR_DISPLAYS (ver .cursor/rules/team-display-gallery.mdc)

function lista_local() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function grava_lista(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

/**
 * Por enquanto: drafts do criador no localStorage (+ oficiais do arquivo, se houver).
 * No release: só CREATOR_DISPLAYS.
 */
export function lista_displays() {
  const oficiais = Array.isArray(CREATOR_DISPLAYS) ? CREATOR_DISPLAYS : [];
  const locais = lista_local();
  const seen = new Set(oficiais.map((d) => d.id));
  return [...oficiais, ...locais.filter((d) => d?.id && !seen.has(d.id))];
}

export function pega_display(id) {
  return lista_displays().find((x) => x.id === id) || null;
}

export function salva_display(display) {
  const list = lista_local();
  const row = {
    id:
      display.id ||
      `td_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: display.title || "Team",
    game: display.game,
    note: display.note || "",
    sprite: display.sprite === "2d" ? "2d" : "3d",
    team: (display.team || []).map((p) =>
      p
        ? {
            id: p.id,
            slug: p.slug,
            name: p.name,
            types: p.types || [],
            shiny: !!p.shiny,
            nature: p.nature || "",
            item: p.item || "",
            itemName: p.itemName || "",
            ivs: p.ivs || null,
            evs: p.evs || null,
            moves: (p.moves || [])
              .slice(0, 4)
              .map((m) =>
                m
                  ? {
                      slug: m.slug,
                      name: m.name,
                      type: m.type || "",
                    }
                  : null
              ),
          }
        : null
    ),
    created: display.created || Date.now(),
    updated: Date.now(),
  };
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row;
  else list.unshift(row);
  grava_lista(list);
  return row;
}

export function apaga_display(id) {
  grava_lista(lista_local().filter((x) => x.id !== id));
}

/** temas visuais por geração (fallback) e override por jogo */
const THEME_BY_GEN = {
  1: { bg: "#1a2f1a", fg: "#c4e0c4", accent: "#9bbc0f", muted: "#7a9a7a", label: "Kanto" },
  2: { bg: "#1c1a24", fg: "#f0e6c8", accent: "#d4a017", muted: "#9a8f78", label: "Johto" },
  3: { bg: "#0f2430", fg: "#e8f4f0", accent: "#3ecf8e", muted: "#7aa0a8", label: "Hoenn" },
  4: { bg: "#1a1528", fg: "#efe8ff", accent: "#7b6cff", muted: "#9a90b8", label: "Sinnoh" },
  5: { bg: "#101820", fg: "#eef2f6", accent: "#4aa3ff", muted: "#8494a8", label: "Unova" },
  6: { bg: "#201018", fg: "#fff0f4", accent: "#ff5a8a", muted: "#b8909c", label: "Kalos" },
  7: { bg: "#0e2228", fg: "#e8fff6", accent: "#2ee6a8", muted: "#7aaba0", label: "Alola" },
  8: { bg: "#14121c", fg: "#f4f0ff", accent: "#a78bfa", muted: "#958aad", label: "Galar" },
  9: { bg: "#1a120c", fg: "#fff4e8", accent: "#f59e0b", muted: "#b8a080", label: "Paldea" },
};

const THEME_BY_GAME = {
  rby: { bg: "#0d1f0d", fg: "#d8f0d8", accent: "#8bac0f", muted: "#6a8a6a", label: "RBY" },
  frlg: { bg: "#1a1008", fg: "#ffe8d0", accent: "#ff6b35", muted: "#b89070", label: "FRLG" },
  hgss: { bg: "#18141c", fg: "#f5ecd0", accent: "#e8b923", muted: "#a09070", label: "HGSS" },
  oras: { bg: "#081828", fg: "#e8f8ff", accent: "#ef4444", muted: "#7a90a8", label: "ORAS" },
  usum: { bg: "#12081c", fg: "#f5e8ff", accent: "#c084fc", muted: "#9880b0", label: "USUM" },
  swsh: { bg: "#0c0c14", fg: "#f0f0ff", accent: "#60a5fa", muted: "#8888a8", label: "SWSH" },
  bdsp: { bg: "#14101c", fg: "#efe8ff", accent: "#818cf8", muted: "#9088b0", label: "BDSP" },
  sv: { bg: "#1c1008", fg: "#fff7ed", accent: "#f97316", muted: "#b89070", label: "SV" },
};

export function tema_do_jogo(gameSlug) {
  const j = jogo_por_slug(gameSlug);
  return (
    THEME_BY_GAME[gameSlug] ||
    THEME_BY_GEN[j?.gen] ||
    THEME_BY_GEN[9]
  );
}

export function nome_jogo(gameSlug) {
  return jogo_por_slug(gameSlug)?.name || gameSlug;
}

function art_url(id, mode, shiny = false) {
  if (mode === "2d") return sprite_url(id, { shiny });
  return art3d_url(id, { shiny });
}

function art_fallback_attr(id, mode, shiny = false) {
  if (mode === "2d") {
    return `onerror="this.onerror=null;this.src='${artwork_url(id, { shiny })}'"`;
  }
  return `onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${artwork_url(id, { shiny })}'}else{this.onerror=null;this.src='${sprite_url(id, { shiny })}'}"`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function move_list(moves) {
  const list = [...(moves || [])];
  while (list.length < 4) list.push(null);
  const any = list.some(Boolean);
  if (!any) return "";
  return `<ol class="td-moves">${list
    .slice(0, 4)
    .map((m) =>
      m
        ? `<li class="td-move" title="${esc(m.name)}">${esc(m.name)}</li>`
        : `<li class="td-move td-move_empty">—</li>`
    )
    .join("")}</ol>`;
}

function mon_extra(p) {
  const bits = [];
  if (p.nature) bits.push(`<div class="td-meta-line">${esc(p.nature)}</div>`);
  if (p.item || p.itemName) {
    bits.push(
      `<div class="td-meta-line">${esc(p.itemName || p.item)}</div>`
    );
  }
  if (p.evs) {
    const spread = Object.entries(p.evs)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(" / ");
    if (spread) bits.push(`<div class="td-meta-line">${esc(spread)}</div>`);
  }
  return bits.join("") + move_list(p.moves);
}

function type_pills(types) {
  return (types || [])
    .map(
      (tp) =>
        `<span class="td-type" data-type="${esc(tp)}">${esc(tp)}</span>`
    )
    .join("");
}

/** CSS embutido no HTML exportado (+ preview) */
export function css_display() {
  return `
.td-root{box-sizing:border-box;font-family:ui-rounded,"Segoe UI",system-ui,sans-serif;color:var(--td-fg);background:var(--td-bg);border-radius:20px;padding:1.25rem 1.35rem 1.5rem;border:1px solid color-mix(in srgb,var(--td-accent) 35%,transparent);box-shadow:0 12px 40px rgba(0,0,0,.28);max-width:920px;margin:0 auto;position:relative;overflow:hidden}
.td-root *,.td-root *::before,.td-root *::after{box-sizing:border-box}
.td-root::before{content:"";position:absolute;inset:-40% -20% auto auto;width:60%;height:70%;background:radial-gradient(circle,color-mix(in srgb,var(--td-accent) 28%,transparent),transparent 70%);pointer-events:none}
.td-head{position:relative;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.6rem 1rem;margin-bottom:1.1rem;padding-bottom:.85rem;border-bottom:1px solid color-mix(in srgb,var(--td-fg) 12%,transparent)}
.td-title{margin:0;font-size:1.45rem;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.td-meta{margin:0;font-size:.82rem;color:var(--td-muted);font-weight:600}
.td-note{position:relative;margin:0 0 1rem;font-size:.92rem;color:var(--td-muted);line-height:1.4}
.td-grid{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.65rem}
@media(max-width:720px){.td-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.td-mon{background:color-mix(in srgb,var(--td-fg) 6%,transparent);border:1px solid color-mix(in srgb,var(--td-fg) 10%,transparent);border-radius:14px;padding:.65rem .4rem .75rem;text-align:center;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:.35rem;position:relative}
.td-mon_empty{opacity:.45}
.td-mon_shiny{box-shadow:inset 0 0 0 1px color-mix(in srgb,gold 55%,transparent)}
.td-shiny-badge{position:absolute;top:.35rem;right:.35rem;font-size:.65rem;font-weight:800;letter-spacing:.04em;color:gold;text-shadow:0 0 6px rgba(0,0,0,.45)}
.td-art{width:96px;height:96px;object-fit:contain;object-position:center bottom;image-rendering:auto}
.td-root[data-sprite="2d"] .td-art{image-rendering:pixelated}
.td-name{font-size:.78rem;font-weight:700;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-types{display:flex;flex-wrap:wrap;justify-content:center;gap:.2rem}
.td-type{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:.15rem .35rem;border-radius:999px;background:color-mix(in srgb,var(--td-accent) 35%,#000);color:var(--td-fg)}
.td-moves{list-style:none;margin:.15rem 0 0;padding:0;width:100%;display:flex;flex-direction:column;gap:.15rem}
.td-move{font-size:.58rem;font-weight:600;line-height:1.2;padding:.12rem .3rem;border-radius:6px;background:color-mix(in srgb,var(--td-fg) 8%,transparent);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:2px solid color-mix(in srgb,var(--td-accent) 55%,transparent)}
.td-move_empty{opacity:.35}
.td-meta-line{font-size:.58rem;color:var(--td-muted);width:100%;text-align:left;padding:0 .15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-foot{position:relative;margin-top:1rem;font-size:.72rem;color:var(--td-muted);text-align:right}
`.trim();
}

export function html_display_card(display, { forExport = false } = {}) {
  const theme = tema_do_jogo(display.game);
  const mode = display.sprite === "2d" ? "2d" : "3d";
  const team = [...(display.team || [])];
  while (team.length < 6) team.push(null);

  const mons = team
    .map((p) => {
      if (!p?.id && !p?.slug) {
        return `<div class="td-mon td-mon_empty"><div class="td-name">—</div></div>`;
      }
      const id = p.id || p.slug;
      const shiny = !!p.shiny;
      const shinyCls = shiny ? " td-mon_shiny" : "";
      const badge = shiny ? `<span class="td-shiny-badge" title="Shiny">✦</span>` : "";
      return `<div class="td-mon${shinyCls}">
        ${badge}
        <img class="td-art" src="${art_url(id, mode, shiny)}" alt="${esc(p.name)}" ${art_fallback_attr(id, mode, shiny)}>
        <div class="td-name">${esc(p.name || p.slug)}</div>
        <div class="td-types">${type_pills(p.types)}</div>
        ${mon_extra(p)}
      </div>`;
    })
    .join("");

  const note = display.note
    ? `<p class="td-note">${esc(display.note)}</p>`
    : "";

  return `<article class="td-root" data-sprite="${mode}" style="--td-bg:${theme.bg};--td-fg:${theme.fg};--td-accent:${theme.accent};--td-muted:${theme.muted}">
    <header class="td-head">
      <h2 class="td-title">${esc(display.title || "Team")}</h2>
      <p class="td-meta">${esc(nome_jogo(display.game))} · ${esc(theme.label)}</p>
    </header>
    ${note}
    <div class="td-grid">${mons}</div>
    ${forExport ? `<p class="td-foot">Popokedex</p>` : ""}
  </article>`;
}

/** página HTML completa pra download */
export function html_pagina_display(display) {
  const title = display.title || "Team";
  const card = html_display_card(display, { forExport: true });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Popokedex</title>
<style>
html,body{margin:0;min-height:100%;background:#0b0f14;color:#e8eef5}
body{padding:1.5rem 1rem 2.5rem}
${css_display()}
</style>
</head>
<body>
${card}
</body>
</html>`;
}

export function baixa_html(display) {
  const html = html_pagina_display(display);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  const safe = String(display.title || "time")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  a.href = URL.createObjectURL(blob);
  a.download = `popokedex-${display.game || "team"}-${safe || "display"}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function display_do_time_atual({
  game,
  team,
  title,
  note,
  sprite,
  id,
} = {}) {
  return {
    id,
    title: title || `Time ${nome_jogo(game)}`,
    game,
    note: note || "",
    sprite: sprite || sprite_mode(),
    team: (team || []).slice(0, 6).map((p) =>
      p
        ? {
            id: p.id,
            slug: p.slug,
            name: p.name,
            types: p.types || [],
            shiny: !!p.shiny,
            nature: p.nature || "",
            item: p.item || "",
            itemName: p.itemName || "",
            ivs: p.ivs || null,
            evs: p.evs || null,
            moves: (p.moves || []).slice(0, 4).map((m) =>
              m
                ? { slug: m.slug, name: m.name, type: m.type || "" }
                : null
            ),
          }
        : null
    ),
    created: Date.now(),
  };
}

export { JOGOS };
