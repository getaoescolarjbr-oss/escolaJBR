import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { 
  Send, Mail, Eye, Search, Filter, Loader2, RefreshCw, 
  CheckCircle, Clock, Trash2, Users, AlertCircle, FileText
} from 'lucide-react';

interface GestaoMensagensPanelProps {
  currentCoordinator: Professor;
  theme: 'dark' | 'light';
}

export function GestaoMensagensPanel({ currentCoordinator, theme }: GestaoMensagensPanelProps) {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form states
  const [destinatarioId, setDestinatarioId] = useState<string>('todos');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todas' | 'individuais' | 'broadcast'>('todas');

  // Confirmation Modal
  const [showConfirmationsModal, setShowConfirmationsModal] = useState(false);
  const [selectedGroupMsg, setSelectedGroupMsg] = useState<any | null>(null);
  const [groupDetails, setGroupDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchProfessores();
    fetchMensagensEnviadas();
  }, []);

  async function fetchProfessores() {
    try {
      // Busca todos os professores ordenados por nome
      const { data, error } = await supabase
        .from('professores')
        .select('*')
        .order('nome');

      if (error) throw error;
      
      // Filtra o próprio coordenador para não mandar mensagem para si mesmo na lista individual
      if (data) {
        setProfessores(data.filter((p: any) => p.id !== currentCoordinator.id));
      }
    } catch (err) {
      console.error('Erro ao buscar professores:', err);
    }
  }

  async function fetchMensagensEnviadas() {
    setLoading(true);
    try {
      // Busca todas as mensagens enviadas por este coordenador
      const { data: rawMessages, error } = await supabase
        .from('mensagens_coordenacao')
        .select('*')
        .eq('remetente_id', currentCoordinator.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!rawMessages || rawMessages.length === 0) {
        setMensagens([]);
        return;
      }

      // Vamos buscar informações de professores destinatários em lote para fazer join manual
      const destIds = [...new Set(rawMessages.map((m: any) => m.destinatario_id).filter(Boolean))];
      const { data: destProfessores } = await supabase
        .from('professores')
        .select('id, nome, cargo')
        .in('id', destIds);

      const profMap = new Map((destProfessores || []).map(p => [p.id, p]));

      // Vamos agrupar as mensagens que têm o mesmo `grupo_id` para exibição consolidada
      // Se `grupo_id` for nulo, consideramos a mensagem como individual.
      const groupedMap = new Map<string, any>();

      rawMessages.forEach((msg: any) => {
        const destProf = profMap.get(msg.destinatario_id);
        const msgComProf = {
          ...msg,
          destinatario: destProf || { nome: 'Professor Removido', cargo: 'Indefinido' }
        };

        if (msg.grupo_id) {
          if (!groupedMap.has(msg.grupo_id)) {
            groupedMap.set(msg.grupo_id, {
              id: msg.id,
              grupo_id: msg.grupo_id,
              titulo: msg.titulo,
              conteudo: msg.conteudo,
              created_at: msg.created_at,
              isBroadcast: true,
              totalDestinatarios: 0,
              totalLidos: 0,
              destinatarios: []
            });
          }
          const group = groupedMap.get(msg.grupo_id);
          group.totalDestinatarios += 1;
          if (msg.lida) group.totalLidos += 1;
          group.destinatarios.push(msgComProf);
        } else {
          // Individual (sem grupo_id) - trata como um grupo de tamanho 1
          groupedMap.set(msg.id, {
            id: msg.id,
            grupo_id: null,
            titulo: msg.titulo,
            conteudo: msg.conteudo,
            created_at: msg.created_at,
            isBroadcast: false,
            totalDestinatarios: 1,
            totalLidos: msg.lida ? 1 : 0,
            destinatarioNome: destProf?.nome || 'Professor Removido',
            destinatarioCargo: destProf?.cargo || 'Indefinido',
            destinatarios: [msgComProf]
          });
        }
      });

      setMensagens(Array.from(groupedMap.values()));
    } catch (err) {
      console.error('Erro ao buscar mensagens enviadas:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    if (!titulo.trim()) {
      setFormError('O título/assunto é obrigatório.');
      return;
    }
    if (!conteudo.trim()) {
      setFormError('O conteúdo da mensagem é obrigatório.');
      return;
    }

    setSending(true);

    try {
      let targets: string[] = [];

      if (destinatarioId === 'todos') {
        // Envia para todos os professores
        targets = professores.map(p => p.id);
        if (targets.length === 0) {
          throw new Error('Nenhum professor cadastrado para receber a mensagem.');
        }
      } else {
        // Envia para o selecionado
        targets = [destinatarioId];
      }

      const grupoId = targets.length > 1 ? crypto.randomUUID() : null;
      
      const recordsToInsert = targets.map(tId => ({
        remetente_id: currentCoordinator.id,
        destinatario_id: tId,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        grupo_id: grupoId,
        lida: false
      }));

      const { error } = await supabase
        .from('mensagens_coordenacao')
        .insert(recordsToInsert);

      if (error) throw error;

      setFormSuccess(true);
      setTitulo('');
      setConteudo('');
      setDestinatarioId('todos');
      
      // Recarrega lista
      fetchMensagensEnviadas();

      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      setFormError(err.message || 'Erro inesperado ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleExcluirMensagem = async (msg: any) => {
    const confirmMsg = msg.isBroadcast 
      ? 'Excluir este comunicado apagará o envio para todos os professores. Deseja continuar?'
      : 'Deseja excluir esta mensagem permanentemente?';

    if (!window.confirm(confirmMsg)) return;

    try {
      let deleteQuery = supabase.from('mensagens_coordenacao').delete();
      
      if (msg.grupo_id) {
        deleteQuery = deleteQuery.eq('grupo_id', msg.grupo_id);
      } else {
        deleteQuery = deleteQuery.eq('id', msg.id);
      }

      const { error } = await deleteQuery;
      if (error) throw error;

      fetchMensagensEnviadas();
    } catch (err) {
      console.error('Erro ao excluir mensagem:', err);
      alert('Erro ao excluir mensagem.');
    }
  };

  const handleViewConfirmations = async (msg: any) => {
    setSelectedGroupMsg(msg);
    setShowConfirmationsModal(true);
    setLoadingDetails(true);

    try {
      // Carrega os detalhes completos das mensagens do grupo direto do banco
      let query = supabase
        .from('mensagens_coordenacao')
        .select('*');
      
      if (msg.grupo_id) {
        query = query.eq('grupo_id', msg.grupo_id);
      } else {
        query = query.eq('id', msg.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // Buscar nomes dos professores
        const profIds = data.map((d: any) => d.destinatario_id);
        const { data: profs } = await supabase
          .from('professores')
          .select('id, nome, cargo')
          .in('id', profIds);

        const profMap = new Map((profs || []).map(p => [p.id, p]));

        const details = data.map((d: any) => {
          const prof = profMap.get(d.destinatario_id);
          return {
            ...d,
            professor: prof || { nome: 'Professor Removido', cargo: 'Indefinido' }
          };
        }).sort((a: any, b: any) => a.professor.nome.localeCompare(b.professor.nome));

        setGroupDetails(details);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes de leitura:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredMensagens = mensagens.filter(msg => {
    const matchesSearch = msg.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          msg.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'todas') return matchesSearch;
    if (filterType === 'individuais') return matchesSearch && !msg.isBroadcast;
    if (filterType === 'broadcast') return matchesSearch && msg.isBroadcast;
    return matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* Lado Esquerdo: Formulário de Envio (5 colunas) */}
      <div className="lg:col-span-5 bg-ms-card rounded-3xl border border-ms-border shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#002677] to-[#001a4d] px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Send className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-black !text-white uppercase tracking-wider" style={{ color: '#ffffff' }}>Novo Comunicado</h3>
        </div>

        <form onSubmit={handleSendMessage} className="p-6 space-y-5">
          {formError && (
            <div className="p-4 bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl flex items-start gap-2.5 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 bg-green-500/15 border border-green-500/30 text-green-400 rounded-2xl flex items-start gap-2.5 text-xs font-bold animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Comunicado enviado com sucesso!</span>
            </div>
          )}

          {/* Selecionar Destinatário */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Destinatário</label>
            <div className="relative">
              <select
                value={destinatarioId}
                onChange={(e) => setDestinatarioId(e.target.value)}
                className="w-full appearance-none border border-ms-border rounded-xl p-3 bg-ms-dark text-sm text-white font-bold outline-none focus:ring-2 focus:ring-ms-blue transition-all cursor-pointer"
              >
                <option value="todos" className="bg-ms-card text-white">📢 Enviar para Todos os Professores</option>
                {professores.map(p => (
                  <option key={p.id} value={p.id} className="bg-ms-card text-white">
                    👤 {p.nome} ({p.cargo})
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Título / Assunto</label>
            <input
              type="text"
              placeholder="Ex: Preenchimento do Conselho, Lembrete..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-ms-border rounded-xl p-3 bg-ms-dark text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-ms-blue transition-all placeholder-gray-600"
            />
          </div>

          {/* Conteúdo */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Mensagem / Conteúdo</label>
            <textarea
              placeholder="Escreva as instruções ou recado detalhado..."
              rows={6}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="w-full border border-ms-border rounded-xl p-3 bg-ms-dark text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-ms-blue transition-all placeholder-gray-600 resize-none custom-scrollbar"
            />
          </div>

          {/* Enviar Button */}
          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-ms-blue hover:bg-ms-blue/90 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-ms-blue/20 active:scale-95"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Comunicado
              </>
            )}
          </button>
        </form>
      </div>

      {/* Lado Direito: Histórico de Mensagens Enviadas (7 colunas) */}
      <div className="lg:col-span-7 bg-ms-card rounded-3xl border border-ms-border shadow-xl overflow-hidden flex flex-col h-[650px]">
        <div className="bg-ms-dark/20 border-b border-ms-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <Mail className="w-5 h-5 text-ms-blue" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Histórico Enviado</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Acompanhamento e Confirmações</p>
            </div>
          </div>
          <button
            onClick={fetchMensagensEnviadas}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
            title="Recarregar Comunicados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros rápidos e busca */}
        <div className="p-4 bg-ms-dark/10 border-b border-ms-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Filtrar histórico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-ms-dark border border-ms-border rounded-xl text-xs text-white outline-none focus:border-ms-blue transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-ms-dark border border-ms-border rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-transparent border-none text-[10px] font-black text-white outline-none pr-5 cursor-pointer"
            >
              <option value="todas" className="bg-ms-card text-white">Todos os tipos</option>
              <option value="broadcast" className="bg-ms-card text-white">📢 Transmissões</option>
              <option value="individuais" className="bg-ms-card text-white">👤 Individuais</option>
            </select>
          </div>
        </div>

        {/* Lista de comunicados */}
        <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Carregando histórico...</p>
            </div>
          ) : filteredMensagens.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
              <Mail className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest text-center">Nenhum comunicado enviado.</p>
            </div>
          ) : (
            filteredMensagens.map((msg) => {
              const readRatio = msg.totalDestinatarios > 0 ? (msg.totalLidos / msg.totalDestinatarios) : 0;
              const dateStr = new Date(msg.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
              });

              return (
                <div 
                  key={msg.id} 
                  className={`p-4 bg-ms-dark/10 rounded-2xl border border-ms-border flex flex-col justify-between hover:border-ms-blue/30 transition-all gap-4 group`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {msg.isBroadcast ? (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            <Users className="w-2.5 h-2.5" /> Transmissão
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-wide bg-ms-blue/15 text-ms-blue px-2 py-0.5 rounded-full border border-ms-blue/20">
                            👤 {msg.destinatarioNome}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-gray-500">{dateStr}</span>
                      </div>
                      <h4 className="text-sm font-black text-white truncate">{msg.titulo}</h4>
                      <p className="text-xs text-gray-400 font-medium line-clamp-2 leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
                    </div>
                    
                    <button
                      onClick={() => handleExcluirMensagem(msg)}
                      className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/20 text-red-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                      title="Excluir comunicado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-ms-border/30 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        Leitura: <span className={readRatio === 1 ? 'text-green-500' : 'text-ms-blue'}>
                          {msg.totalLidos} / {msg.totalDestinatarios}
                        </span>
                      </div>
                      
                      {/* Mini progresso */}
                      <div className="w-24 bg-black/40 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className={`h-full rounded-full transition-all ${readRatio === 1 ? 'bg-green-500' : 'bg-ms-blue'}`} 
                          style={{ width: `${readRatio * 100}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewConfirmations(msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-ms-blue hover:text-white border border-blue-500/20 text-ms-blue text-[9px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                    >
                      <Eye className="w-3 h-3" />
                      Visualizar Leituras
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÕES DE LEITURA */}
      {showConfirmationsModal && selectedGroupMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ms-card rounded-3xl border border-ms-border w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in duration-300">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-ms-blue/20 to-transparent border-b border-ms-border px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-ms-blue" /> Confirmações de Leitura
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Assunto: {selectedGroupMsg.titulo}</p>
              </div>
              <button 
                onClick={() => setShowConfirmationsModal(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-6 space-y-3 custom-scrollbar">
              {loadingDetails ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-ms-blue mb-3" />
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Consultando leituras...</p>
                </div>
              ) : groupDetails.length === 0 ? (
                <p className="text-center text-gray-500 text-xs italic">Nenhum registro encontrado.</p>
              ) : (
                groupDetails.map((item: any) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-ms-dark/10 border border-ms-border/50 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{item.professor.nome}</p>
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-wider">{item.professor.cargo}</p>
                    </div>

                    <div>
                      {item.lida ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="flex items-center gap-1 text-[9px] font-black text-green-500 uppercase">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Lido
                          </span>
                          <span className="text-[8px] text-gray-500 font-semibold">
                            {new Date(item.data_leitura).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase">
                          <Clock className="w-3.5 h-3.5 text-amber-500" /> Pendente
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-ms-dark/30 border-t border-ms-border flex justify-end">
              <button 
                onClick={() => setShowConfirmationsModal(false)}
                className="px-4 py-2 bg-ms-dark border border-ms-border text-xs font-bold rounded-xl text-white hover:bg-white/5 transition-all"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ChevronDown mini helper to avoid extra imports if not exported from lucide
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
