/** Gen 5 (BW / B2W2) party + boxes. */

import {
  SIZE,
  decrypt_if_encrypted45,
  crc16_ccitt,
  u16le,
  u32le,
} from "./crypto.js";
import { decode_gen5 } from "./strings.js";
import { national_name, national_slug } from "./national_slugs.js";
import { shiny_from_pid } from "./shiny.js";
import { level_from_exp } from "./experience.js";
import { apply_unown_fields, UNOWN_DEX } from "./unown.js";

const SIZE_G5RAW = 0x80000;
const SIZE_G5BW = 0x24000;
const SIZE_G5B2W2 = 0x26000;

const UNOVA_BADGES_BW = [
  "Trio",
  "Basic",
  "Insect",
  "Bolt",
  "Quake",
  "Jet",
  "Freeze",
  "Legend",
];
const UNOVA_BADGES_B2W2 = [
  "Basic",
  "Toxic",
  "Insect",
  "Bolt",
  "Quake",
  "Jet",
  "Legend",
  "Wave",
];

/** Playtime relative to trainer block: +0x24 hours (u16), +0x26 min, +0x27 sec. */
const PLAY_HOURS = 0x24;

const PROFILES = {
  bw: {
    label: "Gen 5 · Black/White",
    format: "gen5-bw",
    mainSize: SIZE_G5BW,
    infoLen: 0x8c,
    trainer: 0x19400,
    misc: 0x21200,
  },
  b2w2: {
    label: "Gen 5 · Black 2/White 2",
    format: "gen5-b2w2",
    mainSize: SIZE_G5B2W2,
    infoLen: 0x94,
    trainer: 0x19400,
    misc: 0x21100,
  },
};

function footer5_ok(v, mainSize, infoLength) {
  if (v.length < mainSize) return false;
  const footer = v.subarray(mainSize - 0x100, mainSize - 0x100 + infoLength + 0x10);
  const stored = u16le(footer, footer.length - 2);
  const actual = crc16_ccitt(footer.subarray(0, infoLength));
  return stored === actual;
}

function detect(v) {
  if (footer5_ok(v, PROFILES.b2w2.mainSize, PROFILES.b2w2.infoLen)) return PROFILES.b2w2;
  if (footer5_ok(v, PROFILES.bw.mainSize, PROFILES.bw.infoLen)) return PROFILES.bw;
  return null;
}

function parse_pk5(raw, party) {
  const need = party ? SIZE.G5_PARTY : SIZE.G5_STORED;
  if (raw.length < need) return null;
  const data = raw.slice(0, need);
  decrypt_if_encrypted45(data);
  const dexId = u16le(data, 0x08);
  if (!dexId || dexId > 649) return null;
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
    nickname: decode_gen5(data, 0x48, 22),
    ot: decode_gen5(data, 0x68, 16),
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
  if (v.length >= SIZE_G5RAW + 0x2a && v.length <= SIZE_G5RAW + 0x100) {
    return v.subarray(0, SIZE_G5RAW);
  }
  if (v.length === SIZE_G5RAW) return v;
  return null;
}

export function parse_gen5(v) {
  const data = normalize_save(v);
  if (!data) return null;

  const kind = detect(data);
  if (!kind) return null;

  const BOX = 0x400;
  const PARTY = 0x18e00;
  const rawCount = data[PARTY + 4] ?? 0;
  const partyCount = rawCount <= 6 ? rawCount : 0;
  const party = [];
  for (let i = 0; i < partyCount; i++) {
    const start = PARTY + 8 + i * SIZE.G5_PARTY;
    const mon = parse_pk5(data.subarray(start, start + SIZE.G5_PARTY), true);
    if (mon) party.push(mon);
  }

  const boxes = [];
  for (let b = 0; b < 24; b++) {
    const boxOff = BOX + SIZE.G5_STORED * b * 30 + b * 0x10;
    const mons = [];
    for (let s = 0; s < 30; s++) {
      const start = boxOff + s * SIZE.G5_STORED;
      if (start + SIZE.G5_STORED > data.length) break;
      const slice = data.subarray(start, start + SIZE.G5_STORED);
      let empty = true;
      for (let k = 0; k < 8; k++) {
        if (slice[k]) {
          empty = false;
          break;
        }
      }
      if (empty) continue;
      const mon = parse_pk5(slice, false);
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

  // Trainer Data block @ 0x19400 — OT at +4 (UTF-16), TID at +0x14
  const player = decode_gen5(data, kind.trainer + 4, 16);
  const playerId = u16le(data, kind.trainer + 0x14);
  const sid = u16le(data, kind.trainer + 0x16);
  const money = u32le(data, kind.misc) >>> 0;
  const badgesByte = data[kind.misc + 4] ?? 0;
  const names = kind.format === "gen5-b2w2" ? UNOVA_BADGES_B2W2 : UNOVA_BADGES_BW;
  const badges = names.filter((_, i) => badgesByte & (1 << i));
  const playtime = {
    hours: u16le(data, kind.trainer + PLAY_HOURS),
    minutes: data[kind.trainer + PLAY_HOURS + 2] ?? 0,
    seconds: data[kind.trainer + PLAY_HOURS + 3] ?? 0,
  };

  return {
    gen: 5,
    format: kind.format,
    label: kind.label,
    player,
    playerId,
    sid,
    money,
    badges,
    playtime,
    partyCount: party.length,
    party,
    currentBox: 0,
    boxes,
    checksum: { ok: true, stored: 0, expected: 0 },
  };
}
