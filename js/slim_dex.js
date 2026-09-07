import { cuzin_lang } from "./i18n.js";

let pack = null;
let byId = null;
let bySlug = null;

function data_url() {
  // funciona de / e de /dex/
  const parts = location.pathname.split("/").filter(Boolean);
  const leaf = parts[parts.length - 1] || "";
  const inSub = ["dex", "maps", "plan", "roms"].includes(leaf) ||
    (leaf.endsWith(".html") && parts.length >= 2 &&
      ["dex", "maps", "plan", "roms"].includes(parts[parts.length - 2]));
  return `${inSub ? "../" : ""}data/dex_slim.json`;
}

export async function carrega_slim() {
  if (pack) return pack;
  const res = await fetch(data_url(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`slim HTTP ${res.status}`);
  pack = await res.json();
  byId = new Map(pack.pokemon.map((p) => [p.id, p]));
  bySlug = new Map(pack.pokemon.map((p) => [p.slug, p]));
  return pack;
}

export function slim_pronto() {
  return !!pack;
}

export function slim_lista() {
  return pack?.pokemon || [];
}

export function slim_por_id(id) {
  return byId?.get(Number(id)) || null;
}

export function slim_por_slug(slug) {
  return bySlug?.get(String(slug).toLowerCase()) || null;
}

export function slim_nome(p) {
  if (!p) return "";
  const lang = cuzin_lang() === "pt" ? "pt" : "en";
  return p.name?.[lang] || p.name?.en || p.slug || "";
}

export function slim_genus(p) {
  if (!p) return "";
  const lang = cuzin_lang() === "pt" ? "pt" : "en";
  return p.genus?.[lang] || p.genus?.en || "";
}

/** catálogo no formato que a dex já usa */
export function slim_como_catalogo() {
  return slim_lista().map((p) => ({
    id: p.id,
    slug: p.slug,
    name: slim_nome(p),
    gen: p.gen || 0,
    types: p.types || [],
    stats: p.stats || null,
  }));
}
