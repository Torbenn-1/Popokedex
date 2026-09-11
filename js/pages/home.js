import { monta_shell } from "../boot.js";

monta_shell({ active: "home" });

const CRY_LEGACY =
  "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/legacy";

/** ms cortados no fim pra matar o estalo/estática dos .ogg legacy */
const TRIM_END_SEC = 0.09;
const FADE_OUT_SEC = 0.04;

/** @type {Map<number, AudioBuffer>} */
const cryBuffers = new Map();
/** @type {AudioContext | null} */
let audioCtx = null;
/** @type {AudioBufferSourceNode | null} */
let currentSource = null;
/** @type {GainNode | null} */
let currentGain = null;

function get_ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  return audioCtx;
}

async function ensure_ctx_running() {
  const ctx = get_ctx();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (_) {}
  }
  return ctx;
}

/**
 * Corta o final sujo do cry e faz um fade curtinho.
 * @param {AudioContext} ctx
 * @param {AudioBuffer} src
 */
function buffer_limpo(ctx, src) {
  const rate = src.sampleRate;
  const trimSamples = Math.floor(TRIM_END_SEC * rate);
  const fadeSamples = Math.max(1, Math.floor(FADE_OUT_SEC * rate));
  const len = Math.max(1, src.length - trimSamples);
  const out = ctx.createBuffer(src.numberOfChannels, len, rate);

  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const from = src.getChannelData(ch);
    const to = out.getChannelData(ch);
    to.set(from.subarray(0, len));
    const fadeStart = Math.max(0, len - fadeSamples);
    for (let i = fadeStart; i < len; i++) {
      to[i] *= (len - i) / fadeSamples;
    }
  }
  return out;
}

async function carrega_cry(id) {
  const n = Number(id);
  if (!n || cryBuffers.has(n)) return cryBuffers.get(n);

  const res = await fetch(`${CRY_LEGACY}/${n}.ogg`);
  if (!res.ok) throw new Error(`cry ${n}: ${res.status}`);
  const raw = await res.arrayBuffer();
  const ctx = get_ctx();
  const decoded = await ctx.decodeAudioData(raw.slice(0));
  const clean = buffer_limpo(ctx, decoded);
  cryBuffers.set(n, clean);
  return clean;
}

function para_cry() {
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch (_) {}
    try {
      currentSource.disconnect();
    } catch (_) {}
    currentSource = null;
  }
  if (currentGain) {
    try {
      currentGain.disconnect();
    } catch (_) {}
    currentGain = null;
  }
}

async function toca_cry_legacy(id) {
  const n = Number(id);
  if (!n) return;

  const ctx = await ensure_ctx_running();
  let buf = cryBuffers.get(n);
  if (!buf) {
    try {
      buf = await carrega_cry(n);
    } catch (err) {
      console.warn(err);
      return;
    }
  }
  if (!buf) return;

  para_cry();

  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(ctx.destination);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  src.onended = () => {
    if (currentSource === src) {
      currentSource = null;
      currentGain = null;
    }
    try {
      src.disconnect();
      gain.disconnect();
    } catch (_) {}
  };

  currentSource = src;
  currentGain = gain;
  src.start(0);
}

const mons = document.querySelectorAll(".home-orbit__mon[data-cry-id]");
const ids = [...new Set([...mons].map((el) => el.dataset.cryId).filter(Boolean))];

mons.forEach((el) => {
  el.style.cursor = "pointer";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  const play = () => toca_cry_legacy(el.dataset.cryId);
  el.addEventListener("click", play);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      play();
    }
  });
});

// pré-carrega assim que a página abre (fetch + decode em memória)
Promise.allSettled(ids.map((id) => carrega_cry(id))).then((results) => {
  const ok = results.filter((r) => r.status === "fulfilled").length;
  if (ok < ids.length) {
    console.warn(`cries: ${ok}/${ids.length} carregados`);
  }
});
