/** Pokémon entity encrypt/decrypt (PKHeX PokeCrypto subset). */

const SIZE_3HEADER = 32;
const SIZE_3STORED = 80;
const SIZE_3BLOCK = 12;
const SIZE_4STORED = 136;
const SIZE_4BLOCK = 32;

/** Shuffle layout for blocks 0–3 × 24 permutations (+dup). */
const BLOCK_POSITION = [
  0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1, 1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
  // dups
  0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 1, 0, 2, 3, 1, 0, 3, 2,
];

function u16le(v, i) {
  return v[i] | (v[i + 1] << 8);
}
function u32le(v, i) {
  return (v[i] | (v[i + 1] << 8) | (v[i + 2] << 16) | (v[i + 3] << 24)) >>> 0;
}
function w16le(v, i, n) {
  v[i] = n & 0xff;
  v[i + 1] = (n >> 8) & 0xff;
}

function crypt_array(data, seed) {
  // XOR every u16 with LCRNG
  for (let i = 0; i + 1 < data.length; i += 2) {
    seed = (Math.imul(0x41c64e6d, seed) + 0x00006073) >>> 0;
    const xor = (seed >>> 16) & 0xffff;
    const cur = data[i] | (data[i + 1] << 8);
    const next = cur ^ xor;
    data[i] = next & 0xff;
    data[i + 1] = (next >> 8) & 0xff;
  }
  return seed;
}

function crypt_array3(data, seed) {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const cur =
      (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) >>> 0;
    const next = (cur ^ seed) >>> 0;
    data[i] = next & 0xff;
    data[i + 1] = (next >> 8) & 0xff;
    data[i + 2] = (next >> 16) & 0xff;
    data[i + 3] = (next >> 24) & 0xff;
  }
}

function shuffle_blocks(data, sv, blockSize) {
  if (sv === 0) return;
  const order = BLOCK_POSITION.slice(sv * 4, sv * 4 + 4);
  const tmp = new Uint8Array(data.length);
  for (let b = 0; b < 4; b++) {
    const src = order[b] * blockSize;
    const dst = b * blockSize;
    tmp.set(data.subarray(src, src + blockSize), dst);
  }
  data.set(tmp);
}

/** In-place decrypt Gen3 80-byte (or 100-byte party) entity. */
export function decrypt3(data) {
  const pid = u32le(data, 0);
  const oid = u32le(data, 4);
  const seed = (pid ^ oid) >>> 0;
  const sv = pid % 24;
  const shuffle = data.subarray(SIZE_3HEADER, SIZE_3STORED);
  crypt_array3(shuffle, seed);
  shuffle_blocks(shuffle, sv, SIZE_3BLOCK);
}

export function is_encrypted3(data) {
  let sum = 0;
  for (let i = SIZE_3HEADER; i < SIZE_3STORED; i += 2) sum = (sum + u16le(data, i)) & 0xffff;
  return sum !== u16le(data, 0x1c);
}

export function decrypt_if_encrypted3(data) {
  if (is_encrypted3(data)) decrypt3(data);
}

/** In-place decrypt Gen4/5 stored (±party). */
export function decrypt45(data) {
  const pv = u32le(data, 0);
  const chk = u16le(data, 6);
  const sv = (pv >>> 13) & 31;
  const shuffle = data.subarray(8, SIZE_4STORED);
  crypt_array(shuffle, chk);
  if (data.length > SIZE_4STORED) crypt_array(data.subarray(SIZE_4STORED), pv);
  shuffle_blocks(shuffle, sv, SIZE_4BLOCK);
}

export function is_encrypted45(data) {
  return u32le(data, 0x64) !== 0;
}

/** Prefer checksum-validated decrypt (avoids false negatives on 0x64). */
export function decrypt_if_encrypted45(data) {
  if (data.length < SIZE_4STORED) return;
  const chk = u16le(data, 6);
  let sum = 0;
  for (let i = 8; i < SIZE_4STORED; i += 2) sum = (sum + u16le(data, i)) & 0xffff;
  const looksPlain = sum === chk && !is_encrypted45(data);
  if (looksPlain) return;

  const backup = data.slice();
  decrypt45(data);
  sum = 0;
  for (let i = 8; i < SIZE_4STORED; i += 2) sum = (sum + u16le(data, i)) & 0xffff;
  if (sum !== u16le(data, 6)) data.set(backup);
}

/** CRC-16/CCITT used by Gen4/5 block footers. */
export function crc16_ccitt(data) {
  let top = 0xff;
  let bot = 0xff;
  for (let i = 0; i < data.length; i++) {
    let x = data[i] ^ top;
    x ^= x >> 4;
    top = (bot ^ (x >> 3) ^ ((x << 4) & 0xff)) & 0xff;
    bot = (x ^ ((x << 5) & 0xff)) & 0xff;
  }
  return ((top << 8) | bot) & 0xffff;
}

export const SIZE = {
  G2_PARTY: 48,
  G2_STORED: 32,
  G3_PARTY: 100,
  G3_STORED: 80,
  G4_PARTY: 236,
  G4_STORED: 136,
  G5_PARTY: 220,
  G5_STORED: 136,
};

export { u16le, u32le, w16le };
