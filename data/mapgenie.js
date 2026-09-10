/** Só links externos opcionais (toolbar). Nada de iframe — MapGenie/PokéRegions quebram embed. */
export const EXTERNAL_LINKS = {
  dppt: { page: "https://pokeregions.com/sinnoh", labelKey: "maps_pokeregions" },
  bdsp: { page: "https://pokeregions.com/sinnoh", labelKey: "maps_pokeregions" },
};

export function external_link(slug) {
  return EXTERNAL_LINKS[slug] || null;
}
