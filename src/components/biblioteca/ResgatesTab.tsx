import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { ResgateDetalhado } from '../../services/bibliotecaService';
import { listarResgates, marcarResgateEntregue, cancelarResgate } from '../../services/bibliotecaService';

const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendente', ENTREGUE: 'Entregue', CANCELADO: 'Cancelado' };
const STATUS_COR: Record<string, string> = {
  PENDENTE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ENTREGUE: 'bg-green-500/10 text-green-500 border-green-500/20',
  CANCELADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function ResgatesTab() {
  const { usuarioId } = useAuth();
  const [resgates, setResgates] = useState<ResgateDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setResgates(await listarResgates());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleEntregar(id: string) {
    if (!usuarioId) return;
    setProcessandoId(id);
    setErro(null);
    try {
      await marcarResgateEntregue(id, usuarioId);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao marcar entrega.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleCancelar(id: string) {
    setProcessandoId(id);
    setErro(null);
    try {
      await cancelarResgate(id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cancelar resgate.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs font-black uppercase tracking-wider text-ms-main">Resgates ({resgates.length})</p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
      ) : resgates.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum resgate ainda.</p>
      ) : (
        resgates.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
            <div>
              <p className="text-sm font-bold text-ms-main">{r.recompensa_nome} <span className="text-[10px] text-gray-500 font-mono">#{r.codigo}</span></p>
              <p className="text-[11px] text-gray-500">{r.aluno_nome} · {r.custo_pontos} pontos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${STATUS_COR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              {r.status === 'PENDENTE' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEntregar(r.id)}
                    disabled={processandoId === r.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Entregar
                  </button>
                  <button
                    onClick={() => handleCancelar(r.id)}
                    disabled={processandoId === r.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
