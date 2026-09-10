/** Inspeção local de saves/ROMs — leitura no browser. */

import { gen1_slug, gen1_dex_id } from "./gen1_species.js";
import { parse_gen2 } from "./save/gen2.js";
import { parse_gen3 } from "./save/gen3.js";
import { parse_gen4 } from "./save/gen4.js";
import { parse_gen5 } from "./save/gen5.js";
import { shiny_from_dvs } from "./save/shiny.js";

const GEN1_CHAR = (() => {
  const m = {};
  for (let i = 0; i < 26; i++) {
    m[0x80 + i] = String.fromCharCode(65 + i);
    m[0xa0 + i] = String.fromCharCode(97 + i);
  }
  for (let i = 0; i < 10; i++) m[0xf6 + i] = String(i);
  m[0x7f] = " ";
  m[0xe8] = ".";
  m[0xe6] = "?";
  m[0xe7] = "!";
  m[0xf2] = ".";
  m[0x50] = "";
  return m;
})();

const GEN1_BADGE_NAMES = [
  "Boulder",
  "Cascade",
  "Thunder",
  "Rainbow",
  "Soul",
  "Marsh",
  "Volcano",
  "Earth",
];

function u8(v, i) {
  return v[i] ?? 0;
}
function u16be(v, i) {
  return (u8(v, i) << 8) | u8(v, i + 1);
}
function read_bcd(v, i, n) {
  let s = "";
  for (let k = 0; k < n; k++) {
    const b = u8(v, i + k);
    s += ((b >> 4) & 0xf).toString(16);
    s += (b & 0xf).toString(16);
  }
  return parseInt(s, 10) || 0;
}

function decode_gen1_name(v, off, len = 11) {
  let out = "";
  for (let i = 0; i < len; i++) {
    const b = u8(v, off + i);
    if (b === 0x50) break;
    out += GEN1_CHAR[b] ?? "·";
  }
  return out.trim();
}

function count_bits(byte) {
  let n = 0;
  for (let i = 0; i < 8; i++) if (byte & (1 << i)) n++;
  return n;
}

function count_pokedex(v, off) {
  let n = 0;
  for (let i = 0; i < 19; i++) n += count_bits(u8(v, off + i));
  return n;
}

function gen1_checksum_ok(v) {
  let sum = 0;
  for (let i = 0x2598; i <= 0x3522; i++) sum = (sum + u8(v, i)) & 0xff;
  const stored = u8(v, 0x3523);
  const expected = (~sum) & 0xff;
  return { ok: stored === expected, stored, expected };
}

function capitalize_slug(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function parse_gen1_party_mon(v, base) {
  const speciesInt = u8(v, base);
  const slug = gen1_slug(speciesInt);
  const dexId = gen1_dex_id(speciesInt);
  const hp = u16be(v, base + 1);
  const status = u8(v, base + 4);
  const moves = [u8(v, base + 8), u8(v, base + 9), u8(v, base + 10), u8(v, base + 11)].filter(
    (m) => m > 0
  );
  const otId = u16be(v, base + 12);
  const level = u8(v, base + 0x21);
  const maxHp = u16be(v, base + 0x22);
  const atk = u16be(v, base + 0x24);
  const def = u16be(v, base + 0x26);
  const spe = u16be(v, base + 0x28);
  const spc = u16be(v, base + 0x2a);
  const dv = u16be(v, base + 0x1b);
  const ivs = {
    atk: (dv >> 12) & 0xf,
    def: (dv >> 8) & 0xf,
    spe: (dv >> 4) & 0xf,
    spc: dv & 0xf,
  };
  ivs.hp =
    ((ivs.atk & 1) << 3) |
    ((ivs.def & 1) << 2) |
    ((ivs.spe & 1) << 1) |
    (ivs.spc & 1);
  return {
    speciesInt,
    slug,
    dexId,
    speciesName: capitalize_slug(slug) || `ID 0x${speciesInt.toString(16)}`,
    hp,
    maxHp,
    level,
    status,
    moves,
    otId,
    atk,
    def,
    spe,
    spc,
    ivs,
    shiny: shiny_from_dvs(ivs),
  };
}

/** Box mon = 0x21 bytes (sem stats de batalha). Level = BoxLevel. */
function parse_gen1_box_mon(v, base) {
  const speciesInt = u8(v, base);
  if (!speciesInt) return null;
  const slug = gen1_slug(speciesInt);
  const dexId = gen1_dex_id(speciesInt);
  const hp = u16be(v, base + 1);
  const level = u8(v, base + 3);
  const status = u8(v, base + 4);
  const moves = [u8(v, base + 8), u8(v, base + 9), u8(v, base + 10), u8(v, base + 11)].filter(
    (m) => m > 0
  );
  const otId = u16be(v, base + 12);
  const dv = u16be(v, base + 0x1b);
  const ivs = {
    atk: (dv >> 12) & 0xf,
    def: (dv >> 8) & 0xf,
    spe: (dv >> 4) & 0xf,
    spc: dv & 0xf,
  };
  ivs.hp =
    ((ivs.atk & 1) << 3) |
    ((ivs.def & 1) << 2) |
    ((ivs.spe & 1) << 1) |
    (ivs.spc & 1);
  return {
    speciesInt,
    slug,
    dexId,
    speciesName: capitalize_slug(slug) || `ID 0x${speciesInt.toString(16)}`,
    hp,
    maxHp: hp,
    level,
    status,
    moves,
    otId,
    atk: null,
    def: null,
    spe: null,
    spc: null,
    ivs,
    shiny: shiny_from_dvs(ivs),
    boxed: true,
  };
}

const GEN1_BOX_SIZE = 0x462;
const GEN1_BOX_SLOTS = 20;
const GEN1_BOX_MON = 0x21;
const GEN1_CURRENT_BOX = 0x30c0;
const GEN1_CURRENT_BOX_INDEX = 0x284c;

function gen1_box_raw_offset(box) {
  // PKHeX: boxes 0-5 @ 0x4000, boxes 6-11 @ 0x6000
  if (box < 6) return 0x4000 + box * GEN1_BOX_SIZE;
  return 0x6000 + (box - 6) * GEN1_BOX_SIZE;
}

/**
 * Lista de PC Gen 1 (party-like): count + species[20]+FF + mons + OTs + nicks.
 * @param {Uint8Array} v
 * @param {number} off
 */
function parse_gen1_box_list(v, off) {
  if (off + GEN1_BOX_SIZE > v.length) {
    return { count: 0, mons: [] };
  }
  const rawCount = u8(v, off);
  // Contagem inválida = box vazia / lixo, não inventar slots.
  if (rawCount > GEN1_BOX_SLOTS) return { count: 0, mons: [] };
  const count = rawCount;

  const speciesBase = off + 1;
  const monBase = off + 0x16; // after 20 species + 0xFF
  const otBase = monBase + GEN1_BOX_SLOTS * GEN1_BOX_MON;
  const nickBase = otBase + GEN1_BOX_SLOTS * 11;

  const mons = [];
  for (let i = 0; i < count; i++) {
    const speciesList = u8(v, speciesBase + i);
    const mon = parse_gen1_box_mon(v, monBase + i * GEN1_BOX_MON);
    if (!mon) continue;
    // Prefer species from the list header when present
    if (speciesList && speciesList !== 0xff) {
      mon.speciesInt = speciesList;
      mon.slug = gen1_slug(speciesList);
      mon.dexId = gen1_dex_id(speciesList);
      mon.speciesName =
        capitalize_slug(mon.slug) || `ID 0x${speciesList.toString(16)}`;
    }
    mon.nickname = decode_gen1_name(v, nickBase + i * 11);
    mon.ot = decode_gen1_name(v, otBase + i * 11);
    mons.push(mon);
  }
  return { count: mons.length, mons };
}

function parse_gen1_boxes(v) {
  const idxByte = u8(v, GEN1_CURRENT_BOX_INDEX);
  let currentBox = idxByte & 0x7f;
  if (currentBox > 11) currentBox = 0;
  const boxesInitialized = (idxByte & 0x80) !== 0;
  const boxes = [];

  for (let i = 0; i < 12; i++) {
    const useCurrent = i === currentBox;
    const off = useCurrent ? GEN1_CURRENT_BOX : gen1_box_raw_offset(i);
    const parsed = parse_gen1_box_list(v, off);
    boxes.push({
      index: i,
      name: `Box ${i + 1}`,
      current: useCurrent,
      count: parsed.count,
      capacity: GEN1_BOX_SLOTS,
      mons: parsed.mons,
      offset: off,
    });
  }

  return { currentBox, boxesInitialized, boxes };
}

function parse_gen1(v) {
  if (v.length < 0x8000) return null;
  // Gen1 international save is exactly 32 KiB (or padded slightly).
  if (v.length !== 0x8000 && v.length !== 0x8000 + 0x10) {
    // still allow common padded dumps only if checksum passes later
    if (v.length < 0x8000 || v.length > 0x10000) return null;
  }
  const partyCount = u8(v, 0x2f2c);
  if (partyCount > 6) return null;
  const checksum = gen1_checksum_ok(v);
  // Checksum is the ground truth for Gen 1 intl saves.
  if (!checksum.ok) return null;

  const player = decode_gen1_name(v, 0x2598);
  const rival = decode_gen1_name(v, 0x25f6);
  const badgesByte = u8(v, 0x2602);
  const badges = GEN1_BADGE_NAMES.filter((_, i) => badgesByte & (1 << i));
  const money = read_bcd(v, 0x25f3, 3);
  const playerId = u16be(v, 0x2605);
  const owned = count_pokedex(v, 0x25a3);
  const seen = count_pokedex(v, 0x25b6);
  const hours = u8(v, 0x2cee);
  const minutes = u8(v, 0x2cef);
  const seconds = u8(v, 0x2cf0);

  const party = [];
  for (let i = 0; i < partyCount; i++) {
    const monBase = 0x2f2c + 0x08 + i * 0x2c;
    const nick = decode_gen1_name(v, 0x2f2c + 0x152 + i * 11);
    const ot = decode_gen1_name(v, 0x2f2c + 0x110 + i * 11);
    const mon = parse_gen1_party_mon(v, monBase);
    party.push({ ...mon, nickname: nick, ot });
  }

  const boxData = parse_gen1_boxes(v);

  return {
    gen: 1,
    format: "gen1-intl",
    label: "Gen 1 · RBY",
    player,
    rival,
    playerId,
    money,
    badges,
    badgesByte,
    owned,
    seen,
    playtime: { hours, minutes, seconds },
    partyCount,
    party,
    currentBox: boxData.currentBox,
    boxesInitialized: boxData.boxesInitialized,
    boxes: boxData.boxes,
    checksum,
  };
}

/**
 * Identifica o save por tamanho + assinatura (checksum / seções / listas).
 * Sem “chute”: ou casa, ou não.
 */
export function identify_save(bytes) {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const size = v.length;

  // 512 KiB NDS (+ optional .dsv footer) → Gen 4 / Gen 5
  if (size === 0x80000 || size === 0x80000 + 0x2a) {
    const g5 = parse_gen5(v);
    if (g5) return g5;
    const g4 = parse_gen4(v);
    if (g4) return g4;
  }

  // 128 KiB (+ optional RTC) → Gen 3
  if (size === 0x20000 || size === 0x20000 + 0x1000 || (size >= 0x20000 && size <= 0x22000)) {
    const g3 = parse_gen3(v);
    if (g3) return g3;
  }

  // 32 KiB → Gen 1 or Gen 2
  if (size === 0x8000 || (size > 0x7000 && size <= 0x9000)) {
    const g1 = parse_gen1(v);
    if (g1) return g1;
    const g2 = parse_gen2(v);
    if (g2) return g2;
  }

  return null;
}

function probe_rom(v, name) {
  const ext = (name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const out = { kind: "rom", ext, title: "", code: "", platform: "?", notes: [] };

  if (
    v.length >= 0x150 &&
    (ext === ".gb" ||
      ext === ".gbc" ||
      u8(v, 0x143) === 0x80 ||
      u8(v, 0x143) === 0xc0 ||
      u8(v, 0x143) === 0x00)
  ) {
    const titleBytes = [...v.slice(0x134, 0x143)].filter((b) => b >= 0x20 && b < 0x7f);
    const title = String.fromCharCode(...titleBytes).trim();
    if (title.length >= 2 || ext === ".gb" || ext === ".gbc") {
      out.platform = u8(v, 0x143) === 0xc0 || u8(v, 0x143) === 0x80 ? "GBC" : "GB";
      out.title = title;
      out.code = String.fromCharCode(
        ...[...v.slice(0x13f, 0x143)].filter((b) => b >= 0x20 && b < 0x7f)
      );
      out.notes.push(`type 0x${u8(v, 0x147).toString(16)}`);
      out.notes.push(`ROM 0x${u8(v, 0x148).toString(16)}`);
      out.notes.push(`RAM 0x${u8(v, 0x149).toString(16)}`);
      return out;
    }
  }

  if (v.length >= 0xc0) {
    const title = String.fromCharCode(
      ...[...v.slice(0xa0, 0xac)].filter((b) => b >= 0x20 && b < 0x7f)
    ).trim();
    const code = String.fromCharCode(
      ...[...v.slice(0xac, 0xb0)].filter((b) => b >= 0x20 && b < 0x7f)
    );
    if ((ext === ".gba" || /^B[A-Z0-9]{3}$/i.test(code)) && (title || code)) {
      out.platform = "GBA";
      out.title = title;
      out.code = code;
      return out;
    }
  }

  if (v.length >= 0x200) {
    const title = String.fromCharCode(
      ...[...v.slice(0x0, 0xc)].filter((b) => b >= 0x20 && b < 0x7f)
    ).trim();
    const code = String.fromCharCode(
      ...[...v.slice(0xc, 0x10)].filter((b) => b >= 0x20 && b < 0x7f)
    );
    if (ext === ".nds" || (title.length >= 2 && /^[A-Z0-9]{4}$/i.test(code))) {
      out.platform = "NDS";
      out.title = title;
      out.code = code;
      return out;
    }
  }

  out.platform = ext.replace(".", "").toUpperCase() || "?";
  return out;
}

function entropy_sample(v, n = 4096) {
  const take = Math.min(n, v.length);
  const freq = new Array(256).fill(0);
  for (let i = 0; i < take; i++) freq[v[i]]++;
  let h = 0;
  for (const c of freq) {
    if (!c) continue;
    const p = c / take;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 100) / 100;
}

function hex_slice(v, start, len = 256) {
  const end = Math.min(v.length, start + len);
  const lines = [];
  for (let i = start; i < end; i += 16) {
    const chunk = [];
    const ascii = [];
    for (let j = 0; j < 16; j++) {
      if (i + j >= end) {
        chunk.push("  ");
        ascii.push(" ");
      } else {
        const b = v[i + j];
        chunk.push(b.toString(16).padStart(2, "0"));
        ascii.push(b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".");
      }
    }
    lines.push({
      offset: i,
      hex: chunk.join(" "),
      ascii: ascii.join(""),
    });
  }
  return lines;
}

/**
 * @param {Uint8Array} bytes
 * @param {{name?: string, kindHint?: string}} opts
 */
export function inspect_buffer(bytes, opts = {}) {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const name = opts.name || "file";
  const ext = (name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const kindHint = opts.kindHint || "";

  const base = {
    name,
    ext: ext || "—",
    size: v.length,
    entropy: entropy_sample(v),
    hex: hex_slice(v, 0, 256),
  };

  const wantsRom =
    kindHint === "rom" ||
    [".gb", ".gbc", ".gba", ".nds", ".3ds", ".cia", ".nsp", ".xci"].includes(ext);

  if (wantsRom) {
    return { ...base, kind: "rom", rom: probe_rom(v, name), save: null };
  }

  const save = identify_save(v);

  return {
    ...base,
    kind: save
      ? "save"
      : [".sav", ".dsv", ".main", ".bak"].includes(ext)
        ? "save"
        : "unknown",
    save,
    rom: null,
  };
}

export function fmt_bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function hex_at(bytes, start, len = 256) {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return hex_slice(v, Math.max(0, start | 0), len);
}
