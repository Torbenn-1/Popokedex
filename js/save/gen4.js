/** Gen 4 (DP / Pt / HGSS) party + boxes. */

import {
  SIZE,
  decrypt_if_encrypted45,
  crc16_ccitt,
  u16le,
  u32le,
} from "./crypto.js";
import { decode_gen4 } from "./strings.js";
import { national_name, national_slug } from "./national_slugs.js";
import { shiny_from_pid } from "./shiny.js";
import { level_from_exp } from "./experience.js";
import { apply_unown_fields, UNOWN_DEX } from "./unown.js";

const PARTITION = 0x40000;
const MAGIC_INTL = 0x20060623;
const MAGIC_KOR = 0x20070903;

const SINNOH_BADGES = [
  "Coal",
  "Forest",
  "Cobble",
  "Fen",
  "Relic",
  "Mine",
  "Icicle",
  "Beacon",
];
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

/** Relative to trainer1: badges +0x1a, playtime +0x22 (u16 hours). HGSS Kanto +0x1f. */
const TRAINER_BADGES = 0x1a;
const TRAINER_KANTO = 0x1f;
const TRAINER_HOURS = 0x22;

const VARIANTS = {
  dp: {
    label: "Gen 4 · Diamond/Pearl",
    format: "gen4-dp",
    generalSize: 0xc100,
    storageSize: 0x121e0,
    storageStart: 0xc100,
    party: 0x98,
    trainer1: 0x64,
    box: 4,
    footer: 0x14,
  },
  pt: {
    label: "Gen 4 · Platinum",
    format: "gen4-pt",
    generalSize: 0xcf2c,
    storageSize: 0x121e4,
    storageStart: 0xcf2c,
    party: 0xa0,
    trainer1: 0x68,
    box: 4,
    footer: 0x14,
  },
  hgss: {
    label: "Gen 4 · HeartGold/SoulSilver",
    format: "gen4-hgss",
    generalSize: 0xf628,
    storageSize: 0x12310,
    storageStart: 0xf700,
    party: 0x98,
    trainer1: 0x64,
    box: 0,
    footer: 0x10,
  },
};

function compare_footers(v, off1, off2) {
  const major1 = u32le(v, off1);
  const major2 = u32le(v, off2);
  if (major1 === 0xffffffff && major2 !== 0xfffffffe) return 1;
  if (major2 === 0xffffffff && major1 !== 0xfffffffe) return 0;
  if (major1 > major2) return 0;
  if (major1 < major2) return 1;
  const minor1 = u32le(v, off1 + 4);
  const minor2 = u32le(v, off2 + 4);
  if (minor1 < minor2) return 1;
  return 0;
}

function active_block(v, begin, length) {
  const offset = begin + length - 0x14;
  return compare_footers(v, offset, offset + PARTITION);
}

function footer_ok_at(v, base, generalSize) {
  if (base + generalSize > v.length) return false;
  const general = v.subarray(base, base + generalSize);
  const size = u32le(general, general.length - 0xc);
  if (size !== general.length) return false;
  const sdk = u32le(general, general.length - 0x8);
  return sdk === MAGIC_INTL || sdk === MAGIC_KOR;
}

function footer_ok(v, generalSize) {
  // PKHeX checks the second partition; some dumps only keep one valid copy.
  return footer_ok_at(v, PARTITION, generalSize) || footer_ok_at(v, 0, generalSize);
}

function detect_variant(v) {
  // Order matters: more specific sizes first (HGSS > Pt > DP)
  if (footer_ok(v, VARIANTS.hgss.generalSize)) return VARIANTS.hgss;
  if (footer_ok(v, VARIANTS.pt.generalSize)) return VARIANTS.pt;
  if (footer_ok(v, VARIANTS.dp.generalSize)) return VARIANTS.dp;
  return null;
}

function parse_pk45(raw, party) {
  const need = party ? SIZE.G4_PARTY : SIZE.G4_STORED;
  if (raw.length < need) return null;
  const data = raw.slice(0, need);
  decrypt_if_encrypted45(data);
  const dexId = u16le(data, 0x08);
  if (!dexId || dexId > 493) return null;
  const pid = u32le(data, 0);
  const tid = u16le(data, 0x0c);
  const sid = u16le(data, 0x0e);
  const exp = u32le(data, 0x10);
  const moves = [u16le(data, 0x28), u16le(data, 0x2a), u16le(data, 0x2c), u16le(data, 0x2e)].filter(
    (m) => m > 0
  );
  const iv32 = u32le(data, 0x38);
  const partyLv = party ? data[0x8c] : 0;
  const level = partyLv || level_from_exp(exp, dexId);
  const form = (data[0x40] >> 3) & 0x1f;
  const mon = {
    speciesInt: dexId,
    dexId,
    slug: national_slug(dexId),
    speciesName: national_name(dexId),
    nickname: decode_gen4(data, 0x48, 22),
    ot: decode_gen4(data, 0x68, 16),
    otId: tid,
    sid,
    pid,
    exp,
    form,
    moves,
    level,
    shiny: shiny_from_pid(pid, tid, sid),
    ivs: {
      hp: iv32 & 0x1f,
      atk: (iv32 >> 5) & 0x1f,
      def: (iv32 >> 10) & 0x1f,
      spe: (iv32 >> 15) & 0x1f,
      spa: (iv32 >> 20) & 0x1f,
      spd: (iv32 >> 25) & 0x1f,
    },
    boxed: !party,
  };
  if (dexId === UNOWN_DEX) apply_unown_fields(mon, form);
  if (party) {
    mon.hp = u16le(data, 0x8e);
    mon.maxHp = u16le(data, 0x90);
    mon.atk = u16le(data, 0x92);
    mon.def = u16le(data, 0x94);
    mon.spe = u16le(data, 0x96);
    mon.spa = u16le(data, 0x98);
    mon.spd = u16le(data, 0x9a);
  }
  return mon;
}

function normalize_save(v) {
  // DeSmuME .dsv footer, or no$gba / leftover padding
  if (v.length >= 0x80000 + 0x2a && v.length <= 0x80000 + 0x100) {
    return v.subarray(0, 0x80000);
  }
  if (v.length === 0x80000) return v;
  return null;
}

export function parse_gen4(v) {
  const data = normalize_save(v);
  if (!data) return null;

  const variant = detect_variant(data);
  if (!variant) return null;

  const gPos = active_block(data, 0, variant.generalSize);
  const sPos = active_block(data, variant.storageStart, variant.storageSize);
  const gbo = gPos === 0 ? 0 : PARTITION;
  const sbo = (sPos === 0 ? 0 : PARTITION) + variant.storageStart;
  if (gbo + variant.generalSize > data.length) return null;
  if (sbo + variant.storageSize > data.length) return null;

  const general = data.subarray(gbo, gbo + variant.generalSize);
  const storage = data.subarray(sbo, sbo + variant.storageSize);

  const player = decode_gen4(general, variant.trainer1, 14); // 7 chars max
  const playerId = u16le(general, variant.trainer1 + 0x10);
  const sid = u16le(general, variant.trainer1 + 0x12);
  const money = u32le(general, variant.trainer1 + 0x14) >>> 0;
  const badgesByte = general[variant.trainer1 + TRAINER_BADGES] ?? 0;
  const playtime = {
    hours: u16le(general, variant.trainer1 + TRAINER_HOURS),
    minutes: general[variant.trainer1 + TRAINER_HOURS + 2] ?? 0,
    seconds: general[variant.trainer1 + TRAINER_HOURS + 3] ?? 0,
  };

  let badges;
  let badgesJohto;
  let badgesKanto;
  let badgesJohtoNames;
  let badgesKantoNames;
  if (variant.format === "gen4-hgss") {
    const kantoByte = general[variant.trainer1 + TRAINER_KANTO] ?? 0;
    badgesJohtoNames = JOHTO_BADGES.filter((_, i) => badgesByte & (1 << i));
    badgesKantoNames = KANTO_BADGES.filter((_, i) => kantoByte & (1 << i));
    badgesJohto = badgesJohtoNames.length;
    badgesKanto = badgesKantoNames.length;
  } else {
    badges = SINNOH_BADGES.filter((_, i) => badgesByte & (1 << i));
  }

  const rawCount = general[variant.party - 4] ?? 0;
  const partyCount = rawCount <= 6 ? rawCount : 0;

  const party = [];
  for (let i = 0; i < partyCount; i++) {
    const start = variant.party + i * SIZE.G4_PARTY;
    const mon = parse_pk45(general.subarray(start, start + SIZE.G4_PARTY), true);
    if (mon) party.push(mon);
  }

  const boxes = [];
  for (let b = 0; b < 18; b++) {
    const boxOff = variant.box + b * 30 * SIZE.G4_STORED;
    const mons = [];
    for (let s = 0; s < 30; s++) {
      const start = boxOff + s * SIZE.G4_STORED;
      if (start + SIZE.G4_STORED > storage.length) break;
      const slice = storage.subarray(start, start + SIZE.G4_STORED);
      let empty = true;
      for (let k = 0; k < 8; k++) {
        if (slice[k]) {
          empty = false;
          break;
        }
      }
      if (empty) continue;
      const mon = parse_pk45(slice, false);
      if (mon) mons.push(mon);
    }
    boxes.push({
      index: b,
      name: `Box ${b + 1}`,
      current: false,
      count: mons.length,
      capacity: 30,
      mons,
      offset: boxOff,
    });
  }

  const ckGeneral = crc16_ccitt(general.subarray(0, general.length - variant.footer));
  const storedCk = u16le(general, general.length - 2);

  return {
    gen: 4,
    format: variant.format,
    label: variant.label,
    player,
    playerId,
    sid,
    money,
    playtime,
    ...(badges
      ? { badges }
      : {
          badgesJohto,
          badgesKanto,
          badgesJohtoNames,
          badgesKantoNames,
        }),
    partyCount: party.length,
    party,
    currentBox: 0,
    boxes,
    checksum: { ok: ckGeneral === storedCk, stored: storedCk, expected: ckGeneral },
  };
}
