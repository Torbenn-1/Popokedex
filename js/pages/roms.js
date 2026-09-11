/** Página: editor local de saves / ROMs. */

import { monta_shell } from "../boot.js";
import { t } from "../i18n.js";
import { inspect_buffer, fmt_bytes, hex_at } from "../save_inspect.js";
import { art3d_url, artwork_url, sprite_url } from "../buceta_api.js";
import {
  ensure_slim,
  load_builder_team_for_gen,
  write_party,
  download_bytes,
  patched_name,
  move_slug_from_id,
  resolve_move_token,
} from "../save/write.js";
import { NATURES, rotulo_nature } from "../../data/natures_items.js";
import { normaliza_ivs, normaliza_evs, ivs_default, evs_default } from "../team_stats.js";
import { normaliza_moves } from "../team_moves.js";
import {
  html_trainer_card,
  baixa_trainer_card_html,
  baixa_trainer_card_png,
  badge_list,
} from "../trainer_card.js";

monta_shell({ active: "roms" });

/** @type {'saves'|'roms'} */
let mode = "saves";
/** @type {Uint8Array|null} */
let bytes = null;
/** @type {string} */
let fileName = "";
/** @type {ReturnType<typeof inspect_buffer>|null} */
let report = null;
/** @type {string} */
let view = "overview";
let hexStart = 0;
/** @type {number} */
let activeBox = 0;

const empty = document.getElementById("roms-empty");
const work = document.getElementById("roms-work");
const drop = document.getElementById("drop-main");
const input = document.getElementById("file-main");
const dropHint = document.getElementById("drop-hint");
const fileNameEl = document.getElementById("file-name");
const fileSub = document.getElementById("file-sub");
const fileChips = document.getElementById("file-chips");
const viewOverview = document.getElementById("view-overview");
const viewParty = document.getElementById("view-party");
const viewBoxes = document.getElementById("view-boxes");
const viewHex = document.getElementById("view-hex");
const viewTools = document.getElementById("view-tools");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function set_mode(next) {
  mode = next;
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.classList.toggle("roms-tab_on", btn.dataset.mode === mode);
  });
  dropHint.textContent = mode === "roms" ? t("roms_rom_accept") : t("roms_save_accept");
  input.accept =
    mode === "roms"
      ? ".gb,.gbc,.gba,.nds,.3ds,.cia,.nsp,.xci,.zip,.7z,application/octet-stream"
      : ".sav,.dsv,.main,.bak,application/octet-stream";
}

function set_view(next) {
  view = next;
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.classList.toggle("roms-subtab_on", btn.dataset.view === view);
  });
  const map = {
    overview: viewOverview,
    party: viewParty,
    boxes: viewBoxes,
    hex: viewHex,
    tools: viewTools,
  };
  Object.entries(map).forEach(([key, el]) => {
    const on = key === view;
    el.classList.toggle("hidden", !on);
    el.hidden = !on;
  });
}

function show_empty() {
  empty.classList.remove("hidden");
  empty.hidden = false;
  work.classList.add("hidden");
  work.hidden = true;
  bytes = null;
  report = null;
  fileName = "";
}

function show_work() {
  empty.classList.add("hidden");
  empty.hidden = true;
  work.classList.remove("hidden");
  work.hidden = false;
}

function chip(text, tone = "") {
  return `<span class="roms-chip${tone ? ` roms-chip_${tone}` : ""}">${esc(text)}</span>`;
}

function art_for(mon) {
  const id = mon?.spriteId || mon?.dexId;
  if (!id) {
    return `<div class="roms-mon__art roms-mon__art_empty" aria-hidden="true"></div>`;
  }
  const shiny = !!mon.shiny;
  const src = art3d_url(id, { shiny });
  const fb = artwork_url(mon.dexId, { shiny }); // official-artwork often only has base
  const fb2 = sprite_url(id, { shiny });
  return `<img class="roms-mon__art${shiny ? " roms-mon__art_shiny" : ""}" src="${src}" alt="" loading="lazy"
    onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${fb2}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${fb}'}">`;
}

function paint_filebar() {
  if (!report) return;
  fileNameEl.textContent = report.name;
  const bits = [fmt_bytes(report.size), report.ext];
  if (report.save?.label) bits.push(report.save.label);
  if (report.rom?.platform) bits.push(report.rom.platform);
  fileSub.textContent = bits.join(" · ");

  const chips = [];
  if (report.save?.label) {
    chips.push(chip(report.save.label, "soft"));
  }
  if (report.save?.checksum) {
    chips.push(
      chip(
        report.save.checksum.ok ? t("roms_ck_ok") : t("roms_ck_bad"),
        report.save.checksum.ok ? "ok" : "bad"
      )
    );
  }
  if (report.rom?.platform && report.rom.platform !== "?") {
    chips.push(chip(report.rom.platform, "soft"));
  }
  if (report.rom?.code) chips.push(chip(report.rom.code));
  fileChips.innerHTML = chips.join("");
}

function paint_overview() {
  if (!report) return;
  const s = report.save;
  const r = report.rom;

  if (r) {
    viewOverview.innerHTML = `
      <div class="roms-overview panel">
        <h2 class="section-title">${t("roms_view_overview")}</h2>
        <dl class="roms-kv">
          <div><dt>${t("roms_rom_title")}</dt><dd>${esc(r.title || "—")}</dd></div>
          <div><dt>${t("roms_rom_platform")}</dt><dd>${esc(r.platform)}</dd></div>
          <div><dt>${t("roms_rom_code")}</dt><dd>${esc(r.code || "—")}</dd></div>
          <div><dt>${t("roms_meta_size")}</dt><dd>${esc(fmt_bytes(report.size))}</dd></div>
        </dl>
        ${
          r.notes?.length
            ? `<p class="muted">${r.notes.map(esc).join(" · ")}</p>`
            : ""
        }
      </div>`;
    return;
  }

  if (!s) {
    viewOverview.innerHTML = `
      <div class="panel">
        <h2 class="section-title">${t("roms_view_overview")}</h2>
        <p class="muted">${t("roms_unknown_body")}</p>
        <dl class="roms-kv">
          <div><dt>${t("roms_format")}</dt><dd>${t("roms_format_unknown")}</dd></div>
          <div><dt>${t("roms_meta_size")}</dt><dd>${esc(fmt_bytes(report.size))} <span class="muted">(${report.size} B)</span></dd></div>
        </dl>
      </div>`;
    return;
  }

  const play =
    s.playtime != null
      ? `${s.playtime.hours}h ${String(s.playtime.minutes).padStart(2, "0")}m ${String(s.playtime.seconds).padStart(2, "0")}s`
      : "—";

  const earned = badge_list(s);
  const badgeBlock = earned.length
    ? `<div class="roms-badges">${earned.map((b) => `<span class="roms-badge-pill">${esc(b)}</span>`).join("")}</div>`
    : s.badgesJohto != null || s.badgesKanto != null
      ? `<p class="muted">${t("roms_badges_g2")}: ${s.badgesJohto ?? 0} Johto · ${s.badgesKanto ?? 0} Kanto</p>`
      : `<p class="muted">—</p>`;

  viewOverview.innerHTML = `
    <div class="roms-tcard-row">
      <div class="roms-tcard-panel">
        <div class="roms-tcard-actions">
          <h2 class="section-title">${t("tcard_title")}</h2>
          <div class="roms-tcard-btns">
            <button type="button" class="btn btn_ghost" id="btn-tcard-html">${t("tcard_download_html")}</button>
            <button type="button" class="btn" id="btn-tcard-png">${t("tcard_download")}</button>
          </div>
        </div>
        <div id="tcard-host">${html_trainer_card(s)}</div>
      </div>
    </div>
    <div class="roms-overview-grid">
      <div class="panel">
        <h2 class="section-title">${t("roms_trainer")}</h2>
        <dl class="roms-kv">
          <div><dt>${t("roms_format")}</dt><dd><strong>${esc(s.label)}</strong></dd></div>
          <div><dt>${t("roms_player")}</dt><dd>${esc(s.player || "—")}</dd></div>
          ${s.rival != null ? `<div><dt>${t("roms_rival")}</dt><dd>${esc(s.rival || "—")}</dd></div>` : ""}
          <div><dt>ID</dt><dd>${s.playerId ?? "—"}</dd></div>
          <div><dt>${t("roms_money")}</dt><dd>₽ ${Number(s.money || 0).toLocaleString()}</dd></div>
          ${s.playtime ? `<div><dt>${t("roms_playtime")}</dt><dd>${esc(play)}</dd></div>` : ""}
          ${s.owned != null ? `<div><dt>${t("roms_dex")}</dt><dd>${s.owned} / ${s.seen}</dd></div>` : ""}
          ${s.activeSlot ? `<div><dt>${t("roms_slot")}</dt><dd>${esc(s.activeSlot)} · #${s.saveIndex}</dd></div>` : ""}
          ${
            s.checksum
              ? `<div><dt>${t("roms_checksum")}</dt><dd class="${s.checksum.ok ? "roms-ok" : "roms-bad"}">${
                  s.checksum.ok ? t("roms_ck_ok") : t("roms_ck_bad")
                }</dd></div>`
              : ""
          }
        </dl>
      </div>
      <div class="panel">
        <h2 class="section-title">${t("roms_badges")}</h2>
        ${badgeBlock}
        <dl class="roms-kv" style="margin-top:1rem">
          <div><dt>${t("roms_meta_size")}</dt><dd>${esc(fmt_bytes(report.size))}</dd></div>
          <div><dt>${t("roms_party_count")}</dt><dd>${s.partyCount ?? s.party?.length ?? 0} / 6</dd></div>
          ${
            s.boxes
              ? `<div><dt>${t("roms_boxes_total")}</dt><dd>${s.boxes.reduce((n, b) => n + b.count, 0)} · ${t("roms_box_current")} ${ (s.currentBox ?? 0) + 1 }</dd></div>`
              : ""
          }
        </dl>
      </div>
    </div>`;

  const host = document.getElementById("tcard-host");
  const cardEl = host?.querySelector(".tcard");
  document.getElementById("btn-tcard-html")?.addEventListener("click", () => {
    baixa_trainer_card_html(s);
  });
  document.getElementById("btn-tcard-png")?.addEventListener("click", () => {
    baixa_trainer_card_png(cardEl, s);
  });
}

function mon_card(m, i, { compact = false } = {}) {
  const title = m.nickname || m.speciesName;
  const iv = m.ivs
    ? m.ivs.spa != null
      ? `HP ${m.ivs.hp} · Atk ${m.ivs.atk} · Def ${m.ivs.def} · Spe ${m.ivs.spe} · SpA ${m.ivs.spa} · SpD ${m.ivs.spd}`
      : `HP ${m.ivs.hp} · Atk ${m.ivs.atk} · Def ${m.ivs.def} · Spe ${m.ivs.spe} · Spc ${m.ivs.spc}`
    : "";
  const stats =
    m.atk != null
      ? `<div class="roms-mon__stats">
          <span>HP ${m.hp}/${m.maxHp}</span>
          <span>Atk ${m.atk}</span>
          <span>Def ${m.def}</span>
          <span>Spe ${m.spe}</span>
          ${m.spa != null ? `<span>SpA ${m.spa}</span><span>SpD ${m.spd}</span>` : `<span>Spc ${m.spc}</span>`}
        </div>`
      : `<div class="roms-mon__stats">
          ${m.hp != null ? `<span>HP ${m.hp}</span>` : ""}
          <span>Lv.${m.level || "?"}</span>
        </div>`;
  return `<article class="roms-mon panel${compact ? " roms-mon_compact" : ""}${m.shiny ? " roms-mon_shiny" : ""}">
    <div class="roms-mon__top">
      ${art_for(m)}
      <div>
        <p class="roms-mon__slot">#${i + 1}${m.shiny ? ` <span class="roms-shiny" title="Shiny">✦</span>` : ""}</p>
        <h3 class="roms-mon__name">${esc(title)}</h3>
        <p class="muted">${esc(m.speciesName)} · Lv.${m.level || "?"}</p>
        <p class="muted">OT ${esc(m.ot || "—")} · ID ${m.otId}</p>
      </div>
    </div>
    ${stats}
    ${iv ? `<p class="roms-mon__ivs muted">${m.ivs?.spa != null ? "IVs" : "DVs"} ${esc(iv)}</p>` : ""}
    <p class="roms-mon__moves muted">${t("roms_moves")}: ${(m.moves || []).map((x) => `#${x}`).join(" · ") || "—"}</p>
  </article>`;
}

function paint_party() {
  const s = report?.save;
  if (!s) {
    viewParty.innerHTML = `<div class="panel muted">${t("roms_party_none")}</div>`;
    return;
  }
  if (!s.party?.length) {
    viewParty.innerHTML = `
      <div class="panel">
        <h2 class="section-title">${t("roms_view_party")}</h2>
        <p class="muted">${t("roms_party_partial")} <strong>${s.partyCount ?? 0}</strong>/6</p>
      </div>`;
    return;
  }

  viewParty.innerHTML = `
    <div class="roms-party">
      ${s.party.map((m, i) => mon_card(m, i)).join("")}
    </div>`;
}

function paint_boxes() {
  const s = report?.save;
  if (!s?.boxes?.length) {
    viewBoxes.innerHTML = `<div class="panel muted">${t("roms_boxes_none")}</div>`;
    return;
  }

  if (activeBox < 0 || activeBox >= s.boxes.length) {
    activeBox = s.currentBox ?? 0;
  }
  const box = s.boxes[activeBox];

  viewBoxes.innerHTML = `
    <div class="roms-boxes">
      <div class="roms-box-tabs">
        ${s.boxes
          .map((b) => {
            const on = b.index === activeBox ? " roms-box-tab_on" : "";
            const cur = b.current ? " roms-box-tab_current" : "";
            return `<button type="button" class="roms-box-tab${on}${cur}" data-box="${b.index}">
              ${esc(b.name)}
              <span class="roms-box-tab__n">${b.count}/${b.capacity}</span>
            </button>`;
          })
          .join("")}
      </div>
      <div class="panel roms-box-head">
        <div>
          <h2 class="section-title" style="margin:0">${esc(box.name)}${box.current ? ` · ${t("roms_box_active")}` : ""}</h2>
          <p class="muted">${box.count} / ${box.capacity} · offset 0x${box.offset.toString(16)}</p>
        </div>
      </div>
      ${
        box.mons.length
          ? `<div class="roms-party">${box.mons.map((m, i) => mon_card(m, i, { compact: true })).join("")}</div>`
          : `<div class="panel muted">${t("roms_box_empty")}</div>`
      }
    </div>`;

  viewBoxes.querySelectorAll("[data-box]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeBox = Number(btn.dataset.box);
      paint_boxes();
    });
  });
}

function paint_hex() {
  if (!bytes) return;
  const lines = hex_at(bytes, hexStart, 512);
  viewHex.innerHTML = `
    <div class="panel roms-hex-panel">
      <div class="roms-hex-toolbar">
        <h2 class="section-title" style="margin:0">${t("roms_view_hex")}</h2>
        <label class="roms-hex-jump">
          <span class="muted">${t("roms_hex_offset")}</span>
          <input id="hex-off" type="text" value="0x${hexStart.toString(16)}" spellcheck="false">
          <button type="button" class="btn btn_ghost" id="hex-go">${t("roms_hex_go")}</button>
        </label>
      </div>
      <pre class="roms-hex">${lines
        .map(
          (l) =>
            `<span class="roms-hex__off">${l.offset.toString(16).padStart(6, "0")}</span>  <span class="roms-hex__bytes">${esc(l.hex)}</span>  <span class="roms-hex__asc">${esc(l.ascii)}</span>`
        )
        .join("\n")}</pre>
      <div class="toolbar">
        <button type="button" class="btn btn_ghost" id="hex-prev" ${hexStart <= 0 ? "disabled" : ""}>${t("roms_hex_prev")}</button>
        <button type="button" class="btn btn_ghost" id="hex-next" ${hexStart + 512 >= bytes.length ? "disabled" : ""}>${t("roms_hex_next")}</button>
      </div>
    </div>`;

  document.getElementById("hex-go")?.addEventListener("click", () => {
    const raw = document.getElementById("hex-off")?.value?.trim() || "0";
    const n = raw.startsWith("0x") ? parseInt(raw, 16) : parseInt(raw, 10);
    if (Number.isFinite(n)) {
      hexStart = Math.max(0, Math.min(bytes.length - 1, n));
      paint_hex();
    }
  });
  document.getElementById("hex-prev")?.addEventListener("click", () => {
    hexStart = Math.max(0, hexStart - 512);
    paint_hex();
  });
  document.getElementById("hex-next")?.addEventListener("click", () => {
    hexStart = Math.min(Math.max(0, bytes.length - 512), hexStart + 512);
    paint_hex();
  });
}

function save_writable() {
  const g = report?.save?.gen;
  return g >= 1 && g <= 5;
}

function refresh_after_write(nextBytes) {
  bytes = nextBytes;
  report = inspect_buffer(bytes, {
    name: fileName,
    kindHint: mode === "roms" ? "rom" : "save",
  });
  activeBox = report.save?.currentBox ?? 0;
  paint_all();
  download_bytes(bytes, patched_name(fileName));
}

async function do_inject() {
  if (!bytes || !save_writable()) {
    alert(t("roms_inject_need_save"));
    return;
  }
  try {
    await ensure_slim();
    const pack = load_builder_team_for_gen(report.save.gen);
    if (!pack.team.length) {
      alert(t("roms_inject_need_team"));
      return;
    }
    const mons = pack.team.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      nickname: p.name,
      shiny: !!p.shiny,
      nature: p.nature || "hardy",
      item: p.item || "",
      ivs: normaliza_ivs(p.ivs),
      evs: normaliza_evs(p.evs),
      moves: normaliza_moves(p.moves),
      level: 50,
    }));
    const next = write_party(bytes, report.save, mons);
    refresh_after_write(next);
    alert(t("roms_inject_ok"));
  } catch (err) {
    console.error(err);
    alert(`${t("roms_inject_err")} ${err?.message || err}`);
  }
}

function editor_mons_from_form(root) {
  const cards = [...root.querySelectorAll("[data-edit-slot]")];
  return cards.map((card) => {
    const dexId = Number(card.dataset.dexId) || 0;
    const slug = card.dataset.slug || "";
    const nick = card.querySelector("[data-nick]")?.value?.trim() || "";
    const level = Number(card.querySelector("[data-level]")?.value) || 50;
    const shiny = !!card.querySelector("[data-shiny]")?.checked;
    const nature = card.querySelector("[data-nature]")?.value || "hardy";
    const item = card.querySelector("[data-item]")?.value?.trim() || "";
    const movesRaw = card.querySelector("[data-moves]")?.value || "";
    const moveToks = movesRaw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    const moves = moveToks.map((tok) => {
      const id = resolve_move_token(tok);
      return id ? { slug: move_slug_from_id(id), id } : null;
    });
    const ivs = { ...ivs_default() };
    const evs = { ...evs_default() };
    for (const k of ["hp", "atk", "def", "spa", "spd", "spe"]) {
      const ivEl = card.querySelector(`[data-iv-${k}]`);
      const evEl = card.querySelector(`[data-ev-${k}]`);
      if (ivEl) ivs[k] = Number(ivEl.value) || 0;
      if (evEl) evs[k] = Number(evEl.value) || 0;
    }
    return {
      id: dexId,
      dexId,
      slug,
      name: nick || slug,
      nickname: nick,
      level,
      shiny,
      nature,
      item,
      ivs: normaliza_ivs(ivs),
      evs: normaliza_evs(evs),
      moves,
    };
  });
}

async function do_apply_edits() {
  if (!bytes || !save_writable()) {
    alert(t("roms_edit_need_save"));
    return;
  }
  const root = viewTools.querySelector("[data-edit-root]");
  if (!root) return;
  try {
    await ensure_slim();
    const mons = editor_mons_from_form(root);
    if (!mons.length) {
      alert(t("roms_edit_empty"));
      return;
    }
    const next = write_party(bytes, report.save, mons);
    refresh_after_write(next);
    alert(t("roms_edit_ok"));
  } catch (err) {
    console.error(err);
    alert(`${t("roms_inject_err")} ${err?.message || err}`);
  }
}

function paint_tools() {
  const hasParty = !!report?.save?.party?.length;
  const hasBoxes = !!report?.save?.boxes?.length;
  const canWrite = save_writable();
  let injectBody = t("roms_tool_inject_body");
  let injectBadge = t("roms_status_soon");
  let injectBadgeOn = false;
  let teamPreview = "";
  if (canWrite) {
    const pack = load_builder_team_for_gen(report.save.gen);
    if (pack.team.length) {
      injectBadge = t("roms_status_ready");
      injectBadgeOn = true;
      injectBody = `${t("roms_inject_preview")} ${pack.team.length} (${esc(pack.gameSlug || "—")}).`;
      teamPreview = `<ol class="roms-inject-list">${pack.team
        .map((p) => `<li>${esc(p.name || p.slug)}</li>`)
        .join("")}</ol>
        <button type="button" class="btn" data-inject>${t("roms_inject_go")}</button>`;
    } else {
      // Feature is live — missing team, not "coming soon"
      injectBadge = t("roms_status_need_team");
      injectBadgeOn = false;
      injectBody = t("roms_inject_need_team");
      teamPreview = `<p class="roms-inject-cta"><a class="btn btn_ghost" href="../plan/">${t(
        "roms_inject_need_team_link"
      )}</a></p>`;
    }
  } else if (report?.save) {
    injectBody = t("roms_inject_need_save");
    injectBadge = t("roms_status_soon");
  } else {
    injectBadge = t("roms_status_ready");
    injectBadgeOn = true;
    injectBody = t("roms_tool_inject_body");
  }

  const gen = report?.save?.gen || 0;
  const modern = gen >= 3;
  let editHtml = `<p class="muted">${t("roms_edit_need_save")}</p>`;
  if (canWrite) {
    const party = report.save.party || [];
    if (!party.length) {
      editHtml = `<p class="muted">${t("roms_edit_empty")}</p>`;
    } else {
      editHtml = `<div data-edit-root class="roms-edit">
        ${party
          .map((m, i) => {
            const moves = (m.moves || [])
              .map((id) => (typeof id === "number" ? move_slug_from_id(id) : id?.slug || ""))
              .filter(Boolean)
              .join(", ");
            // Prefer slug labels when we only have IDs — user can paste slugs
            const iv = m.ivs || ivs_default();
            const ev = m.evs || evs_default();
            const natureOpts = NATURES.map(
              (n) =>
                `<option value="${n.slug}"${n.slug === (m.nature || "hardy") ? " selected" : ""}>${rotulo_nature(n.slug)}</option>`
            ).join("");
            return `<div class="roms-edit-card" data-edit-slot="${i}" data-dex-id="${m.dexId || 0}" data-slug="${esc(m.slug || "")}">
              <strong>#${m.dexId || "?"} ${esc(m.speciesName || m.slug || "")}</strong>
              <label class="roms-edit-field"><span>${t("roms_edit_nick")}</span>
                <input data-nick value="${esc(m.nickname || "")}" maxlength="10" /></label>
              <label class="roms-edit-field"><span>${t("roms_edit_level")}</span>
                <input data-level type="number" min="1" max="100" value="${m.level || 50}" /></label>
              <label class="roms-edit-check"><input data-shiny type="checkbox"${m.shiny ? " checked" : ""}/> ${t("roms_edit_shiny")}</label>
              ${
                modern
                  ? `<label class="roms-edit-field"><span>${t("nature")}</span><select data-nature>${natureOpts}</select></label>
                     <label class="roms-edit-field"><span>${t("held_item")}</span>
                       <input data-item value="${esc(m.item || "")}" placeholder="leftovers" /></label>`
                  : `<input type="hidden" data-nature value="hardy" /><input type="hidden" data-item value="" />`
              }
              <label class="roms-edit-field"><span>${t("roms_edit_moves")}</span>
                <input data-moves value="${esc(moves)}" /></label>
              ${
                modern
                  ? `<div class="roms-edit-stats muted">IV
                      ${["hp", "atk", "def", "spa", "spd", "spe"]
                        .map(
                          (k) =>
                            `<input data-iv-${k} type="number" min="0" max="31" value="${iv[k] ?? (iv.spc != null && k === "spa" ? iv.spc : 31)}" title="IV ${k}" />`
                        )
                        .join("")}
                    </div>
                    <div class="roms-edit-stats muted">EV
                      ${["hp", "atk", "def", "spa", "spd", "spe"]
                        .map(
                          (k) =>
                            `<input data-ev-${k} type="number" min="0" max="252" value="${ev[k] ?? 0}" title="EV ${k}" />`
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </div>`;
          })
          .join("")}
        <button type="button" class="btn" data-apply-edits>${t("roms_edit_apply")}</button>
      </div>`;
    }
  }

  viewTools.innerHTML = `
    <div class="panel">
      <h2 class="section-title">${t("roms_view_tools")}</h2>
      <ul class="roms-tools">
        <li class="roms-tool">
          <div>
            <strong>${t("roms_tool_inspect")}</strong>
            <p class="muted">${t("roms_tool_inspect_body")}</p>
          </div>
          <span class="roms-badge roms-badge_on">${t("roms_status_ready")}</span>
        </li>
        <li class="roms-tool">
          <div>
            <strong>${t("roms_tool_party")}</strong>
            <p class="muted">${hasParty ? t("roms_tool_party_ready") : t("roms_tool_party_body")}</p>
          </div>
          <span class="roms-badge${hasParty ? " roms-badge_on" : ""}">${hasParty ? t("roms_status_ready") : t("roms_status_soon")}</span>
        </li>
        <li class="roms-tool">
          <div>
            <strong>${t("roms_tool_boxes")}</strong>
            <p class="muted">${hasBoxes ? t("roms_tool_boxes_ready") : t("roms_tool_boxes_body")}</p>
          </div>
          <span class="roms-badge${hasBoxes ? " roms-badge_on" : ""}">${hasBoxes ? t("roms_status_ready") : t("roms_status_soon")}</span>
        </li>
        <li class="roms-tool roms-tool_stack">
          <div>
            <strong>${t("roms_tool_inject")}</strong>
            <p class="muted">${injectBody}</p>
            ${teamPreview}
          </div>
          <span class="roms-badge${injectBadgeOn ? " roms-badge_on" : ""}">${injectBadge}</span>
        </li>
        <li class="roms-tool roms-tool_stack">
          <div>
            <strong>${t("roms_tool_rom_patch")}</strong>
            <p class="muted">${t("roms_tool_rom_patch_body")}</p>
            <h3 class="roms-edit-heading">${t("roms_edit_title")}</h3>
            ${editHtml}
          </div>
          <span class="roms-badge${canWrite && hasParty ? " roms-badge_on" : ""}">${
            canWrite && hasParty ? t("roms_status_ready") : t("roms_status_soon")
          }</span>
        </li>
      </ul>
    </div>`;

  viewTools.querySelector("[data-inject]")?.addEventListener("click", () => do_inject());
  viewTools.querySelector("[data-apply-edits]")?.addEventListener("click", () => do_apply_edits());
}

function paint_all() {
  paint_filebar();
  paint_overview();
  paint_party();
  paint_boxes();
  paint_hex();
  paint_tools();
}

async function open_file(file) {
  if (!file) return;
  fileName = file.name;
  const buf = await file.arrayBuffer();
  bytes = new Uint8Array(buf);
  hexStart = 0;
  report = inspect_buffer(bytes, {
    name: fileName,
    kindHint: mode === "roms" ? "rom" : "save",
  });
  activeBox = report.save?.currentBox ?? 0;
  show_work();
  set_view(report.save?.party?.length ? "party" : "overview");
  paint_all();
}

function download_copy() {
  if (!bytes) return;
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName || "file.bin";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

document.querySelectorAll("[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => set_mode(btn.dataset.mode));
});
document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    set_view(btn.dataset.view);
    if (btn.dataset.view === "hex") paint_hex();
  });
});

drop.addEventListener("click", (e) => {
  if (e.target === input) return;
  input.click();
});
input.addEventListener("change", () => {
  const f = input.files?.[0];
  if (f) open_file(f);
});
["dragenter", "dragover"].forEach((ev) => {
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add("roms-drop_over");
  });
});
["dragleave", "drop"].forEach((ev) => {
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove("roms-drop_over");
  });
});
drop.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) open_file(f);
});

document.getElementById("btn-reopen")?.addEventListener("click", () => input.click());
document.getElementById("btn-download")?.addEventListener("click", download_copy);
document.getElementById("btn-close")?.addEventListener("click", () => {
  input.value = "";
  show_empty();
});

set_mode("saves");
show_empty();
