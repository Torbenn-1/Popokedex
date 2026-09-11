/** Análise visual do time — defesa + cobertura por golpes. */

import { TIPOS, mult_ataque, rotulo_tipo } from "../data/jogos.js";
import { t } from "./i18n.js";

function tipos_ofensivos(mon) {
  const moves = (mon.moves || []).filter(Boolean);
  if (moves.length) {
    return [...new Set(moves.map((m) => m.type).filter(Boolean))];
  }
  return mon.types || [];
}

function score_defesa(mons, atk) {
  let weak = 0;
  let resist = 0;
  let immune = 0;
  for (const m of mons) {
    const mul = mult_ataque(atk, m.types || []);
    if (mul === 0) immune++;
    else if (mul > 1) weak++;
    else if (mul < 1) resist++;
  }
  return { weak, resist, immune };
}

function score_cobertura(mons, defType) {
  let superHits = 0;
  let neutral = 0;
  let blocked = 0;
  for (const m of mons) {
    let best = 0;
    for (const atk of tipos_ofensivos(m)) {
      const mul = mult_ataque(atk, [defType]);
      if (mul > best) best = mul;
    }
    if (best > 1) superHits++;
    else if (best === 0) blocked++;
    else if (best > 0) neutral++;
  }
  return { superHits, neutral, blocked };
}

function bar_row({ label, type, value, max, tone }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `<div class="ana-bar" data-type="${type || ""}">
    <div class="ana-bar__label">
      <span class="type-pill ana-bar__pill" style="background:var(--type-${type || "normal"})">${rotulo_tipo(label || type)}</span>
      <strong>${value}</strong>
    </div>
    <div class="ana-bar__track">
      <span class="ana-bar__fill ana-bar__fill_${tone}" style="width:${pct}%"></span>
    </div>
  </div>`;
}

function radar_svg(values, { size = 200, color = "var(--accent)" } = {}) {
  const n = values.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const max = Math.max(1, ...values.map((v) => v.value));

  const pt = (i, ratio) => {
    const ang = (-Math.PI / 2) + (i / n) * Math.PI * 2;
    return [
      cx + Math.cos(ang) * r * ratio,
      cy + Math.sin(ang) * r * ratio,
    ];
  };

  const rings = [0.33, 0.66, 1]
    .map((ratio) => {
      const pts = values
        .map((_, i) => pt(i, ratio).join(","))
        .join(" ");
      return `<polygon points="${pts}" class="ana-radar__ring"/>`;
    })
    .join("");

  const axes = values
    .map((_, i) => {
      const [x, y] = pt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="ana-radar__axis"/>`;
    })
    .join("");

  const poly = values
    .map((v, i) => pt(i, v.value / max).join(","))
    .join(" ");

  const labels = values
    .map((v, i) => {
      const [x, y] = pt(i, 1.18);
      return `<text x="${x}" y="${y}" class="ana-radar__label" text-anchor="middle" dominant-baseline="middle">${v.label}</text>`;
    })
    .join("");

  return `<svg class="ana-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    ${rings}${axes}
    <polygon points="${poly}" class="ana-radar__area" style="fill:${color}"/>
    ${labels}
  </svg>`;
}

function chips_resumo(items, tone) {
  if (!items.length) return `<span class="muted">—</span>`;
  return items
    .map(
      (tp) =>
        `<span class="type-pill ana-chip ana-chip_${tone}" style="background:var(--type-${tp})">${rotulo_tipo(tp)}</span>`
    )
    .join("");
}

/**
 * Renderiza painel completo de análise.
 * @param {HTMLElement} root
 * @param {object[]} time
 */
export function pinta_analise_Rica(root, time) {
  const mons = (time || []).filter(Boolean);
  if (!root) return;
  if (!mons.length) {
    root.innerHTML = "";
    return;
  }

  const defScores = TIPOS.map((tp) => ({
    type: tp,
    ...score_defesa(mons, tp),
  }));
  const covScores = TIPOS.map((tp) => ({
    type: tp,
    ...score_cobertura(mons, tp),
  }));

  const holes = covScores.filter((c) => c.superHits === 0).map((c) => c.type);
  const walls = defScores.filter((d) => d.weak >= 3).map((d) => d.type);
  const resists = defScores
    .filter((d) => d.resist + d.immune >= 3)
    .map((d) => d.type);
  const covered = covScores.filter((c) => c.superHits >= 2).map((c) => c.type);

  const moveTypes = {};
  for (const m of mons) {
    for (const mv of m.moves || []) {
      if (!mv?.type) continue;
      moveTypes[mv.type] = (moveTypes[mv.type] || 0) + 1;
    }
  }
  const moveEntries = Object.entries(moveTypes).sort((a, b) => b[1] - a[1]);
  const maxMove = Math.max(1, ...moveEntries.map(([, n]) => n));

  const radarCov = covScores.map((c) => ({
    label: rotulo_tipo(c.type),
    value: c.superHits,
  }));
  const radarDef = defScores.map((d) => ({
    label: rotulo_tipo(d.type),
    value: d.resist + d.immune,
  }));

  const maxWeak = Math.max(1, ...defScores.map((d) => d.weak));
  const maxSuper = Math.max(1, ...covScores.map((c) => c.superHits));

  const defSorted = [...defScores].sort((a, b) => b.weak - a.weak || a.type.localeCompare(b.type));
  const covSorted = [...covScores].sort((a, b) => a.superHits - b.superHits || a.type.localeCompare(b.type));

  root.innerHTML = `
    <div class="ana-board">
      <div class="ana-summary">
        <div class="ana-card">
          <h4>${t("ana_holes")}</h4>
          <div class="ana-chips">${chips_resumo(holes, "bad")}</div>
          <p class="muted ana-note">${t("ana_holes_note")}</p>
        </div>
        <div class="ana-card">
          <h4>${t("ana_walls")}</h4>
          <div class="ana-chips">${chips_resumo(walls, "bad")}</div>
          <p class="muted ana-note">${t("ana_walls_note")}</p>
        </div>
        <div class="ana-card">
          <h4>${t("ana_resists")}</h4>
          <div class="ana-chips">${chips_resumo(resists, "ok")}</div>
          <p class="muted ana-note">${t("ana_resists_note")}</p>
        </div>
        <div class="ana-card">
          <h4>${t("ana_covered")}</h4>
          <div class="ana-chips">${chips_resumo(covered, "ok")}</div>
          <p class="muted ana-note">${t("ana_covered_note")}</p>
        </div>
      </div>

      <div class="ana-radars">
        <div class="ana-card ana-card_chart">
          <h4>${t("ana_radar_cov")}</h4>
          ${radar_svg(radarCov, { color: "color-mix(in srgb, var(--accent) 55%, transparent)" })}
        </div>
        <div class="ana-card ana-card_chart">
          <h4>${t("ana_radar_def")}</h4>
          ${radar_svg(radarDef, { color: "color-mix(in srgb, var(--ok, #2f9e44) 50%, transparent)" })}
        </div>
      </div>

      <div class="ana-cols">
        <div class="ana-card">
          <h4>${t("defense")}</h4>
          <p class="muted ana-note">${t("ana_def_note")}</p>
          <div class="ana-bars">
            ${defSorted
              .map((d) =>
                bar_row({
                  label: d.type,
                  type: d.type,
                  value: d.weak,
                  max: maxWeak,
                  tone: d.weak >= 3 ? "bad" : d.weak >= 2 ? "warn" : "ok",
                })
              )
              .join("")}
          </div>
        </div>
        <div class="ana-card">
          <h4>${t("coverage")}</h4>
          <p class="muted ana-note">${t("ana_cov_note")}</p>
          <div class="ana-bars">
            ${covSorted
              .map((c) =>
                bar_row({
                  label: c.type,
                  type: c.type,
                  value: c.superHits,
                  max: maxSuper,
                  tone: c.superHits === 0 ? "bad" : c.superHits >= 2 ? "ok" : "warn",
                })
              )
              .join("")}
          </div>
        </div>
      </div>

      ${
        moveEntries.length
          ? `<div class="ana-card">
              <h4>${t("ana_move_types")}</h4>
              <p class="muted ana-note">${t("ana_move_types_note")}</p>
              <div class="ana-bars">
                ${moveEntries
                  .map(([tp, n]) =>
                    bar_row({
                      label: tp,
                      type: tp,
                      value: n,
                      max: maxMove,
                      tone: "ok",
                    })
                  )
                  .join("")}
              </div>
            </div>`
          : `<div class="ana-card"><p class="muted">${t("ana_no_moves")}</p></div>`
      }
    </div>
  `;
}
