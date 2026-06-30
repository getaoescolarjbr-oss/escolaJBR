import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, Avaliacao, NotaAvaliacao, ListaParaVistos } from '../types';
import { Plus, Save, Trash2, Calculator, Info, TrendingUp, X, Sparkles, CheckCheck, Loader2 } from 'lucide-react';
import { autoUpdateExpiredAbsences, isStudentAbsentOnDate } from '../utils/studentUtils';
import { arredondarNotaMS, getCorGradiente, getBimestreFromDate } from '../utils/academicUtils';
import { RAVListModal } from './RAVListModal';
import { DecimalInput } from './DecimalInput';

interface GradesPanelProps {
  professor: Professor;
  turmaId: string;
  disciplinaId: string;
  bimestreId: number;
  theme: 'dark' | 'light';
  refreshKey?: number;
  isLocked?: boolean;
}

export function GradesPanel({ professor, turmaId, disciplinaId, bimestreId, theme, refreshKey = 0, isLocked = false }: GradesPanelProps) {
  const [alunos, setAlunos] = useState<ListaParaVistos[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [subTab, setSubTab] = useState<'cadastro' | 'boletim'>('boletim');
  const [notas, setNotas] = useState<Record<string, Record<string, number>>>({});
  const [vistosCalculados, setVistosCalculados] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isAddingAvaliacao, setIsAddingAvaliacao] = useState(false);
  const [newAvalName, setNewAvalName] = useState('');
  const [newAvalValue, setNewAvalValue] = useState(10);
  const [newAvalDate, setNewAvalDate] = useState('');
  const [newAvalPublicada, setNewAvalPublicada] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avalError, setAvalError] = useState<string | null>(null);
  const [isRAVModalOpen, setIsRAVModalOpen] = useState(false);

  // Estados do botão de reforço de salvamento
  const [isSavingConfirmation, setIsSavingConfirmation] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // 1. Buscar Alunos da Turma (Fonte de Dados Oficial)
      const { data: dataAlunos } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .order('aluno_numero');
      
      // Guarda em variável local para usar no cálculo de vistos sem depender do estado React
      let mappedAlunos: any[] = [];
      if (dataAlunos) {
        mappedAlunos = dataAlunos.map(a => ({
          aluno_id: a.id,
          aluno_nome: a.nome,
          aluno_numero: a.aluno_numero,
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          professor_id: professor.id,
          status: a.status,
          atestado_inicio: a.atestado_inicio,
          atestado_fim: a.atestado_fim
        }));
        setAlunos(mappedAlunos as any);

        autoUpdateExpiredAbsences(dataAlunos, (updatedAlunos) => {
          const remapped = updatedAlunos.map(a => ({
            aluno_id: a.id,
            aluno_nome: a.nome,
            aluno_numero: a.aluno_numero,
            turma_id: turmaId,
            disciplina_id: disciplinaId,
            professor_id: professor.id,
            status: a.status,
            atestado_inicio: a.atestado_inicio,
            atestado_fim: a.atestado_fim
          }));
          setAlunos(remapped as any);
        });
      }

      // 2. Buscar Avaliações do Bimestre
      const { data: dataAval } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', bimestreId);
      if (dataAval) setAvaliacoes(dataAval);

      // 3. Buscar Notas de Avaliações
      if (dataAval && dataAval.length > 0) {
        const avalIds = dataAval.map(a => a.id);
        const { data: dataNotas } = await supabase
            .from('notas_avaliacoes')
            .select('*')
            .in('avaliacao_id', avalIds);
        
        if (dataNotas) {
            const mapped: Record<string, Record<string, number>> = {};
            dataNotas.forEach(n => {
                if (!mapped[n.aluno_id]) mapped[n.aluno_id] = {};
                mapped[n.aluno_id][n.avaliacao_id] = n.nota;
            });
            setNotas(mapped);
        }
      }

      // 4. Calcular Nota de Vistos Automaticamente
      const { data: atividades } = await supabase
        .from('atividades_diárias')
        .select('id')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', bimestreId);
      
      const ativIds = atividades?.map(a => a.id) || [];
      const totalAtiv = ativIds.length;

      if (totalAtiv > 0) {
        const { data: vistos } = await supabase
            .from('vistos_v2')
            .select('aluno_id, valor')
            .in('atividade_id', ativIds);
        
        if (vistos) {
            const pesosAluno: Record<string, number> = {};
            vistos.forEach(v => {
                let peso = 0;
                const val = String(v.valor).trim();
                const aId = String(v.aluno_id).trim();
                
                if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
                else if (val === '0.5' || val === 'half') peso = 0.5;
                else if (!isNaN(parseFloat(val))) {
                    const num = parseFloat(val);
                    peso = num > 1 ? num / 10 : num;
                }
                
                pesosAluno[aId] = (pesosAluno[aId] || 0) + peso;
            });

            const notasVistos: Record<string, number> = {};
            // USA mappedAlunos (local) e não alunos (estado React que ainda está vazio aqui)
            mappedAlunos.forEach(aluno => {
                const aId = String(aluno.aluno_id).trim();
                const somaPesos = pesosAluno[aId] || 0;
                const realizacao = somaPesos / totalAtiv;
                const notaFinalVisto = realizacao * (professor.config_visto_valor_total || 2.0);
                notasVistos[aluno.aluno_id] = arredondarNotaMS(notaFinalVisto);
            });
            setVistosCalculados(notasVistos);
        }
      } else {
          setVistosCalculados({});
      }

      setLoading(false);
    }
    fetchData();
  }, [professor.id, turmaId, disciplinaId, bimestreId, professor.config_visto_valor_total, refreshKey]);

  const handleAddAvaliacao = async () => {
    if (!newAvalName.trim() || newAvalValue <= 0) return;
    setIsSaving(true);
    setAvalError(null);

    const { data, error } = await supabase.from('avaliacoes').insert({
        professor_id: professor.id,
        turma_id: turmaId,
        disciplina_id: disciplinaId,
        bimestre_id: bimestreId,
        nome: newAvalName.trim(),
        valor_maximo: newAvalValue,
        data_avaliacao: newAvalDate || null,
        publicada: newAvalPublicada
    }).select().single();

    if (error) {
        console.error('Erro ao criar avaliação:', error);
        setAvalError(`Erro: ${error.message}`);
    } else if (data) {
        setAvaliacoes([...avaliacoes, data]);
        setIsAddingAvaliacao(false);
        setNewAvalName('');
        setNewAvalValue(10);
        setNewAvalDate('');
        setNewAvalPublicada(false);
        setAvalError(null);
    }
    setIsSaving(false);
  };

  const handleUpdateAvaliacaoField = async (id: string, field: 'data_avaliacao' | 'publicada', value: any) => {
    const updated = avaliacoes.map(a => {
      if (a.id === id) {
        return { ...a, [field]: value };
      }
      return a;
    });
    setAvaliacoes(updated);

    const { error } = await supabase
      .from('avaliacoes')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      console.error(`Erro ao atualizar campo ${field}:`, error);
    }
  };

  const handleDeleteAvaliacao = async (id: string) => {
    const { error } = await supabase.from('avaliacoes').delete().eq('id', id);
    if (!error) {
        setAvaliacoes(avaliacoes.filter(a => a.id !== id));
    }
  };

  const handleUpdateNota = async (alunoId: string, avalId: string, notaVal: number) => {
    // Buscar o valor máximo desta avaliação
    const aval = avaliacoes.find(a => a.id === avalId);
    let valorFinal = notaVal;
    
    if (aval && notaVal > aval.valor_maximo) {
        valorFinal = aval.valor_maximo;
    }

    const updatedNotas = { ...notas };
    if (!updatedNotas[alunoId]) updatedNotas[alunoId] = {};
    updatedNotas[alunoId][avalId] = valorFinal;
    setNotas(updatedNotas);

    await supabase.from('notas_avaliacoes').upsert({
        avaliacao_id: avalId,
        aluno_id: alunoId,
        nota: valorFinal
    }, { onConflict: 'avaliacao_id,aluno_id' });
  };

  const handleManualSaveFeedback = () => {
    setIsSavingConfirmation(true);
    setTimeout(() => {
      setIsSavingConfirmation(false);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2000);
    }, 600);
  };

  if (loading) return <div className="p-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div></div>;

  return (
    <div className="space-y-6">
      {/* Sub-Navegação */}
      <div className={`flex p-1 rounded-xl w-fit ${
        theme === 'light' ? 'bg-blue-50/80 border border-blue-100/50' : 'bg-black/20'
      }`}>
          <button 
            onClick={() => setSubTab('boletim')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                subTab === 'boletim' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : theme === 'light' 
                    ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/40' 
                    : 'text-blue-200 hover:text-white'
            }`}
          >
              Boletim da Turma
          </button>
          <button 
            onClick={() => setSubTab('cadastro')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                subTab === 'cadastro' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : theme === 'light' 
                    ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/40' 
                    : 'text-blue-200 hover:text-white'
            }`}
          >
              Cadastrar Avaliações
          </button>
      </div>

      {subTab === 'cadastro' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className={`p-6 rounded-2xl border shadow-xl ${theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'}`}>
                  <div className="flex items-center justify-between mb-6">
                      <div>
                          <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Gestão de Avaliações</h3>
                          <p className={`text-[10px] font-bold uppercase ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>Cadastre provas, trabalhos e seminários do {bimestreId}º BIM</p>
                      </div>
                      <button 
                        onClick={() => setIsAddingAvaliacao(!isAddingAvaliacao)}
                        disabled={isLocked}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
                      >
                          {isAddingAvaliacao ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Nova Avaliação
                      </button>
                  </div>

                  {isAddingAvaliacao && (
                    <>
                    <div className={`p-6 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border ${
                        theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-ms-dark/10 border-gray-800'
                    }`}>
                        <div className="md:col-span-2">
                            <label className={`block text-[10px] font-bold uppercase mb-2 ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>Nome da Avaliação</label>
                            <input 
                                type="text" 
                                value={newAvalName} 
                                onChange={e => setNewAvalName(e.target.value)} 
                                placeholder="Ex: Prova Mensal" 
                                className={`w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                    theme === 'light' 
                                        ? 'bg-white border-blue-200 text-blue-900 placeholder:text-blue-300 shadow-sm' 
                                        : 'bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-600 shadow-inner'
                                }`} 
                            />
                        </div>
                        <div>
                            <label className={`block text-[10px] font-bold uppercase mb-2 ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>Pontuação Máxima</label>
                            <input 
                                type="number" 
                                value={newAvalValue || ''} 
                                onChange={e => setNewAvalValue(parseFloat(e.target.value) || 0)} 
                                placeholder="0.0"
                                className={`w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                    theme === 'light' 
                                        ? 'bg-white border-blue-200 text-blue-900 shadow-sm' 
                                        : 'bg-gray-800/50 border-gray-700 text-white shadow-inner'
                                }`} 
                            />
                        </div>
                        <div>
                            <label className={`block text-[10px] font-bold uppercase mb-2 ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>Data da Avaliação</label>
                            <input 
                                type="date" 
                                value={newAvalDate} 
                                onChange={e => setNewAvalDate(e.target.value)} 
                                className={`w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                                    theme === 'light' 
                                        ? 'bg-white border-blue-200 text-blue-900 shadow-sm' 
                                        : 'bg-gray-800/50 border-gray-700 text-white shadow-inner'
                                }`} 
                            />
                        </div>
                        <div className="flex items-center h-full pt-6">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={newAvalPublicada} 
                                    onChange={e => setNewAvalPublicada(e.target.checked)}
                                    disabled={isLocked}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                                />
                                <span className={`text-[10px] font-bold uppercase ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>
                                    Publicar no Calendário Letivo
                                </span>
                            </label>
                        </div>
                        <div className="flex items-end">
                            <button 
                                onClick={handleAddAvaliacao} 
                                disabled={!newAvalName.trim() || newAvalValue <= 0 || isSaving || isLocked}
                                className="w-full bg-ms-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSaving
                                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Salvando...</>
                                  : 'Salvar e Criar'
                                }
                            </button>
                        </div>
                    </div>
                    {avalError && (
                      <div className="mb-4 px-4 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-400 font-medium">
                        {avalError}
                      </div>
                    )}
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {avaliacoes.map(av => (
                          <div key={av.id} className={`p-4 rounded-xl flex flex-col gap-3 border transition-all ${
                              theme === 'light' 
                                  ? 'bg-blue-50/20 border-blue-100 hover:border-blue-300' 
                                  : 'bg-black/20 border-gray-800 hover:border-gray-700'
                          }`}>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <span className={`block text-xs font-bold ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>{av.nome}</span>
                                      <span className="text-[10px] text-blue-500 font-black uppercase">Valendo {av.valor_maximo} pts</span>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteAvaliacao(av.id)}
                                    disabled={isLocked}
                                    className="p-1.5 text-gray-550 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-red-500/10 transition-all active:scale-95"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-gray-700/30">
                                  <div>
                                      <label className={`block text-[9px] font-bold uppercase mb-1 ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>Data</label>
                                      <input 
                                          type="date" 
                                          value={av.data_avaliacao || ''} 
                                          onChange={e => handleUpdateAvaliacaoField(av.id, 'data_avaliacao', e.target.value || null)}
                                          disabled={isLocked}
                                          className={`w-full p-1.5 rounded-lg text-[11px] font-medium outline-none border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                              theme === 'light' 
                                                  ? 'bg-white border-blue-200 text-blue-900 focus:border-blue-500' 
                                                  : 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500'
                                          }`}
                                      />
                                  </div>
                                  <div className="flex flex-col justify-end">
                                      <label className="flex items-center gap-2 cursor-pointer select-none h-full py-1">
                                          <input 
                                              type="checkbox" 
                                              checked={av.publicada || false}
                                              onChange={e => handleUpdateAvaliacaoField(av.id, 'publicada', e.target.checked)}
                                              disabled={isLocked}
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                          />
                                          <span className={`text-[10px] font-bold uppercase ${
                                              av.publicada 
                                                  ? 'text-emerald-500' 
                                                  : theme === 'light' ? 'text-blue-500' : 'text-gray-400'
                                          }`}>
                                              {av.publicada ? 'Publicado' : 'Não Pub.'}
                                          </span>
                                      </label>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {avaliacoes.length === 0 && <div className="col-span-full py-10 text-center text-gray-600 text-xs italic">Nenhuma avaliação cadastrada ainda.</div>}
                  </div>
              </div>
          </div>
      ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Boletim Consolidado */}
            <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-xl border border-ms-border overflow-hidden`}>
                <div className={`p-4 border-b ${theme === 'light' ? 'bg-[#e6f0ff] border-[#002677]/20' : 'bg-[#0a1a3a] border-[#002677]/30'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-[#002677]' : 'text-[#93c5fd]'}`}>Boletim de Notas - Turma Integrada</h3>
                    <div className="flex items-center gap-2">
                        {/* Botão de Reforço de Salvamento */}
                        <button
                            onClick={handleManualSaveFeedback}
                            disabled={isSavingConfirmation}
                            className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md ${
                              showSavedFeedback
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : theme === 'light'
                                  ? 'bg-white border-blue-200 text-blue-900 hover:bg-blue-50'
                                  : 'bg-ms-card border-ms-border text-ms-main hover:bg-gray-800'
                            }`}
                        >
                            {isSavingConfirmation ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : showSavedFeedback ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {isSavingConfirmation ? 'Salvando...' : showSavedFeedback ? 'Notas Salvas!' : 'Salvar Lançamentos'}
                        </button>

                        <button
                            onClick={() => setIsRAVModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-amber-900/20"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                            Alunos de RAV (Recuperação)
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-ms-border/30">
                        <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'}>
                        <tr>
                            <th className={`px-2 sm:px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest sticky left-0 z-10 border-r border-white/10 min-w-[100px] max-w-[120px] sm:max-w-none ${
                              theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'
                            }`}>Estudante</th>
                            <th className="px-2 sm:px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-600/20 whitespace-nowrap">Vistos ({professor.config_visto_valor_total})</th>
                            {avaliacoes.map(av => (
                            <th key={av.id} className="px-2 sm:px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">
                                <div className="truncate max-w-[70px] sm:max-w-[100px] mx-auto">{av.nome}</div>
                                <div className="text-[8px] text-white/50">{av.valor_maximo} pts</div>
                            </th>
                            ))}
                            <th className="px-2 sm:px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-black/40 whitespace-nowrap">Média Final</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-ms-border/30">
                        {alunos.map((aluno, idx) => {
                            const isPosterior = (aluno.status === 'Transferido' || aluno.status === 'Remanejado' || aluno.status === 'Cancelada') && (() => {
                              const exitBim = getBimestreFromDate(aluno.atestado_inicio);
                              return exitBim !== null && bimestreId > exitBim;
                            })();

                            const notaVisto = isPosterior ? 0 : (vistosCalculados[aluno.aluno_id] || 0);
                            let somaNotas = notaVisto;
                            avaliacoes.forEach(av => {
                                somaNotas += isPosterior ? 0 : (notas[aluno.aluno_id]?.[av.id] || 0);
                            });
                            const mediaBimestral = somaNotas;
                            const d = new Date();
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            const todayStr = `${year}-${month}-${day}`;
                            const isAbsentToday = isStudentAbsentOnDate(aluno, todayStr);

                            return (
                            <tr key={aluno.aluno_id} className={idx % 2 !== 0 ? 'bg-ms-dark/5' : ''}>
                                <td className={`px-2 sm:px-6 py-3 sm:py-4 sticky left-0 z-10 border-r border-ms-border/30 min-w-[100px] max-w-[120px] sm:max-w-none ${
                                  idx % 2 !== 0
                                    ? theme === 'light' ? 'bg-[#fcfdfe]' : 'bg-[#0d131f]'
                                    : theme === 'light' ? 'bg-white' : 'bg-[#0d1117]'
                                }`}>
                                <div className="flex items-center gap-1.5 sm:gap-3">
                                    <span className="text-[10px] font-black text-ms-gold shrink-0">{idx + 1}.</span>
                                    <span className={`text-[10px] sm:text-xs font-bold leading-tight ${
                                      isAbsentToday
                                        ? 'animate-pulse text-red-650 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg'
                                        : aluno.status === 'Transferido' || aluno.status === 'Remanejado'
                                          ? 'line-through text-gray-500 opacity-60'
                                          : theme === 'light' ? 'text-blue-950' : 'text-ms-main'
                                    }`} title={aluno.aluno_nome}>
                                      <span className="sm:hidden">{aluno.aluno_nome.split(' ').slice(0, 2).join(' ')}</span>
                                      <span className="hidden sm:inline">{aluno.aluno_nome}</span>
                                      {aluno.status && aluno.status !== 'Ativo' && (
                                        <span className={`block mt-0.5 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase border tracking-normal w-fit ${
                                          aluno.status === 'Transferido' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                          aluno.status === 'Remanejado' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                          aluno.status === 'Atestado' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                          aluno.status === 'Suspenso' || aluno.status === 'Aluno Suspenso' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                          aluno.status === 'Licença Maternidade' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                          'bg-red-500/20 text-red-400 border-red-500/30'
                                        }`}>
                                          {aluno.status}
                                        </span>
                                      )}
                                    </span>
                                </div>
                                </td>
                                <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-black text-blue-500 bg-blue-500/5 whitespace-nowrap">
                                  {isPosterior ? 'N/A' : notaVisto.toFixed(1)}
                                </td>
                                {avaliacoes.map(av => (
                                <td key={av.id} className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                    {isPosterior ? (
                                      <span className="text-xs text-gray-505 font-medium italic">N/A</span>
                                    ) : (
                                      <DecimalInput 
                                          value={notas[aluno.aluno_id]?.[av.id] ?? ''}
                                          onChange={(val) => handleUpdateNota(aluno.aluno_id, av.id, val)}
                                          max={av.valor_maximo}
                                          disabled={isLocked}
                                          className={`w-12 sm:w-16 text-center p-1 rounded text-xs font-bold focus:border-blue-500 outline-none border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                              theme === 'light' ? 'bg-blue-50/30 border-blue-100 text-blue-900' : 'bg-ms-dark/5 border-ms-border/50 text-ms-main'
                                          }`}
                                      />
                                    )}
                                </td>
                                ))}
                                <td className="px-2 sm:px-6 py-3 sm:py-4 text-center">
                                    {isPosterior ? (
                                      <span className="text-xs text-gray-500 font-semibold italic">Inativo</span>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 rounded-full border border-ms-border shadow-inner" style={{ backgroundColor: `${getCorGradiente(mediaBimestral, theme)}20` }}>
                                          <span className="text-xs sm:text-sm font-black" style={{ color: getCorGradiente(mediaBimestral, theme) }}>
                                              {arredondarNotaMS(mediaBimestral).toFixed(1)}
                                          </span>
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCorGradiente(mediaBimestral, theme) }}></div>
                                      </div>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
      )}

      {isRAVModalOpen && (
        <RAVListModal
          isOpen={isRAVModalOpen}
          onClose={() => setIsRAVModalOpen(false)}
          theme={theme}
          professor={professor}
          turmaId={turmaId}
          disciplinaId={disciplinaId}
          bimestreId={bimestreId}
        />
      )}
    </div>
  );
}
