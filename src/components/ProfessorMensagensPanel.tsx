import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { 
  Mail, MessageSquare, CheckCircle, Clock, Loader2, 
  RefreshCw, Info, Calendar, ArrowRight, User
} from 'lucide-react';

interface ProfessorMensagensPanelProps {
  currentTeacher: Professor;
  theme: 'dark' | 'light';
  onReadConfirmed?: () => void;
}

export function ProfessorMensagensPanel({ currentTeacher, theme, onReadConfirmed }: ProfessorMensagensPanelProps) {
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'todas' | 'pendentes' | 'lidas'>('pendentes');

  useEffect(() => {
    fetchMensagens();
  }, [activeFilter]);

  async function fetchMensagens() {
    setLoading(true);
    try {
      let query = supabase
        .from('mensagens_coordenacao')
        .select('*')
        .eq('destinatario_id', currentTeacher.id)
        .order('created_at', { ascending: false });

      if (activeFilter === 'pendentes') {
        query = query.eq('lida', false);
      } else if (activeFilter === 'lidas') {
        query = query.eq('lida', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setMensagens([]);
        return;
      }

      // Buscar nomes dos coordenadores remetentes
      const remetenteIds = [...new Set(data.map((m: any) => m.remetente_id))];
      const { data: remetentes } = await supabase
        .from('professores')
        .select('id, nome, cargo')
        .in('id', remetenteIds);

      const remMap = new Map((remetentes || []).map(r => [r.id, r]));

      const mensagensComRemetente = data.map((msg: any) => ({
        ...msg,
        remetente: remMap.get(msg.remetente_id) || { nome: 'Coordenação Pedagógica', cargo: 'Coordenador' }
      }));

      setMensagens(mensagensComRemetente);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmarLeitura = async (msgId: string) => {
    setConfirmingId(msgId);
    try {
      const { error } = await supabase
        .from('mensagens_coordenacao')
        .update({
          lida: true,
          data_leitura: new Date().toISOString()
        })
        .eq('id', msgId);

      if (error) throw error;

      // Recarrega
      fetchMensagens();
      
      // Notifica o componente pai para atualizar badge global se houver
      if (onReadConfirmed) {
        onReadConfirmed();
      }
    } catch (err) {
      console.error('Erro ao confirmar leitura:', err);
      alert('Ocorreu um erro ao confirmar a leitura da mensagem.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Navegação e Filtros */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-3xl border shadow-xl gap-4 ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <Mail className="w-5 h-5 text-ms-blue" />
          </div>
          <div>
            <h2 className={`text-lg font-black tracking-tight ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}> Comunicados da Coordenação</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Orientações, solicitações e avisos pedagógicos</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`flex p-1 rounded-xl border w-full sm:w-auto ${
            theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-ms-dark border-ms-border'
          }`}>
            <button
              onClick={() => setActiveFilter('pendentes')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeFilter === 'pendentes'
                  ? 'bg-blue-600 text-white shadow-md'
                  : theme === 'light' ? 'text-blue-900 hover:text-blue-800' : 'text-gray-400 hover:text-white'
              }`}
            >
              📥 Pendentes
            </button>
            <button
              onClick={() => setActiveFilter('lidas')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeFilter === 'lidas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : theme === 'light' ? 'text-blue-900 hover:text-blue-800' : 'text-gray-400 hover:text-white'
              }`}
            >
              ✓ Lidos
            </button>
            <button
              onClick={() => setActiveFilter('todas')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                activeFilter === 'todas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : theme === 'light' ? 'text-blue-900 hover:text-blue-800' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todas
            </button>
          </div>

          <button
            onClick={fetchMensagens}
            className={`p-2.5 rounded-xl border transition-all ${
              theme === 'light' ? 'bg-white border-blue-100 hover:bg-blue-50 text-blue-900' : 'bg-ms-dark border-ms-border hover:bg-white/5 text-gray-400 hover:text-white'
            }`}
            title="Sincronizar Mensagens"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="space-y-4">
        {loading ? (
          <div className={`py-24 text-center rounded-3xl border ${
            theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
          }`}>
            <Loader2 className="w-10 h-10 animate-spin text-ms-blue mx-auto mb-4" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Consultando comunicados...</p>
          </div>
        ) : mensagens.length === 0 ? (
          <div className={`p-16 text-center rounded-3xl border-2 border-dashed flex flex-col items-center justify-center ${
            theme === 'light' ? 'bg-white border-blue-200 text-blue-900/60' : 'bg-ms-card border-gray-800 text-gray-500'
          }`}>
            {activeFilter === 'pendentes' ? (
              <>
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-4 animate-bounce" />
                <p className="text-base font-black uppercase tracking-wider text-green-500">Tudo em dia!</p>
                <p className="text-xs font-semibold mt-1">Nenhum comunicado pendente de leitura no momento.</p>
              </>
            ) : (
              <>
                <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
                <p className="text-xs font-black uppercase tracking-wider">Nenhum comunicado encontrado.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {mensagens.map((msg) => {
              const dateStr = new Date(msg.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              });

              return (
                <div 
                  key={msg.id}
                  className={`rounded-3xl border p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 transition-all shadow-lg hover:shadow-xl ${
                    msg.lida 
                      ? theme === 'light'
                        ? 'bg-white/40 border-blue-100/55 opacity-75 hover:opacity-100'
                        : 'bg-ms-card/40 border-ms-border/50 opacity-70 hover:opacity-100'
                      : theme === 'light'
                        ? 'bg-white border-blue-200 ring-2 ring-blue-500/5'
                        : 'bg-ms-card border-ms-border shadow-ms-blue/5'
                  }`}
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 px-3 py-0.5 rounded-full border border-amber-500/20">
                        <User className="w-3 h-3 text-amber-500" />
                        Remetente: {msg.remetente.nome} ({msg.remetente.cargo})
                      </span>
                      
                      <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                      </span>
                    </div>

                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>
                      {msg.titulo}
                    </h3>
                    
                    <p className={`text-sm leading-relaxed font-medium whitespace-pre-wrap ${
                      theme === 'light' ? 'text-blue-900/85' : 'text-gray-300'
                    }`}>
                      {msg.conteudo}
                    </p>
                  </div>

                  {/* Actions / Read status */}
                  <div className="shrink-0 flex items-center md:items-end justify-between md:justify-center md:flex-col gap-4 border-t md:border-t-0 border-ms-border/30 pt-4 md:pt-0">
                    <span className="md:hidden text-[9px] font-black uppercase text-gray-500">Status</span>
                    {msg.lida ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase">
                          ✓ Leitura Confirmada
                        </span>
                        <span className="text-[8px] text-gray-500 font-bold uppercase">
                          Em {new Date(msg.data_leitura).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmarLeitura(msg.id)}
                        disabled={confirmingId === msg.id}
                        className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-900/30 hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        {confirmingId === msg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Confirmar Leitura
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
