import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { BarrasPorTurma } from './BarrasPorTurma';
import { MESES, ROTULOS_TIPO_AUSENCIA, carregarEstatisticasAtestados } from './atestadosStats';
import type { EstatisticasAtestados } from './atestadosStats';

function formatarDias(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-gray-800 p-3">
      <p className="text-[11px] uppercase text-gray-500 font-bold">{rotulo}</p>
      <p className="text-2xl font-black text-ms-main">{valor}</p>
    </div>
  );
}

// Estatísticas dos afastamentos (atestados, licenças etc.) registrados em RH > Ausências.
// Dado de saúde: a leitura passa pela mesma RLS da tela de Ausências (Gestão/Secretaria).
export function AtestadosEstatisticas() {
  const [stats, setStats] = useState<EstatisticasAtestados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setStats(await carregarEstatisticasAtestados());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar estatísticas.');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  if (erro) return <p className="text-sm text-red-400">{erro}</p>;
  if (!stats) return <Loader2 className="w-5 h-5 animate-spin text-gray-500" />;
  if (stats.registros === 0) return <p className="text-sm text-gray-500">Nenhum registro de ausência ainda: sem dados para estatística.</p>;

  const mesAtual = new Date().getMonth();
  const primeiroMes = Math.max(0, stats.porMes.findIndex((n) => n > 0));

  return (
    <section className="space-y-4" aria-label="Estatísticas de atestados">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Estatísticas</h3>
        <button onClick={carregar} className="flex items-center gap-1 text-xs text-gray-400 hover:text-ms-main">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi rotulo="Registros" valor={String(stats.registros)} />
        <Kpi rotulo="Ativos agora" valor={String(stats.ativos)} />
        <Kpi rotulo="Servidores" valor={String(stats.servidores)} />
        <Kpi rotulo="Dias de afastamento" valor={String(stats.diasTotais)} />
        <Kpi rotulo="Duração média" valor={`${formatarDias(stats.duracaoMedia)} d`} />
        <Kpi rotulo="Maior afastamento" valor={`${stats.maiorAfastamento} d`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase font-bold text-[#2563eb]">Por tipo</p>
          <BarrasPorTurma
            itens={stats.porTipo.map((t) => ({ rotulo: ROTULOS_TIPO_AUSENCIA[t.tipo], partes: [{ nome: 'Registros', valor: t.total, cor: '#3b82f6' }] }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase font-bold text-[#2563eb]">Início dos afastamentos, por mês</p>
          <BarrasPorTurma
            itens={MESES.slice(primeiroMes, mesAtual + 1).map((mes, i) => ({ rotulo: mes, partes: [{ nome: 'Registros', valor: stats.porMes[primeiroMes + i], cor: '#f59e0b' }] }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase font-bold text-[#2563eb]">Dias de afastamento por servidor</p>
          <BarrasPorTurma
            rotuloTotal="Total (dias)"
            itens={stats.porServidor.slice(0, 8).map((s) => ({ rotulo: s.nome.split(' ')[0], partes: [{ nome: 'Dias', valor: s.dias, cor: '#ef4444' }] }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase font-bold text-[#2563eb]">Retornos previstos (afastamentos ativos)</p>
          {stats.retornosPrevistos.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">Nenhum afastamento ativo.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {stats.retornosPrevistos.map((r, i) => (
                <li key={i} className="flex justify-between border-b border-gray-800 pb-1">
                  <span className="text-ms-main">{r.nome}</span>
                  <span className="text-gray-400">até {new Date(`${r.dataFim}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
