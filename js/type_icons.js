/** ícones de tipo (SVG simples, estilo portal) */
const ICONS = {
  normal: `<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`,
  fire: `<path fill="currentColor" d="M12 3c2 3 1 5-1 7 3-1 6 1 6 5a5 5 0 1 1-10 0c0-4 3-6 5-12z"/>`,
  water: `<path fill="currentColor" d="M12 3.5c3.5 4.2 6 7 6 10a6 6 0 1 1-12 0c0-3 2.5-5.8 6-10z"/>`,
  electric: `<path fill="currentColor" d="M13 2 6 13h5l-1 9 8-12h-5l0-8z"/>`,
  grass: `<path fill="currentColor" d="M12 20c-4-1-7-5-7-9 4 0 7 2 9 5 1-4 4-6 7-7-1 6-4 10-9 11z"/>`,
  ice: `<path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 3v18M5 7l14 10M19 7 5 17M4 12h16"/>`,
  fighting: `<path fill="currentColor" d="M8 11V7a2 2 0 1 1 4 0v2h1V6a2 2 0 1 1 4 0v6l1 1v4a4 4 0 0 1-8 0v-2H8a2 2 0 0 1-2-2v-1a1 1 0 0 1 2-1z"/>`,
  poison: `<circle cx="12" cy="10" r="5" fill="currentColor"/><circle cx="9.5" cy="17.5" r="2" fill="currentColor"/><circle cx="14.5" cy="17.5" r="2" fill="currentColor"/>`,
  ground: `<path fill="currentColor" d="M3 16 8 8h8l5 8H3zm5-2h2v2H8v-2zm4 0h2v2h-2v-2z"/>`,
  flying: `<path fill="currentColor" d="M4 14c4-1 7-4 8-8 1 4 4 7 8 8-4 1-7 4-8 8-1-4-4-7-8-8z"/>`,
  psychic: `<circle cx="12" cy="12" r="3" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8"/>`,
  bug: `<path fill="currentColor" d="M12 7a4 4 0 0 1 4 4v2H8v-2a4 4 0 0 1 4-4zm-6 5 3 1M18 12l-3 1M9 18l-2 3M15 18l2 3M12 5V3"/>`,
  rock: `<path fill="currentColor" d="M7 8 12 4l5 4 2 6-4 5H9l-4-5 2-6z"/>`,
  ghost: `<path fill="currentColor" d="M12 3c4 0 7 3 7 7v8l-2.3-1.5L14 19l-2-2.5L10 19l-2.7-2.5L5 18V10c0-4 3-7 7-7z"/><circle cx="9.5" cy="11" r="1.2" fill="#fff"/><circle cx="14.5" cy="11" r="1.2" fill="#fff"/>`,
  dragon: `<path fill="currentColor" d="M12 3 8 8l4 2 4-2-4-5zm-7 8 5 2-1 8H6l-1-10zm14 0-5 2 1 8h3l1-10z"/>`,
  dark: `<path fill="currentColor" d="M13 3a9 9 0 1 0 8 13A7 7 0 0 1 13 3z"/>`,
  steel: `<path fill="currentColor" d="M12 3 4 8v8l8 5 8-5V8l-8-5zm0 3.2L17.5 9 12 12.2 6.5 9 12 6.2z"/>`,
  fairy: `<path fill="currentColor" d="M12 3.5 13.8 9H19l-4 3.2L16.5 18 12 14.8 7.5 18 9 12.2 5 9h5.2L12 3.5z"/>`,
};

export function type_icon_html(type) {
  const body = ICONS[type] || ICONS.normal;
  return `<span class="type-ico" data-type="${type}" title="${type}" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18">${body}</svg>
  </span>`;
}
