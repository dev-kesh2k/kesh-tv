// Regras de "continuar de onde parou" (filmes e episódios).

const MIN_START = 30; // menos que isso: começa do início
const END_MARGIN = 60; // a menos de 1 min do fim (créditos): considera assistido

/** Posição para retomar, ou 0 se não vale a pena (muito no começo ou já no fim). */
export function resumePoint(position, duration) {
  const pos = Number(position) || 0;
  const dur = Number(duration) || 0;
  if (pos < MIN_START) return 0;
  if (dur > 0 && pos > dur - END_MARGIN) return 0;
  return Math.floor(pos);
}

/** Fração assistida (0–1) para a barrinha de progresso; 1 quando passou dos créditos. */
export function watchedFraction(position, duration) {
  const pos = Number(position) || 0;
  const dur = Number(duration) || 0;
  if (dur <= 0 || pos <= 0) return 0;
  if (pos > dur - END_MARGIN) return 1;
  return Math.min(1, pos / dur);
}

/** Valida o que vem do player: segundos entre 0 e 24 h. */
export function cleanSeconds(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 86400 ? n : null;
}
