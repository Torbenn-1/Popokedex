/** Write Gen1–5 party into a save buffer (mutates copy). */

import {
  SIZE,
  encrypt3,
  encrypt45,
  crc16_ccitt,
  u16le,
  u32le,
  w16le,
  w32le,
  w16be,
} from "./crypto.js";
import {
  encode_gen12,
  encode_gen3,
  encode_gen4,
  encode_gen5,
} from "./strings.js";
import {
  exp_at_level,
  calc_stat_modern,
  calc_stat_g12,
  base_stats_from_slim,
  ivs_to_dvs,
  pack_dvs,
  pack_iv32,
  default_pp,
} from "./stats.js";
import { craft_pid } from "./pid.js";
import {
  move_id,
  item_id,
  gen3_internal_species,
  gen1_internal_from_slug,
  nature_index,
  MOVE_ID,
} from "./ids.js";
import { slim_por_id, slim_por_slug, carrega_slim } from "../slim_dex.js";
import { JOGOS } from "../../data/jogos.js";

const TEAMS_KEY = "caraio_teams_by_game_v1";
const LAST_GAME = "caraio_last_game";

function u8set(v, i, n) {
  v[i] = n & 0xff;
}

function moves_from_team(mon) {
  const out = [0, 0, 0, 0];
  (mon?.moves || []).slice(0, 4).forEach((m, i) => {
    if (m == null || m === "") return;
    if (typeof m === "number") {
      out[i] = m & 0xffff;
      return;
    }
    if (typeof m === "string") {
      const n = Number(m.replace(/^#/, ""));
      if (Number.isFinite(n) && n > 0) {
        out[i] = n & 0xffff;
        return;
      }
      out[i] = move_id(m) & 0xffff;
      return;
    }
    if (m.id) {
      out[i] = m.id & 0xffff;
      return;
    }
    out[i] = move_id(m.slug) & 0xffff;
  });
  return out;
}

/** Export for UI: resolve move token (slug / #id / number) → id */
export function resolve_move_token(tok) {
  if (tok == null || tok === "") return 0;
  if (typeof tok === "number") return tok & 0xffff;
  const s = String(tok).trim();
  const n = Number(s.replace(/^#/, ""));
  if (Number.isFinite(n) && n > 0) return n & 0xffff;
  return move_id(s) & 0xffff;
}

export function move_slug_from_id(id) {
  const want = id & 0xffff;
  for (const [slug, mid] of Object.entries(MOVE_ID)) {
    if (mid === want) return slug;
  }
  return want ? `#${want}` : "";
}

function nick_of(mon, fallback) {
  return (mon?.nickname || mon?.name || fallback || "POKEMON").slice(0, 10);
}

function resolve_dex(mon) {
  if (mon?.dexId) return mon.dexId | 0;
  if (mon?.id) return mon.id | 0;
  const slim = slim_por_slug(mon?.slug);
  return slim?.id || 0;
}

function resolve_slim(dexId, slug) {
  return slim_por_id(dexId) || slim_por_slug(slug) || null;
}

/** Load builder team matching save gen. */
export function load_builder_team_for_gen(saveGen) {
  let store = {};
  try {
    store = JSON.parse(localStorage.getItem(TEAMS_KEY) || "{}") || {};
  } catch {
    store = {};
  }
  const last = localStorage.getItem(LAST_GAME) || "";
  const jogo = JOGOS.find((j) => j.slug === last);
  const pick = (slug) => {
    const snap = store[slug];
    const team = (snap?.team || []).filter(Boolean);
    return team.length ? { gameSlug: slug, team, title: snap.title || "" } : null;
  };
  if (jogo && jogo.gen === saveGen) {
    const hit = pick(last);
    if (hit) return hit;
  }
  for (const j of JOGOS) {
    if (j.gen !== saveGen) continue;
    const hit = pick(j.slug);
    if (hit) return hit;
  }
  return { gameSlug: last || "", team: [], title: "", mismatch: true };
}

export async function ensure_slim() {
  await carrega_slim();
}

/* —— Gen 1 —— */

function rewrite_gen1_checksum(v) {
  let sum = 0;
  for (let i = 0x2598; i <= 0x3522; i++) sum = (sum + v[i]) & 0xff;
  v[0x3523] = (~sum) & 0xff;
}

function build_g1_party_bytes(mon, ctx, baseStats) {
  const level = Math.max(1, Math.min(100, mon.level || ctx.level || 50));
  const dvs = ivs_to_dvs(mon.ivs, mon.shiny);
  const dv = pack_dvs(dvs);
  const moves = moves_from_team(mon);
  const speciesInt = gen1_internal_from_slug(mon.slug) || gen1_internal_from_slug(
    resolve_slim(resolve_dex(mon), mon.slug)?.slug
  );
  const buf = new Uint8Array(0x2c);
  u8set(buf, 0, speciesInt);
  u8set(buf, 3, level); // BoxLevel / party level mirror
  u8set(buf, 4, 0); // status
  u8set(buf, 5, 0); // type1
  u8set(buf, 6, 0); // type2
  u8set(buf, 7, 0); // catch rate
  u8set(buf, 8, moves[0]);
  u8set(buf, 9, moves[1]);
  u8set(buf, 10, moves[2]);
  u8set(buf, 11, moves[3]);
  w16be(buf, 12, ctx.tid & 0xffff);
  // exp (3 bytes BE)
  const exp = exp_at_level(level, resolve_dex(mon) || 1);
  buf[14] = (exp >>> 16) & 0xff;
  buf[15] = (exp >>> 8) & 0xff;
  buf[16] = exp & 0xff;
  w16be(buf, 0x1b, dv);
  u8set(buf, 0x1d, default_pp(moves[0]));
  u8set(buf, 0x1e, default_pp(moves[1]));
  u8set(buf, 0x1f, default_pp(moves[2]));
  u8set(buf, 0x20, default_pp(moves[3]));
  u8set(buf, 0x21, level);

  const hp = calc_stat_g12("hp", baseStats.hp, dvs.hp, 0, level);
  const atk = calc_stat_g12("atk", baseStats.atk, dvs.atk, 0, level);
  const def = calc_stat_g12("def", baseStats.def, dvs.def, 0, level);
  const spe = calc_stat_g12("spe", baseStats.spe, dvs.spe, 0, level);
  const spc = calc_stat_g12("spc", baseStats.spc, dvs.spc, 0, level);
  w16be(buf, 1, hp);
  w16be(buf, 0x22, hp);
  w16be(buf, 0x24, atk);
  w16be(buf, 0x26, def);
  w16be(buf, 0x28, spe);
  w16be(buf, 0x2a, spc);
  return { buf, speciesInt, level };
}

function write_gen1_party(v, mons, ctx) {
  const count = Math.min(6, mons.length);
  const partyOff = 0x2f2c;
  u8set(v, partyOff, count);
  for (let i = 0; i < 6; i++) {
    u8set(v, partyOff + 1 + i, i < count ? 0 : 0xff);
  }
  u8set(v, partyOff + 1 + count, 0xff);

  for (let i = 0; i < 6; i++) {
    const monBase = partyOff + 0x08 + i * 0x2c;
    const nickOff = partyOff + 0x152 + i * 11;
    const otOff = partyOff + 0x110 + i * 11;
    if (i >= count) {
      v.fill(0, monBase, monBase + 0x2c);
      v.set(encode_gen12("", 11), nickOff);
      v.set(encode_gen12("", 11), otOff);
      continue;
    }
    const mon = mons[i];
    const dex = resolve_dex(mon);
    const slim = resolve_slim(dex, mon.slug);
    const base = base_stats_from_slim(slim);
    const built = build_g1_party_bytes(mon, ctx, base);
    v.set(built.buf, monBase);
    u8set(v, partyOff + 1 + i, built.speciesInt);
    v.set(encode_gen12(nick_of(mon, slim?.slug), 11), nickOff);
    v.set(encode_gen12(ctx.ot || "RED", 11), otOff);
  }
  rewrite_gen1_checksum(v);
}

/* —— Gen 2 —— */

const G2_PROFILES = {
  "gen2-gs": {
    party: 0x288a,
    trainer1: 0x2009,
    ckEnd: 0x2d68,
    ckPos: 0x2d69,
  },
  "gen2-crystal": {
    party: 0x2865,
    trainer1: 0x2009,
    ckEnd: 0x2b82,
    ckPos: 0x2d0d,
  },
};

function rewrite_gen2_checksum(v, profile) {
  let sum = 0;
  for (let i = profile.trainer1; i <= profile.ckEnd; i++) sum = (sum + v[i]) & 0xffff;
  u8set(v, profile.ckPos, sum & 0xff);
  u8set(v, profile.ckPos + 1, (sum >> 8) & 0xff);
}

function build_g2_party_bytes(mon, ctx, baseStats) {
  const level = Math.max(1, Math.min(100, mon.level || ctx.level || 50));
  const dvs = ivs_to_dvs(mon.ivs, mon.shiny);
  const dv = pack_dvs(dvs);
  const moves = moves_from_team(mon);
  const dex = resolve_dex(mon);
  const buf = new Uint8Array(SIZE.G2_PARTY);
  u8set(buf, 0, dex);
  u8set(buf, 1, item_id(mon.item, 2) & 0xff);
  u8set(buf, 2, moves[0]);
  u8set(buf, 3, moves[1]);
  u8set(buf, 4, moves[2]);
  u8set(buf, 5, moves[3]);
  w16be(buf, 6, ctx.tid & 0xffff);
  const exp = exp_at_level(level, dex || 1);
  buf[8] = (exp >>> 16) & 0xff;
  buf[9] = (exp >>> 8) & 0xff;
  buf[10] = exp & 0xff;
  w16be(buf, 0x15, dv);
  u8set(buf, 0x17, default_pp(moves[0]));
  u8set(buf, 0x18, default_pp(moves[1]));
  u8set(buf, 0x19, default_pp(moves[2]));
  u8set(buf, 0x1a, default_pp(moves[3]));
  // friendship
  u8set(buf, 0x1b, 255);
  // pokerus / caught data left 0
  u8set(buf, 0x1f, level);

  const hp = calc_stat_g12("hp", baseStats.hp, dvs.hp, 0, level);
  const atk = calc_stat_g12("atk", baseStats.atk, dvs.atk, 0, level);
  const def = calc_stat_g12("def", baseStats.def, dvs.def, 0, level);
  const spe = calc_stat_g12("spe", baseStats.spe, dvs.spe, 0, level);
  const spa = calc_stat_g12("spa", baseStats.spa, dvs.spc, 0, level);
  const spd = calc_stat_g12("spd", baseStats.spd, dvs.spc, 0, level);
  w16be(buf, 0x22, hp);
  w16be(buf, 0x24, hp);
  w16be(buf, 0x26, atk);
  w16be(buf, 0x28, def);
  w16be(buf, 0x2a, spe);
  w16be(buf, 0x2c, spa);
  w16be(buf, 0x2e, spd);
  return { buf, dex };
}

function write_gen2_party(v, mons, ctx, format) {
  const profile = G2_PROFILES[format] || G2_PROFILES["gen2-gs"];
  const off = profile.party;
  const count = Math.min(6, mons.length);
  const capacity = 6;
  const monSize = SIZE.G2_PARTY;
  u8set(v, off, count);
  for (let i = 0; i < capacity; i++) u8set(v, off + 1 + i, 0xff);
  for (let i = 0; i < count; i++) u8set(v, off + 1 + i, resolve_dex(mons[i]));
  u8set(v, off + 1 + count, 0xff);

  const monBase = off + 1 + capacity + 1;
  const otBase = monBase + capacity * monSize;
  const nickBase = otBase + capacity * 11;

  for (let i = 0; i < capacity; i++) {
    const start = monBase + i * monSize;
    if (i >= count) {
      v.fill(0, start, start + monSize);
      v.set(encode_gen12("", 11), otBase + i * 11);
      v.set(encode_gen12("", 11), nickBase + i * 11);
      continue;
    }
    const mon = mons[i];
    const dex = resolve_dex(mon);
    const slim = resolve_slim(dex, mon.slug);
    const built = build_g2_party_bytes(mon, ctx, base_stats_from_slim(slim));
    v.set(built.buf, start);
    u8set(v, off + 1 + i, built.dex);
    v.set(encode_gen12(ctx.ot || "ASH", 11), otBase + i * 11);
    v.set(encode_gen12(nick_of(mon, slim?.slug), 11), nickBase + i * 11);
  }
  rewrite_gen2_checksum(v, profile);
}

/* —— Gen 3 —— */

const SECTION = 0x1000;
const SECTION_USED = 0xf80;
const FOOT = 0xff4;

function build_slot3(v, base) {
  const sections = [];
  for (let s = 0; s < 14; s++) {
    const off = base + s * SECTION;
    if (off + SECTION > v.length) return null;
    const id = u16le(v, off + FOOT);
    const idx = u32le(v, off + FOOT + 4);
    sections.push({ id, saveIndex: idx, offset: off });
  }
  const ids = new Set(sections.map((x) => x.id));
  if (![...Array(14).keys()].every((i) => ids.has(i))) return null;
  return {
    base,
    saveIndex: sections.find((x) => x.id === 0)?.saveIndex || 0,
    byId: Object.fromEntries(sections.map((s) => [s.id, s])),
  };
}

function pick_active_slot3(v) {
  const slots = [];
  for (const base of [0, 0xe000]) {
    const s = build_slot3(v, base);
    if (s) slots.push(s);
  }
  if (!slots.length) return null;
  slots.sort((a, b) => b.saveIndex - a.saveIndex);
  return slots[0];
}

function section_checksum(secBytes) {
  // Gen3 section checksum: sum of u32 over used region, then fold
  let sum = 0;
  for (let i = 0; i < SECTION_USED; i += 4) {
    sum = (sum + u32le(secBytes, i)) >>> 0;
  }
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff;
}

function write_section_bytes(v, slot, id, dataUsed) {
  const sec = slot.byId[id];
  if (!sec) return;
  const buf = v.subarray(sec.offset, sec.offset + SECTION);
  buf.set(dataUsed.subarray(0, Math.min(SECTION_USED, dataUsed.length)), 0);
  const ck = section_checksum(buf);
  w16le(v, sec.offset + FOOT + 2, ck);
}

function concat_sections3(v, slot, ids) {
  const out = new Uint8Array(ids.length * SECTION_USED);
  ids.forEach((id, i) => {
    const sec = slot.byId[id];
    out.set(v.subarray(sec.offset, sec.offset + SECTION_USED), i * SECTION_USED);
  });
  return out;
}

function detect_g3_version(small) {
  const ac = u32le(small, 0xac);
  if (ac === 1) return "frlg";
  if (ac === 0) return "rs";
  const rem = small.subarray(0x890, 0xf2c);
  for (let i = 0; i < rem.length; i++) if (rem[i] !== 0) return "e";
  return "rs";
}

function build_pk3(mon, ctx, baseStats) {
  const data = new Uint8Array(SIZE.G3_PARTY);
  const dex = resolve_dex(mon);
  const level = Math.max(1, Math.min(100, mon.level || ctx.level || 50));
  const tid = ctx.tid & 0xffff;
  const sid = (ctx.sid ?? 0) & 0xffff;
  const pid = craft_pid({
    nature: mon.nature,
    shiny: mon.shiny,
    tid,
    sid,
  });
  w32le(data, 0, pid);
  w32le(data, 4, (tid | (sid << 16)) >>> 0);
  data.set(encode_gen3(nick_of(mon, mon.slug), 10), 0x08);
  u8set(data, 0x12, 2); // language English
  data.set(encode_gen3(ctx.ot || "ASH", 7), 0x14);

  const species = gen3_internal_species(dex);
  w16le(data, 0x20, species);
  w16le(data, 0x22, item_id(mon.item, 3));
  w32le(data, 0x24, exp_at_level(level, dex || 1));
  u8set(data, 0x28, 0); // pp bonuses
  u8set(data, 0x29, 255); // friendship

  const moves = moves_from_team(mon);
  w16le(data, 0x2c, moves[0]);
  w16le(data, 0x2e, moves[1]);
  w16le(data, 0x30, moves[2]);
  w16le(data, 0x32, moves[3]);
  u8set(data, 0x34, default_pp(moves[0]));
  u8set(data, 0x35, default_pp(moves[1]));
  u8set(data, 0x36, default_pp(moves[2]));
  u8set(data, 0x37, default_pp(moves[3]));

  const evs = mon.evs || {};
  u8set(data, 0x38, evs.hp || 0);
  u8set(data, 0x39, evs.atk || 0);
  u8set(data, 0x3a, evs.def || 0);
  u8set(data, 0x3b, evs.spe || 0);
  u8set(data, 0x3c, evs.spa || 0);
  u8set(data, 0x3d, evs.spd || 0);

  // Misc: origin game, IVs
  // met location / level / ball — ball pokeball (4) in bits
  // IV32 at 0x48 — ability bit 31 = 0
  let iv32 = pack_iv32(mon.ivs);
  iv32 &= 0x7fffffff;
  w32le(data, 0x48, iv32);

  // Party stats trailer
  u8set(data, 0x54, level);
  const nature = mon.nature || "hardy";
  const hp = calc_stat_modern("hp", baseStats.hp, mon.ivs?.hp ?? 31, evs.hp || 0, level, nature);
  const atk = calc_stat_modern("atk", baseStats.atk, mon.ivs?.atk ?? 31, evs.atk || 0, level, nature);
  const def = calc_stat_modern("def", baseStats.def, mon.ivs?.def ?? 31, evs.def || 0, level, nature);
  const spe = calc_stat_modern("spe", baseStats.spe, mon.ivs?.spe ?? 31, evs.spe || 0, level, nature);
  const spa = calc_stat_modern("spa", baseStats.spa, mon.ivs?.spa ?? 31, evs.spa || 0, level, nature);
  const spd = calc_stat_modern("spd", baseStats.spd, mon.ivs?.spd ?? 31, evs.spd || 0, level, nature);
  w16le(data, 0x56, hp);
  w16le(data, 0x58, hp);
  w16le(data, 0x5a, atk);
  w16le(data, 0x5c, def);
  w16le(data, 0x5e, spe);
  w16le(data, 0x60, spa);
  w16le(data, 0x62, spd);

  encrypt3(data);
  return data;
}

function write_gen3_party(v, mons, ctx) {
  const slot = pick_active_slot3(v);
  if (!slot) throw new Error("Gen3 slot not found");
  const small = concat_sections3(v, slot, [0]);
  const large = concat_sections3(v, slot, [1, 2, 3, 4]);
  const version = detect_g3_version(small);
  let partyCountOff;
  let partyDataOff;
  if (version === "frlg") {
    partyCountOff = 0x034;
    partyDataOff = 0x038;
  } else {
    partyCountOff = 0x234;
    partyDataOff = 0x238;
  }
  const count = Math.min(6, mons.length);
  large[partyCountOff] = count;
  for (let i = 0; i < 6; i++) {
    const start = partyDataOff + i * SIZE.G3_PARTY;
    if (i >= count) {
      large.fill(0, start, start + SIZE.G3_PARTY);
      continue;
    }
    const mon = mons[i];
    const dex = resolve_dex(mon);
    const slim = resolve_slim(dex, mon.slug);
    const pk = build_pk3(mon, ctx, base_stats_from_slim(slim));
    large.set(pk, start);
  }
  // write back sections 1–4
  for (let i = 0; i < 4; i++) {
    const id = i + 1;
    const chunk = large.subarray(i * SECTION_USED, (i + 1) * SECTION_USED);
    write_section_bytes(v, slot, id, chunk);
  }
}

/* —— Gen 4 / 5 shared PK builder —— */

function fill_battle_stats45(data, mon, baseStats, level, nature, evs, offHp = 0x8e) {
  const hp = calc_stat_modern("hp", baseStats.hp, mon.ivs?.hp ?? 31, evs.hp || 0, level, nature);
  const atk = calc_stat_modern("atk", baseStats.atk, mon.ivs?.atk ?? 31, evs.atk || 0, level, nature);
  const def = calc_stat_modern("def", baseStats.def, mon.ivs?.def ?? 31, evs.def || 0, level, nature);
  const spe = calc_stat_modern("spe", baseStats.spe, mon.ivs?.spe ?? 31, evs.spe || 0, level, nature);
  const spa = calc_stat_modern("spa", baseStats.spa, mon.ivs?.spa ?? 31, evs.spa || 0, level, nature);
  const spd = calc_stat_modern("spd", baseStats.spd, mon.ivs?.spd ?? 31, evs.spd || 0, level, nature);
  u8set(data, 0x8c, level);
  w16le(data, offHp, hp);
  w16le(data, offHp + 2, hp);
  w16le(data, offHp + 4, atk);
  w16le(data, offHp + 6, def);
  w16le(data, offHp + 8, spe);
  w16le(data, offHp + 10, spa);
  w16le(data, offHp + 12, spd);
}

function build_pk45(mon, ctx, baseStats, partySize) {
  const data = new Uint8Array(partySize);
  const dex = resolve_dex(mon);
  const level = Math.max(1, Math.min(100, mon.level || ctx.level || 50));
  const tid = ctx.tid & 0xffff;
  const sid = (ctx.sid ?? 0) & 0xffff;
  const nature = mon.nature || "hardy";
  const pid = craft_pid({ nature, shiny: mon.shiny, tid, sid });
  w32le(data, 0, pid);
  // sanity 0x04 left 0
  w16le(data, 0x08, dex);
  w16le(data, 0x0a, item_id(mon.item, ctx.gen >= 5 ? 5 : 4));
  w16le(data, 0x0c, tid);
  w16le(data, 0x0e, sid);
  w32le(data, 0x10, exp_at_level(level, dex || 1));
  u8set(data, 0x14, 255); // friendship
  u8set(data, 0x15, 0); // ability
  // markings / country
  u8set(data, 0x17, 0); // HP EV etc start 0x18
  const evs = mon.evs || {};
  u8set(data, 0x18, evs.hp || 0);
  u8set(data, 0x19, evs.atk || 0);
  u8set(data, 0x1a, evs.def || 0);
  u8set(data, 0x1b, evs.spe || 0);
  u8set(data, 0x1c, evs.spa || 0);
  u8set(data, 0x1d, evs.spd || 0);

  const moves = moves_from_team(mon);
  w16le(data, 0x28, moves[0]);
  w16le(data, 0x2a, moves[1]);
  w16le(data, 0x2c, moves[2]);
  w16le(data, 0x2e, moves[3]);
  u8set(data, 0x30, default_pp(moves[0]));
  u8set(data, 0x31, default_pp(moves[1]));
  u8set(data, 0x32, default_pp(moves[2]));
  u8set(data, 0x33, default_pp(moves[3]));

  // IV32 @ 0x38
  let iv32 = pack_iv32(mon.ivs);
  iv32 &= 0x3fffffff; // clear egg/nicknamed bits sometimes in high bits — Gen4 uses bit30 nick, bit31 egg
  w32le(data, 0x38, iv32);

  // Nature is from PID in Gen3-4; Gen5 stores nature separately at 0x41
  if (ctx.gen >= 5) {
    u8set(data, 0x41, nature_index(nature));
  }

  // Nickname @ 0x48
  if (ctx.gen >= 5) {
    data.set(encode_gen5(nick_of(mon, mon.slug), 22), 0x48);
    data.set(encode_gen5(ctx.ot || "ASH", 16), 0x68);
  } else {
    data.set(encode_gen4(nick_of(mon, mon.slug), 22), 0x48);
    data.set(encode_gen4(ctx.ot || "ASH", 16), 0x68);
  }

  // Ball Poké Ball
  u8set(data, 0x83, 4);

  fill_battle_stats45(data, mon, baseStats, level, nature, evs);
  encrypt45(data);
  return data;
}

/* Gen4 write */

const G4_VARIANTS = {
  "gen4-dp": {
    generalSize: 0xc100,
    storageStart: 0xc100,
    party: 0x98,
    trainer1: 0x64,
    footer: 0x14,
  },
  "gen4-pt": {
    generalSize: 0xcf2c,
    storageStart: 0xcf2c,
    party: 0xa0,
    trainer1: 0x68,
    footer: 0x14,
  },
  "gen4-hgss": {
    generalSize: 0xf628,
    storageStart: 0xf700,
    party: 0x98,
    trainer1: 0x64,
    footer: 0x10,
  },
};

const PARTITION = 0x40000;

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

function active_block4(v, begin, length) {
  const offset = begin + length - 0x14;
  return compare_footers(v, offset, offset + PARTITION);
}

function write_gen4_party(v, mons, ctx, format) {
  const variant = G4_VARIANTS[format];
  if (!variant) throw new Error("Unknown Gen4 format");
  const gPos = active_block4(v, 0, variant.generalSize);
  const gbo = gPos === 0 ? 0 : PARTITION;
  const general = v.subarray(gbo, gbo + variant.generalSize);
  const count = Math.min(6, mons.length);
  general[variant.party - 4] = count;
  for (let i = 0; i < 6; i++) {
    const start = variant.party + i * SIZE.G4_PARTY;
    if (i >= count) {
      general.fill(0, start, start + SIZE.G4_PARTY);
      continue;
    }
    const mon = mons[i];
    const dex = resolve_dex(mon);
    const slim = resolve_slim(dex, mon.slug);
    const pk = build_pk45(mon, { ...ctx, gen: 4 }, base_stats_from_slim(slim), SIZE.G4_PARTY);
    general.set(pk, start);
  }
  const ck = crc16_ccitt(general.subarray(0, general.length - variant.footer));
  w16le(general, general.length - 2, ck);
}

/* Gen5 write — party block checksums */

function fix_g5_block(v, offset, length, chkOff, mirrorOff) {
  const cs = crc16_ccitt(v.subarray(offset, offset + length));
  w16le(v, chkOff, cs);
  if (mirrorOff != null) w16le(v, mirrorOff, cs);
}

function write_gen5_party(v, mons, ctx, format) {
  const PARTY = 0x18e00;
  const count = Math.min(6, mons.length);
  v[PARTY + 4] = count;
  for (let i = 0; i < 6; i++) {
    const start = PARTY + 8 + i * SIZE.G5_PARTY;
    if (i >= count) {
      v.fill(0, start, start + SIZE.G5_PARTY);
      continue;
    }
    const mon = mons[i];
    const dex = resolve_dex(mon);
    const slim = resolve_slim(dex, mon.slug);
    const pk = build_pk45(mon, { ...ctx, gen: 5 }, base_stats_from_slim(slim), SIZE.G5_PARTY);
    v.set(pk, start);
  }
  // Party block checksum + mirror inside checksum block
  const mirror = format === "gen5-b2w2" ? 0x25f34 : 0x23f34;
  fix_g5_block(v, 0x18e00, 0x534, 0x19336, mirror);

  // Checksum block CRC (must include updated mirrors)
  if (format === "gen5-b2w2") {
    fix_g5_block(v, 0x25f00, 0x94, 0x25fa2, null);
  } else {
    fix_g5_block(v, 0x23f00, 0x8c, 0x23f9a, null);
  }
}

/**
 * Inject / replace party. Returns new Uint8Array (copy).
 * @param {Uint8Array} bytes
 * @param {object} save report.save
 * @param {object[]} mons team-like mons
 */
export function write_party(bytes, save, mons) {
  const out = bytes.slice();
  const ctx = {
    ot: save.player || "ASH",
    tid: save.playerId || 0,
    sid: save.sid ?? save.party?.[0]?.sid ?? 0,
    level: 50,
    gen: save.gen,
  };

  const list = (mons || []).filter(Boolean).slice(0, 6);
  if (save.gen === 1) write_gen1_party(out, list, ctx);
  else if (save.gen === 2) write_gen2_party(out, list, ctx, save.format);
  else if (save.gen === 3) write_gen3_party(out, list, ctx);
  else if (save.gen === 4) write_gen4_party(out, list, ctx, save.format);
  else if (save.gen === 5) write_gen5_party(out, list, ctx, save.format);
  else throw new Error("Unsupported gen for write");
  return out;
}

export function download_bytes(bytes, name) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function patched_name(fileName) {
  const n = fileName || "save.sav";
  const dot = n.lastIndexOf(".");
  if (dot < 0) return `${n}-patched.sav`;
  return `${n.slice(0, dot)}-patched${n.slice(dot)}`;
}
