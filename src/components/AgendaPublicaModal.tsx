import { useEffect, useState } from 'react';
import { X, CalendarClock, Loader2, ChevronLeft, ChevronRight, Lock, CalendarPlus, ShieldAlert } from 'lucide-react';
import { obterDisponibilidade } from '../services/agendamentoService';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Recurso, DisponibilidadeSlot } from '../types/agendamento';
import { ReservaFormModal } from './agendamento/ReservaFormModal';

interface AgendaPublicaModalProps {
  recurso: Recurso | null;
  onClose: () => void;
  // Só relevante quando usado na home pública deslogada — abre a tela de login.
  // Dentro do app autenticado (ModuleShell) isto é omitido, pois já existe sessão.
  onRequireLogin?: () => void;
}

function inicioDaSemana(offsetSemanas: number): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  hoje.setDate(hoje.getDate() + offsetSemanas * 7);
  return hoje;
}

export function AgendaPublicaModal({ recurso, onClose, onRequireLogin }: AgendaPublicaModalProps) {
  const { session, hasAnyRole } = useAuth();
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [slots, setSlots] = useState<DisponibilidadeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormReserva, setMostrarFormReserva] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!recurso) return;
    const timeout = setTimeout(() => setOffsetSemana(0), 0);
    return () => clearTimeout(timeout);
  }, [recurso]);

  useEffect(() => {
    if (!recurso) return;

    async function carregar() {
      setLoading(true);
      const inicio = inicioDaSemana(offsetSemana);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 6);
      try {
        const dados = await obterDisponibilidade(
          recurso!.id,
          inicio.toISOString().slice(0, 10),
          fim.toISOString().slice(0, 10)
        );
        setSlots(dados);
      } finally {
        setLoading(false);
      }
    }

    carregar().catch(console.error);
  }, [recurso, offsetSemana, refreshKey]);

  // Tempo real: usuários autenticados recebem push do Realtime (a RLS de `reservas`
  // permite pra quem tem PROFESSOR/COORDENACAO/GESTAO). Um visitante anônimo na home
  // pública NÃO recebe esses eventos — a mesma RLS que esconde professor/turma/
  // finalidade também impede o anon de assinar mudanças na tabela. Para não deixar a
  // home "parada", uso polling leve (30s) como reforço nesse caso.
  useEffect(() => {
    if (!recurso) return;

    if (session) {
      const channel = supabase
        .channel(`disponibilidade-${recurso.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas', filter: `recurso_id=eq.${recurso.id}` }, () => {
          setRefreshKey((k) => k + 1);
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }

    const interval = setInterval(() => setRefreshKey((k) => k + 1), 30000);
    return () => clearInterval(interval);
  }, [recurso, session]);

  if (!recurso) return null;

  const inicio = inicioDaSemana(offsetSemana);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-50 border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="bg-white rounded-t-2xl p-6 md:p-8 flex items-center gap-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0" style={{ color: recurso.cor ?? '#002f6c' }}>
            <CalendarClock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#002f6c]">{recurso.nome}</h2>
            <p className="text-sm text-gray-500">{recurso.local || 'Agenda de disponibilidade'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 md:px-8 pt-4">
          <button onClick={() => setOffsetSemana((o) => o - 1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <p className="text-sm font-bold text-gray-600">
            {dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </p>
          <button onClick={() => setOffsetSemana((o) => o + 1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#002f6c]" /></div>
          ) : (
            dias.map((dia) => {
              const dataStr = dia.toISOString().slice(0, 10);
              const ocupados = slots
                .filter((s) => s.data === dataStr)
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

              return (
                <div key={dataStr} className="border border-gray-200 rounded-xl p-4">
                  <p className="font-black text-[#002f6c] uppercase text-xs tracking-wide mb-2">
                    {dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  </p>
                  {ocupados.length === 0 ? (
                    <p className="text-sm text-green-600 font-bold">Livre o dia todo</p>
                  ) : (
                    <ul className="space-y-1">
                      {ocupados.map((s, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${s.tipo === 'BLOQUEIO' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          {s.tipo === 'BLOQUEIO' ? 'Em manutenção' : `Reservado ${s.hora_inicio.slice(0, 5)}–${s.hora_fim.slice(0, 5)}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 md:p-8 pt-0">
          {!session ? (
            <button
              onClick={() => onRequireLogin?.()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#002f6c] text-white rounded-xl font-bold hover:bg-[#00204d] transition-colors"
            >
              <Lock className="w-4 h-4" /> Entrar para reservar
            </button>
          ) : !hasAnyRole(['PROFESSOR', 'COORDENACAO', 'GESTAO']) ? (
            <div className="flex items-center gap-2 py-3 px-4 bg-gray-100 text-gray-600 rounded-xl text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0" /> Seu perfil não tem permissão para reservar recursos.
            </div>
          ) : (
            <button
              onClick={() => setMostrarFormReserva(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#002f6c] text-white rounded-xl font-bold hover:bg-[#00204d] transition-colors"
            >
              <CalendarPlus className="w-4 h-4" /> Agendar
            </button>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Esta visão é pública e mostra só livre/ocupado — nome de professor e turma só aparecem para quem está logado com permissão de reserva.
          </p>
        </div>
      </div>

      {mostrarFormReserva && (
        <ReservaFormModal
          recursoIdInicial={recurso.id}
          onClose={() => setMostrarFormReserva(false)}
          onCriada={() => {
            setMostrarFormReserva(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
