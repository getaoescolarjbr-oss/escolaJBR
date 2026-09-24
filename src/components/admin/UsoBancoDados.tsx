import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { LIMITE_BANCO_BYTES, obterUsoBancoDados } from '../../services/usoBancoService';
import type { UsoBancoDados as Uso } from '../../services/usoBancoService';

const MB = 1024 * 1024;
const fmtMb = (bytes: number) => `${(bytes / MB).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

// Medidor de uso do banco (cota do plano gratuito do Supabase) para o Portal do Administrador.
export function UsoBancoDados() {
  const [uso, setUso] = useState<Uso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setUso(await obterUsoBancoDados());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível medir o uso do banco.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const pct = uso ? Math.min(100, (uso.total_bytes / LIMITE_BANCO_BYTES) * 100) : 0;
  const restante = uso ? Math.max(0, LIMITE_BANCO_BYTES - uso.total_bytes) : 0;
  const cor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-ms-gold' : 'bg-ms-green';

  return (
    <section className="bg-ms-card border border-gray-800 rounded-2xl p-4 sm:p-5" aria-label="Uso do banco de dados">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-5 h-5 text-ms-blueText shrink-0" />
          <h3 className="text-sm font-black text-ms-main truncate">Uso do banco de dados</h3>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          title="Atualizar"
          aria-label="Atualizar uso do banco"
          className="p-1.5 rounded-lg text-gray-500 hover:text-ms-main transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {erro && <p className="mt-3 text-xs text-red-500">{erro}</p>}

      {!erro && !uso && <p className="mt-3 text-xs text-gray-500">Medindo…</p>}

      {uso && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ms-main">
              <strong className="text-lg font-black">{fmtMb(uso.total_bytes)}</strong>
              <span className="text-gray-500"> de {fmtMb(LIMITE_BANCO_BYTES)} ({pct.toFixed(1)}%)</span>
            </p>
            <p className="text-xs text-gray-500">Faltam <strong className="text-ms-main">{fmtMb(restante)}</strong> para a cota</p>
          </div>

          <div
            className="h-3 rounded-full bg-gray-500/25 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Percentual da cota do banco utilizado"
          >
            <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
          </div>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer select-none hover:text-ms-main">Maiores tabelas</summary>
            <ul className="mt-2 space-y-1">
              {uso.maiores_tabelas.map((t) => (
                <li key={t.tabela} className="flex justify-between gap-3">
                  <span className="truncate">{t.tabela}</span>
                  <span className="font-bold text-ms-main shrink-0">{fmtMb(t.bytes)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 pt-1 border-t border-gray-800">
                <span>Sistema (logs, login, agendador)</span>
                <span className="font-bold text-ms-main shrink-0">{fmtMb(Math.max(0, uso.total_bytes - uso.public_bytes))}</span>
              </li>
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
