const KEY = "caraio_sprite_mode";

/** @returns {"3d"|"2d"} */
export function sprite_mode() {
  const v = localStorage.getItem(KEY);
  return v === "2d" ? "2d" : "3d";
}

export function set_sprite_mode(mode) {
  localStorage.setItem(KEY, mode === "2d" ? "2d" : "3d");
}

export function art_urls(id, mode = sprite_mode()) {
  const home = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`;
  const art = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const pix = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  if (mode === "2d") {
    return { primary: pix, fallback: art, last: home };
  }
  return { primary: home, fallback: art, last: pix };
}

export function art_src(id, mode = sprite_mode()) {
  return art_urls(id, mode).primary;
}

export function art_onerror_attr(id, mode = sprite_mode()) {
  const u = art_urls(id, mode);
  return `onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${u.fallback}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${u.last}'}"`;
}

const SPRITES =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** id de arquivo: 201, 201-b, 201-exclamation */
export function form_file_id(speciesId, formName) {
  const id = Number(speciesId) || speciesId;
  const fn = String(formName || "").trim();
  return fn ? `${id}-${fn}` : String(id);
}

/**
 * URLs da forma no modo ativo da dex (3d = Home, 2d = pixel).
 * @param {{ form_name?: string, sprites?: { front?: string, shiny?: string } }} form
 */
export function form_art_urls(speciesId, form, { shiny = false, mode = sprite_mode() } = {}) {
  const fileId = form_file_id(speciesId, form?.form_name);
  const pix =
    (shiny ? form?.sprites?.shiny : form?.sprites?.front) ||
    form?.sprites?.front ||
    `${SPRITES}/${fileId}.png`;
  const pixShiny = form?.sprites?.shiny || `${SPRITES}/shiny/${fileId}.png`;
  const home = shiny
    ? `${SPRITES}/other/home/shiny/${fileId}.png`
    : `${SPRITES}/other/home/${fileId}.png`;
  const homePlain = shiny
    ? `${SPRITES}/other/home/shiny/${speciesId}.png`
    : `${SPRITES}/other/home/${speciesId}.png`;
  const art = `${SPRITES}/other/official-artwork/${speciesId}.png`;

  if (mode === "2d") {
    return {
      primary: shiny ? pixShiny || pix : pix,
      fallback: art,
      last: home,
    };
  }
  return {
    primary: home,
    fallback: homePlain,
    last: shiny ? pixShiny || pix : pix,
  };
}

export function form_art_src(speciesId, form, opts = {}) {
  return form_art_urls(speciesId, form, opts).primary;
}

/** onerror em cadeia pra <img> de forma */
export function form_art_onerror_attr(speciesId, form, opts = {}) {
  const u = form_art_urls(speciesId, form, opts);
  return `onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${u.fallback}'}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='${u.last}'}"`;
}
