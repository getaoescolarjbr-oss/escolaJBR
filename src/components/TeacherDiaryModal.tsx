import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Student, AtividadeDiaria, Avaliacao } from '../types';
import { X, Loader2, BookOpen, AlertCircle, BarChart2, ClipboardList } from 'lucide-react';
import { arredondarNotaMS, getCorGradiente } from '../utils/academicUtils';

interface TeacherDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  professorId: string;
  professorNome: string;
  disciplinaId: string;
  disciplinaNome: string;
  turmaId: string;
  turmaNome: string;
  theme: 'dark' | 'light';
  initialBimestre: number;
  configVistoValorTotal?: number;
}

export function TeacherDiaryModal({
  isOpen,
  onClose,
  professorId,
  professorNome,
  disciplinaId,
  disciplinaNome,
  turmaId,
  turmaNome,
  theme,
  initialBimestre,
  configVistoValorTotal = 2.0,
}: TeacherDiaryModalProps) {
  const [selectedBimestre, setSelectedBimestre] = useState<number>(initialBimestre || 1);
  const [activeTab, setActiveTab] = useState<'vistos' | 'boletim'>('vistos');
  const [loading, setLoading] = useState(true);

  // Vistos state
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<AtividadeDiaria[]>([]);
  const [vistos, setVistos] = useState<Record<string, Record<string, string>>>({}); // studentId -> activityId -> valor

  // Grades state
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [notas, setNotas] = useState<Record<string, Record<string, number>>>({}); // alunoId -> avalId -> nota
  const [vistosCalculados, setVistosCalculados] = useState<Record<string, number>>({}); // alunoId -> nota de vistos

  useEffect(() => {
    if (isOpen && professorId && turmaId && disciplinaId) {
      fetchAllData();
    }
  }, [isOpen, professorId, turmaId, disciplinaId, selectedBimestre]);

  async function fetchAllData() {
    setLoading(true);
    try {
      // 1. Buscar alunos da turma
      const { data: studentsData } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .order('aluno_numero');

      const alunosList: Student[] = studentsData || [];
      setStudents(alunosList);

      // 2. Buscar atividades diárias do bimestre
      const { data: activitiesData } = await supabase
        .from('atividades_diárias')
        .select('*')
        .eq('id_do_professor', professorId)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', selectedBimestre)
        .order('data', { ascending: true });

      const acts = (activitiesData || []) as AtividadeDiaria[];
      setActivities(acts);

      // 3. Buscar vistos (registros de participação)
      if (acts.length > 0) {
        const { data: vistosData } = await supabase
          .from('vistos_v2')
          .select('aluno_id, atividade_id, valor')
          .in('atividade_id', acts.map(a => a.id));

        const map: Record<string, Record<string, string>> = {};
        (vistosData || []).forEach((v: any) => {
          const studentId = String(v.aluno_id).trim();
          const activityId = String(v.atividade_id).trim();
          if (!map[studentId]) map[studentId] = {};
          map[studentId][activityId] = String(v.valor).trim();
        });
        setVistos(map);

        // 3b. Calcular nota de vistos por aluno
        const pesosAluno: Record<string, number> = {};
        (vistosData || []).forEach((v: any) => {
          const aId = String(v.aluno_id).trim();
          pesosAluno[aId] = (pesosAluno[aId] || 0) + getPeso(String(v.valor));
        });

        const notasVistos: Record<string, number> = {};
        alunosList.forEach(aluno => {
          const soma = pesosAluno[String(aluno.id).trim()] || 0;
          const realizacao = acts.length > 0 ? soma / acts.length : 0;
          notasVistos[aluno.id] = arredondarNotaMS(realizacao * configVistoValorTotal);
        });
        setVistosCalculados(notasVistos);
      } else {
        setVistos({});
        setVistosCalculados({});
      }

      // 4. Buscar avaliações do bimestre
      const { data: avalData } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('professor_id', professorId)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', selectedBimestre);

      const avals: Avaliacao[] = avalData || [];
      setAvaliacoes(avals);

      // 5. Buscar notas das avaliações
      if (avals.length > 0) {
        const avalIds = avals.map(a => a.id);
        const { data: notasData } = await supabase
          .from('notas_avaliacoes')
          .select('*')
          .in('avaliacao_id', avalIds);

        const mappedNotas: Record<string, Record<string, number>> = {};
        (notasData || []).forEach((n: any) => {
          if (!mappedNotas[n.aluno_id]) mappedNotas[n.aluno_id] = {};
          mappedNotas[n.aluno_id][n.avaliacao_id] = n.nota;
        });
        setNotas(mappedNotas);
      } else {
        setNotas({});
      }
    } catch (error) {
      console.error('Error fetching diary data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getPeso = (val: string | undefined): number => {
    if (!val) return 0;
    const v = val.trim();
    if (v === '1.0' || v === '+' || v === '.' || v === 'checked') return 1.0;
    if (v === '0.5' || v === 'half') return 0.5;
    const num = parseFloat(v);
    if (isNaN(num)) return 0;
    return num > 1 ? num / 10 : num;
  };

  const getVistoBadge = (val: string | undefined) => {
    if (!val) return <span className="text-gray-500 font-bold opacity-30">—</span>;
    const peso = getPeso(val);
    if (peso === 1.0) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs font-black shadow-sm" title="Visto Completo">✓</span>
      );
    } else if (peso === 0.5) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs font-black shadow-sm" title="Meio Visto">½</span>
      );
    } else if (val.toLowerCase() === 'não fez' || val === '0' || val === '0.0') {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 text-xs font-black shadow-sm" title="Não Fez">✗</span>
      );
    }
    return <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black">{val}</span>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-ms-card w-full max-w-6xl h-[90vh] rounded-[2.5rem] border border-ms-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">

        {/* Header */}
        <div className="px-8 py-5 bg-gradient-to-r from-ms-blue/20 to-transparent border-b border-ms-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-ms-blue/20 flex items-center justify-center border border-ms-blue/30 shadow-inner">
              <ClipboardList className="w-7 h-7 text-ms-blue" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Diário de Atividades</h2>
              <p className="text-xs text-blue-400 font-extrabold uppercase tracking-widest flex items-center gap-2">
                <span className="text-white">{professorNome}</span>
                <span className="opacity-40">•</span>
                <span>{disciplinaNome}</span>
                <span className="opacity-40">•</span>
                <span className="text-ms-gold">{turmaNome}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all group">
            <X className="w-6 h-6 text-gray-500 group-hover:text-white" />
          </button>
        </div>

        {/* Controls Bar: Bimestre + Legend + Tabs */}
        <div className="px-8 py-3 bg-ms-dark/40 border-b border-ms-border/50 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
          {/* Bimestre selector */}
          <div className="flex items-center gap-2 p-1 bg-black/35 rounded-xl border border-ms-border/40 w-fit">
            {[1, 2, 3, 4].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBimestre(b)}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                  selectedBimestre === b
                    ? 'bg-blue-600 text-white shadow-md'
                    : theme === 'light' ? 'text-blue-800 hover:text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
                }`}
              >
                {b}º Bimestre
              </button>
            ))}
          </div>

          {/* Right side: legend + tab switcher */}
          <div className="flex items-center gap-6">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-bold" style={{ color: '#002677' }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded shadow-sm inline-block" style={{ backgroundColor: '#10b981', borderColor: '#059669', borderWidth: '1px' }}></span>
                <span>Concluído (1.0)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded shadow-sm inline-block" style={{ backgroundColor: '#f59e0b', borderColor: '#d97706', borderWidth: '1px' }}></span>
                <span>Meio Visto (0.5)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded shadow-sm inline-block" style={{ backgroundColor: '#ef4444', borderColor: '#dc2626', borderWidth: '1px' }}></span>
                <span>Não Fez</span>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex p-1 bg-black/30 rounded-xl border border-ms-border/40">
              <button
                onClick={() => setActiveTab('vistos')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'vistos' ? 'bg-blue-600 text-white shadow' : 'text-blue-200 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3 h-3" /> Vistos
              </button>
              <button
                onClick={() => setActiveTab('boletim')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'boletim' ? 'bg-blue-600 text-white shadow' : 'text-blue-200 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3 h-3" /> Notas & Média
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="h-full py-40 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-ms-blue mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Consultando banco de dados...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-ms-border rounded-3xl">
              <AlertCircle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-bold">Nenhum aluno cadastrado nesta turma.</p>
            </div>
          ) : activeTab === 'vistos' ? (
            /* ===== ABA VISTOS ===== */
            activities.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-ms-border rounded-3xl space-y-2">
                <BookOpen className="w-10 h-10 text-gray-500 mx-auto mb-1" />
                <p className="text-sm text-gray-400 font-black uppercase tracking-wider">Sem atividades registradas</p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Este docente ainda não cadastrou nenhuma atividade diária para esta turma/disciplina no {selectedBimestre}º Bimestre.
                </p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Tabela de Vistos */}
                <div className="border border-ms-border rounded-3xl overflow-hidden shadow-2xl bg-ms-card">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#0a1a3a] border-b border-ms-border text-[10px] font-black text-white uppercase tracking-widest">
                          <th className="px-6 py-4 text-left sticky left-0 z-20 bg-[#0a1a3a] border-r border-[#002677]/30 min-w-[220px] shadow-[2px_0_5px_rgba(0,0,0,0.15)]">
                            Estudante
                          </th>
                          {activities.map((act) => (
                            <th key={act.id} className="px-3 py-4 text-center min-w-[70px] relative group/th border-r border-ms-border/30 hover:bg-[#002677]/20 transition-colors">
                              <span className="cursor-help font-extrabold text-[#93c5fd] decoration-dotted underline decoration-[#93c5fd]/50">
                                {formatDate(act.data)}
                              </span>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-3 bg-white dark:bg-[#0d162d] text-gray-800 dark:text-gray-100 rounded-xl shadow-2xl border border-blue-200 dark:border-blue-900 opacity-0 invisible group-hover/th:opacity-100 group-hover/th:visible transition-all duration-200 text-left normal-case text-xs z-50">
                                <p className="font-black text-blue-600 dark:text-blue-400 mb-1">Atividade em {formatDate(act.data)}</p>
                                <p className="font-semibold text-gray-600 dark:text-gray-300 leading-relaxed max-h-24 overflow-y-auto pr-1">
                                  {act.descricao || 'Sem descrição cadastrada.'}
                                </p>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 rotate-45 bg-white dark:bg-[#0d162d] border-b border-r border-blue-200 dark:border-blue-900" />
                              </div>
                            </th>
                          ))}
                          <th className="px-6 py-4 text-center min-w-[120px] bg-black/40">Desempenho</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ms-border/50 text-xs">
                        {students.map((student, sIdx) => {
                          const cleanStudentId = String(student.id).trim();
                          const studentVistos = vistos[cleanStudentId] || {};
                          let somaVistos = 0;
                          activities.forEach(act => { somaVistos += getPeso(studentVistos[act.id]); });
                          const totalAtiv = activities.length;
                          const percentual = totalAtiv > 0 ? Math.min(100, Math.round((somaVistos / totalAtiv) * 100)) : 0;
                          let scoreColor = 'text-red-500 bg-red-500/10 border-red-500/20';
                          if (percentual >= 80) scoreColor = 'text-green-500 bg-green-500/10 border-green-500/20';
                          else if (percentual >= 60) scoreColor = 'text-blue-500 bg-blue-500/10 border-blue-500/20';
                          else if (percentual >= 40) scoreColor = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
                          return (
                            <tr key={student.id} className={`${sIdx % 2 !== 0 ? 'bg-ms-dark/15 hover:bg-ms-blue/5' : 'bg-transparent hover:bg-ms-blue/5'} transition-colors group`}>
                              <td className={`px-6 py-3 whitespace-nowrap sticky left-0 z-10 border-r border-ms-border/30 font-bold transition-colors ${
                                sIdx % 2 !== 0
                                  ? theme === 'light' ? 'bg-[#fcfdfe]' : 'bg-[#0d131f]'
                                  : theme === 'light' ? 'bg-white' : 'bg-[#0d1117]'
                              }`}>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-ms-gold">{student.aluno_numero || '-'}</span>
                                  <span className="text-xs text-white truncate max-w-[200px]" title={student.nome}>{student.nome}</span>
                                </div>
                              </td>
                              {activities.map((act) => (
                                <td key={act.id} className="px-3 py-3 text-center border-r border-ms-border/30">
                                  {getVistoBadge(studentVistos[act.id])}
                                </td>
                              ))}
                              <td className="px-6 py-3 text-center bg-black/10">
                                <div className="flex flex-col items-center justify-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${scoreColor} mb-0.5`}>{percentual}%</span>
                                  <span className="text-[9px] text-gray-500 font-bold">{somaVistos.toFixed(1)} / {totalAtiv}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Timeline de Atividades */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-ms-blue" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Conteúdo Programático e Atividades</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activities.map((act, index) => (
                      <div key={act.id} className="p-4 bg-ms-dark/20 border border-ms-border/60 rounded-2xl flex items-start gap-4 hover:border-ms-blue/30 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-ms-blue/10 flex items-center justify-center text-xs font-black text-ms-blue border border-ms-blue/20 flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] font-black text-ms-gold uppercase tracking-widest">
                            Data: {new Date(act.data).toLocaleDateString('pt-BR')}
                          </span>
                          <p className="text-xs text-gray-300 font-semibold leading-relaxed">
                            {act.descricao || 'Sem descrição cadastrada para esta atividade.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* ===== ABA BOLETIM / NOTAS & MÉDIA ===== */
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Resumo Visual das Avaliações Cadastradas */}
              {avaliacoes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Avaliações Cadastradas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {avaliacoes.map(av => (
                      <div 
                        key={av.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          theme === 'light' 
                            ? 'bg-white border-blue-100 shadow-sm' 
                            : 'bg-ms-card border-ms-border shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className={`text-xs font-black truncate max-w-[150px] ${theme === 'light' ? 'text-blue-950' : 'text-white'}`} title={av.nome}>
                            {av.nome}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                            av.publicada 
                              ? 'bg-emerald-550/10 text-emerald-400 border border-emerald-550/20' 
                              : 'bg-gray-550/10 text-gray-400 border border-gray-550/20'
                          }`}>
                            {av.publicada ? 'Público' : 'Pendente'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-550 font-bold uppercase">Pontos: <span className="text-ms-blue font-black">{av.valor_maximo} pts</span></span>
                          <span className="text-gray-555 font-bold uppercase">Data: <span className="text-ms-gold font-black">{av.data_avaliacao ? new Date(av.data_avaliacao + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem Data'}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-xl border border-ms-border overflow-hidden`}>
                <div className={`px-6 py-4 border-b ${theme === 'light' ? 'bg-[#e6f0ff] border-[#002677]/20' : 'bg-[#0a1a3a] border-[#002677]/30'}`}>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-[#002677]' : 'text-[#93c5fd]'}`}>
                    Boletim de Notas — {selectedBimestre}º Bimestre
                  </h3>
                  <p className={`text-[10px] font-bold uppercase mt-0.5 ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                    Vistos ({configVistoValorTotal} pts) + Avaliações = Média Bimestral
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ms-border/30">
                    <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-[#0a1a3a]'}>
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest sticky left-0 z-10 bg-inherit border-r border-white/10 min-w-[220px]">
                          Estudante
                        </th>
                        <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-600/20 min-w-[90px]">
                          Vistos<br />
                          <span className="text-[8px] text-white/50 font-bold">({configVistoValorTotal} pts)</span>
                        </th>
                        {avaliacoes.map(av => (
                          <th key={av.id} className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest min-w-[100px] border-r border-ms-border/30">
                            <div className="truncate max-w-[100px] mx-auto text-[#93c5fd]">{av.nome}</div>
                            <div className="text-[8px] text-white/50 font-bold">{av.valor_maximo} pts</div>
                            <div className="mt-1 flex flex-col items-center gap-0.5 no-print">
                              <span className="text-[8px] text-gray-300">
                                {av.data_avaliacao ? formatDate(av.data_avaliacao) : 'S/ Data'}
                              </span>
                              <span className={`text-[7px] font-bold px-1 rounded ${
                                av.publicada 
                                  ? 'bg-emerald-550/20 text-emerald-400 border border-emerald-550/30' 
                                  : 'bg-gray-550/20 text-gray-400 border border-gray-550/30'
                              }`}>
                                {av.publicada ? 'Púb.' : 'Pend.'}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-black/40 min-w-[110px]">
                          Média Bimestral
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ms-border/30">
                      {students.map((aluno, idx) => {
                        const notaVisto = vistosCalculados[aluno.id] || 0;
                        let somaNotas = notaVisto;
                        avaliacoes.forEach(av => {
                          somaNotas += notas[aluno.id]?.[av.id] || 0;
                        });
                        const mediaBimestral = arredondarNotaMS(somaNotas);
                        const corMedia = getCorGradiente(mediaBimestral, theme);
                        return (
                          <tr key={aluno.id} className={idx % 2 !== 0 ? (theme === 'light' ? 'bg-blue-50/30' : 'bg-ms-dark/5') : ''}>
                            <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-inherit border-r border-ms-border/30">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-ms-gold">{idx + 1}.</span>
                                <span className={`text-xs font-bold ${theme === 'light' ? 'text-blue-950' : 'text-ms-main'}`}>{aluno.nome}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center font-black text-blue-500 bg-blue-500/5 text-sm">
                              {notaVisto.toFixed(1)}
                            </td>
                            {avaliacoes.map(av => (
                              <td key={av.id} className="px-4 py-4 text-center">
                                <span className={`text-sm font-bold ${
                                  notas[aluno.id]?.[av.id] !== undefined
                                    ? theme === 'light' ? 'text-blue-900' : 'text-white'
                                    : 'text-gray-500'
                                }`}>
                                  {notas[aluno.id]?.[av.id] !== undefined
                                    ? notas[aluno.id][av.id].toFixed(1)
                                    : '—'}
                                </span>
                              </td>
                            ))}
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-ms-border shadow-inner" style={{ backgroundColor: `${corMedia}20` }}>
                                <span className="text-sm font-black" style={{ color: corMedia }}>
                                  {mediaBimestral.toFixed(1)}
                                </span>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: corMedia }}></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {avaliacoes.length === 0 && (
                  <div className="py-12 text-center">
                    <BarChart2 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                      Nenhuma avaliação cadastrada pelo docente neste bimestre.
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      A coluna de Vistos ainda está disponível acima.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-ms-dark/30 border-t border-ms-border flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest flex-shrink-0">
          <span>{students.length} Estudantes Cadastrados</span>
          <span>Diário de Vistos da Coordenação</span>
        </div>
      </div>
    </div>
  );
}
