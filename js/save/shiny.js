/** Shiny checks Gen 1–5. */

/** Gen 1/2 DV shiny (also VC Gen1). */
export function shiny_from_dvs(ivs) {
  if (!ivs) return false;
  const atk = ivs.atk & 0xf;
  const def = ivs.def & 0xf;
  const spe = ivs.spe & 0xf;
  const spc = (ivs.spc ?? ivs.spa ?? 0) & 0xf;
  if (def !== 10 || spe !== 10 || spc !== 10) return false;
  return (atk & 2) !== 0; // 2,3,6,7,10,11,14,15
}

/**
 * Gen 3–5 PID shiny.
 * @param {number} pid uint32
 * @param {number} tid uint16
 * @param {number} sid uint16
 * @param {number} [threshold=8] Gen6+ uses 16
 */
export function shiny_from_pid(pid, tid, sid, threshold = 8) {
  const p = pid >>> 0;
  const xor = ((tid & 0xffff) ^ (sid & 0xffff) ^ (p >>> 16) ^ (p & 0xffff)) & 0xffff;
  return xor < threshold;
}
