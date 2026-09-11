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

function invert_map(forward) {
  const rev = {};
  for (const [k, v] of Object.entries(forward)) {
    if (!v) continue;
    if (rev[v] == null) rev[v] = Number(k);
  }
  return rev;
}

const GEN12_REV = invert_map(GEN12_CHAR);
GEN12_REV[" "] = 0x7f;
const GEN3_REV = invert_map(GEN3_CHAR);
GEN3_REV[" "] = 0xba;

const GEN4_REV = (() => {
  const m = {};
  for (let i = 0; i < GEN4_TABLE_INT.length; i++) {
    const cp = GEN4_TABLE_INT[i];
    if (cp === 0xffff) continue;
    const ch = String.fromCharCode(cp);
    if (m[ch] == null) m[ch] = i;
  }
  m["♂"] = m["♂"] ?? 0x1b1; // fallbacks unused if table has them
  m["♀"] = m["♀"] ?? 0x1b2;
  return m;
})();

/** Encode Gen1/2 name (terminator 0x50). */
export function encode_gen12(str, len = 11) {
  const out = new Uint8Array(len);
  out.fill(0x50);
  const s = String(str || "");
  let j = 0;
  for (let i = 0; i < s.length && j < len - 1; i++) {
    const code = GEN12_REV[s[i]];
    if (code == null) continue;
    out[j++] = code;
  }
  if (j < len) out[j] = 0x50;
  return out;
}

/** Encode Gen3 name (terminator 0xFF). */
export function encode_gen3(str, len = 10) {
  const out = new Uint8Array(len);
  out.fill(0xff);
  const s = String(str || "");
  let j = 0;
  for (let i = 0; i < s.length && j < len - 1; i++) {
    const code = GEN3_REV[s[i]];
    if (code == null) continue;
    out[j++] = code;
  }
  return out;
}

/** Encode Gen4 glyph name (u16 LE, terminator 0xFFFF). */
export function encode_gen4(str, byteLen = 22) {
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i += 2) {
    out[i] = 0xff;
    out[i + 1] = 0xff;
  }
  const s = String(str || "");
  let j = 0;
  for (let i = 0; i < s.length && j + 1 < byteLen - 2; i++) {
    let ch = s[i];
    let code = GEN4_REV[ch];
    if (code == null && ch >= "A" && ch <= "Z") code = GEN4_REV[ch] ?? ch.charCodeAt(0);
    if (code == null) continue;
    out[j] = code & 0xff;
    out[j + 1] = (code >> 8) & 0xff;
    j += 2;
  }
  return out;
}

/** Encode Gen5 UTF-16LE name (terminator 0xFFFF). */
export function encode_gen5(str, byteLen = 22) {
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i += 2) {
    out[i] = 0xff;
    out[i + 1] = 0xff;
  }
  const s = String(str || "");
  let j = 0;
  for (let i = 0; i < s.length && j + 1 < byteLen - 2; i++) {
    const code = s.charCodeAt(i);
    out[j] = code & 0xff;
    out[j + 1] = (code >> 8) & 0xff;
    j += 2;
  }
  return out;
}
