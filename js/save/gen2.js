/** Gen 2 (G/S/C intl) party + boxes. */

import { SIZE } from "./crypto.js";
import { decode_gen12 } from "./strings.js";
import { national_name, national_slug } from "./national_slugs.js";
import { shiny_from_dvs } from "./shiny.js";
import { apply_unown_fields, unown_form_gen2, UNOWN_DEX } from "./unown.js";

function u8(v, i) {
  return v[i] ?? 0;
}
function u16be(v, i) {
  return (u8(v, i) << 8) | u8(v, i + 1);
}

function list_valid(v, off, max) {
  const count = u8(v, off);
  if (count > max) return false;
  return u8(v, off + 1 + count) === 0xff;
}

function dvs_from(dv) {
  const ivs = {
    atk: (dv >> 12) & 0xf,
    def: (dv >> 8) & 0xf,
    spe: (dv >> 4) & 0xf,
    spc: dv & 0xf,
  };
  ivs.hp =
    ((ivs.atk & 1) << 3) | ((ivs.def & 1) << 2) | ((ivs.spe & 1) << 1) | (ivs.spc & 1);
  return ivs;
}

function parse_mon(v, base, party) {
  const speciesInt = u8(v, base);
  if (!speciesInt) return null;
  const dexId = speciesInt; // Gen2 uses national IDs
  const held = u8(v, base + 1);
  const moves = [u8(v, base + 2), u8(v, base + 3), u8(v, base + 4), u8(v, base + 5)].filter(
    (m) => m > 0
  );
  const otId = u16be(v, base + 6);
  const level = u8(v, base + 0x1f);
  const dv = u16be(v, base + 0x15);
  const ivs = dvs_from(dv);
  const mon = {
    speciesInt,
    dexId,
    slug: national_slug(dexId),
    speciesName: national_name(dexId),
    level,
    moves,
    otId,
    heldItem: held,
    ivs,
    shiny: shiny_from_dvs(ivs),
    boxed: !party,
  };
  if (dexId === UNOWN_DEX) apply_unown_fields(mon, unown_form_gen2(ivs));
  if (party) {
    mon.hp = u16be(v, base + 0x22);
    mon.maxHp = u16be(v, base + 0x24);
    mon.atk = u16be(v, base + 0x26);
    mon.def = u16be(v, base + 0x28);
    mon.spe = u16be(v, base + 0x2a);
    mon.spc = u16be(v, base + 0x2c); // spa in GSC; spd follows
    mon.spd = u16be(v, base + 0x2e);
  } else {
    mon.hp = null;
    mon.maxHp = null;
  }
  return mon;
}

/**
 * Pokémon list (Gen1/2 style).
 * @param {boolean} party
 */
function parse_list(v, off, capacity, party) {
  if (off >= v.length) return { count: 0, mons: [] };
  const raw = u8(v, off);
  if (raw > capacity) return { count: 0, mons: [] };
  const monSize = party ? SIZE.G2_PARTY : SIZE.G2_STORED;
  const speciesBase = off + 1;
  const monBase = off + 1 + capacity + 1;
  const otBase = monBase + capacity * monSize;
  const nickBase = otBase + capacity * 11;
  const mons = [];
  for (let i = 0; i < raw; i++) {
    const speciesList = u8(v, speciesBase + i);
    const mon = parse_mon(v, monBase + i * monSize, party);
    if (!mon) continue;
    if (speciesList && speciesList !== 0xff) {
      mon.speciesInt = speciesList;
      mon.dexId = speciesList;
      mon.slug = national_slug(speciesList);
      mon.speciesName = national_name(speciesList);
    }
    if (mon.dexId === UNOWN_DEX) apply_unown_fields(mon, unown_form_gen2(mon.ivs));
    mon.nickname = decode_gen12(v, nickBase + i * 11);
    mon.ot = decode_gen12(v, otBase + i * 11);
    mons.push(mon);
  }
  return { count: mons.length, mons };
}

const BOX_LIST = 1102;
const BOX_STRIDE = BOX_LIST + 2; // 1104
const BOX_COUNT = 14;
const SPLIT = 7;

/** English GS/C: time played @ 0x2053 (hh, mm, ss, frames). */
const PLAYTIME = 0x2053;

const JOHTO_BADGES = [
  "Zephyr",
  "Hive",
  "Plain",
  "Fog",
  "Storm",
  "Mineral",
  "Glacier",
  "Rising",
];
const KANTO_BADGES = [
  "Boulder",
  "Cascade",
  "Thunder",
  "Rainbow",
  "Soul",
  "Marsh",
  "Volcano",
  "Earth",
];

function box_offset(i) {
  if (i < SPLIT) return 0x4000 + i * BOX_STRIDE;
  return 0x6000 + (i - SPLIT) * BOX_STRIDE;
}

const PROFILES = {
  gs: {
    label: "Gen 2 · Gold/Silver",
    format: "gen2-gs",
    party: 0x288a,
    currentBox: 0x2d6c,
    currentBoxIndex: 0x2724,
    money: 0x23db,
    badges: 0x23e4,
    trainer1: 0x2009,
    ckEnd: 0x2d68,
    ckPos: 0x2d69,
  },
  c: {
    label: "Gen 2 · Crystal",
    format: "gen2-crystal",
    party: 0x2865,
    currentBox: 0x2d10,
    currentBoxIndex: 0x2700,
    money: 0x23dc,
    badges: 0x23e5,
    trainer1: 0x2009,
    ckEnd: 0x2b82,
    ckPos: 0x2d0d,
  },
};

function checksum_ok(v, profile) {
  let sum = 0;
  for (let i = profile.trainer1; i <= profile.ckEnd; i++) sum = (sum + u8(v, i)) & 0xffff;
  const stored = u8(v, profile.ckPos) | (u8(v, profile.ckPos + 1) << 8);
  return { ok: sum === stored, stored, expected: sum };
}

function detect_profile(v) {
  if (list_valid(v, 0x288a, 6) && list_valid(v, 0x2d6c, 20)) return PROFILES.gs;
  if (list_valid(v, 0x2865, 6) && list_valid(v, 0x2d10, 20)) return PROFILES.c;
  return null;
}

export function parse_gen2(v) {
  if (v.length < 0x8000) return null;
  const profile = detect_profile(v);
  if (!profile) return null;
  const checksum = checksum_ok(v, profile);
  // List structure is the ground truth; checksum is advisory.
  const player = decode_gen12(v, profile.trainer1 + 2);
  const partyList = parse_list(v, profile.party, 6, true);
  const currentBox = u8(v, profile.currentBoxIndex) & 0x7f;
  const money =
    (u8(v, profile.money) << 16) | (u8(v, profile.money + 1) << 8) | u8(v, profile.money + 2);
  const johtoByte = u8(v, profile.badges);
  const kantoByte = u8(v, profile.badges + 1);
  const badgesJohtoNames = JOHTO_BADGES.filter((_, i) => johtoByte & (1 << i));
  const badgesKantoNames = KANTO_BADGES.filter((_, i) => kantoByte & (1 << i));
  const badgesJohto = badgesJohtoNames.length;
  const badgesKanto = badgesKantoNames.length;
  const playtime = {
    hours: u8(v, PLAYTIME),
    minutes: u8(v, PLAYTIME + 1),
    seconds: u8(v, PLAYTIME + 2),
  };

  const boxes = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const off = box_offset(i);
    const parsed = parse_list(v, off, 20, false);
    boxes.push({
      index: i,
      name: `Box ${i + 1}`,
      current: i === (currentBox > 13 ? 0 : currentBox),
      count: parsed.count,
      capacity: 20,
      mons: parsed.mons,
      offset: off,
    });
  }

  return {
    gen: 2,
    format: profile.format,
    label: profile.label,
    player,
    playerId: u16be(v, profile.trainer1),
    money,
    badgesJohto,
    badgesKanto,
    badgesJohtoNames,
    badgesKantoNames,
    playtime,
    partyCount: partyList.count,
    party: partyList.mons,
    currentBox: currentBox > 13 ? 0 : currentBox,
    boxes,
    checksum,
  };
}
