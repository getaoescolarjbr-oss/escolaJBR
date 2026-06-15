import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Professor, AtestadoServidor } from '../../types';
import {
  X,
  Plus,
  Loader2,
  CalendarRange,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Trash2,
  ShieldOff
} from 'lucide-react';

interface AtestadoModalProps {
  professor: Professor;
  allProfessors: Professor[];
  onClose: () => void;
  onUpdate: () => void;
}

export function AtestadoModal({ professor, allProfessors, onClose, onUpdate }: AtestadoModalProps) {
  const [atestados, setAtestados] = useState<AtestadoServidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isProfessor = professor.cargo === 'Professor';
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    data_inicio: today,
    data_fim: today,
    substituto_id: '',
    observacoes: ''
  });

  useEffect(() => {
    fetchAtestados();
  }, [professor.id]);

  async function fetchAtestados() {
    setLoading(true);
    const { data, error } = await supabase
      .from('atestados_servidores')
      .select('*')
      .eq('professor_id', professor.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Enriquecer com nomes dos substitutos
      const enriched = await Promise.all(data.map(async (a) => {
        if (a.substituto_id) {
          const sub = allProfessors.find(p => p.id === a.substituto_id);
          return { ...a, substituto_nome: sub?.nome || 'Desconhecido' };
        }
        return a;
      }));
      setAtestados(enriched);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!formData.data_inicio || !formData.data_fim) {
      alert('Preencha as datas de início e fim do atestado.');
      return;
    }
    if (new Date(formData.data_fim) < new Date(formData.data_inicio)) {
      alert('A data de fim não pode ser anterior à data de início.');
      return;
    }
    if (isProfessor && !formData.substituto_id) {
      if (!confirm('Não foi selecionado um professor substituto. Deseja continuar assim mesmo? O titular ficará em modo somente leitura, mas nenhum substituto será atribuído.')) return;
    }

    setSaving(true);
    try {
      // 1. Inserir o atestado
      const payload: any = {
        professor_id: professor.id,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        observacoes: formData.observacoes || null,
        ativo: true
      };
      if (isProfessor && formData.substituto_id) {
        payload.substituto_id = formData.substituto_id;
      }

      const { data: novoAtestado, error: errInsert } = await supabase
        .from('atestados_servidores')
        .insert([payload])
        .select()
        .single();

      if (errInsert) throw errInsert;

      // 2. Se há substituto, criar espelhos de alocações
      if (isProfessor && formData.substituto_id && novoAtestado) {
        const { data: alocacoesOriginais } = await supabase
          .from('alocacoes_v2')
          .select('turma_id, disciplina_id')
          .eq('professor_id', professor.id)
          .eq('is_espelho', false);

        if (alocacoesOriginais && alocacoesOriginais.length > 0) {
          const espelhos = alocacoesOriginais.map(a => ({
            professor_id: formData.substituto_id,
            turma_id: a.turma_id,
            disciplina_id: a.disciplina_id,
            is_espelho: true,
            atestado_id: novoAtestado.id,
            professor_original_id: professor.id
          }));

          const { error: errEspelho } = await supabase
            .from('alocacoes_v2')
            .insert(espelhos);

          if (errEspelho) {
            console.warn('Aviso: alguns espelhos podem não ter sido criados:', errEspelho.message);
          }
        }
      }

      alert('Atestado registrado com sucesso!' + (isProfessor && formData.substituto_id ? '\nAs turmas foram espelhadas para o professor substituto.' : ''));
      setShowForm(false);
      setFormData({ data_inicio: today, data_fim: today, substituto_id: '', observacoes: '' });
      await fetchAtestados();
      onUpdate();
    } catch (err: any) {
      alert('Erro ao registrar atestado: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEncerrar(atestado: AtestadoServidor) {
    if (!confirm('Deseja encerrar este atestado agora? O espelhamento será removido imediatamente e o titular retomará o controle das turmas.')) return;

    setSaving(true);
    try {
      // Remover espelhos
      if (atestado.substituto_id) {
        await supabase
          .from('alocacoes_v2')
          .delete()
          .eq('atestado_id', atestado.id)
          .eq('is_espelho', true);
      }

      // Marcar como inativo
      await supabase
        .from('atestados_servidores')
        .update({ ativo: false, data_fim: today })
        .eq('id', atestado.id);

      alert('Atestado encerrado. O professor titular retomou o acesso normal às turmas.');
      await fetchAtestados();
      onUpdate();
    } catch (err: any) {
      alert('Erro ao encerrar atestado: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(atestado: AtestadoServidor) {
    if (!confirm('Deseja excluir este registro de atestado? Esta ação não pode ser desfeita.')) return;

    setSaving(true);
    try {
      // Espelhos serão removidos em cascata pelo FK atestado_id
      await supabase
        .from('atestados_servidores')
        .delete()
        .eq('id', atestado.id);

      await fetchAtestados();
      onUpdate();
    } catch (err: any) {
      alert('Erro ao excluir atestado: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function getAtestadoStatus(a: AtestadoServidor): 'ativo' | 'futuro' | 'encerrado' {
    const now = today;
    if (!a.ativo) return 'encerrado';
    if (a.data_inicio > now) return 'futuro';
    if (a.data_fim >= now && a.data_inicio <= now) return 'ativo';
    return 'encerrado';
  }

  const statusConfig = {
    ativo: { label: 'Em Atestado', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', icon: AlertCircle },
    futuro: { label: 'Agendado', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', icon: Clock },
    encerrado: { label: 'Encerrado', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30', icon: CheckCircle2 }
  };

  const substitutosDisponiveis = allProfessors.filter(p =>
    p.id !== professor.id && p.cargo === 'Professor'
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-ms-card w-full max-w-2xl rounded-3xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800 bg-gradient-to-r from-amber-500/10 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ms-main">Atestados Médicos</h3>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mt-0.5">{professor.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* Formulário */}
          {showForm ? (
            <div className="bg-ms-dark border border-amber-400/20 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Novo Atestado
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Data de Início</label>
                  <input
                    type="date"
                    value={formData.data_inicio}
                    onChange={e => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-card border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-amber-400/50 font-bold text-sm transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Data de Fim</label>
                  <input
                    type="date"
                    value={formData.data_fim}
                    onChange={e => setFormData({ ...formData, data_fim: e.target.value })}
                    min={formData.data_inicio}
                    className="w-full px-4 py-3 bg-ms-card border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-amber-400/50 font-bold text-sm transition-all"
                  />
                </div>
              </div>

              {isProfessor && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-3 h-3 text-amber-400" />
                    Professor Substituto (Opcional)
                  </label>
                  <select
                    value={formData.substituto_id}
                    onChange={e => setFormData({ ...formData, substituto_id: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-card border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-amber-400/50 font-bold text-sm transition-all"
                  >
                    <option value="">— Sem substituto designado —</option>
                    {substitutosDisponiveis.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {formData.substituto_id && (
                    <p className="text-[10px] text-amber-400 font-bold ml-1">
                      ✓ As turmas de {professor.nome} serão espelhadas automaticamente para o substituto selecionado.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Informações adicionais (opcional)..."
                  className="w-full px-4 py-3 bg-ms-card border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-amber-400/50 font-bold text-sm transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:bg-gray-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                  Registrar Atestado
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-amber-400/30 rounded-2xl text-amber-400 font-bold text-sm hover:border-amber-400/60 hover:bg-amber-400/5 transition-all"
            >
              <Plus className="w-5 h-5" />
              Registrar Novo Atestado
            </button>
          )}

          {/* Histórico */}
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CalendarRange className="w-4 h-4" />
              Histórico de Atestados
            </h4>

            {loading ? (
              <div className="py-12 flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-gray-500 font-bold text-sm">Carregando...</span>
              </div>
            ) : atestados.length === 0 ? (
              <div className="py-12 text-center">
                <Stethoscope className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                <p className="text-gray-500 font-bold text-sm">Nenhum atestado registrado para este servidor.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atestados.map((a) => {
                  const status = getAtestadoStatus(a);
                  const cfg = statusConfig[status];
                  const IconComponent = cfg.icon;
                  const isExpanded = expandedId === a.id;

                  return (
                    <div key={a.id} className={`rounded-2xl border overflow-hidden transition-all ${status === 'ativo' ? 'border-amber-400/30 bg-amber-400/5' : 'border-gray-800 bg-ms-dark'}`}>
                      {/* Cabeçalho do card */}
                      <div
                        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${cfg.color}`}>
                            <IconComponent className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          <div>
                            <p className="text-sm font-black text-ms-main">
                              {new Date(a.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                              {' — '}
                              {new Date(a.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </p>
                            {a.substituto_nome && (
                              <p className="text-[10px] text-amber-400 font-bold mt-0.5">
                                Substituto: {a.substituto_nome}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === 'ativo' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleEncerrar(a); }}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-[10px] font-black"
                              title="Encerrar atestado agora"
                            >
                              <ShieldOff className="w-3 h-3" />
                              Encerrar
                            </button>
                          )}
                          {status === 'encerrado' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleExcluir(a); }}
                              disabled={saving}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                              title="Excluir registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </div>
                      </div>

                      {/* Detalhes expandidos */}
                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-2 border-t border-gray-800/50 pt-3 animate-in slide-in-from-top-2 duration-200">
                          {a.observacoes && (
                            <p className="text-xs text-gray-400 font-medium">
                              <span className="font-bold text-gray-300">Observações:</span> {a.observacoes}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-600 font-mono">
                            ID: {a.id} · Registrado em: {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
