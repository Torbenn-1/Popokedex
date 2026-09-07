/** pins % no overview CC0 (assets/maps/{region}.png)
 *  match: substring no slug da location PokéAPI
 *  pokemaps: URL do mapa detalhado (referência externa; não hospedamos tiles deles)
 */

export const MAPA_POR_REGIAO = {
  kanto: {
    image: "kanto.png",
    pokemaps: {
      rby: "https://pokemaps.net/maps/rby/kanto",
      frlg: "https://pokemaps.net/maps/frlg/kanto",
    },
    pins: [
      { id: "indigo-plateau", label: "Indigo Plateau", match: ["indigo-plateau"], x: 8, y: 7 },
      { id: "pewter-city", label: "Pewter City", match: ["pewter-city"], x: 22, y: 12 },
      { id: "mt-moon", label: "Mt. Moon", match: ["mt-moon"], x: 40, y: 12 },
      { id: "cerulean-city", label: "Cerulean City", match: ["cerulean-city"], x: 62, y: 14 },
      { id: "cerulean-cave", label: "Cerulean Cave", match: ["cerulean-cave"], x: 55, y: 8 },
      { id: "route-24", label: "Route 24", match: ["route-24", "kanto-route-24"], x: 70, y: 10 },
      { id: "route-25", label: "Route 25", match: ["route-25", "kanto-route-25"], x: 78, y: 8 },
      { id: "viridian-city", label: "Viridian City", match: ["viridian-city"], x: 18, y: 38 },
      { id: "viridian-forest", label: "Viridian Forest", match: ["viridian-forest"], x: 18, y: 26 },
      { id: "route-22", label: "Route 22", match: ["route-22", "kanto-route-22"], x: 8, y: 38 },
      { id: "route-23", label: "Victory Road path", match: ["route-23", "kanto-route-23", "victory-road"], x: 8, y: 22 },
      { id: "pallet-town", label: "Pallet Town", match: ["pallet-town"], x: 18, y: 58 },
      { id: "route-1", label: "Route 1", match: ["route-1", "kanto-route-1"], x: 18, y: 48 },
      { id: "cinnabar-island", label: "Cinnabar Island", match: ["cinnabar-island"], x: 18, y: 88 },
      { id: "pokemon-mansion", label: "Pokémon Mansion", match: ["pokemon-mansion"], x: 12, y: 84 },
      { id: "seafoam", label: "Seafoam Islands", match: ["seafoam"], x: 40, y: 88 },
      { id: "celadon-city", label: "Celadon City", match: ["celadon-city"], x: 40, y: 42 },
      { id: "saffron-city", label: "Saffron City", match: ["saffron-city"], x: 55, y: 42 },
      { id: "vermilion-city", label: "Vermilion City", match: ["vermilion-city"], x: 55, y: 58 },
      { id: "digletts-cave", label: "Diglett's Cave", match: ["digletts-cave"], x: 48, y: 52 },
      { id: "lavender-town", label: "Lavender Town", match: ["lavender-town"], x: 78, y: 42 },
      { id: "pokemon-tower", label: "Pokémon Tower", match: ["pokemon-tower"], x: 84, y: 38 },
      { id: "rock-tunnel", label: "Rock Tunnel", match: ["rock-tunnel"], x: 78, y: 28 },
      { id: "power-plant", label: "Power Plant", match: ["power-plant"], x: 86, y: 28 },
      { id: "fuchsia-city", label: "Fuchsia City", match: ["fuchsia-city"], x: 55, y: 78 },
      { id: "safari-zone", label: "Safari Zone", match: ["safari-zone"], x: 55, y: 70 },
      { id: "route-12", label: "Route 12", match: ["route-12", "kanto-route-12"], x: 78, y: 58 },
      { id: "route-10", label: "Route 10", match: ["route-10", "kanto-route-10"], x: 78, y: 22 },
    ],
  },
  johto: {
    image: "johto.png",
    pokemaps: { gsc: "https://pokemaps.net/maps/gsc/johto", hgss: "https://pokemaps.net/maps/gsc/johto" },
    pins: [
      { id: "new-bark", label: "New Bark Town", match: ["new-bark"], x: 88, y: 55 },
      { id: "cherrygrove", label: "Cherrygrove City", match: ["cherrygrove"], x: 78, y: 62 },
      { id: "violet", label: "Violet City", match: ["violet-city"], x: 62, y: 42 },
      { id: "azalea", label: "Azalea Town", match: ["azalea"], x: 48, y: 72 },
      { id: "goldenrod", label: "Goldenrod City", match: ["goldenrod"], x: 42, y: 52 },
      { id: "ecruteak", label: "Ecruteak City", match: ["ecruteak"], x: 42, y: 28 },
      { id: "olivine", label: "Olivine City", match: ["olivine"], x: 22, y: 42 },
      { id: "cianwood", label: "Cianwood City", match: ["cianwood"], x: 12, y: 62 },
      { id: "mahogany", label: "Mahogany Town", match: ["mahogany"], x: 62, y: 28 },
      { id: "blackthorn", label: "Blackthorn City", match: ["blackthorn"], x: 78, y: 22 },
      { id: "national-park", label: "National Park", match: ["national-park"], x: 42, y: 40 },
      { id: "mt-mortar", label: "Mt. Mortar", match: ["mt-mortar"], x: 55, y: 28 },
      { id: "lake-of-rage", label: "Lake of Rage", match: ["lake-of-rage"], x: 62, y: 12 },
      { id: "ice-path", label: "Ice Path", match: ["ice-path"], x: 72, y: 18 },
      { id: "whirl", label: "Whirl Islands", match: ["whirl"], x: 22, y: 55 },
    ],
  },
  hoenn: {
    image: "hoenn.png",
    pokemaps: {
      rse: "https://pokemaps.net/maps/rse/hoenn",
      oras: "https://pokemaps.net/maps/rse/hoenn",
    },
    pins: [
      { id: "littleroot", label: "Littleroot Town", match: ["littleroot"], x: 28, y: 78 },
      { id: "oldale", label: "Oldale Town", match: ["oldale"], x: 28, y: 68 },
      { id: "petalburg", label: "Petalburg City", match: ["petalburg"], x: 18, y: 62 },
      { id: "rustboro", label: "Rustboro City", match: ["rustboro"], x: 12, y: 42 },
      { id: "dewford", label: "Dewford Town", match: ["dewford"], x: 18, y: 82 },
      { id: "slateport", label: "Slateport City", match: ["slateport"], x: 38, y: 72 },
      { id: "mauville", label: "Mauville City", match: ["mauville"], x: 48, y: 52 },
      { id: "verdanturf", label: "Verdanturf Town", match: ["verdanturf"], x: 38, y: 52 },
      { id: "fallarbor", label: "Fallarbor Town", match: ["fallarbor"], x: 28, y: 22 },
      { id: "lavaridge", label: "Lavaridge Town", match: ["lavaridge"], x: 38, y: 32 },
      { id: "fortree", label: "Fortree City", match: ["fortree"], x: 62, y: 28 },
      { id: "lilycove", label: "Lilycove City", match: ["lilycove"], x: 78, y: 42 },
      { id: "mossdeep", label: "Mossdeep City", match: ["mossdeep"], x: 88, y: 52 },
      { id: "sootopolis", label: "Sootopolis City", match: ["sootopolis"], x: 72, y: 58 },
      { id: "pacifidlog", label: "Pacifidlog Town", match: ["pacifidlog"], x: 58, y: 72 },
      { id: "ever-grande", label: "Ever Grande City", match: ["ever-grande"], x: 92, y: 68 },
      { id: "mt-chimney", label: "Mt. Chimney", match: ["mt-chimney"], x: 38, y: 28 },
      { id: "mt-pyre", label: "Mt. Pyre", match: ["mt-pyre"], x: 72, y: 48 },
    ],
  },
  sinnoh: {
    image: "sinnoh.png",
    pokemaps: {
      dppt: "https://pokemaps.net/maps/dpp/sinnoh",
      bdsp: "https://pokemaps.net/maps/dpp/sinnoh",
    },
    pins: [
      { id: "twinleaf", label: "Twinleaf Town", match: ["twinleaf"], x: 22, y: 82 },
      { id: "sandgem", label: "Sandgem Town", match: ["sandgem"], x: 32, y: 78 },
      { id: "jubilife", label: "Jubilife City", match: ["jubilife"], x: 28, y: 58 },
      { id: "oreburgh", label: "Oreburgh City", match: ["oreburgh"], x: 42, y: 68 },
      { id: "floaroma", label: "Floaroma Town", match: ["floaroma"], x: 28, y: 42 },
      { id: "eterna", label: "Eterna City", match: ["eterna-city"], x: 42, y: 38 },
      { id: "hearthome", label: "Hearthome City", match: ["hearthome"], x: 55, y: 52 },
      { id: "solaceon", label: "Solaceon Town", match: ["solaceon"], x: 68, y: 48 },
      { id: "veilstone", label: "Veilstone City", match: ["veilstone"], x: 82, y: 42 },
      { id: "pastoria", label: "Pastoria City", match: ["pastoria"], x: 68, y: 72 },
      { id: "celestic", label: "Celestic Town", match: ["celestic"], x: 55, y: 32 },
      { id: "canalave", label: "Canalave City", match: ["canalave"], x: 12, y: 52 },
      { id: "snowpoint", label: "Snowpoint City", match: ["snowpoint"], x: 55, y: 12 },
      { id: "sunyshore", label: "Sunyshore City", match: ["sunyshore"], x: 92, y: 68 },
      { id: "mt-coronet", label: "Mt. Coronet", match: ["mt-coronet"], x: 48, y: 42 },
      { id: "lake-verity", label: "Lake Verity", match: ["verity"], x: 18, y: 72 },
      { id: "lake-valor", label: "Lake Valor", match: ["valor"], x: 72, y: 62 },
      { id: "lake-acuity", label: "Lake Acuity", match: ["acuity"], x: 48, y: 12 },
    ],
  },
  unova: {
    image: "unova.png",
    pokemaps: {},
    pins: [
      { id: "nuvema", label: "Nuvema Town", match: ["nuvema"], x: 78, y: 78 },
      { id: "accumula", label: "Accumula Town", match: ["accumula"], x: 72, y: 68 },
      { id: "striaton", label: "Striaton City", match: ["striaton"], x: 68, y: 55 },
      { id: "nacrene", label: "Nacrene City", match: ["nacrene"], x: 58, y: 58 },
      { id: "castelia", label: "Castelia City", match: ["castelia"], x: 48, y: 72 },
      { id: "nimbasa", label: "Nimbasa City", match: ["nimbasa"], x: 48, y: 48 },
      { id: "driftveil", label: "Driftveil City", match: ["driftveil"], x: 32, y: 52 },
      { id: "mistralton", label: "Mistralton City", match: ["mistralton"], x: 22, y: 38 },
      { id: "icirrus", label: "Icirrus City", match: ["icirrus"], x: 28, y: 28 },
      { id: "opelucid", label: "Opelucid City", match: ["opelucid"], x: 48, y: 28 },
      { id: "lacunosa", label: "Lacunosa Town", match: ["lacunosa"], x: 72, y: 28 },
      { id: "undella", label: "Undella Town", match: ["undella"], x: 82, y: 38 },
      { id: "black-city", label: "Black City / White Forest", match: ["black-city", "white-forest"], x: 88, y: 22 },
      { id: "victory-road-unova", label: "Victory Road", match: ["victory-road"], x: 48, y: 18 },
    ],
  },
  kalos: {
    image: "kalos.png",
    pokemaps: {},
    pins: [
      { id: "vaniville", label: "Vaniville Town", match: ["vaniville"], x: 72, y: 82 },
      { id: "aquacorde", label: "Aquacorde Town", match: ["aquacorde"], x: 68, y: 72 },
      { id: "santalune", label: "Santalune City", match: ["santalune"], x: 62, y: 62 },
      { id: "lumiose", label: "Lumiose City", match: ["lumiose"], x: 52, y: 48 },
      { id: "camphrier", label: "Camphrier Town", match: ["camphrier"], x: 38, y: 48 },
      { id: "cyllage", label: "Cyllage City", match: ["cyllage"], x: 22, y: 52 },
      { id: "geosenge", label: "Geosenge Town", match: ["geosenge"], x: 18, y: 38 },
      { id: "shalour", label: "Shalour City", match: ["shalour"], x: 28, y: 32 },
      { id: "coumarine", label: "Coumarine City", match: ["coumarine"], x: 42, y: 28 },
      { id: "laverre", label: "Laverre City", match: ["laverre"], x: 62, y: 22 },
      { id: "dendemille", label: "Dendemille Town", match: ["dendemille"], x: 72, y: 32 },
      { id: "anistar", label: "Anistar City", match: ["anistar"], x: 82, y: 42 },
      { id: "couriway", label: "Couriway Town", match: ["couriway"], x: 82, y: 55 },
      { id: "snowbelle", label: "Snowbelle City", match: ["snowbelle"], x: 72, y: 62 },
      { id: "kiloude", label: "Kiloude City", match: ["kiloude"], x: 78, y: 78 },
    ],
  },
  alola: {
    image: "alola.png",
    pokemaps: {},
    pins: [
      { id: "iku-melemele", label: "Melemele — Iki Town", match: ["iki-town", "melemele"], x: 22, y: 42 },
      { id: "hauoli", label: "Hau'oli City", match: ["hauoli", "hau-oli"], x: 18, y: 55 },
      { id: "konikoni", label: "Konikoni City", match: ["konikoni"], x: 42, y: 72 },
      { id: "pailolo", label: "Paniola Town", match: ["paniola"], x: 48, y: 58 },
      { id: "royal-avenue", label: "Royal Avenue", match: ["royal-avenue"], x: 55, y: 62 },
      { id: "malie", label: "Malie City", match: ["malie"], x: 72, y: 38 },
      { id: "tapu-village", label: "Tapu Village", match: ["tapu-village"], x: 78, y: 48 },
      { id: "po-town", label: "Po Town", match: ["po-town"], x: 85, y: 32 },
      { id: "seafolk", label: "Seafolk Village", match: ["seafolk"], x: 62, y: 78 },
      { id: "vast-poni", label: "Vast Poni Canyon", match: ["vast-poni", "poni"], x: 55, y: 85 },
    ],
  },
  paldea: {
    image: "paldea.png",
    pokemaps: {
      sv: "https://pokemaps.net/maps/sv/paldea",
    },
    pins: [
      { id: "mesagoza", label: "Mesagoza", match: ["mesagoza"], x: 48, y: 55 },
      { id: "cabo-pocobre", label: "Cabo Poco", match: ["cabo-poco", "poco-path"], x: 42, y: 78 },
      { id: "los-platos", label: "Los Platos", match: ["los-platos"], x: 45, y: 68 },
      { id: "cortondo", label: "Cortondo", match: ["cortondo"], x: 28, y: 62 },
      { id: "cascarrafa", label: "Cascarrafa", match: ["cascarrafa"], x: 22, y: 48 },
      { id: "porto-marinada", label: "Porto Marinada", match: ["porto-marinada"], x: 12, y: 42 },
      { id: "medali", label: "Medali", match: ["medali"], x: 38, y: 38 },
      { id: "zapapico", label: "Zapapico", match: ["zapapico"], x: 62, y: 32 },
      { id: "levincia", label: "Levincia", match: ["levincia"], x: 78, y: 48 },
      { id: "artazon", label: "Artazon", match: ["artazon"], x: 62, y: 58 },
      { id: "montenevera", label: "Montenevera", match: ["montenevera"], x: 55, y: 22 },
      { id: "alfornada", label: "Alfornada", match: ["alfornada"], x: 28, y: 72 },
      { id: "area-zero", label: "Area Zero", match: ["area-zero", "zero-gate"], x: 50, y: 42 },
    ],
  },
  galar: {
    image: null,
    pokemaps: {},
    pins: [],
  },
};

export function mapa_da_regiao(region) {
  return MAPA_POR_REGIAO[region] || null;
}

export function pokemaps_url(jogo) {
  if (!jogo) return "https://pokemaps.net/maps";
  const m = MAPA_POR_REGIAO[jogo.region];
  return m?.pokemaps?.[jogo.slug] || "https://pokemaps.net/maps";
}

export function pin_bate(pin, locationSlug) {
  const s = locationSlug.toLowerCase();
  return pin.match.some((m) => s.includes(m));
}
