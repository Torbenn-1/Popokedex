/** Battle stats + EXP helpers for party writes. */

import { TABLES, GROWTH_RATE } from "./experience.js";
import { nature_index } from "./ids.js";
import { NATURES } from "../../data/natures_items.js";

export function exp_at_level(level, speciesId) {
  const lv = Math.max(1, Math.min(100, level | 0));
  const growth = GROWTH_RATE[speciesId] ?? 0;
  const table = TABLES[growth] || TABLES[0];
  return table[lv - 1] >>> 0;
}

function nature_mods(natureSlug) {
  const idx = nature_index(natureSlug);
  const n = NATURES[idx] || NATURES[0];
  return { up: n.up, down: n.down };
}

function apply_nature(stat, key, mods) {
  if (!mods.up && !mods.down) return stat;
  if (mods.up === key) return Math.floor((stat * 110) / 100);
  if (mods.down === key) return Math.floor((stat * 90) / 100);
  return stat;
}

/**
 * Modern (Gen3+) battle stat.
 * @param {'hp'|'atk'|'def'|'spa'|'spd'|'spe'} key
 */
export function calc_stat_modern(key, base, iv, ev, level, natureSlug) {
  const b = base | 0;
  const i = iv | 0;
  const e = Math.floor((ev | 0) / 4);
  const lv = Math.max(1, Math.min(100, level | 0));
  if (key === "hp") {
    if (b === 1) return 1; // Shedinja
    return Math.floor(((2 * b + i + e) * lv) / 100) + lv + 10;
  }
  let s = Math.floor(((2 * b + i + e) * lv) / 100) + 5;
  return apply_nature(s, key, nature_mods(natureSlug));
}

/** Gen1/2 DV-based stat (Spc for Gen1; Gen2 uses spa/spd separately with same DV Spc). */
export function calc_stat_g12(key, base, dv, statExp, level) {
  const b = base | 0;
  const d = dv & 0xf;
  const se = Math.min(0xffff, statExp | 0);
  const sqrt = Math.floor(Math.sqrt(se));
  const lv = Math.max(1, Math.min(100, level | 0));
  if (key === "hp") {
    return Math.floor((((b + d) * 2 + Math.floor(sqrt / 4)) * lv) / 100) + lv + 10;
  }
  return Math.floor((((b + d) * 2 + Math.floor(sqrt / 4)) * lv) / 100) + 5;
}

export function base_stats_from_slim(slimMon) {
  const s = slimMon?.stats || {};
  return {
    hp: s.hp ?? 50,
    atk: s.attack ?? 50,
    def: s.defense ?? 50,
    spa: s["special-attack"] ?? 50,
    spd: s["special-defense"] ?? 50,
    spe: s.speed ?? 50,
    /** Gen1 uses Special = spa in dex_slim */
    spc: s["special-attack"] ?? 50,
  };
}

/** Map competitive IVs (0–31) → Gen1/2 DVs (0–15). */
export function ivs_to_dvs(ivs, shiny) {
  if (shiny) {
    // Classic shiny DV set (Atk varies 2/3/6/7/10/11/14/15 — pick 15)
    return { atk: 15, def: 10, spe: 10, spc: 10, hp: 15 };
  }
  const atk = Math.min(15, Math.max(0, (ivs?.atk ?? 31) >> 1));
  const def = Math.min(15, Math.max(0, (ivs?.def ?? 31) >> 1));
  const spe = Math.min(15, Math.max(0, (ivs?.spe ?? 31) >> 1));
  const spc = Math.min(15, Math.max(0, ((ivs?.spc ?? ivs?.spa ?? 31) >> 1)));
  const hp =
    ((atk & 1) << 3) | ((def & 1) << 2) | ((spe & 1) << 1) | (spc & 1);
  return { atk, def, spe, spc, hp };
}

export function pack_dvs(dvs) {
  return (((dvs.atk & 0xf) << 12) | ((dvs.def & 0xf) << 8) | ((dvs.spe & 0xf) << 4) | (dvs.spc & 0xf)) &
    0xffff;
}

export function pack_iv32(ivs) {
  const hp = (ivs?.hp ?? 31) & 0x1f;
  const atk = (ivs?.atk ?? 31) & 0x1f;
  const def = (ivs?.def ?? 31) & 0x1f;
  const spe = (ivs?.spe ?? 31) & 0x1f;
  const spa = (ivs?.spa ?? 31) & 0x1f;
  const spd = (ivs?.spd ?? 31) & 0x1f;
  return (hp | (atk << 5) | (def << 10) | (spe << 15) | (spa << 20) | (spd << 25)) >>> 0;
}

/** Default move PP (enough for inject; game may rewrite). */
export function default_pp(moveId) {
  if (!moveId) return 0;
  return 20;
}
