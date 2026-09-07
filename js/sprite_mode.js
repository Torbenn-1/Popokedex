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
