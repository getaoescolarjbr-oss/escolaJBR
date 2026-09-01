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
      setErro(err instanceof Error ? err.message : 'Erro ao carregar agendamentos do dia.');
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
      {/* Cabeçalho com descrição */}
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-ms-main mb-1">📅 Agendamentos do Dia</p>
        <p className="text-xs text-gray-400">
          Visão geral de todos os recursos cadastrados para uma data específica — quais estão ocupados, quem fez a
          reserva, em que horário e para qual turma/finalidade. Ideal para a coordenação acompanhar a ocupação dos
          espaços em tempo real.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <CalendarDays className="w-4 h-4 text-gray-500" />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
        />
      </div>

      {erro && (
        <div className="bg-red-950/20 border border-red-700/40 rounded-xl p-4 space-y-2">
          <p className="text-sm text-red-400 font-bold">Erro ao carregar</p>
          <p className="text-xs text-red-400/80">{erro}</p>
          <button
            onClick={carregar}
            className="text-xs px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : !erro && porRecurso.size === 0 ? (
        <p className="text-sm text-gray-500">Nenhum recurso ativo cadastrado.</p>
      ) : !erro && (() => {
        // Só lista quem tem reserva no dia — recurso livre só entra na contagem do
        // resumo abaixo, não ocupa um card inteiro pra dizer "Livre o dia todo".
        const entradas = Array.from(porRecurso.entries());
        const ocupados = entradas.filter(([, { reservas }]) => reservas.length > 0);
        const livres = entradas.length - ocupados.length;

        if (ocupados.length === 0) {
          return (
            <p className="text-sm text-green-500 font-bold text-center py-4">
              Todos os recursos livres neste dia. 🎉
            </p>
          );
        }

        return (
          <div className="space-y-2">
            {ocupados.map(([recursoId, { nome, reservas }]) => (
              <div key={recursoId} className="bg-ms-card border border-gray-800 rounded-2xl p-4 space-y-1.5">
                <p className="text-sm font-black text-ms-main">{nome}</p>
                <div className="space-y-1.5">
                  {reservas.map((r) => (
                    <div
                      key={r.reserva_id}
                      className={`flex items-start justify-between px-3 py-2 rounded-lg border text-sm gap-2 ${
                        r.status === 'PENDENTE' ? 'bg-amber-950/10 border-amber-700/40' : 'bg-ms-dark border-gray-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-ms-main font-bold">
                          {r.hora_inicio?.slice(0, 5)}–{r.hora_fim?.slice(0, 5)}
                        </span>
                        <span className="ml-2 text-gray-400">{r.professor_nome ?? '—'}</span>
                        {r.turma_nome && <span className="ml-2 text-gray-500">({r.turma_nome})</span>}
                        {(r.finalidade || r.tema) && (
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                            {[r.finalidade, r.tema].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black shrink-0 ${
                          r.status === 'PENDENTE' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {livres > 0 && (
              <p className="text-xs text-green-500 font-bold text-center pt-1">
                + {livres} recurso{livres > 1 ? 's' : ''} livre{livres > 1 ? 's' : ''} neste dia
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
