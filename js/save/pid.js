/** Craft PID for Gen3–5 (nature + shiny). */

import { nature_index } from "./ids.js";
import { shiny_from_pid } from "./shiny.js";

function rand32() {
  const a = (Math.random() * 0x100000000) >>> 0;
  return a;
}

/**
 * Find a PID with desired nature and optional shiny vs TID/SID.
 * @returns {number} uint32 PID
 */
export function craft_pid({ nature, shiny, tid, sid, prefer }) {
  const wantNature = nature_index(nature || "hardy");
  const t = (tid ?? 0) & 0xffff;
  const s = (sid ?? 0) & 0xffff;
  const start = prefer != null ? prefer >>> 0 : rand32();

  for (let i = 0; i < 0x100000; i++) {
    const pid = (start + i) >>> 0;
    if (pid % 25 !== wantNature) continue;
    const isShiny = shiny_from_pid(pid, t, s);
    if (!!shiny === isShiny) return pid;
  }

  // Fallback: force nature; shiny via upper/lower craft
  if (shiny) {
    for (let low = 0; low < 0x10000; low++) {
      // xor = tid^sid^hid^lid < 8 → hid^lid = (tid^sid) for perfect shiny (xor 0)
      const target = (t ^ s) & 0xffff;
      const hid = (target ^ low) & 0xffff;
      const pid = ((hid << 16) | low) >>> 0;
      if (pid % 25 === wantNature) return pid;
    }
  }

  for (let i = 0; i < 25; i++) {
    const pid = (wantNature + i * 25) >>> 0;
    if (!shiny || shiny_from_pid(pid, t, s)) return pid;
  }
  return wantNature;
}
