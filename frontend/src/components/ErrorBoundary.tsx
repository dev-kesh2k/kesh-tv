import { Component, ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

/** Erro inesperado numa tela: mostra aviso com "Recarregar" em vez de tela em branco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Erro na tela:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
            <TriangleAlert className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
          <p className="mt-2 text-sm text-slate-400">Recarregue para tentar de novo. Se continuar, avise com o que você estava fazendo.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink-950"
          >
            <RotateCcw className="h-4 w-4" /> Recarregar
          </button>
        </div>
      </div>
    );
  }
}
