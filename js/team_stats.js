/** IVs / EVs pra sets competitivos. */

export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

export const STAT_SHORT = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export const EV_CAP = 252;
export const EV_TOTAL = 510;
export const IV_CAP = 31;

export function ivs_default() {
  return { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
}

export function evs_default() {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

export function normaliza_ivs(raw) {
  const out = ivs_default();
  if (!raw || typeof raw !== "object") return out;
  for (const k of STAT_KEYS) {
    if (raw[k] == null || raw[k] === "") continue;
    out[k] = clamp(raw[k], 0, IV_CAP);
  }
  return out;
}

export function normaliza_evs(raw) {
  const out = evs_default();
  if (!raw || typeof raw !== "object") return out;
  for (const k of STAT_KEYS) {
    if (raw[k] == null || raw[k] === "") continue;
    out[k] = clamp(raw[k], 0, EV_CAP);
  }
  return out;
}

export function soma_evs(evs) {
  return STAT_KEYS.reduce((s, k) => s + (evs?.[k] || 0), 0);
}

export function ivs_padrao(ivs) {
  const n = normaliza_ivs(ivs);
  return STAT_KEYS.every((k) => n[k] === 31);
}

export function evs_zerados(evs) {
  const n = normaliza_evs(evs);
  return STAT_KEYS.every((k) => n[k] === 0);
}

/** Spread estilo Showdown: "252 Atk / 4 SpD / 252 Spe" */
export function rotulo_ev_spread(evs) {
  const n = normaliza_evs(evs);
  const bits = STAT_KEYS.filter((k) => n[k] > 0).map(
    (k) => `${n[k]} ${STAT_SHORT[k]}`
  );
  return bits.length ? bits.join(" / ") : "—";
}

export function rotulo_iv_resumo(ivs) {
  const n = normaliza_ivs(ivs);
  if (ivs_padrao(n)) return "31 across";
  const low = STAT_KEYS.filter((k) => n[k] < 31);
  if (!low.length) return "31 across";
  return low.map((k) => `${n[k]} ${STAT_SHORT[k]}`).join(", ");
}

export function tem_stats(mon) {
  if (!mon) return false;
  return !ivs_padrao(mon.ivs) || !evs_zerados(mon.evs);
}
