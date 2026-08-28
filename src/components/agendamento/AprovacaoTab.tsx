import { useEffect, useState } from 'react';
import { Loader2, Check, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ReservaComRecurso } from '../../services/agendamentoService';
import { listarTodasReservas, decidirReserva, obterUserIdDoProfessor } from '../../services/agendamentoService';
import { notifyReservaDecidida } from '../../services/pushService';
import type { StatusReserva } from '../../types/agendamento';

const ROTULOS_STATUS: Record<StatusReserva, { label: string; cor: string }> = {
  CONFIRMADA: { label: 'Confirmada', cor: 'bg-green-500/10 text-green-500 border-green-500/20' },
  PENDENTE: { label: 'Pendente', cor: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  RECUSADA: { label: 'Recusada', cor: 'bg-red-500/10 text-red-500 border-red-500/20' },
  CANCELADA: { label: 'Cancelada', cor: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

export function AprovacaoTab() {
  const [reservas, setReservas] = useState<ReservaComRecurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<StatusReserva | ''>('PENDENTE');
  const [processando, setProcessando] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setReservas(await listarTodasReservas(filtro || undefined));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Tempo real: qualquer INSERT/UPDATE/DELETE em reservas atualiza a fila ao vivo —
  // é o efeito que a escola já espera do sistema anterior (Agenda1).
  useEffect(() => {
    const channel = supabase
      .channel('reservas-aprovacao')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function handleDecidir(reserva: ReservaComRecurso, aprovar: boolean) {
    setProcessando(reserva.id);
    try {
      await decidirReserva(reserva.id, aprovar);
      const userId = await obterUserIdDoProfessor(reserva.professor_id);
      if (userId) {
        notifyReservaDecidida({
          professor_user_id: userId,
          recurso_nome: reserva.recurso_nome ?? 'recurso',
          aprovada: aprovar,
        }).catch(console.error);
      }
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao processar a decisão.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <select
        value={filtro}
        onChange={(e) => setFiltro(e.target.value as StatusReserva | '')}
        className="px-3 py-2 bg-ms-card border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
      >
        <option value="PENDENTE">Fila de aprovação (Pendentes)</option>
        <option value="">Todas as reservas</option>
        <option value="CONFIRMADA">Confirmadas</option>
        <option value="RECUSADA">Recusadas</option>
        <option value="CANCELADA">Canceladas</option>
      </select>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma reserva encontrada.</p>
        ) : (
          reservas.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-ms-main">{r.recurso_nome} — {r.professor_nome}</p>
                <p className="text-xs text-gray-500">
                  {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)}
                  {r.turma_nome ? ` · ${r.turma_nome}` : ''}
                </p>
                {r.finalidade && <p className="text-xs text-gray-600 italic">{r.finalidade}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${ROTULOS_STATUS[r.status].cor}`}>
                  {ROTULOS_STATUS[r.status].label}
                </span>
                {r.status === 'PENDENTE' && (
                  <>
                    <button
                      onClick={() => handleDecidir(r, true)}
                      disabled={processando === r.id}
                      className="p-1.5 hover:bg-green-500/20 text-green-500 rounded-lg transition-all disabled:opacity-50"
                      title="Aprovar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDecidir(r, false)}
                      disabled={processando === r.id}
                      className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-lg transition-all disabled:opacity-50"
                      title="Recusar"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
