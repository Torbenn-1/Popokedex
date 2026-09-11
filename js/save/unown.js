/** Unown letter/form from save data → sprite suffix. */

/** Form index 0–27 → PokeAPI file suffix (A=default often bare `201`). */
const UNOWN_SUFFIX = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "exclamation", "question",
];

const UNOWN_LETTER = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "!", "?",
];

export const UNOWN_DEX = 201;

/** Gen 2: middle bits of Atk/Def/Spe/Spc DVs. */
export function unown_form_gen2(ivs) {
  if (!ivs) return 0;
  let v = 0;
  v |= (ivs.atk & 0x6) << 5;
  v |= (ivs.def & 0x6) << 3;
  v |= (ivs.spe & 0x6) << 1;
  v |= ((ivs.spc ?? ivs.spa ?? 0) & 0x6) >> 1;
  return (v / 10) | 0; // 0–25
}

/** Gen 3: letter from PID (FRLG / all Gen3 Unown). */
export function unown_form_gen3(pid) {
  const p = pid >>> 0;
  const value =
    ((p & 0x3000000) >> 18) | ((p & 0x30000) >> 12) | ((p & 0x300) >> 6) | (p & 0x3);
  return value % 28; // 0–27 (A–Z, !, ?)
}

export function unown_suffix(form) {
  const i = Math.max(0, Math.min(27, form | 0));
  return UNOWN_SUFFIX[i];
}

export function unown_letter(form) {
  const i = Math.max(0, Math.min(27, form | 0));
  return UNOWN_LETTER[i];
}

/** Sprite file id: `201`, `201-b`, `201-exclamation`. A → bare 201 (Home prefers it). */
export function unown_sprite_id(form, { shiny = false } = {}) {
  const i = Math.max(0, Math.min(27, form | 0));
  // default A uses base id (works for home + pixel)
  if (i === 0) return "201";
  return `201-${UNOWN_SUFFIX[i]}`;
}

export function apply_unown_fields(mon, form) {
  if (!mon || mon.dexId !== UNOWN_DEX) return mon;
  const f = form | 0;
  mon.form = f;
  mon.formName = unown_suffix(f);
  mon.formLetter = unown_letter(f);
  mon.speciesName = `Unown ${unown_letter(f)}`;
  mon.spriteId = unown_sprite_id(f);
  return mon;
}
