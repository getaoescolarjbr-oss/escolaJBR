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
      const res = await obterDashboardDia(data);
      setLinhas(Array.isArray(res) ? res : []);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar agendamentos do dia.');
      setLinhas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const porRecurso = new Map<string, { nome: string; reservas: DashboardDiaLinha[] }>();
  if (Array.isArray(linhas)) {
    for (const linha of linhas) {
      if (!linha || !linha.recurso_id) continue;
      if (!porRecurso.has(linha.recurso_id)) {
        porRecurso.set(linha.recurso_id, {
          nome: linha.recurso_nome || 'Recurso',
          reservas: [],
        });
      }
      if (linha.reserva_id) {
        porRecurso.get(linha.recurso_id)?.reservas.push(linha);
      }
    }
  }

  const entradas = Array.from(porRecurso.entries());
  const ocupados = entradas.filter(([, val]) => (val?.reservas?.length ?? 0) > 0);
  const livres = entradas.length - ocupados.length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Cabeçalho com descrição */}
      <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-900 dark:text-ms-main mb-1">📅 Agendamentos do Dia</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Visão geral de todos os recursos cadastrados para uma data específica — quais estão ocupados, quem fez a
          reserva, em que horário e para qual turma/finalidade. Ideal para a coordenação acompanhar a ocupação dos
          espaços em tempo real.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-gray-500 flex-shrink-0" />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue shadow-sm font-medium text-sm"
        />
      </div>

      {erro && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-700/40 rounded-xl p-4 space-y-2">
          <p className="text-sm text-red-700 dark:text-red-400 font-bold">Erro ao carregar</p>
          <p className="text-xs text-red-600 dark:text-red-400/80">{erro}</p>
          <button
            onClick={carregar}
            className="text-xs px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all shadow-sm"
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
      ) : !erro && (
        <div className="space-y-3">
          {ocupados.length === 0 ? (
            <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm text-emerald-600 dark:text-green-400 font-bold">
                Todos os recursos livres neste dia. 🎉
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ocupados.map(([recursoId, item]) => (
                <div key={recursoId} className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-2 shadow-sm">
                  <p className="text-sm font-black text-gray-900 dark:text-ms-main">{item.nome}</p>
                  <div className="space-y-1.5">
                    {item.reservas.map((r, idx) => (
                      <div
                        key={r.reserva_id || `${recursoId}-${idx}`}
                        className={`flex items-start justify-between px-3.5 py-2.5 rounded-xl border text-sm gap-2 ${
                          r.status === 'PENDENTE'
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700/40 text-amber-900 dark:text-amber-200'
                            : 'bg-gray-50 dark:bg-ms-dark border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-gray-900 dark:text-ms-main">
                            {(r.hora_inicio ? String(r.hora_inicio).slice(0, 5) : '00:00')}–{(r.hora_fim ? String(r.hora_fim).slice(0, 5) : '00:00')}
                          </span>
                          <span className="ml-2 text-gray-700 dark:text-gray-300 font-medium">{r.professor_nome ?? '—'}</span>
                          {r.turma_nome && <span className="ml-2 text-gray-500 dark:text-gray-400">({r.turma_nome})</span>}
                          {(r.finalidade || r.tema) && (
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                              {[r.finalidade, r.tema].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full uppercase font-black shrink-0 border ${
                            r.status === 'PENDENTE'
                              ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/20'
                              : 'bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/20'
                          }`}
                        >
                          {r.status ?? 'CONFIRMADA'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {livres > 0 && (
                <p className="text-xs text-emerald-600 dark:text-green-400 font-bold text-center pt-1">
                  + {livres} recurso{livres > 1 ? 's' : ''} livre{livres > 1 ? 's' : ''} neste dia
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

