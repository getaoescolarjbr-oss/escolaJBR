import { useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import type { IndicadoresPnae } from '../../types/cozinha';
import { obterIndicadoresPnae } from '../../services/cozinhaService';

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function pct(valor: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((valor / total) * 100).toFixed(1)}%`;
}

export function IndicadoresTab() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hoje());
  const [indicadores, setIndicadores] = useState<IndicadoresPnae | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleConsultar() {
    setLoading(true);
    setErro(null);
    try {
      setIndicadores(await obterIndicadoresPnae(inicio, fim));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao consultar indicadores.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <p className="text-xs text-gray-500">
        Calculado a partir das entradas de estoque no período (quantidade × valor unitário). Referência: Resolução
        CD/FNDE — mínimo 85% em in natura/minimamente processados a partir de 2026, máximo 10% ultraprocessados,
        mínimo 45% de agricultura familiar. Não substitui a prestação de contas oficial (SIGPC/Sigecon).
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

      {indicadores && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
          <p className="text-sm text-gray-400">Valor total de entradas no período: <span className="font-black text-ms-main">R$ {indicadores.valor_total.toFixed(2)}</span></p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">In natura / minimamente processado</span>
              <span className="font-black text-green-500">{pct(indicadores.valor_in_natura_minimamente_processado, indicadores.valor_total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Ultraprocessado</span>
              <span className={`font-black ${indicadores.valor_total > 0 && indicadores.valor_ultraprocessado / indicadores.valor_total > 0.10 ? 'text-red-500' : 'text-ms-blue'}`}>
                {pct(indicadores.valor_ultraprocessado, indicadores.valor_total)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Agricultura familiar</span>
              <span className={`font-black ${indicadores.valor_total > 0 && indicadores.valor_agricultura_familiar / indicadores.valor_total < 0.45 ? 'text-yellow-500' : 'text-green-500'}`}>
                {pct(indicadores.valor_agricultura_familiar, indicadores.valor_total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
