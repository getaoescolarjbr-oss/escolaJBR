import { useEffect, useState } from 'react';
import { Loader2, Plus, XCircle, Share2, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { ReservaComRecurso } from '../../services/agendamentoService';
import {
  obterMeuProfessorId,
  listarMinhasReservas,
  cancelarReserva,
  listarProfessoresParaSelecao,
  obterUserIdDoProfessor,
  compartilharReserva,
} from '../../services/agendamentoService';
import { notifyReservaCompartilhada } from '../../services/pushService';
import type { StatusReserva } from '../../types/agendamento';
import { ReservaFormModal } from './ReservaFormModal';

const ROTULOS_STATUS: Record<StatusReserva, { label: string; cor: string }> = {
  CONFIRMADA: { label: 'Confirmada', cor: 'bg-green-500/10 text-green-500 border-green-500/20' },
  PENDENTE: { label: 'Pendente', cor: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  RECUSADA: { label: 'Recusada', cor: 'bg-red-500/10 text-red-500 border-red-500/20' },
  CANCELADA: { label: 'Cancelada', cor: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

interface MinhasReservasTabProps {
  recursoIdInicial?: string | null;
}

export function MinhasReservasTab({ recursoIdInicial }: MinhasReservasTabProps) {
  const { usuarioId } = useAuth();
  const [reservas, setReservas] = useState<ReservaComRecurso[]>([]);
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(!!recursoIdInicial);
  const [filtro, setFiltro] = useState('');
  const [compartilhando, setCompartilhando] = useState<ReservaComRecurso | null>(null);
  const [colegas, setColegas] = useState<{ id: string; nome: string }[]>([]);

  async function carregar() {
    if (!usuarioId) return;
    setLoading(true);
    try {
      const meuProfessorId = await obterMeuProfessorId(usuarioId);
      setProfessorId(meuProfessorId);
      if (meuProfessorId) {
        setReservas(await listarMinhasReservas(meuProfessorId));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  // Tempo real: recarrega a lista quando qualquer reserva minha muda (criada por
  // Coordenação/Gestão em meu nome, aprovada, recusada, etc.) sem precisar dar F5.
  useEffect(() => {
    if (!professorId) return;
    const channel = supabase
      .channel(`minhas-reservas-${professorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas', filter: `professor_id=eq.${professorId}` }, () => {
        carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function handleCancelar(id: string) {
    if (!confirm('Cancelar esta reserva?')) return;
    await cancelarReserva(id);
    await carregar();
  }

  async function handleAbrirCompartilhar(r: ReservaComRecurso) {
    setCompartilhando(r);
    if (colegas.length === 0) setColegas(await listarProfessoresParaSelecao());
  }

  async function handleCompartilharCom(destinatarioProfessorId: string) {
    if (!compartilhando || !usuarioId) return;
    try {
      const destinatarioUserId = await obterUserIdDoProfessor(destinatarioProfessorId);
      if (!destinatarioUserId) throw new Error('Destinatário sem conta vinculada.');
      await compartilharReserva(compartilhando.id, destinatarioUserId, usuarioId);
      const nomeAutor = colegas.find((c) => c.id === professorId)?.nome ?? 'Um colega';
      notifyReservaCompartilhada({
        destinatario_user_id: destinatarioUserId,
        compartilhado_por_nome: nomeAutor,
        recurso_nome: compartilhando.recurso_nome ?? 'Recurso',
        data: compartilhando.data,
        hora_inicio: compartilhando.hora_inicio,
      }).catch(console.error);
      setCompartilhando(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao compartilhar reserva.');
    }
  }

  const reservasFiltradas = filtro.trim()
    ? reservas.filter((r) =>
        r.tema?.toLowerCase().includes(filtro.toLowerCase()) ||
        r.objetivos?.toLowerCase().includes(filtro.toLowerCase()) ||
        r.finalidade?.toLowerCase().includes(filtro.toLowerCase())
      )
    : reservas;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Reserva
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            placeholder="Filtrar por tema/objetivos/finalidade..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : reservasFiltradas.length === 0 ? (
          <p className="text-sm text-gray-500">{filtro ? 'Nenhuma reserva corresponde ao filtro.' : 'Você ainda não tem reservas.'}</p>
        ) : (
          reservasFiltradas.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-ms-main">{r.recurso_nome}</p>
                <p className="text-xs text-gray-500">
                  {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)}
                  {r.turma_nome ? ` · ${r.turma_nome}` : ''}
                </p>
                {r.tema && <p className="text-xs text-ms-blueText font-bold">Tema: {r.tema}</p>}
                {r.objetivos && <p className="text-xs text-gray-500">Objetivos: {r.objetivos}</p>}
                {r.finalidade && <p className="text-xs text-gray-600 italic">{r.finalidade}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${ROTULOS_STATUS[r.status].cor}`}>
                  {ROTULOS_STATUS[r.status].label}
                </span>
                {(r.status === 'CONFIRMADA' || r.status === 'PENDENTE') && (
                  <>
                    <button onClick={() => handleAbrirCompartilhar(r)} className="p-1.5 hover:bg-ms-blue/20 text-ms-blueText rounded-lg transition-all" title="Compartilhar">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCancelar(r.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Cancelar">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {mostrarForm && (
        <ReservaFormModal
          recursoIdInicial={recursoIdInicial}
          onClose={() => setMostrarForm(false)}
          onCriada={carregar}
        />
      )}

      {compartilhando && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ms-card max-w-sm w-full rounded-2xl shadow-2xl border border-gray-800 p-6 space-y-3">
            <p className="text-sm font-black text-ms-main">Compartilhar reserva</p>
            <p className="text-xs text-gray-500">{compartilhando.recurso_nome} — {new Date(compartilhando.data + 'T12:00:00').toLocaleDateString('pt-BR')} {compartilhando.hora_inicio.slice(0, 5)}</p>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {colegas.filter((c) => c.id !== professorId).map((c) => (
                <button key={c.id} onClick={() => handleCompartilharCom(c.id)} className="w-full text-left px-3 py-2 bg-ms-dark hover:bg-ms-blue/10 rounded-lg text-sm text-gray-300 transition-colors">
                  {c.nome}
                </button>
              ))}
            </div>
            <button onClick={() => setCompartilhando(null)} className="w-full px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-200">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
