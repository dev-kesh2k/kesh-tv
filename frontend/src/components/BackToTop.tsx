import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/** Botão flutuante para voltar ao topo depois de rolar bastante (listas com milhares de canais). */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.5);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-brand text-ink-950 shadow-xl shadow-black/40 transition hover:bg-brand-dark lg:bottom-6 lg:right-6"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
