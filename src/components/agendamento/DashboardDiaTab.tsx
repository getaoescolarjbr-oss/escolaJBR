import { useEffect, useState } from 'react';
import { Loader2, CalendarDays } from 'lucide-react';
import type { DashboardDiaLinha } from '../../types/agendamento';
import { obterDashboardDia } from '../../services/agendamentoService';

export function DashboardDiaTab() {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [linhas, setLinhas] = useState<DashboardDiaLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      setLinhas(await obterDashboardDia(data));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar dashboard do dia.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const porRecurso = new Map<string, { nome: string; reservas: DashboardDiaLinha[] }>();
  for (const linha of linhas) {
    if (!porRecurso.has(linha.recurso_id)) porRecurso.set(linha.recurso_id, { nome: linha.recurso_nome, reservas: [] });
    if (linha.reserva_id) porRecurso.get(linha.recurso_id)!.reservas.push(linha);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-4 h-4 text-gray-500" />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
      </div>

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>
      ) : porRecurso.size === 0 ? (
        <p className="text-sm text-gray-500">Nenhum recurso ativo cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(porRecurso.entries()).map(([recursoId, { nome, reservas }]) => (
            <div key={recursoId} className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-2">
              <p className="text-sm font-black text-ms-main">{nome}</p>
              {reservas.length === 0 ? (
                <p className="text-xs text-gray-500">Livre o dia todo.</p>
              ) : (
                <div className="space-y-1.5">
                  {reservas.map((r) => (
                    <div key={r.reserva_id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${r.status === 'PENDENTE' ? 'bg-amber-950/10 border-amber-700/40' : 'bg-ms-dark border-gray-800'}`}>
                      <div>
                        <span className="text-ms-main font-bold">{r.hora_inicio?.slice(0, 5)}–{r.hora_fim?.slice(0, 5)}</span>
                        <span className="ml-2 text-gray-400">{r.professor_nome}</span>
                        {r.turma_nome && <span className="ml-2 text-gray-500">({r.turma_nome})</span>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black ${r.status === 'PENDENTE' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
