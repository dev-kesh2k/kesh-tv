// Navegação por setas (controle remoto da TV, teclado): move o foco para o item mais próximo na direção
// pressionada, por posição na tela. Enter/OK abre (comportamento normal de links e botões).

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
type Dir = 'up' | 'down' | 'left' | 'right';
const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
// Teclas "Voltar" de controles de TV (Tizen 10009, webOS 461) e navegadores.
const BACK_KEYS = new Set(['GoBack', 'BrowserBack']);
const BACK_CODES = new Set([10009, 461]);

function visible(el: HTMLElement) {
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
}

/** Próximo elemento na direção: distância no eixo principal + desvio lateral pesado (fica na mesma linha/coluna). */
export function nextInDirection(from: DOMRect, dir: Dir, candidates: { el: HTMLElement; rect: DOMRect }[]) {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const { el, rect: r } of candidates) {
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let main: number;
    let side: number;
    if (dir === 'down') [main, side] = [r.top - from.bottom, Math.abs(x - cx)];
    else if (dir === 'up') [main, side] = [from.top - r.bottom, Math.abs(x - cx)];
    else if (dir === 'right') [main, side] = [r.left - from.right, Math.abs(y - cy)];
    else [main, side] = [from.left - r.right, Math.abs(y - cy)];
    if (main < -4) continue; // está para o outro lado
    const score = Math.max(0, main) + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function installSpatialNav() {
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement as HTMLElement | null;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

    if (BACK_KEYS.has(e.key) || BACK_CODES.has(e.keyCode) || (e.key === 'Backspace' && !typing)) {
      // Só volta dentro do app (o React Router guarda o índice da tela em history.state.idx).
      if ((window.history.state?.idx ?? 0) > 0) {
        e.preventDefault();
        window.history.back();
      }
      return;
    }

    const dir = KEYS[e.key];
    if (!dir) return;
    // Dentro de um campo, ← → movem o cursor no texto.
    if (typing && (dir === 'left' || dir === 'right')) return;
    const nothingFocused = !active || active === document.body || active.tagName === 'VIDEO';
    // Na tela do canal, sem nada em destaque, as setas são do player (canal ↑↓, tempo ←→).
    if (nothingFocused && location.pathname.includes('/assistir/')) return;

    const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    if (!all.length) return;
    e.preventDefault();
    let target: HTMLElement | null;
    if (nothingFocused) {
      // Primeiro toque nas setas: começa pelo conteúdo da página (não pelo menu).
      target = all.find((el) => el.closest('main')) || all[0];
    } else {
      const candidates = all.filter((el) => el !== active).map((el) => ({ el, rect: el.getBoundingClientRect() }));
      target = nextInDirection(active!.getBoundingClientRect(), dir, candidates);
    }
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: dir === 'up' || dir === 'down' ? 'center' : 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}
