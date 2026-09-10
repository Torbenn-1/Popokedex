/** Text decoders for Gen 1–5 saves. */

import { GEN4_TABLE_INT } from "./gen4_charset.js";

const GEN12_CHAR = (() => {
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

/** Gen 3 western charset (subset — enough for EN OT/nick). */
const GEN3_CHAR = (() => {
  const m = {};
  for (let i = 0; i < 26; i++) {
    m[0xbb + i] = String.fromCharCode(65 + i);
    m[0xd5 + i] = String.fromCharCode(97 + i);
  }
  for (let i = 0; i < 10; i++) m[0xa1 + i] = String(i);
  m[0x00] = "";
  m[0xff] = "";
  m[0xba] = " ";
  m[0xae] = "-";
  m[0xb8] = ".";
  m[0xad] = "?";
  m[0xab] = "!";
  m[0xb6] = "♂";
  m[0xb5] = "♀";
  return m;
})();

export function decode_gen12(bytes, off = 0, len = 11) {
  let out = "";
  for (let i = 0; i < len; i++) {
    const b = bytes[off + i];
    if (b === 0x50) break;
    out += GEN12_CHAR[b] ?? "·";
  }
  return out.trim();
}

export function decode_gen3(bytes, off = 0, len = 10) {
  let out = "";
  for (let i = 0; i < len; i++) {
    const b = bytes[off + i];
    if (b === 0xff || b === 0x00) break;
    out += GEN3_CHAR[b] ?? "";
  }
  return out.trim();
}

/** Gen 4 glyph → string (international table). */
export function decode_gen4(bytes, off = 0, byteLen = 22) {
  let out = "";
  for (let i = 0; i + 1 < byteLen; i += 2) {
    const v = bytes[off + i] | (bytes[off + i + 1] << 8);
    if (v === 0xffff || v === 0) break;
    const cp = v < GEN4_TABLE_INT.length ? GEN4_TABLE_INT[v] : 0xffff;
    if (cp === 0xffff) break;
    let ch = String.fromCharCode(cp);
    if (cp === 0x246d) ch = "♂";
    if (cp === 0x246e) ch = "♀";
    out += ch;
  }
  return out.trim();
}

/** Gen 5 UTF-16LE. */
export function decode_gen5(bytes, off = 0, byteLen = 22) {
  let out = "";
  for (let i = 0; i + 1 < byteLen; i += 2) {
    const v = bytes[off + i] | (bytes[off + i + 1] << 8);
    if (v === 0xffff || v === 0) break;
    out += String.fromCharCode(v);
  }
  return out.trim();
}
