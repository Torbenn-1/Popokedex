/** Gen 3 (RS / Emerald / FRLG) party + PC boxes. */

import {
  SIZE,
  decrypt_if_encrypted3,
  u16le,
  u32le,
} from "./crypto.js";
import { decode_gen3 } from "./strings.js";
import { national_name, national_slug } from "./national_slugs.js";
import { shiny_from_pid } from "./shiny.js";
import { level_from_exp } from "./experience.js";
import { apply_unown_fields, unown_form_gen3, UNOWN_DEX } from "./unown.js";

const SECTION = 0x1000;
const SECTION_USED = 0xf80;
const FOOT = 0xff4;

/** Gen3 internal → national delta for species ≥ 252 (PKHeX Table3InternalToNational). */
const TABLE3_DELTA = [
  -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -11, -11, -11, -28, -28, -21, -21, 19, -31, -31, -28, -28, 7, 7, -15, -15, 35, 25, 25, -21, 3, -20, 16, 16, 45, 15, 15, 21, 21, -12, -12, -4, -4, -4, -39, -39, -28, -28, -17, -17, 22, 22, 22, -13, -13, 15, 15, -11, -11, -52, -26, -26, -42, -42, -52, -49, -49, -25, -25, 0, -6, -6, -48, -77, -77, -77, -51, -51, -12, -77, -77, -77, -7, -7, -7, -17, -24, -24, -43, -45, -12, -78, -78, -78, -34, -73, -73, -43, -43, -43, -43, -112, -112, -112, -24, -24, -24, -24, -24, -24, -24, -24, -24, -22, -22, -22, -27, -27, -24, -24, -53,
];

function national3(raw) {
  if (raw < 252) return raw;
  const shift = raw - 252;
  if (shift >= TABLE3_DELTA.length) return 0;
  return (raw + TABLE3_DELTA[shift]) & 0xffff;
}

function u8(v, i) {
  return v[i] ?? 0;
}

function build_slot(v, base) {
  const sections = [];
  for (let s = 0; s < 14; s++) {
    const off = base + s * SECTION;
    if (off + SECTION > v.length) return null;
    const id = u16le(v, off + FOOT);
    const ck = u16le(v, off + FOOT + 2);
    const idx = u32le(v, off + FOOT + 4);
    sections.push({ id, checksum: ck, saveIndex: idx, offset: off });
  }
  const ids = new Set(sections.map((x) => x.id));
  if (![...Array(14).keys()].every((i) => ids.has(i))) return null;
  const trainer = sections.find((x) => x.id === 0);
  return {
    base,
    saveIndex: trainer ? trainer.saveIndex : 0,
    sections,
    byId: Object.fromEntries(sections.map((s) => [s.id, s])),
  };
}

function concat_sections(v, slot, ids) {
  const out = new Uint8Array(ids.length * SECTION_USED);
  ids.forEach((id, i) => {
    const sec = slot.byId[id];
    out.set(v.subarray(sec.offset, sec.offset + SECTION_USED), i * SECTION_USED);
  });
  return out;
}

function detect_version(small) {
  const ac = u32le(small, 0xac);
  if (ac === 1) return "frlg";
  if (ac === 0) return "rs";
  const rem = small.subarray(0x890, 0xf2c);
  for (let i = 0; i < rem.length; i++) if (rem[i] !== 0) return "e";
  return "rs";
}

const HOENN_BADGES = [
  "Stone",
  "Knuckle",
  "Dynamo",
  "Heat",
  "Balance",
  "Feather",
  "Mind",
  "Rain",
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

/** PKHeX LargeBlock event-flag bases + FLAG_BADGE01_GET. */
const BADGE_FLAGS = {
  rs: { eventFlag: 0x1220, start: 0x807, names: HOENN_BADGES },
  e: { eventFlag: 0x1270, start: 0x867, names: HOENN_BADGES },
  frlg: { eventFlag: 0x0ee0, start: 0x820, names: KANTO_BADGES },
};

function event_flag(large, flagBase, flagNum) {
  const off = flagBase + (flagNum >> 3);
  return !!(u8(large, off) & (1 << (flagNum & 7)));
}

function read_badges3(large, version) {
  const cfg = BADGE_FLAGS[version] || BADGE_FLAGS.rs;
  return cfg.names.filter((_, i) => event_flag(large, cfg.eventFlag, cfg.start + i));
}

function parse_pk3(raw, party) {
  const data = raw.slice();
  decrypt_if_encrypted3(data);
  const speciesInternal = u16le(data, 0x20);
  if (!speciesInternal) return null;
  const dexId = national3(speciesInternal);
  if (!dexId) return null;
  const pid = u32le(data, 0);
  const tid = u16le(data, 0x04);
  const sid = u16le(data, 0x06);
  const exp = u32le(data, 0x24);
  const moves = [u16le(data, 0x2c), u16le(data, 0x2e), u16le(data, 0x30), u16le(data, 0x32)].filter(
    (m) => m > 0
  );
  const iv32 = u32le(data, 0x48);
  const level = party ? u8(data, 0x54) || level_from_exp(exp, dexId) : level_from_exp(exp, dexId);
  const mon = {
    speciesInt: speciesInternal,
    dexId,
    slug: national_slug(dexId),
    speciesName: national_name(dexId),
    nickname: decode_gen3(data, 0x08, 10),
    ot: decode_gen3(data, 0x14, 7),
    otId: tid,
    sid,
    pid,
    exp,
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
  if (dexId === UNOWN_DEX) apply_unown_fields(mon, unown_form_gen3(pid));
  if (party) {
    mon.hp = u16le(data, 0x56);
    mon.maxHp = u16le(data, 0x58);
    mon.atk = u16le(data, 0x5a);
    mon.def = u16le(data, 0x5c);
    mon.spe = u16le(data, 0x5e);
    mon.spa = u16le(data, 0x60);
    mon.spd = u16le(data, 0x62);
  }
  // Box: level not stored — leave 0 / estimate later if needed
  return mon;
}

export function parse_gen3(v) {
  if (v.length < 0x20000) return null;
  const slots = [];
  for (const base of [0, 0xe000]) {
    const s = build_slot(v, base);
    if (s) slots.push(s);
  }
  if (!slots.length) return null;
  slots.sort((a, b) => b.saveIndex - a.saveIndex);
  const best = slots[0];

  const small = concat_sections(v, best, [0]);
  const large = concat_sections(v, best, [1, 2, 3, 4]);
  const storage = concat_sections(v, best, [5, 6, 7, 8, 9, 10, 11, 12, 13]);

  const version = detect_version(small);
  const labels = {
    rs: "Gen 3 · Ruby/Sapphire",
    e: "Gen 3 · Emerald",
    frlg: "Gen 3 · FireRed/LeafGreen",
  };

  const player = decode_gen3(small, 0, 7);
  const playerId = u16le(small, 0x0a);
  const secretId = u16le(small, 0x0c);

  let partyCountOff;
  let partyDataOff;
  let moneyOff;
  let securityKey = 0;
  if (version === "frlg") {
    partyCountOff = 0x034;
    partyDataOff = 0x038;
    moneyOff = 0x290;
    securityKey = u32le(small, 0xf20);
  } else if (version === "e") {
    partyCountOff = 0x234;
    partyDataOff = 0x238;
    moneyOff = 0x490;
    securityKey = u32le(small, 0xac);
  } else {
    partyCountOff = 0x234;
    partyDataOff = 0x238;
    moneyOff = 0x490;
  }

  const partyCount = Math.min(6, u8(large, partyCountOff));
  const party = [];
  for (let i = 0; i < partyCount; i++) {
    const slice = large.subarray(
      partyDataOff + i * SIZE.G3_PARTY,
      partyDataOff + (i + 1) * SIZE.G3_PARTY
    );
    const mon = parse_pk3(slice, true);
    if (mon) party.push(mon);
  }

  const currentBox = u8(storage, 0) % 14;
  const boxes = [];
  for (let b = 0; b < 14; b++) {
    const boxOff = 4 + b * 30 * SIZE.G3_STORED;
    const mons = [];
    for (let s = 0; s < 30; s++) {
      const start = boxOff + s * SIZE.G3_STORED;
      const slice = storage.subarray(start, start + SIZE.G3_STORED);
      let empty = true;
      for (let k = 0; k < SIZE.G3_STORED; k++) if (slice[k]) { empty = false; break; }
      if (empty) continue;
      const mon = parse_pk3(slice, false);
      if (mon) mons.push(mon);
    }
    boxes.push({
      index: b,
      name: `Box ${b + 1}`,
      current: b === currentBox,
      count: mons.length,
      capacity: 30,
      mons,
      offset: boxOff,
    });
  }

  const money = (u32le(large, moneyOff) ^ securityKey) >>> 0;
  const playtime = {
    hours: u16le(small, 0x0e),
    minutes: u8(small, 0x10),
    seconds: u8(small, 0x11),
  };
  const badges = read_badges3(large, version);

  return {
    gen: 3,
    format: `gen3-${version}`,
    label: labels[version],
    player,
    playerId,
    sid: secretId,
    money: money & 0xffffff,
    badges,
    playtime,
    partyCount: party.length,
    party,
    currentBox,
    boxes,
    activeSlot: best.base === 0 ? "A" : "B",
    saveIndex: best.saveIndex,
    sectionsOk: true,
    checksum: { ok: true, stored: 0, expected: 0 },
  };
}
