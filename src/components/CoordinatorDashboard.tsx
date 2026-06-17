import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, Turma, Student } from '../types';
import { Filter, Users, Search, LayoutDashboard, ChevronDown, BookOpen, UserCheck, UserX, FileText, Loader2, GraduationCap, Globe, Activity, Calendar, ShieldCheck, Printer, AlertTriangle, CheckCheck, Clock, Mail, MessageSquare, BarChart2, Send, X } from 'lucide-react';
import { printReport } from '../utils/printUtils';
import { getCurrentBimestre } from '../utils/academicUtils';
import { autoUpdateExpiredAbsences } from '../utils/studentUtils';
import { StudentProfileModal } from './StudentProfileModal';
import { TeacherDiaryModal } from './TeacherDiaryModal';
import { SiteManager } from './admin/SiteManager';
import { GestaoAtasPanel } from './GestaoAtasPanel';
import { CalendarioLetivoModal } from './CalendarioLetivoModal';
import { CalendarioEditor } from './CalendarioEditor';
import { GradeCellEditModal } from './GradeCellEditModal';
import { BimestreLockModal } from './BimestreLockModal';
import { GestaoMensagensPanel } from './GestaoMensagensPanel';
import { StudentManager } from './admin/StudentManager';

interface CoordinatorDashboardProps {
  professor: Professor;
  theme: 'dark' | 'light';
}

export function CoordinatorDashboard({ professor, theme }: CoordinatorDashboardProps) {
  const overviewTableRef = useRef<HTMLTableElement>(null);
  const painelTableRef = useRef<HTMLTableElement>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, nome: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'painel_turma' | 'alunos' | 'site' | 'atas' | 'agenda_avaliacoes' | 'novas_ocorrencias' | 'comunicados'>('overview');
  const [ocorrenciasPendentes, setOcorrenciasPendentes] = useState<any[]>([]);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ocorrenciasRevisadas, setOcorrenciasRevisadas] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [devolutivaModalOc, setDevolutivaModalOc] = useState<any | null>(null);
  const [devolutivaText, setDevolutivaText] = useState('');
  const [submittingDevolutiva, setSubmittingDevolutiva] = useState(false);
  const [alunosReincidentes, setAlunosReincidentes] = useState<any[]>([]);
  const [loadingReincidentes, setLoadingReincidentes] = useState(false);
  const [showReincidentes, setShowReincidentes] = useState(false);
  const [avaliacoesAgenda, setAvaliacoesAgenda] = useState<any[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const agendaTableRef = useRef<HTMLTableElement>(null);
  const [painelData, setPainelData] = useState<{
    atividades: Record<string, number>;
    vistos: Record<string, Record<string, number>>;
    notas?: Record<string, Record<string, { total: number; detalhes: any[] }>>;
  }>({ atividades: {}, vistos: {} });
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [selectedBimestre, setSelectedBimestre] = useState<number>(getCurrentBimestre);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCalendarEditor, setShowCalendarEditor] = useState(false);
  const [selectedTeacherDiary, setSelectedTeacherDiary] = useState<{
    professorId: string;
    professorNome: string;
    disciplinaId: string;
    disciplinaNome: string;
    configVistoValorTotal: number;
  } | null>(null);

  const [isEditingGrades, setIsEditingGrades] = useState(false);
  const [selectedGradeCell, setSelectedGradeCell] = useState<{
    studentId: string;
    studentName: string;
    disciplinaNome: string;
  } | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);

  // Status Change Confirmation Modal States
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalStudent, setStatusModalStudent] = useState<Student | null>(null);
  const [statusModalNewStatus, setStatusModalNewStatus] = useState<Student['status'] | ''>('');
  const [statusModalDateInicio, setStatusModalDateInicio] = useState('');
  const [statusModalDateFim, setStatusModalDateFim] = useState('');
  const [statusModalTargetTurma, setStatusModalTargetTurma] = useState('');
  const [statusModalSubmitting, setStatusModalSubmitting] = useState(false);

  useEffect(() => {
    fetchTurmas();
    fetchOcorrenciasPendentes();
  }, []);

  useEffect(() => {
    if (selectedTurma) {
      fetchTurmaData();
      if (activeTab === 'painel_turma') {
        fetchPainelTurma();
      } else if (activeTab === 'agenda_avaliacoes') {
        fetchAgendaAvaliacoes();
      }
    }
  }, [selectedTurma, activeTab, selectedBimestre]);

  async function fetchTurmas() {
    const { data } = await supabase.from('turmas').select('*').order('nome');
    if (data) {
      setTurmas(data);
      if (data.length > 0) setSelectedTurma(data[0].id);
    }
  }

  async function fetchTurmaData() {
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: studentsData } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', selectedTurma)
        .order('aluno_numero');
      
      if (studentsData) {
        setStudents(studentsData);
        autoUpdateExpiredAbsences(studentsData, (updated) => {
          setStudents(updated);
        });
      }

      // 2. Fetch Professors/Disciplines allocated to this turma
      const combinedMap = new Map();

      // Fonte A: alocacoes_v2
      const { data: allocsData } = await supabase
        .from('alocacoes_v2')
        .select(`
          id,
          professores (id, nome, cargo, config_visto_valor_total),
          disciplinas (id, nome)
        `)
        .eq('turma_id', selectedTurma);
      
      if (allocsData) {
        allocsData.forEach((a: any) => {
          if (a.professores?.id && a.disciplinas?.id) {
            combinedMap.set(`${a.professores.id}-${a.disciplinas.id}`, a);
          }
        });
      }

      // Fonte B: horarios
      const { data: horariosData } = await supabase
        .from('horarios')
        .select(`
          professor_id,
          disciplina_id,
          disciplina_nome,
          professores!inner(id, nome, cargo, config_visto_valor_total)
        `)
        .eq('turma_id', selectedTurma);

      if (horariosData) {
        horariosData.forEach((h: any) => {
          const key = `${h.professor_id}-${h.disciplina_id}`;
          if (!combinedMap.has(key)) {
            combinedMap.set(key, {
              id: key,
              professores: h.professores,
              disciplinas: { id: h.disciplina_id, nome: h.disciplina_nome }
            });
          }
        });
      }

      // Fonte C: lista_para_vistos (Legado)
      const { data: legacyData } = await supabase
        .from('lista_para_vistos')
        .select(`
          professor_id, professor_nome,
          disciplina_id, disciplina_nome,
          professores!inner(id, nome, cargo, config_visto_valor_total)
        `)
        .eq('turma_id', selectedTurma);

      if (legacyData) {
        legacyData.forEach((l: any) => {
          const key = `${l.professor_id}-${l.disciplina_id}`;
          if (!combinedMap.has(key)) {
            combinedMap.set(key, {
              id: key,
              professores: l.professores,
              disciplinas: { id: l.disciplina_id, nome: l.disciplina_nome }
            });
          }
        });
      }

      setAllocations(Array.from(combinedMap.values()));

    } catch (err) {
      console.error('Error fetching coordinator dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPainelTurma() {
      setLoadingPainel(true);
      try {
          let atividadesData;
          if (selectedBimestre > 0) {
            const { data } = await supabase
              .from('atividades_diárias')
              .select('id, disciplinas(nome)')
              .eq('turma_id', selectedTurma)
              .eq('bimestre_id', selectedBimestre);
            atividadesData = data;
          } else {
            const { data } = await supabase
              .from('atividades_diárias')
              .select('id, disciplinas(nome)')
              .eq('turma_id', selectedTurma);
            atividadesData = data;
          }

          const contagemAtividades: Record<string, number> = {};
          const ativIds: string[] = [];

          if (atividadesData) {
              atividadesData.forEach((a: any) => {
                  const discNome = a.disciplinas?.nome;
                  if (discNome) {
                      contagemAtividades[discNome] = (contagemAtividades[discNome] || 0) + 1;
                      ativIds.push(a.id);
                  }
              });
          }

          const vistosAcumulados: Record<string, Record<string, number>> = {};
          
          if (ativIds.length > 0) {
              const { data: vistosData } = await supabase
                 .from('vistos_v2')
                 .select('aluno_id, valor, atividade_id!inner(disciplinas(nome))')
                 .in('atividade_id', ativIds);
              
              if (vistosData) {
                  vistosData.forEach((v: any) => {
                     const disc = v.atividade_id?.disciplinas?.nome;
                     const alunoId = v.aluno_id;
                     if (disc && alunoId) {
                         let peso = 0;
                         const val = String(v.valor).trim();
                         if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
                         else if (val === '0.5' || val === 'half') peso = 0.5;
                         else if (!isNaN(parseFloat(val))) {
                             const num = parseFloat(val);
                             peso = num > 1 ? num / 10 : num;
                         }

                         if (!vistosAcumulados[alunoId]) vistosAcumulados[alunoId] = {};
                         vistosAcumulados[alunoId][disc] = (vistosAcumulados[alunoId][disc] || 0) + peso;
                     }
                  });
              }
          }

          // ── Mapear Disciplinas (ID -> Nome) ──
          const { data: discData } = await supabase.from('disciplinas').select('id, nome');
          const discMap: Record<string, string> = {};
          if (discData) {
              discData.forEach((d: any) => discMap[d.id] = d.nome);
          }

          // ── Buscar Avaliações e Notas ──
          let avaliacoesData;
          if (selectedBimestre > 0) {
            const { data } = await supabase
              .from('avaliacoes')
              .select('id, valor_maximo, nome, disciplina_id')
              .eq('turma_id', selectedTurma)
              .eq('bimestre_id', selectedBimestre);
            avaliacoesData = data;
          } else {
            const { data } = await supabase
              .from('avaliacoes')
              .select('id, valor_maximo, nome, disciplina_id')
              .eq('turma_id', selectedTurma);
            avaliacoesData = data;
          }

          const avalIds = avaliacoesData?.map((a: any) => a.id) || [];
          let notasData: any[] = [];
          if (avalIds.length > 0) {
              const { data } = await supabase
                 .from('notas_avaliacoes')
                 .select('aluno_id, avaliacao_id, nota')
                 .in('avaliacao_id', avalIds);
              notasData = data || [];
          }

          // Agrupar notas por aluno e disciplina
          const notasAcumuladas: Record<string, Record<string, { total: number; detalhes: any[] }>> = {};
          
          if (avaliacoesData && notasData) {
              notasData.forEach((nota: any) => {
                  const aval = avaliacoesData.find((a: any) => a.id === nota.avaliacao_id);
                  if (aval && aval.disciplina_id) {
                      const discNome = discMap[aval.disciplina_id] || 'Desconhecida';
                      const alunoId = nota.aluno_id;
                      
                      if (!notasAcumuladas[alunoId]) notasAcumuladas[alunoId] = {};
                      if (!notasAcumuladas[alunoId][discNome]) {
                          notasAcumuladas[alunoId][discNome] = { total: 0, detalhes: [] };
                      }
                      
                      notasAcumuladas[alunoId][discNome].total += nota.nota;
                      notasAcumuladas[alunoId][discNome].detalhes.push({
                          nome: aval.nome,
                          nota: nota.nota,
                          valorMaximo: aval.valor_maximo
                      });
                  }
              });
          }

          // ── Garantir que todas as disciplinas da turma apareçam no painel consolidado ──
          // 1. A partir das alocações da turma
          const { data: localAllocs } = await supabase
            .from('alocacoes_v2')
            .select('disciplinas(nome)')
            .eq('turma_id', selectedTurma);
          
          if (localAllocs) {
              localAllocs.forEach((a: any) => {
                  const discNome = a.disciplinas?.nome;
                  if (discNome && !contagemAtividades[discNome]) {
                      contagemAtividades[discNome] = 0;
                  }
              });
          }

          // 2. A partir das avaliações do bimestre/turma
          if (avaliacoesData) {
              avaliacoesData.forEach((av: any) => {
                  const discNome = discMap[av.disciplina_id];
                  if (discNome && !contagemAtividades[discNome]) {
                      contagemAtividades[discNome] = 0;
                  }
              });
          }

          setPainelData({ 
            atividades: contagemAtividades, 
            vistos: vistosAcumulados,
            notas: notasAcumuladas
          });
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingPainel(false);
      }
  }

  async function fetchAgendaAvaliacoes() {
    if (!selectedTurma) return;
    setLoadingAgenda(true);
    try {
      let query = supabase
        .from('avaliacoes')
        .select('*')
        .eq('turma_id', selectedTurma);
      
      if (selectedBimestre > 0) {
        query = query.eq('bimestre_id', selectedBimestre);
      }
      
      const { data: avals, error } = await query;
      if (error) throw error;

      if (avals && avals.length > 0) {
        const discIds = [...new Set(avals.map(a => a.disciplina_id).filter(Boolean))];
        const profIds = [...new Set(avals.map(a => a.professor_id).filter(Boolean))];

        const [resDisciplinas, resProfessores] = await Promise.all([
          discIds.length > 0 ? supabase.from('disciplinas').select('id, nome').in('id', discIds) : { data: [] },
          profIds.length > 0 ? supabase.from('professores').select('id, nome').in('id', profIds) : { data: [] }
        ]);

        const discMap = Object.fromEntries((resDisciplinas.data || []).map(d => [d.id, d.nome]));
        const profMap = Object.fromEntries((resProfessores.data || []).map(p => [p.id, p.nome]));

        const mapped = avals.map(a => ({
          ...a,
          disciplinaNome: discMap[a.disciplina_id] || 'Disciplina não encontrada',
          professorNome: profMap[a.professor_id] || 'Professor não encontrado'
        }));

        mapped.sort((x, y) => {
          if (!x.data_avaliacao) return 1;
          if (!y.data_avaliacao) return -1;
          return x.data_avaliacao.localeCompare(y.data_avaliacao);
        });
        setAvaliacoesAgenda(mapped);
      } else {
        setAvaliacoesAgenda([]);
      }
    } catch (err) {
      console.error('Error fetching assessment agenda:', err);
    } finally {
      setLoadingAgenda(false);
    }
  }

  const handleUpdateAgendaField = async (id: string, field: 'data_avaliacao' | 'publicada', value: any) => {
    setAvaliacoesAgenda(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

    const { error } = await supabase
      .from('avaliacoes')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      console.error(`Erro ao atualizar avaliação ${id} campo ${field}:`, error);
      alert('Erro ao salvar alteração.');
    }
  };

  const handlePrintAgenda = () => {
    const currentTurmaNome = turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';
    const bimestreText = selectedBimestre === 0 ? 'Todos os Bimestres' : `${selectedBimestre}º Bimestre`;
    printReport(agendaTableRef.current, {
      title: `Agenda de Avaliações — ${currentTurmaNome}`,
      subtitle: `Cronograma Escolar — ${bimestreText}`,
      info: [
        { label: 'Turma', value: currentTurmaNome },
        { label: 'Período', value: bimestreText },
        { label: 'Total de Avaliações', value: String(avaliacoesAgenda.length) }
      ]
    });
  };

  async function handleUpdateStudentStatus(studentId: string, newStatus: string) {
    if (newStatus === 'Atestado' || newStatus === 'Suspenso' || newStatus === 'Aluno Suspenso' || newStatus === 'Licença Maternidade' || newStatus === 'Transferido' || newStatus === 'Remanejado') {
      const student = students.find(s => s.id === studentId);
      if (student) {
        setStatusModalStudent(student);
        setStatusModalNewStatus(newStatus as Student['status']);
        setStatusModalDateInicio(new Date().toISOString().split('T')[0]); // Default to today
        setStatusModalDateFim('');
        setStatusModalTargetTurma('');
        setStatusModalOpen(true);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('alunos')
        .update({ 
          status: newStatus,
          atestado_inicio: null,
          atestado_fim: null
        })
        .eq('id', studentId);

      if (error) throw error;

      // Atualiza o estado local imediatamente
      setStudents(prev => prev.map(s => s.id === studentId ? { 
        ...s, 
        status: newStatus as Student['status'],
        atestado_inicio: undefined,
        atestado_fim: undefined
      } : s));
    } catch (err) {
      console.error('Error updating student status:', err);
      alert('Erro ao atualizar o status do aluno.');
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusModalStudent || !statusModalNewStatus) return;
    
    setStatusModalSubmitting(true);
    try {
      const studentId = statusModalStudent.id;
      
      if (statusModalNewStatus === 'Atestado' || statusModalNewStatus === 'Suspenso' || statusModalNewStatus === 'Aluno Suspenso' || statusModalNewStatus === 'Licença Maternidade') {
        if (!statusModalDateInicio) {
          alert('Por favor, preencha a data de início.');
          setStatusModalSubmitting(false);
          return;
        }
        const { error } = await supabase
          .from('alunos')
          .update({
            status: statusModalNewStatus,
            atestado_inicio: statusModalDateInicio,
            atestado_fim: statusModalDateFim || null
          })
          .eq('id', studentId);
        
        if (error) throw error;
        
        setStudents(prev => prev.map(s => s.id === studentId ? {
          ...s,
          status: statusModalNewStatus as Student['status'],
          atestado_inicio: statusModalDateInicio,
          atestado_fim: statusModalDateFim || undefined
        } : s));
        
      } else if (statusModalNewStatus === 'Transferido') {
        if (!statusModalDateInicio) {
          alert('Por favor, preencha a data da transferência.');
          setStatusModalSubmitting(false);
          return;
        }
        const { error } = await supabase
          .from('alunos')
          .update({
            status: 'Transferido',
            atestado_inicio: statusModalDateInicio,
            atestado_fim: null
          })
          .eq('id', studentId);
        
        if (error) throw error;
        
        setStudents(prev => prev.map(s => s.id === studentId ? {
          ...s,
          status: 'Transferido',
          atestado_inicio: statusModalDateInicio,
          atestado_fim: undefined
        } : s));
        
      } else if (statusModalNewStatus === 'Remanejado') {
        if (!statusModalDateInicio) {
          alert('Por favor, preencha a data do remanejamento.');
          setStatusModalSubmitting(false);
          return;
        }
        if (!statusModalTargetTurma) {
          alert('Por favor, selecione a turma de destino.');
          setStatusModalSubmitting(false);
          return;
        }
        
        // 1. Mark original student as Remanejado in current class
        const { error: originalError } = await supabase
          .from('alunos')
          .update({
            status: 'Remanejado',
            atestado_inicio: statusModalDateInicio,
            atestado_fim: null
          })
          .eq('id', studentId);
        
        if (originalError) throw originalError;
        
        // 2. Fetch all students in the target class to determine next call number (aluno_numero)
        const { data: targetStudents, error: fetchError } = await supabase
          .from('alunos')
          .select('aluno_numero')
          .eq('turma_id', statusModalTargetTurma);
        
        if (fetchError) throw fetchError;
        
        const nextNumber = targetStudents && targetStudents.length > 0 
          ? Math.max(...targetStudents.map(ts => ts.aluno_numero || 0)) + 1 
          : 1;
        
        // 3. Insert new student in the target class
        const { error: insertError } = await supabase
          .from('alunos')
          .insert([{
            nome: statusModalStudent.nome,
            turma_id: statusModalTargetTurma,
            aluno_numero: nextNumber,
            status: 'Ativo'
          }]);
        
        if (insertError) throw insertError;
        
        // Update local state immediately
        setStudents(prev => prev.map(s => s.id === studentId ? {
          ...s,
          status: 'Remanejado',
          atestado_inicio: statusModalDateInicio,
          atestado_fim: undefined
        } : s));
      }
      
      setStatusModalOpen(false);
      setStatusModalStudent(null);
      setStatusModalNewStatus('');
    } catch (err: any) {
      console.error('Error executing status change:', err);
      alert('Erro ao atualizar o status do aluno: ' + err.message);
    } finally {
      setStatusModalSubmitting(false);
    }
  }

  const fetchOcorrenciasPendentes = async () => {
    setLoadingOcorrencias(true);
    try {
      const { data: rawOcorrencias, error } = await supabase
        .from('ocorrências')
        .select('*')
        .or('visto_coordenador.eq.false,visto_coordenador.is.null')
        .order('data_registro', { ascending: false });

      if (error) throw error;

      if (rawOcorrencias && rawOcorrencias.length > 0) {
        const studentIds = [...new Set(rawOcorrencias.map(o => o.aluno_id).filter(Boolean))];
        const teacherIds = [...new Set(rawOcorrencias.map(o => o.id_do_professor).filter(Boolean))];
        const classIds = [...new Set(rawOcorrencias.map(o => o.turma_id).filter(Boolean))];

        const [studentsRes, teachersRes, classesRes] = await Promise.all([
          supabase.from('alunos').select('id, nome, aluno_numero, turma_id').in('id', studentIds),
          supabase.from('professores').select('id, nome, cargo').in('id', teacherIds),
          supabase.from('turmas').select('id, nome').in('id', classIds)
        ]);

        const studentsMap = new Map(studentsRes.data?.map(s => [s.id, s]) || []);
        const teachersMap = new Map(teachersRes.data?.map(t => [t.id, t]) || []);
        const classesMap = new Map(classesRes.data?.map(c => [c.id, c]) || []);

        const mapped = rawOcorrencias.map(o => {
          return {
            ...o,
            aluno: o.aluno_id ? studentsMap.get(o.aluno_id) : { nome: 'Aluno Desconhecido' },
            turma: o.turma_id ? classesMap.get(o.turma_id) : { nome: 'Sem Turma' },
            professor: o.id_do_professor ? teachersMap.get(o.id_do_professor) : null
          };
        });
        
        setOcorrenciasPendentes(mapped);
      } else {
        setOcorrenciasPendentes([]);
      }
    } catch (err) {
      console.error('Error fetching pending occurrences:', err);
    } finally {
      setLoadingOcorrencias(false);
    }
  };

  const fetchOcorrenciasRevisadas = async () => {
    setLoadingHistory(true);
    try {
      const { data: rawOcorrencias, error } = await supabase
        .from('ocorrências')
        .select('*')
        .eq('visto_coordenador', true)
        .order('data_visualizacao_coordenador', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (rawOcorrencias && rawOcorrencias.length > 0) {
        const studentIds = [...new Set(rawOcorrencias.map(o => o.aluno_id).filter(Boolean))];
        const teacherIds = [...new Set(rawOcorrencias.map(o => o.id_do_professor).filter(Boolean))];
        const classIds = [...new Set(rawOcorrencias.map(o => o.turma_id).filter(Boolean))];

        const [studentsRes, teachersRes, classesRes] = await Promise.all([
          supabase.from('alunos').select('id, nome, aluno_numero, turma_id').in('id', studentIds),
          supabase.from('professores').select('id, nome, cargo').in('id', teacherIds),
          supabase.from('turmas').select('id, nome').in('id', classIds)
        ]);

        const studentsMap = new Map(studentsRes.data?.map(s => [s.id, s]) || []);
        const teachersMap = new Map(teachersRes.data?.map(t => [t.id, t]) || []);
        const classesMap = new Map(classesRes.data?.map(c => [c.id, c]) || []);

        const mapped = rawOcorrencias.map(o => {
          return {
            ...o,
            aluno: o.aluno_id ? studentsMap.get(o.aluno_id) : { nome: 'Aluno Desconhecido' },
            turma: o.turma_id ? classesMap.get(o.turma_id) : { nome: 'Sem Turma' },
            professor: o.id_do_professor ? teachersMap.get(o.id_do_professor) : null
          };
        });
        
        setOcorrenciasRevisadas(mapped);
      } else {
        setOcorrenciasRevisadas([]);
      }
    } catch (err) {
      console.error('Error fetching reviewed occurrences:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchAlunosReincidentes = async () => {
    setLoadingReincidentes(true);
    try {
      // Busca todas as ocorrências com dados do aluno e turma em uma única query
      const { data, error } = await supabase
        .from('ocorrências')
        .select('aluno_id, aluno:alunos(id, nome, aluno_numero, turma_id, turmas(nome))');

      if (error) throw error;

      if (data && data.length > 0) {
        // Agrupa por aluno_id e conta ocorrências
        const countMap = new Map<string, { count: number; aluno: any }>();
        data.forEach((oc: any) => {
          if (!oc.aluno_id) return;
          const id = String(oc.aluno_id);
          if (!countMap.has(id)) {
            countMap.set(id, { count: 0, aluno: oc.aluno });
          }
          countMap.get(id)!.count += 1;
        });

        const result = Array.from(countMap.entries())
          .filter(([, { count }]) => count >= 3)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([id, { count, aluno }]) => ({ id, count, aluno }))
          .filter(r => r.aluno); // remove entradas sem aluno válido

        setAlunosReincidentes(result);
      } else {
        setAlunosReincidentes([]);
      }
    } catch (err) {
      console.error('Error fetching reincidentes:', err);
      setAlunosReincidentes([]);
    } finally {
      setLoadingReincidentes(false);
    }
  };

  const handleConfirmLeitura = (oc: any) => {
    setDevolutivaModalOc(oc);
    setDevolutivaText('');
  };

  const handleSaveDevolutiva = async () => {
    if (!devolutivaModalOc) return;
    setSubmittingDevolutiva(true);
    // Capture values before clearing state (closure safety)
    const ocId = devolutivaModalOc.id;
    const devolutiva = devolutivaText.trim() || null;
    // Optimistic: remove immediately from list
    setOcorrenciasPendentes(prev => prev.filter(o => o.id !== ocId));
    setDevolutivaModalOc(null);
    setDevolutivaText('');
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('ocorrências')
        .update({
          visto_coordenador: true,
          data_visualizacao_coordenador: now,
          devolutiva_coordenador: devolutiva
        })
        .eq('id', ocId);

      if (error) throw error;

      // Refresh reincidentes list after confirming
      fetchAlunosReincidentes();
    } catch (err: any) {
      console.error('Error saving devolutiva:', err);
      // Revert optimistic update on failure
      fetchOcorrenciasPendentes();
      alert('Erro ao confirmar leitura: ' + err.message);
    } finally {
      setSubmittingDevolutiva(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'novas_ocorrencias') {
      fetchOcorrenciasPendentes();
      fetchAlunosReincidentes();
    }
  }, [activeTab]);

  const filteredStudents = students.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-2 p-1 bg-ms-dark/50 border border-ms-border rounded-2xl w-full lg:w-fit">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'overview' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <LayoutDashboard className="w-4 h-4" /> Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('painel_turma')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'painel_turma' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <Activity className="w-4 h-4" /> Painel da Turma
        </button>
        <button 
          onClick={() => setActiveTab('alunos')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'alunos' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <GraduationCap className="w-4 h-4" /> Alunos
        </button>
        <button 
          onClick={() => setActiveTab('site')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'site' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <Globe className="w-4 h-4" /> Gestão do Site
        </button>
        <button 
          onClick={() => setActiveTab('atas')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'atas' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <FileText className="w-4 h-4" /> Gestão de Atas
        </button>
        <button 
          onClick={() => setActiveTab('agenda_avaliacoes')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'agenda_avaliacoes' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <Calendar className="w-4 h-4" /> Agenda de Avaliações
        </button>
        <button 
          onClick={() => setActiveTab('novas_ocorrencias')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full relative ${activeTab === 'novas_ocorrencias' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Novas Ocorrências
          {ocorrenciasPendentes.length > 0 && (
            <span className="ml-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-md">
              {ocorrenciasPendentes.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('comunicados')}
          className={`flex items-center justify-center lg:justify-start gap-2 px-3 lg:px-6 py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-wider lg:tracking-widest transition-all w-full ${activeTab === 'comunicados' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
        >
          <Mail className="w-4 h-4" /> Comunicados
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowCalendarModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-ms-card border border-ms-border text-[#d4af37] hover:bg-ms-dark/50 shadow-md"
        >
          <Calendar className="w-4 h-4" /> Calendário 2026
        </button>
        <button
          onClick={() => setShowCalendarEditor(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 shadow-md"
        >
          ✏️ Editar Calendário
        </button>
        <button
          onClick={() => setShowLockModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 shadow-md shadow-red-950/10"
        >
          🔒 Bloquear Bimestres
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-ms-blue" />
            Visão Geral da Coordenação
          </h2>
          <p className="text-sm text-[#003366] font-bold">Monitoramento de turmas, docentes e rendimento discente</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-56 group">
            <select
              value={selectedBimestre}
              onChange={(e) => setSelectedBimestre(Number(e.target.value))}
              className="w-full pl-4 pr-10 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
            >
              {[0,1,2,3,4].map(b => (
                <option key={b} value={b}>{b===0 ? 'Todos os Bimestres' : `${b}º Bimestre`}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <div className="relative w-full md:w-64 group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ms-blue group-hover:scale-110 transition-transform" />
            <select
              value={selectedTurma}
              onChange={(e) => setSelectedTurma(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
            >
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Professors Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-ms-card rounded-3xl border border-ms-border overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-ms-blue/10 border-b border-ms-border flex items-center gap-3">
              <Users className="w-5 h-5 text-ms-blue" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Docentes Alocados</h3>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ms-blue" /></div>
              ) : allocations.length === 0 ? (
                <p className="text-center py-6 text-[#003366] text-xs font-bold italic">Nenhuma alocação encontrada.</p>
              ) : allocations.map((a, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTeacherDiary({
                    professorId: a.professores?.id,
                    professorNome: a.professores?.nome,
                    disciplinaId: a.disciplinas?.id,
                    disciplinaNome: a.disciplinas?.nome,
                    configVistoValorTotal: a.professores?.config_visto_valor_total ?? 2.0
                  })}
                  className="w-full flex items-center text-left gap-3 p-3 bg-ms-dark/30 rounded-2xl border border-ms-border/50 hover:bg-ms-blue/10 hover:border-ms-blue/30 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-ms-blue/10 flex items-center justify-center text-xs font-black text-ms-blue border border-ms-blue/20 group-hover:bg-ms-blue group-hover:text-white transition-all">
                    {(a.professores?.nome || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ms-blue leading-tight group-hover:text-ms-blue transition-colors">{a.professores?.nome}</p>
                    <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: '#fbbf24' }}>{a.disciplinas?.nome}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-ms-blue to-blue-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <GraduationCap className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform duration-500" />
            <h3 className="text-xl font-black text-white mb-2 relative z-10">Resumo da Turma</h3>
            <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-[10px] font-black text-blue-200 uppercase mb-1">Total Alunos</p>
                <p className="text-2xl font-black text-white">{students.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-[10px] font-black text-blue-200 uppercase mb-1">Disciplinas</p>
                <p className="text-2xl font-black text-white">{new Set(allocations.map(a => a.disciplinas?.id)).size}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Students Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-ms-card rounded-3xl border border-ms-border overflow-hidden shadow-2xl flex flex-col h-full">
            <div className="px-8 py-5 border-b border-ms-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-ms-blue" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Lista de Alunos</h3>
                </div>
                <button
                  onClick={() => {
                    const currentTurmaNome = turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';
                    printReport(overviewTableRef.current, {
                      title: `Lista de Alunos — ${currentTurmaNome}`,
                      subtitle: `Coordenação Pedagógica`
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md animate-in fade-in"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filtrar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-ms-dark border border-ms-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Consultando banco de dados...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-20 text-gray-500 italic">Nenhum aluno encontrado nesta turma.</p>
              ) : (
                <table ref={overviewTableRef} className="w-full">
                  <thead className="sticky top-0 bg-ms-card z-20">
                    <tr className="bg-ms-dark/50 border-b border-ms-border">
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Nº</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Aluno</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest no-print">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ms-border/50">
                    {filteredStudents.map((s, idx) => (
                      <tr key={s.id} className={`${idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'} hover:bg-ms-blue/5 transition-colors group`}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-sm font-black text-ms-gold">{s.aluno_numero || '-'}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-ms-blue/10 flex items-center justify-center text-[10px] font-black text-ms-blue border border-ms-blue/20">
                              {s.nome.charAt(0)}
                            </div>
                            <p className="text-sm font-bold text-white">{s.nome}</p>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <div className="relative inline-flex items-center group">
                            <select
                              value={s.status || 'Ativo'}
                              onChange={(e) => handleUpdateStudentStatus(s.id, e.target.value)}
                              className={`pl-3 pr-7 py-1.5 rounded-full text-[10px] font-black uppercase border appearance-none cursor-pointer outline-none transition-all ${
                                s.status === 'Ativo' ? 'bg-green-500/10 text-green-500 border-green-500/20 focus:ring-2 focus:ring-green-500/20' :
                                s.status === 'Atestado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 focus:ring-2 focus:ring-blue-500/20' :
                                s.status === 'Suspenso' || s.status === 'Aluno Suspenso' ? 'bg-red-500/10 text-red-500 border-red-500/20 focus:ring-2 focus:ring-red-500/20' :
                                s.status === 'Licença Maternidade' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 focus:ring-2 focus:ring-purple-500/20' :
                                'bg-gray-550/10 text-gray-500 border-gray-550/20 focus:ring-2 focus:ring-gray-500/20'
                              }`}
                            >
                              <option value="Ativo" className="bg-ms-card text-green-500 font-bold">Ativo</option>
                              <option value="Atestado" className="bg-ms-card text-blue-500 font-bold">Atestado</option>
                              <option value="Suspenso" className="bg-ms-card text-red-500 font-bold">Aluno Suspenso</option>
                              <option value="Licença Maternidade" className="bg-ms-card text-purple-500 font-bold">Licença Maternidade</option>
                              <option value="Transferido" className="bg-ms-card text-gray-500 font-bold">Transferido</option>
                              <option value="Remanejado" className="bg-ms-card text-gray-500 font-bold">Remanejado</option>
                              <option value="Cancelada" className="bg-ms-card text-red-500 font-bold">Cancelada</option>
                            </select>
                            <ChevronDown className={`absolute right-2 w-3 h-3 pointer-events-none ${
                              s.status === 'Ativo' ? 'text-green-500' :
                              s.status === 'Atestado' ? 'text-blue-500' :
                              s.status === 'Suspenso' || s.status === 'Aluno Suspenso' ? 'text-red-500' :
                              s.status === 'Licença Maternidade' ? 'text-purple-500' :
                              'text-gray-500'
                            }`} />
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 no-print">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setSelectedStudent({ id: s.id, nome: s.nome })}
                              className="flex items-center gap-2 px-4 py-2 bg-ms-blue/10 text-ms-blue rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ms-blue hover:text-white transition-all shadow-lg hover:shadow-blue-900/40"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ficha
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      ) : activeTab === 'painel_turma' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <Activity className="w-6 h-6 text-ms-blue" />
                Painel da Turma
              </h2>
              <p className="text-sm text-[#003366] font-bold">Desempenho consolidado de todos os alunos em todas as disciplinas</p>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-3">
              <button
                onClick={() => {
                  const currentTurmaNome = turmas.find(t => t.id === selectedTurma)?.nome || 'Turma';
                  const bimestreText = selectedBimestre === 0 ? 'Todos os Bimestres' : `${selectedBimestre}º Bimestre`;
                  printReport(painelTableRef.current, {
                    title: `Painel Consolidado — ${currentTurmaNome}`,
                    subtitle: `Rendimento Escolar: ${bimestreText}`,
                    info: [
                      { label: 'Turma', value: currentTurmaNome },
                      { label: 'Período', value: bimestreText }
                    ]
                  });
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl h-11"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button
                onClick={() => setIsEditingGrades(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all h-11 border shadow-xl ${
                  isEditingGrades
                    ? 'bg-amber-500 text-white border-amber-600 shadow-amber-950/20'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                ✏️ {isEditingGrades ? 'Edição Ativa' : 'Editar Notas'}
              </button>
              <div className="relative w-full md:w-56 group">
                <select
                  value={selectedBimestre}
                  onChange={(e) => setSelectedBimestre(Number(e.target.value))}
                  className="w-full pl-4 pr-10 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
                >
                  {[0,1,2,3,4].map(b => (
                  <option key={b} value={b}>{b===0 ? 'Todos os Bimestres' : `${b}º Bimestre`}</option>
                ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
              <div className="relative w-full md:w-64 group">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ms-blue group-hover:scale-110 transition-transform" />
                <select
                  value={selectedTurma}
                  onChange={(e) => setSelectedTurma(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
                >
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="bg-ms-card rounded-2xl shadow-xl border border-ms-border overflow-hidden">
             {loadingPainel || loading ? (
                 <div className="py-20 flex flex-col items-center justify-center">
                   <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
                   <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Processando boletim consolidado...</p>
                 </div>
             ) : students.length === 0 ? (
                 <p className="text-center py-20 text-gray-500 italic">Nenhum aluno encontrado nesta turma.</p>
             ) : (
                  <div className="overflow-x-auto">
                      <table ref={painelTableRef} className="min-w-full divide-y divide-ms-border/30">
                         <thead className="bg-[#0a1a3a]">
                         <tr>
                             <th className="px-4 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest sticky left-0 z-10 bg-[#0a1a3a] border-r border-[#002677]/30 shadow-[2px_0_5px_rgba(0,0,0,0.1)] align-bottom pb-3">Estudante</th>
                             {Object.keys(painelData.atividades).sort().map(disc => (
                                 <th key={disc} className="px-0.5 py-2 text-center text-[10px] font-semibold text-white uppercase tracking-widest min-w-[46px] max-w-[50px] align-bottom border-b border-ms-border/30">
                                     <div className="flex flex-col items-center justify-end h-[110px] pb-2">
                                         <span 
                                             className="text-[#93c5fd] font-semibold uppercase text-[10px] tracking-wider block text-center" 
                                             style={{ 
                                                 writingMode: 'vertical-rl', 
                                                 transform: 'rotate(180deg)',
                                                 whiteSpace: 'normal',
                                                 lineHeight: '1.2'
                                             }}
                                         >
                                             {disc}
                                         </span>
                                     </div>
                                     <div className="text-[8px] text-gray-400 mt-1 pt-1.5 border-t border-ms-border/20 whitespace-nowrap font-medium">
                                         {painelData.atividades[disc]} ativ.
                                     </div>
                                 </th>
                             ))}
                         </tr>
                         </thead>
                         <tbody className="divide-y divide-ms-border/30">
                         {students.map((aluno, idx) => {
                             return (
                             <tr key={aluno.id} className={idx % 2 !== 0 ? 'bg-ms-dark/10 hover:bg-ms-dark/30' : 'bg-transparent hover:bg-ms-dark/20'}>
                                 <td className={`px-4 py-2 whitespace-nowrap sticky left-0 z-10 border-r border-ms-border/30 transition-colors ${idx % 2 !== 0 ? 'bg-ms-dark' : 'bg-ms-card'}`}>
                                   <div className="flex items-center gap-3">
                                       <span className="text-[10px] font-black text-ms-gold">{aluno.aluno_numero || '-'}</span>
                                       <span className="text-xs font-bold text-ms-main truncate max-w-[200px]" title={aluno.nome}>{aluno.nome}</span>
                                   </div>
                                 </td>
                                 {Object.keys(painelData.atividades).sort().map(disc => {
                                     const totalAtiv = painelData.atividades[disc] || 0;
                                     const acumulado = painelData.vistos[aluno.id]?.[disc] || 0;
                                     
                                     // Config de vistos do professor dessa disciplina
                                     const alloc = allocations.find((a: any) => a.disciplinas?.nome === disc);
                                     const maxVistos = alloc?.professores?.config_visto_valor_total || 2.0;
                                     const notaVistos = totalAtiv > 0 ? (acumulado / totalAtiv) * maxVistos : 0;

                                     const notasInfo = painelData.notas?.[aluno.id]?.[disc] || { total: 0, detalhes: [] };
                                     const mediaFinal = notasInfo.total + notaVistos;
                                     const hasAnyData = totalAtiv > 0 || notasInfo.detalhes.length > 0;

                                     return (
                                     <td key={disc} className="px-1 py-2 text-center group/cell border-r border-ms-border/10">
                                         <div className="flex flex-col items-center justify-center">
                                            {isEditingGrades ? (
                                              hasAnyData ? (
                                                <button
                                                  onClick={() => setSelectedGradeCell({
                                                    studentId: aluno.id,
                                                    studentName: aluno.nome,
                                                    disciplinaNome: disc
                                                  })}
                                                  className="flex items-center justify-center px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-500 bg-amber-500/5 hover:bg-amber-500/25 hover:border-amber-500 transition-all hover:scale-105 active:scale-95 shadow-sm animate-pulse"
                                                  title="Clique para editar notas"
                                                >
                                                  <span className="text-xs leading-none font-black">{mediaFinal.toFixed(1)}</span>
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => setSelectedGradeCell({
                                                    studentId: aluno.id,
                                                    studentName: aluno.nome,
                                                    disciplinaNome: disc
                                                  })}
                                                  className="w-7 h-6 flex items-center justify-center rounded border border-dashed border-gray-600/40 text-gray-500 hover:text-amber-500 hover:bg-amber-500/5 hover:border-amber-500/50 transition-all hover:scale-105 active:scale-95"
                                                  title="Clique para adicionar avaliação e notas"
                                                >
                                                  <span className="text-xs leading-none font-black">+</span>
                                                </button>
                                              )
                                            ) : hasAnyData ? (
                                              <div className="relative group/tooltip">
                                                <button className={`flex items-center justify-center px-1.5 py-0.5 rounded border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                                  mediaFinal >= 6.0 
                                                    ? 'border-blue-500/30 text-blue-600 bg-blue-500/5 hover:bg-blue-500/10' 
                                                    : 'border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10'
                                                }`}>
                                                  <span className="text-xs leading-none font-black">{mediaFinal.toFixed(1)}</span>
                                                </button>

                                                <div className={`absolute left-1/2 -translate-x-1/2 w-56 rounded-2xl shadow-2xl z-[100] border p-4 backdrop-blur-md opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 bg-white/95 dark:bg-[#0a1a3a]/95 border-blue-100 dark:border-blue-900 shadow-blue-900/20 ${
                                                  idx < 2 ? 'top-full mt-3' : 'bottom-full mb-3'
                                                }`}>
                                                  <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white dark:bg-[#0a1a3a] border-blue-100 dark:border-blue-900 ${
                                                    idx < 2 ? '-top-2 border-t border-l' : '-bottom-2 border-b border-r'
                                                  }`} />
                                                  <div className="relative z-10 text-left">
                                                    <p className="text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-3 text-center text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-900">
                                                      Composição da Média
                                                    </p>
                                                    <div className="space-y-3">
                                                      {notasInfo.detalhes.map((av: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-xs">
                                                          <span className="font-semibold text-gray-700 dark:text-gray-300 truncate pr-2 max-w-[120px]">{av.nome}</span>
                                                          <span className="font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{av.nota.toFixed(1)} <span className="text-[9px] font-bold text-gray-400">/ {av.valorMaximo}</span></span>
                                                        </div>
                                                      ))}
                                                      <div className="flex justify-between items-center text-xs">
                                                        <span className="font-semibold text-gray-700 dark:text-gray-300">Vistos na Rotina</span>
                                                        <span className="font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">{notaVistos.toFixed(1)} <span className="text-[9px] font-bold text-gray-400">/ {maxVistos}</span></span>
                                                      </div>
                                                    </div>
                                                    <div className="mt-4 pt-3 border-t border-blue-100 dark:border-blue-900 flex justify-between items-center">
                                                      <span className="text-[11px] font-black uppercase text-blue-900 dark:text-white">Média Final</span>
                                                      <span className={`text-base font-black ${mediaFinal >= 6.0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {mediaFinal.toFixed(1)}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <span className="text-gray-400 dark:text-gray-500 text-xs font-bold">-</span>
                                            )}
                                         </div>
                                     </td>
                                     );
                                 })}
                             </tr>
                             );
                         })}
                         </tbody>
                     </table>
                 </div>
              )}
           </div>
         </div>
        ) : activeTab === 'alunos' ? (
          <StudentManager theme={theme} />
       ) : activeTab === 'site' ? (
         <SiteManager theme={theme} />
       ) : activeTab === 'atas' ? (
         <GestaoAtasPanel />
       ) : activeTab === 'agenda_avaliacoes' ? (
         /* ===== ABA AGENDA DE AVALIAÇÕES ===== */
         <div className="space-y-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                 <Calendar className="w-6 h-6 text-ms-blue" />
                 Agenda de Avaliações
               </h2>
               <p className="text-sm text-[#003366] font-bold">Cronograma de provas, trabalhos e seminários agendados e publicados no calendário escolar</p>
             </div>
             <div className="flex flex-col md:flex-row items-center gap-3">
               <button
                 onClick={handlePrintAgenda}
                 className="flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl h-11"
               >
                 <Printer className="w-4 h-4" /> Imprimir Agenda
               </button>
               <div className="relative w-full md:w-56 group">
                 <select
                   value={selectedBimestre}
                   onChange={(e) => setSelectedBimestre(Number(e.target.value))}
                   className="w-full pl-4 pr-10 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
                 >
                   {[0,1,2,3,4].map(b => (
                     <option key={b} value={b}>{b===0 ? 'Todos os Bimestres' : `${b}º Bimestre`}</option>
                   ))}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
               </div>
               <div className="relative w-full md:w-64 group">
                 <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ms-blue group-hover:scale-110 transition-transform" />
                 <select
                   value={selectedTurma}
                   onChange={(e) => setSelectedTurma(e.target.value)}
                   className="w-full pl-10 pr-4 py-3 bg-ms-card border border-ms-border rounded-2xl text-white font-bold outline-none focus:ring-4 focus:ring-ms-blue/10 appearance-none cursor-pointer transition-all shadow-xl"
                 >
                   {turmas.map(t => (
                     <option key={t.id} value={t.id}>{t.nome}</option>
                   ))}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
               </div>
             </div>
           </div>

           <div className="bg-ms-card rounded-2xl shadow-xl border border-ms-border overflow-hidden">
             {loadingAgenda ? (
               <div className="py-20 flex flex-col items-center justify-center">
                 <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
                 <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando agenda de avaliações...</p>
               </div>
             ) : avaliacoesAgenda.length === 0 ? (
               <div className="py-20 text-center text-gray-500 italic">Nenhuma avaliação encontrada para esta turma no período selecionado.</div>
             ) : (
               <div className="overflow-x-auto">
                 <table ref={agendaTableRef} className="min-w-full divide-y divide-ms-border/30">
                   <thead className="bg-[#0a1a3a]">
                     <tr>
                       <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Avaliação</th>
                       <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Disciplina</th>
                       <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Professor</th>
                       {selectedBimestre === 0 && (
                         <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">Bimestre</th>
                       )}
                       <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest min-w-[150px]">Data</th>
                       <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest no-print">Publicação</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-ms-border/30">
                     {avaliacoesAgenda.map((av, idx) => (
                       <tr key={av.id} className={idx % 2 !== 0 ? 'bg-ms-dark/10' : ''}>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="font-bold text-white text-sm">{av.nome}</div>
                           <div className="text-[10px] font-black text-ms-gold uppercase">Valendo {av.valor_maximo} pts</div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-300">
                           {av.disciplinaNome}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-300">
                           {av.professorNome}
                         </td>
                         {selectedBimestre === 0 && (
                           <td className="px-6 py-4 text-center whitespace-nowrap text-xs font-black text-blue-400">
                             {av.bimestre_id}º BIM
                           </td>
                         )}
                         <td className="px-6 py-4 text-center whitespace-nowrap">
                           <input
                             type="date"
                             value={av.data_avaliacao || ''}
                             onChange={(e) => handleUpdateAgendaField(av.id, 'data_avaliacao', e.target.value || null)}
                             className={`p-2 rounded-xl text-xs font-bold outline-none border transition-all text-center ${
                               theme === 'light' 
                                 ? 'bg-blue-55/40 border-blue-200 text-blue-900 focus:border-blue-500' 
                                 : 'bg-ms-dark/5 border-ms-border text-ms-main focus:border-blue-500'
                             }`}
                           />
                         </td>
                         <td className="px-6 py-4 text-center whitespace-nowrap no-print">
                           <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                             <input
                               type="checkbox"
                               checked={av.publicada || false}
                               onChange={(e) => handleUpdateAgendaField(av.id, 'publicada', e.target.checked)}
                               className="rounded border-gray-350 text-blue-600 focus:ring-blue-550 h-4 w-4"
                             />
                             <span className={`text-[10px] font-black uppercase ${
                               av.publicada ? 'text-emerald-500' : 'text-gray-400'
                             }`}>
                               {av.publicada ? 'Publicada' : 'Pendente'}
                             </span>
                           </label>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
         </div>
       ) : activeTab === 'novas_ocorrencias' ? (
         /* ===== ABA NOVAS OCORRÊNCIAS ===== */
         <div className="space-y-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                 <AlertTriangle className="w-6 h-6 text-red-500" />
                 Novas Ocorrências
               </h2>
               <p className="text-sm text-[#003366] font-bold">Ocorrências registradas pelos professores aguardando confirmação de leitura</p>
             </div>
             <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const nextState = !showReincidentes;
                    setShowReincidentes(nextState);
                    if (nextState) {
                      fetchAlunosReincidentes();
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border shadow-lg ${
                    showReincidentes
                      ? 'bg-amber-600 text-white border-amber-600 shadow-amber-900/30'
                      : 'bg-ms-card text-gray-400 border-ms-border hover:text-white hover:border-amber-500/50'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" />
                  Alunos Reincidentes
                  {alunosReincidentes.length > 0 && (
                    <span className="ml-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {alunosReincidentes.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory);
                    if (!showHistory && ocorrenciasRevisadas.length === 0) {
                      fetchOcorrenciasRevisadas();
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border shadow-lg ${
                    showHistory
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                      : 'bg-ms-card text-gray-400 border-ms-border hover:text-white hover:border-gray-500'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  {showHistory ? 'Ocultar Histórico' : 'Ver Histórico Revisado'}
                </button>
              </div>
           </div>

            {/* Alunos Reincidentes Panel */}
            {showReincidentes && (
              <div className="space-y-4 bg-ms-dark/10 p-1.5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-ms-border" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5" /> Alunos com 3 ou mais ocorrências
                  </span>
                  <div className="h-px flex-1 bg-ms-border" />
                </div>
                {loadingReincidentes ? (
                  <div className="py-8 flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando...</span>
                  </div>
                ) : alunosReincidentes.length === 0 ? (
                  <div className="bg-ms-card rounded-2xl border border-ms-border p-8 text-center">
                    <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm font-semibold">Nenhum aluno com 3 ou mais ocorrências.</p>
                  </div>
                ) : (
                  <div className="bg-ms-card rounded-2xl border border-amber-500/30 shadow-xl overflow-hidden animate-in slide-in-from-top duration-200">
                    <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                        {alunosReincidentes.length} aluno{alunosReincidentes.length > 1 ? 's' : ''} com múltiplas ocorrências
                      </span>
                    </div>
                    <div className="divide-y divide-ms-border/30">
                      {alunosReincidentes.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-amber-500/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-gray-500 w-5 text-right">{idx + 1}.</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-black text-amber-400 border border-amber-500/20 shrink-0">
                              {(item.aluno?.nome || '?').charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">{item.aluno?.nome}</p>
                              <p className="text-[10px] font-black text-ms-blue uppercase">
                                {item.aluno?.aluno_numero ? `Nº ${item.aluno.aluno_numero} · ` : ''}{item.aluno?.turmas?.nome || '—'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                            item.count >= 5
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : item.count >= 4
                              ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {item.count} ocorrência{item.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reviewed History */}
            {showHistory && (
              <div className="space-y-4 bg-ms-dark/10 p-1.5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-ms-border" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Histórico Revisado</span>
                  <div className="h-px flex-1 bg-ms-border" />
                </div>

                {loadingHistory ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando histórico...</p>
                  </div>
                ) : ocorrenciasRevisadas.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 italic text-sm">Nenhuma ocorrência revisada encontrada.</div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top duration-200">
                    {ocorrenciasRevisadas.map((oc) => (
                      <div key={oc.id} className="bg-ms-card/60 rounded-2xl border border-emerald-500/20 shadow-md overflow-hidden opacity-85 hover:opacity-100 transition-all">
                        <div className="flex items-stretch">
                          <div className="w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-700 shrink-0" />
                          <div className="flex-1 p-4">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-white font-bold text-sm">
                                    {oc.aluno?.nome || 'Aluno Desconhecido'}
                                  </span>
                                  <span className="text-[9px] font-black uppercase bg-ms-blue/15 text-ms-blue px-2 py-0.5 rounded-full">
                                    {oc.turma?.nome || 'Sem Turma'}
                                  </span>
                                  {oc.tipo && (
                                    <span className="text-[9px] font-bold uppercase text-gray-500">
                                      {oc.tipo}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                  {oc.descricao || oc.observacao || 'Sem descrição'}
                                </p>
                                <div className="flex items-center gap-4 text-[10px] text-gray-600 font-bold">
                                  <span>Prof. {oc.professor?.nome || 'Desconhecido'}</span>
                                  <span>Data do Ocorrido: {(() => {
                                     const dateStr = oc.data || oc.data_registro;
                                     if (!dateStr) return '—';
                                     if (dateStr.includes('-') && !dateStr.includes('T')) {
                                       const [y, m, d] = dateStr.split('-');
                                       return `${d}/${m}/${y}`;
                                     }
                                     return new Date(dateStr).toLocaleDateString('pt-BR');
                                   })()}</span>
                                </div>
                                {oc.devolutiva_coordenador && (
                                  <div className="mt-2 flex items-start gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2">
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-0.5">Devolutiva da Coordenação</p>
                                      <p className="text-xs text-emerald-300 leading-relaxed">{oc.devolutiva_coordenador}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase rounded-full border border-emerald-500/20">
                                <CheckCheck className="w-3 h-3" />
                                Revisada em {oc.data_visualizacao_coordenador ? new Date(oc.data_visualizacao_coordenador).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

           {/* Pending Occurrences */}
           {loadingOcorrencias ? (
             <div className="py-20 flex flex-col items-center justify-center">
               <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
               <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando ocorrências pendentes...</p>
             </div>
           ) : ocorrenciasPendentes.length === 0 ? (
             <div className="bg-ms-card rounded-2xl border border-ms-border p-12 text-center shadow-xl">
               <CheckCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
               <p className="text-white font-bold text-lg">Nenhuma ocorrência pendente!</p>
               <p className="text-gray-500 text-sm mt-1">Todas as ocorrências foram revisadas pela coordenação.</p>
             </div>
           ) : (
             <div className="space-y-4">
               <p className="text-xs font-black text-red-400 uppercase tracking-widest">
                 {ocorrenciasPendentes.length} ocorrência{ocorrenciasPendentes.length > 1 ? 's' : ''} aguardando leitura
               </p>
               {ocorrenciasPendentes.map((oc) => (
                 <div key={oc.id} className="bg-ms-card rounded-2xl border border-red-500/30 shadow-xl overflow-hidden hover:border-red-500/60 transition-all group">
                   <div className="flex items-stretch">
                     {/* Red accent bar */}
                     <div className="w-1.5 bg-gradient-to-b from-red-500 to-red-700 shrink-0" />
                     <div className="flex-1 p-5">
                       <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                         <div className="flex-1 space-y-2">
                           <div className="flex items-center gap-3 flex-wrap">
                             <span className="text-white font-black text-sm">
                               {oc.aluno?.nome || 'Aluno Desconhecido'}
                             </span>
                             <span className="text-[9px] font-black uppercase bg-ms-blue/20 text-ms-blue px-2 py-0.5 rounded-full border border-ms-blue/30">
                               {oc.turma?.nome || 'Sem Turma'}
                             </span>
                             {oc.tipo && (
                               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                 oc.tipo === 'Disciplinar' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                 oc.tipo === 'Pedagógica' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                               }`}>
                                 {oc.tipo}
                               </span>
                             )}
                           </div>
                           <p className="text-gray-300 text-sm leading-relaxed">
                             {oc.descricao || oc.observacao || 'Sem descrição'}
                           </p>
                           <div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold">
                             <span className="flex items-center gap-1">
                               <Users className="w-3 h-3" />
                               Prof. {oc.professor?.nome || 'Desconhecido'}
                             </span>
                             <span className="flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {(() => {
                                  const dateStr = oc.data || oc.data_registro;
                                  if (!dateStr) return 'Data desconhecida';
                                  if (dateStr.includes('-') && !dateStr.includes('T')) {
                                    const [y, m, d] = dateStr.split('-');
                                    return `${d}/${m}/${y}`;
                                  }
                                  return new Date(dateStr).toLocaleDateString('pt-BR');
                                })()}
                             </span>
                           </div>
                         </div>
                         <button
                           onClick={() => setDevolutivaModalOc(oc)}
                           className="shrink-0 flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/30 transition-all hover:scale-105"
                         >
                           <MessageSquare className="w-4 h-4" />
                           Confirmar & Devolutiva
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
              </div>
            )}
          </div>
        ) : activeTab === 'comunicados' ? (
          <GestaoMensagensPanel currentCoordinator={professor} theme={theme} />
        ) : null}

      {/* Devolutiva Modal */}
      {devolutivaModalOc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ms-card rounded-3xl border border-ms-border w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="bg-gradient-to-r from-ms-blue to-blue-800 px-6 py-5 flex items-center justify-between border-b border-ms-border shrink-0">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-white" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Confirmar Leitura & Devolutiva</h3>
              </div>
              <button
                onClick={() => { setDevolutivaModalOc(null); setDevolutivaText(''); }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Occurrence summary */}
              <div className="bg-ms-dark/30 rounded-2xl border border-ms-border/50 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-black text-sm">{devolutivaModalOc.aluno?.nome || 'Aluno'}</span>
                  <span className="text-[9px] font-black uppercase bg-ms-blue/20 text-ms-blue px-2 py-0.5 rounded-full border border-ms-blue/30">
                    {devolutivaModalOc.turma?.nome || '—'}
                  </span>
                  {devolutivaModalOc.tipo && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      devolutivaModalOc.tipo === 'Disciplinar' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                      devolutivaModalOc.tipo === 'Pedagógica' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}>{devolutivaModalOc.tipo}</span>
                  )}
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  {devolutivaModalOc.descricao || devolutivaModalOc.observacao || 'Sem descrição'}
                </p>
                <p className="text-[10px] text-gray-600 font-bold">
                  Prof. {devolutivaModalOc.professor?.nome || '—'}
                </p>
              </div>

              {/* Devolutiva field */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-ms-blue" />
                  Devolutiva para o Professor (opcional)
                </label>

                {/* Quick-pick suggestions */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'O aluno foi convocado',
                    'Responsáveis foram contactados',
                    'Encaminhado para a direção',
                    'Advertência registrada',
                    'Situação resolvida'
                  ].map(sugestao => (
                    <button
                      key={sugestao}
                      onClick={() => setDevolutivaText(sugestao)}
                      className={`text-[10px] px-3 py-1.5 rounded-full border font-bold transition-all ${
                        devolutivaText === sugestao
                          ? 'bg-ms-blue text-white border-ms-blue shadow-md shadow-blue-900/30'
                          : 'bg-ms-dark/40 text-gray-400 border-ms-border hover:border-ms-blue/40 hover:text-gray-200'
                      }`}
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>

                <textarea
                  value={devolutivaText}
                  onChange={(e) => setDevolutivaText(e.target.value)}
                  placeholder="Digite uma mensagem de retorno ao professor... (ex: O aluno foi convocado e os responsáveis foram notificados)"
                  rows={3}
                  className="w-full px-4 py-3 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue transition-all resize-none placeholder-gray-600"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-900/50 border-t border-ms-border flex gap-3 shrink-0">
              <button
                onClick={() => { setDevolutivaModalOc(null); setDevolutivaText(''); }}
                disabled={submittingDevolutiva}
                className="flex-1 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDevolutiva}
                disabled={submittingDevolutiva}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingDevolutiva ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirmar Leitura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedStudent && (
        <StudentProfileModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          studentId={selectedStudent.id}
          studentName={selectedStudent.nome}
          theme={theme}
          bimestre={selectedBimestre}
          isCoordinator={true}
          professor={professor}
        />
      )}

      {/* Teacher Student Diary Modal */}
      {selectedTeacherDiary && (
        <TeacherDiaryModal
          isOpen={!!selectedTeacherDiary}
          onClose={() => setSelectedTeacherDiary(null)}
          professorId={selectedTeacherDiary.professorId}
          professorNome={selectedTeacherDiary.professorNome}
          disciplinaId={selectedTeacherDiary.disciplinaId}
          disciplinaNome={selectedTeacherDiary.disciplinaNome}
          turmaId={selectedTurma}
          turmaNome={turmas.find(t => t.id === selectedTurma)?.nome || ''}
          theme={theme}
          initialBimestre={selectedBimestre}
          configVistoValorTotal={selectedTeacherDiary.configVistoValorTotal}
        />
      )}

      {/* MODAL CALENDÁRIO LETIVO 2026 */}
      <CalendarioLetivoModal 
        isOpen={showCalendarModal} 
        onClose={() => setShowCalendarModal(false)} 
      />

      {/* EDITOR DO CALENDÁRIO */}
      <CalendarioEditor
        isOpen={showCalendarEditor}
        onClose={() => setShowCalendarEditor(false)}
        professorNome={professor.nome}
      />

      {/* Confirmation Modal for Atestado, Transferido, Remanejado */}
      {statusModalOpen && statusModalStudent && statusModalNewStatus && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ms-card rounded-3xl border border-ms-border w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[calc(100vh-2rem)]">
            <div className="bg-ms-blue px-6 py-5 flex items-center gap-3 border-b border-ms-border shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Confirmar Alteração de Status</h3>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Estudante</p>
                <p className="text-white font-bold text-base">{statusModalStudent.nome}</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Novo Status</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                    statusModalNewStatus === 'Atestado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                    statusModalNewStatus === 'Transferido' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                    statusModalNewStatus === 'Suspenso' || statusModalNewStatus === 'Aluno Suspenso' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    statusModalNewStatus === 'Licença Maternidade' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                    'bg-purple-500/10 text-purple-500 border-purple-500/20'
                  }`}>
                    {statusModalNewStatus}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-ms-dark/20 rounded-2xl border border-ms-border/50 space-y-4">
                {(statusModalNewStatus === 'Atestado' || statusModalNewStatus === 'Suspenso' || statusModalNewStatus === 'Aluno Suspenso' || statusModalNewStatus === 'Licença Maternidade') && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-ms-blue" /> Data de Início
                      </label>
                      <input
                        type="date"
                        value={statusModalDateInicio}
                        onChange={(e) => setStatusModalDateInicio(e.target.value)}
                        className="w-full px-4 py-2.5 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-ms-blue" /> Data de Fim (Opcional)
                      </label>
                      <input
                        type="date"
                        value={statusModalDateFim}
                        onChange={(e) => setStatusModalDateFim(e.target.value)}
                        className="w-full px-4 py-2.5 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                      />
                    </div>
                  </div>
                )}

                {statusModalNewStatus === 'Transferido' && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5 text-ms-blue" /> Data da Transferência
                    </label>
                    <input
                      type="date"
                      value={statusModalDateInicio}
                      onChange={(e) => setStatusModalDateInicio(e.target.value)}
                      className="w-full px-4 py-2.5 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                  </div>
                )}

                {statusModalNewStatus === 'Remanejado' && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-ms-blue" /> Data do Remanejamento
                      </label>
                      <input
                        type="date"
                        value={statusModalDateInicio}
                        onChange={(e) => setStatusModalDateInicio(e.target.value)}
                        className="w-full px-4 py-2.5 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Nova Turma (Destino)
                      </label>
                      <select
                        value={statusModalTargetTurma}
                        onChange={(e) => setStatusModalTargetTurma(e.target.value)}
                        className="w-full px-4 py-2.5 bg-ms-dark border border-ms-border rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue appearance-none cursor-pointer"
                      >
                        <option value="">Selecionar Turma...</option>
                        {turmas.filter(t => t.id !== selectedTurma).map(t => (
                          <option key={t.id} value={t.id} className="bg-ms-card text-white font-bold">{t.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-900/50 border-t border-ms-border flex gap-3 shrink-0">
              <button 
                onClick={() => {
                  setStatusModalOpen(false);
                  setStatusModalStudent(null);
                  setStatusModalNewStatus('');
                }}
                disabled={statusModalSubmitting}
                className="flex-1 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmStatusChange}
                disabled={statusModalSubmitting}
                className="flex-1 py-3 bg-ms-blue text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-900/40 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {statusModalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedGradeCell && (
        <GradeCellEditModal
          isOpen={!!selectedGradeCell}
          onClose={() => setSelectedGradeCell(null)}
          studentId={selectedGradeCell.studentId}
          studentName={selectedGradeCell.studentName}
          disciplinaNome={selectedGradeCell.disciplinaNome}
          turmaId={selectedTurma}
          initialBimestreId={selectedBimestre}
          theme={theme}
          professorId={professor.id}
          onSaveSuccess={() => {
            fetchPainelTurma();
          }}
        />
      )}
      {showLockModal && (
        <BimestreLockModal
          isOpen={showLockModal}
          onClose={() => setShowLockModal(false)}
          theme={theme}
        />
      )}
    </div>
  );
}
