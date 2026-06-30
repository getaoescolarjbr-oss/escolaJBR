import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Save, BookOpen, User, Loader2, Sparkles, AlertCircle, Calendar } from 'lucide-react';
import { getCorGradiente } from '../utils/academicUtils';
import { DecimalInput } from './DecimalInput';

interface GradeCellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  disciplinaNome: string;
  turmaId: string;
  initialBimestreId: number; // if 0, show all/allow choosing
  theme: 'dark' | 'light';
  professorId: string;
  onSaveSuccess: () => void;
}

interface AvaliacaoComNota {
  id: string;
  nome: string;
  valor_maximo: number;
  bimestre_id: number;
  data_avaliacao?: string | null;
  nota?: number;
}

export function GradeCellEditModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  disciplinaNome,
  turmaId,
  initialBimestreId,
  theme,
  professorId,
  onSaveSuccess
}: GradeCellEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [disciplinaId, setDisciplinaId] = useState<string | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoComNota[]>([]);
  const [editedGrades, setEditedGrades] = useState<Record<string, number>>({});
  
  // States for creating a new assessment
  const [isCreatingAval, setIsCreatingAval] = useState(false);
  const [newAvalName, setNewAvalName] = useState('');
  const [newAvalValue, setNewAvalValue] = useState(10);
  const [newAvalBimestre, setNewAvalBimestre] = useState<number>(initialBimestreId > 0 ? initialBimestreId : 1);
  const [newAvalDate, setNewAvalDate] = useState('');
  const [creatingLoader, setCreatingLoader] = useState(false);
  
  const [savingLoader, setSavingLoader] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, studentId, initialBimestreId, disciplinaNome]);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Resolve disciplina nome to ID
      const { data: discData, error: discError } = await supabase
        .from('disciplinas')
        .select('id')
        .eq('nome', disciplinaNome)
        .maybeSingle();

      if (discError) throw discError;
      if (!discData) {
        throw new Error(`Disciplina "${disciplinaNome}" não encontrada.`);
      }

      setDisciplinaId(discData.id);

      // 2. Fetch assessments for this class and discipline
      let avalsQuery = supabase
        .from('avaliacoes')
        .select('*')
        .eq('turma_id', turmaId)
        .eq('disciplina_id', discData.id);

      if (initialBimestreId > 0) {
        avalsQuery = avalsQuery.eq('bimestre_id', initialBimestreId);
      }

      const { data: avalsData, error: avalsError } = await avalsQuery;
      if (avalsError) throw avalsError;

      // 3. Fetch grades for these assessments
      const resolvedAvals: AvaliacaoComNota[] = [];
      const gradesMap: Record<string, number> = {};

      if (avalsData && avalsData.length > 0) {
        const avalIds = avalsData.map(a => a.id);
        const { data: gradesData, error: gradesError } = await supabase
          .from('notas_avaliacoes')
          .select('*')
          .eq('aluno_id', studentId)
          .in('avaliacao_id', avalIds);

        if (gradesError) throw gradesError;

        if (gradesData) {
          gradesData.forEach(g => {
            gradesMap[g.avaliacao_id] = g.nota;
          });
        }

        avalsData.forEach(a => {
          resolvedAvals.push({
            id: a.id,
            nome: a.nome,
            valor_maximo: a.valor_maximo,
            bimestre_id: a.bimestre_id,
            data_avaliacao: a.data_avaliacao,
            nota: gradesMap[a.id]
          });
        });
      }

      // Sort assessments by bimonthly and name
      resolvedAvals.sort((x, y) => x.bimestre_id - y.bimestre_id || x.nome.localeCompare(y.nome));

      setAvaliacoes(resolvedAvals);
      setEditedGrades(gradesMap);
    } catch (err: any) {
      console.error('Error loading cell edit data:', err);
      setErrorMsg(err.message || 'Erro ao carregar dados de notas.');
    } finally {
      setLoading(false);
    }
  }

  const handleGradeChange = (avalId: string, valStr: string, maxValue: number) => {
    let num = parseFloat(valStr);
    if (isNaN(num)) num = 0;
    
    // Clamp grade
    if (num < 0) num = 0;
    if (num > maxValue) num = maxValue;

    setEditedGrades(prev => ({
      ...prev,
      [avalId]: num
    }));
  };

  const handleDeleteAvaliacao = async (avalId: string, avalNome: string) => {
    if (!confirm(`Deseja realmente excluir a avaliação "${avalNome}"? Isso apagará as notas de TODOS os alunos para esta avaliação.`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('avaliacoes')
        .delete()
        .eq('id', avalId);

      if (error) throw error;

      // Update state
      setAvaliacoes(prev => prev.filter(a => a.id !== avalId));
      setEditedGrades(prev => {
        const copy = { ...prev };
        delete copy[avalId];
        return copy;
      });
      
      onSaveSuccess(); // Refresh dashboard
    } catch (err: any) {
      console.error('Error deleting assessment:', err);
      alert('Erro ao excluir avaliação: ' + err.message);
    }
  };

  const handleCreateAvaliacao = async () => {
    if (!disciplinaId) return;
    if (!newAvalName.trim() || newAvalValue <= 0) {
      alert('Por favor, informe um nome válido e uma pontuação máxima.');
      return;
    }

    setCreatingLoader(true);
    try {
      const { data, error } = await supabase
        .from('avaliacoes')
        .insert({
          professor_id: professorId,
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          bimestre_id: newAvalBimestre,
          nome: newAvalName.trim(),
          valor_maximo: newAvalValue,
          data_avaliacao: newAvalDate || null,
          publicada: false
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setAvaliacoes(prev => [
          ...prev,
          {
            id: data.id,
            nome: data.nome,
            valor_maximo: data.valor_maximo,
            bimestre_id: data.bimestre_id,
            data_avaliacao: data.data_avaliacao,
            nota: undefined
          }
        ].sort((x, y) => x.bimestre_id - y.bimestre_id || x.nome.localeCompare(y.nome)));
        
        setIsCreatingAval(false);
        setNewAvalName('');
        setNewAvalValue(10);
        setNewAvalDate('');
      }
    } catch (err: any) {
      console.error('Error creating assessment:', err);
      alert('Erro ao criar avaliação: ' + err.message);
    } finally {
      setCreatingLoader(false);
    }
  };

  const handleSaveGrades = async () => {
    setSavingLoader(true);
    setErrorMsg(null);
    try {
      // Build batch upserts
      const upsertData = Object.keys(editedGrades).map(avalId => ({
        avaliacao_id: avalId,
        aluno_id: studentId,
        nota: editedGrades[avalId]
      }));

      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('notas_avaliacoes')
          .upsert(upsertData, { onConflict: 'avaliacao_id,aluno_id' });

        if (error) throw error;
      }

      onSaveSuccess(); // Refresh parent component
      onClose(); // Close modal
    } catch (err: any) {
      console.error('Error saving grades:', err);
      setErrorMsg('Erro ao salvar notas: ' + err.message);
    } finally {
      setSavingLoader(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-2xl rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[85vh] ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
      }`}>
        
        {/* Header */}
        <div className="px-8 py-5 bg-gradient-to-r from-ms-blue/20 to-transparent border-b border-ms-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ms-blue/20 flex items-center justify-center text-sm font-black text-ms-blue border border-ms-blue/30 shadow-inner">
              <User className="w-5 h-5 text-ms-blue" />
            </div>
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>
                Alteração de Notas
              </h3>
              <p className={`text-[10px] font-bold uppercase ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>
                {studentName} • {disciplinaNome}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl transition-all group">
            <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando avaliações...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 bg-red-950/20 border border-red-900 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-400">Falha ao processar operação</p>
                <p className="text-xs text-red-500/80 mt-1">{errorMsg}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Assessments List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-blue-900' : 'text-gray-400'}`}>
                    Avaliações Registradas
                  </span>
                  {!isCreatingAval && (
                    <button
                      onClick={() => setIsCreatingAval(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nova Avaliação
                    </button>
                  )}
                </div>

                {isCreatingAval && (
                  <div className={`p-5 rounded-2xl border space-y-4 animate-in slide-in-from-top duration-200 ${
                    theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-ms-dark/10 border-gray-800'
                  }`}>
                    <div className="flex items-center justify-between border-b border-gray-850 pb-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Cadastrar Avaliação
                      </span>
                      <button onClick={() => setIsCreatingAval(false)} className="p-1 text-gray-500 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-gray-400'}`}>Nome da Avaliação</label>
                        <input
                          type="text"
                          value={newAvalName}
                          onChange={e => setNewAvalName(e.target.value)}
                          placeholder="Ex: Prova Recuperação"
                          className={`w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-800/50 border-gray-700 text-white'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-gray-400'}`}>Pontuação Máxima</label>
                        <input
                          type="number"
                          value={newAvalValue || ''}
                          onChange={e => setNewAvalValue(parseFloat(e.target.value) || 0)}
                          placeholder="Ex: 10"
                          className={`w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-800/50 border-gray-700 text-white'
                          }`}
                        />
                      </div>
                      {initialBimestreId === 0 ? (
                        <div>
                          <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-gray-400'}`}>Bimestre</label>
                          <select
                            value={newAvalBimestre}
                            onChange={e => setNewAvalBimestre(Number(e.target.value))}
                            className={`w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                              theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-800/50 border-gray-700 text-white'
                            }`}
                          >
                            {[1, 2, 3, 4].map(b => (
                              <option key={b} value={b}>{b}º Bimestre</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-gray-400'}`}>Bimestre</label>
                          <div className={`p-2.5 rounded-xl text-xs font-bold ${
                            theme === 'light' ? 'bg-blue-100/50 text-blue-800' : 'bg-gray-850 text-gray-400'
                          }`}>
                            {initialBimestreId}º Bimestre (Filtro Ativo)
                          </div>
                        </div>
                      )}
                      <div>
                        <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-gray-400'}`}>Data</label>
                        <input
                          type="date"
                          value={newAvalDate}
                          onChange={e => setNewAvalDate(e.target.value)}
                          className={`w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                            theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-800/50 border-gray-700 text-white'
                          }`}
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={handleCreateAvaliacao}
                          disabled={creatingLoader}
                          className="w-full bg-[#d4af37] text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/10"
                        >
                          {creatingLoader ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Avaliação'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {avaliacoes.length === 0 ? (
                  <div className="p-8 text-center bg-ms-dark/10 rounded-2xl border border-dashed border-gray-800">
                    <p className="text-xs text-gray-500 font-bold uppercase">Nenhuma avaliação agendada para esta disciplina.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {avaliacoes.map(av => {
                      const grade = editedGrades[av.id] ?? '';
                      return (
                        <div
                          key={av.id}
                          className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-colors ${
                            theme === 'light' ? 'bg-blue-50/20 border-blue-100/50 hover:bg-blue-50/40' : 'bg-ms-dark/25 border-gray-850 hover:bg-ms-dark/40'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm font-bold ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>
                                {av.nome}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-600/10 text-blue-500 rounded text-[9px] font-black uppercase">
                                {av.bimestre_id}º BIM
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-gray-500 font-semibold uppercase">
                              <span>Valor Máx: <strong className="text-ms-gold">{av.valor_maximo}</strong> pts</span>
                              {av.data_avaliacao && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-500" />
                                  {new Date(av.data_avaliacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <label className="text-[9px] font-bold text-gray-500 uppercase mb-1">Nota</label>
                              <div className="flex items-center gap-1">
                                  <DecimalInput
                                    value={grade}
                                    onChange={val => handleGradeChange(av.id, String(val), av.valor_maximo)}
                                    max={av.valor_maximo}
                                    className={`w-20 text-center p-2 rounded-xl text-xs font-black focus:border-blue-500 outline-none border transition-all ${
                                      theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-800 border-gray-700 text-white'
                                    }`}
                                    placeholder="0.0"
                                  />
                                <span className="text-[10px] font-bold text-gray-500">/ {av.valor_maximo}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteAvaliacao(av.id, av.nome)}
                              className="p-2.5 text-gray-550 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all shrink-0 self-end mt-4"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-900/30 border-t border-ms-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={savingLoader || loading || errorMsg !== null}
            className="flex-1 py-3 bg-ms-blue text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-900/40 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingLoader ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Notas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
