import { useEffect, useState } from 'react';
import { Loader2, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ReservaComRecurso } from '../../services/agendamentoService';
import { listarTurmas, listarReservasDaTurma } from '../../services/agendamentoService';

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function em30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// Agenda das turmas em tempo real: qualquer PROFESSOR já lê `reservas` de qualquer
// turma (RLS de reservas_select_papeis_permitidos libera todo PROFESSOR, não só o
// dono) — aqui só filtramos por turma_id e assinamos Realtime pra atualizar ao vivo
// quando outro professor reserva/cancela algo pra essa turma.
export function AgendaTurmaTab() {
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [reservas, setReservas] = useState<ReservaComRecurso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      listarTurmas().then(setTurmas).finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function carregar() {
    if (!turmaId) return;
    setReservas(await listarReservasDaTurma(turmaId, hoje(), em30Dias()));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  useEffect(() => {
    if (!turmaId) return;
    const channel = supabase
      .channel(`agenda-turma-${turmaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas', filter: `turma_id=eq.${turmaId}` }, () => {
        carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <select
        value={turmaId}
        onChange={(e) => setTurmaId(e.target.value)}
        className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm font-medium shadow-sm"
      >
        <option value="">Selecione a turma...</option>
        {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      {turmaId && (
        <>
          <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-medium">
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Atualiza ao vivo — próximos 30 dias
          </p>
          <div className="space-y-2">
            {reservas.length === 0 ? (
              <div className="bg-white dark:bg-ms-card border border-[#002677]/20 dark:border-gray-800 rounded-2xl p-6 text-center shadow-sm">
                <p className="text-sm text-[#002677] dark:text-ms-main font-bold">Nenhuma reserva para esta turma no período.</p>
              </div>
            ) : (
              reservas.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-ms-main">{r.recurso_nome}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)} · {r.professor_nome}
                    </p>
                    {r.tema && <p className="text-xs text-ms-blue dark:text-ms-blueText font-bold mt-0.5">{r.tema}</p>}
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full uppercase font-black border ${r.status === 'PENDENTE' ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-green-50 text-green-800 border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'}`}>
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
