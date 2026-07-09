import { useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import type { ConciliacaoPnaeLinha } from '../../types/cozinha';
import { obterConciliacaoPnae } from '../../services/cozinhaService';

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ConciliacaoTab() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hoje());
  const [linhas, setLinhas] = useState<ConciliacaoPnaeLinha[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleConsultar() {
    setLoading(true);
    setErro(null);
    try {
      setLinhas(await obterConciliacaoPnae(inicio, fim));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao consultar conciliação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-xs text-gray-500">
        Compara refeições servidas × alunos matriculados (ativos) por dia/turno. O número oficial do Censo escolar
        (INEP) é reportado à SED-MS fora deste sistema — não substitui a prestação de contas oficial.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <button onClick={handleConsultar} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Consultar
        </button>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {linhas && (
        linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cardápio no período selecionado.</p>
        ) : (
          <div className="space-y-2">
            {linhas.map((l, idx) => {
              const divergente = Math.abs(l.divergencia) > 0;
              return (
                <div key={idx} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${divergente ? 'bg-amber-950/10 border-amber-700/40' : 'bg-ms-card border-gray-800'}`}>
                  <span className="text-sm text-ms-main">
                    {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')} — {l.turno}
                  </span>
                  <span className="text-sm text-gray-400">
                    Servido <b className="text-ms-main">{l.quantidade_servida}</b> · Matriculado <b className="text-ms-main">{l.quantidade_matriculada}</b>
                  </span>
                  <span className={`text-sm font-black ${divergente ? 'text-amber-500' : 'text-green-500'}`}>
                    {l.divergencia > 0 ? `+${l.divergencia}` : l.divergencia}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
