import { useState, useEffect, useRef } from 'react';
import type { Professor, AtestadoServidor } from '../types';
import { supabase } from '../lib/supabase';
import { StudentList } from './StudentList';
import { Filter, Users, Calendar, ChevronDown, BookOpen, LayoutDashboard, FileSpreadsheet, ClipboardList, CheckCircle, PlusCircle, Layers, ShieldAlert, Trash2, Save, Mail, Stethoscope, ArrowRightLeft, Eye, Cake } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { GradesPanel } from './GradesPanel';
import { ExameFinalPanel } from './ExameFinalPanel';
import { ReportsPanel } from './ReportsPanel';
import { ProfessorMensagensPanel } from './ProfessorMensagensPanel';
import { AniversariantesPanel } from './AniversariantesPanel';
import { CalendarioLetivoModal } from './CalendarioLetivoModal';
import { getCurrentBimestre } from '../utils/academicUtils';


const TEMPO_RANGES = [
  { tempo: 1, start: '07:30', end: '08:20' },
  { tempo: 2, start: '08:20', end: '09:10' },
  { tempo: 3, start: '09:25', end: '10:15' },
  { tempo: 4, start: '10:15', end: '11:05' },
  { tempo: 5, start: '11:05', end: '11:55' },
  { tempo: 6, start: '13:10', end: '14:00' },
  { tempo: 7, start: '14:00', end: '14:50' },
  { tempo: 8, start: '14:50', end: '15:40' },
];

function getCurrentTempo(): number | null {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  for (const range of TEMPO_RANGES) {
    if (currentTime < range.end) {
      return range.tempo;
    }
  }
  return null;
}

interface DashboardProps {
  professor: Professor;
  theme: 'dark' | 'light';
  onUpdateProfessor: (updated: Professor) => void;
}

export function Dashboard({ professor, theme, onUpdateProfessor }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'aulas' | 'notas' | 'relatorios' | 'comunicados' | 'aniversariantes'>(() => {
    return (localStorage.getItem('last-tab') as any) || 'aulas';
  });
  
  const [turmas, setTurmas] = useState<Array<{ id: string; nome: string }>>([]);
  const [disciplinas, setDisciplinas] = useState<Array<{ id: string; nome: string }>>([]);
  
  const [selectedTurma, setSelectedTurma] = useState(() => {
    return localStorage.getItem('last-turma') || '';
  });
  const [selectedDisciplina, setSelectedDisciplina] = useState(() => {
    return localStorage.getItem('last-disciplina') || '';
  });
  const [selectedBimestre, setSelectedBimestre] = useState<number>(professor.bimestre_atual || 1);
  const [descricaoAtividade, setDescricaoAtividade] = useState<string>(() => {
    return localStorage.getItem('last-description') || '';
  });
  
  const [dataAula, setDataAula] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedAtividadeId, setSelectedAtividadeId] = useState<string | null>(null);
  const [recentAtividades, setRecentAtividades] = useState<Array<{id: string; data: string; descricao: string}>>([]);
  const [atividadesRefreshKey, setAtividadesRefreshKey] = useState(0);
  const [isRegistrando, setIsRegistrando] = useState(false);
  const [registroSucesso, setRegistroSucesso] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const hasAutoSelected = useRef(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [lockedBimestres, setLockedBimestres] = useState<number[]>([]);
  // --- Estado de Atestado ---
  const [atestadoAtivo, setAtestadoAtivo] = useState<AtestadoServidor | null>(null); // se o titular está de atestado
  const [substituicaoAtiva, setSubstituicaoAtiva] = useState<{ atestado: AtestadoServidor; titularNome: string } | null>(null); // se é substituto

  useEffect(() => {
    async function loadLockedBimestres() {
      try {
        const { data } = await supabase
          .from('landing_avisos')
          .select('mensagem')
          .eq('titulo', 'BIMESTRES_BLOQUEADOS')
          .eq('cor_alerta', 'config')
          .maybeSingle();

        if (data && data.mensagem) {
          const parsed = JSON.parse(data.mensagem);
          if (Array.isArray(parsed)) {
            setLockedBimestres(parsed.map(Number));
          }
        }
      } catch (err) {
        console.error('Erro ao buscar bimestres bloqueados no professor dashboard:', err);
      }
    }
    loadLockedBimestres();
  }, [selectedBimestre]);

  // --- Verificar atestado / substituição ativa ---
  useEffect(() => {
    async function checkAtestadoStatus() {
      const today = new Date().toISOString().split('T')[0];

      // 1. Verificar se o professor ATUAL está de atestado (titular)
      const { data: atestados } = await supabase
        .from('atestados_servidores')
        .select('*')
        .eq('professor_id', professor.id)
        .eq('ativo', true)
        .lte('data_inicio', today)
        .gte('data_fim', today)
        .maybeSingle();

      if (atestados) {
        setAtestadoAtivo(atestados);
      } else {
        setAtestadoAtivo(null);
      }

      // 2. Verificar se o professor ATUAL é substituto de alguém
      const { data: espelhos } = await supabase
        .from('alocacoes_v2')
        .select('atestado_id, professor_original_id')
        .eq('professor_id', professor.id)
        .eq('is_espelho', true)
        .limit(1)
        .maybeSingle();

      if (espelhos?.atestado_id) {
        // Buscar o atestado para pegar as datas
        const { data: atestadoEspelho } = await supabase
          .from('atestados_servidores')
          .select('*')
          .eq('id', espelhos.atestado_id)
          .eq('ativo', true)
          .lte('data_inicio', today)
          .gte('data_fim', today)
          .maybeSingle();

        if (atestadoEspelho && espelhos.professor_original_id) {
          const { data: titular } = await supabase
            .from('professores')
            .select('nome')
            .eq('id', espelhos.professor_original_id)
            .maybeSingle();

          setSubstituicaoAtiva({
            atestado: atestadoEspelho,
            titularNome: titular?.nome || 'Professor Titular'
          });
        } else {
          setSubstituicaoAtiva(null);
        }
      } else {
        setSubstituicaoAtiva(null);
      }
    }
    checkAtestadoStatus();
  }, [professor.id]);

  const isBimestreLocked = lockedBimestres.includes(selectedBimestre);
  // Titular de atestado: somente leitura em tudo
  const isTitularEmAtestado = !!atestadoAtivo;
  // Read-only efetivo: bimestre bloqueado OU titular em atestado
  const isEffectivelyLocked = isBimestreLocked || isTitularEmAtestado;

  // Auto-Retorno de Alunos nos Intervalos (09:10, 11:55, 15:40)
  useEffect(() => {
    const checkAutoReturns = async () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      const breakTimes = ['09:10', '11:55', '15:40'];
      
      for (const bTime of breakTimes) {
        if (currentTime >= bTime) {
          try {
            // Atualiza saídas que ocorreram ANTES do intervalo para "Retornou"
            // usando a data de hoje para não pegar saídas de ontem
            const todayStr = new Date().toISOString().split('T')[0];
            
            await supabase.from('saidas_sala')
              .update({
                status: 'Retornou',
                hora_retorno: `${todayStr}T${bTime}:00.000Z`
              })
              .eq('status', 'Fora')
              .lt('hora_saida', `${todayStr}T${bTime}:00.000Z`)
              .gte('hora_saida', `${todayStr}T00:00:00.000Z`);
          } catch (e) {
            console.error("Erro no auto-retorno:", e);
          }
        }
      }
    };

    // Check immediately and then every minute
    checkAutoReturns();
    const intervalId = setInterval(checkAutoReturns, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Persistência de filtros
  useEffect(() => {
    localStorage.setItem('last-tab', activeTab);
    localStorage.setItem('last-turma', selectedTurma);
    localStorage.setItem('last-disciplina', selectedDisciplina);
    localStorage.setItem('last-date', dataAula);
    localStorage.setItem('last-description', descricaoAtividade);
  }, [activeTab, selectedTurma, selectedDisciplina, dataAula, descricaoAtividade]);

  useEffect(() => {
    if (professor.bimestre_atual) {
      setSelectedBimestre(professor.bimestre_atual);
    }
  }, [professor.bimestre_atual]);

  const [unreadCount, setUnreadCount] = useState(0);

  async function fetchUnreadCount() {
    try {
      const { count, error } = await supabase
        .from('mensagens_coordenacao')
        .select('*', { count: 'exact', head: true })
        .eq('destinatario_id', professor.id)
        .eq('lida', false);
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (e) {
      console.error('Erro ao buscar comunicados pendentes:', e);
    }
  }

  useEffect(() => {
    fetchUnreadCount();
  }, [professor.id, activeTab]);
  useEffect(() => {
    setSelectedAtividadeId(null);
    setDescricaoAtividade('');
  }, [selectedTurma, selectedDisciplina, selectedBimestre]);
  // Busca todas as atividades do bimestre para os atalhos rápidos (em ordem crescente)
  useEffect(() => {
    if (!selectedTurma || !selectedDisciplina) { setRecentAtividades([]); return; }
    supabase
      .from('atividades_diárias')
      .select('id, data, descricao')
      .eq('id_do_professor', professor.id)
      .eq('turma_id', selectedTurma)
      .eq('disciplina_id', selectedDisciplina)
      .eq('bimestre_id', selectedBimestre)
      .order('data', { ascending: true })
      .then(({ data }) => { if (data) setRecentAtividades(data); });
  }, [professor.id, selectedTurma, selectedDisciplina, selectedBimestre, atividadesRefreshKey]);

  // Sincronização inteligente do modo lote ao mudar de turma, disciplina, bimestre ou quando novas atividades são criadas
  const prevContextRef = useRef({ turma: '', disciplina: '', bimestre: 0, length: 0 });
  useEffect(() => {
    if (!isBulkMode) return;
    
    const contextChanged = 
      prevContextRef.current.turma !== selectedTurma ||
      prevContextRef.current.disciplina !== selectedDisciplina ||
      prevContextRef.current.bimestre !== selectedBimestre;

    const activityAdded = 
      !contextChanged && 
      recentAtividades.length > prevContextRef.current.length;

    if (contextChanged) {
      // Se mudou o contexto de turma/disciplina/bimestre, seleciona todas as novas atividades
      setBulkSelectedIds(recentAtividades.map(a => a.id));
    } else if (activityAdded) {
      // Se uma nova atividade foi cadastrada, garante que ela é adicionada à seleção existente
      const newIds = recentAtividades.map(a => a.id);
      setBulkSelectedIds(prev => {
        const unique = new Set([...prev, ...newIds]);
        return Array.from(unique);
      });
    }

    prevContextRef.current = {
      turma: selectedTurma,
      disciplina: selectedDisciplina,
      bimestre: selectedBimestre,
      length: recentAtividades.length
    };
  }, [recentAtividades, isBulkMode, selectedTurma, selectedDisciplina, selectedBimestre]);

  useEffect(() => {
    async function loadTurmas() {
      const combinedMap = new Map();

      try {
        const firstName = professor.nome.split(' ')[0];

        // 1. Coleta IDs por múltiplos critérios
        const { data: profsByEmail } = await supabase.from('professores').select('id').eq('email', professor.email);
        const { data: profsByName } = await supabase.from('professores').select('id').ilike('nome', `%${firstName}%`);

        const allIds = Array.from(new Set([
          professor.id,
          ...(profsByEmail?.map(p => p.id) || []),
          ...(profsByName?.map(p => p.id) || [])
        ])).filter(Boolean);

        // 2. BUSCA BRUTA (Se falhar a específica, tenta geral)
        let { data: allocs } = await supabase
          .from('alocacoes_v2')
          .select(`turma_id, turmas (nome, nivel)`)
          .in('professor_id', allIds);

        // FALLBACK RADICAL: Se não veio nada, busca TUDO de alocacoes e filtra no código
        if (!allocs || allocs.length === 0) {
           const { data: allData } = await supabase
             .from('alocacoes_v2')
             .select(`turma_id, professor_id, professores(nome), turmas (nome, nivel)`);
           
           allocs = allData?.filter(a => 
             (a as any).professores?.nome?.toLowerCase().includes(firstName.toLowerCase())
           ) || [];
        }

        if (allocs) {
          allocs.forEach((a: any) => {
            if (a.turma_id && a.turmas) {
              combinedMap.set(a.turma_id, { 
                id: a.turma_id, 
                nome: `${a.turmas.nome} - ${a.turmas.nivel || ''}`.trim() 
              });
            }
          });
        }

        // 3. Busca no Legado (também com fallback por nome)
        const { data: legacy } = await supabase
          .from('lista_para_vistos')
          .select('turma_id, turma_nome, professor_nome')
          .or(`professor_email.eq.${professor.email},professor_nome.ilike.%${firstName}%`);

        if (legacy) {
          legacy.forEach(a => {
            if (!combinedMap.has(a.turma_id)) {
              combinedMap.set(a.turma_id, { id: a.turma_id, nome: a.turma_nome });
            }
          });
        }
      } catch (e) {
        console.error("Erro Crítico de Sincronização:", e);
      }

      const finalTurmas = Array.from(combinedMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      setTurmas(finalTurmas);
    }
    loadTurmas();
  }, [professor.id, professor.email, professor.nome]);

  useEffect(() => {
    if (!selectedTurma) {
      setDisciplinas([]);
      setSelectedDisciplina('');
      return;
    }

    async function loadDisciplinas() {
      const combinedMap = new Map();

      try {
        const firstName = professor.nome.split(' ')[0];
        const { data: profsByEmail } = await supabase.from('professores').select('id').eq('email', professor.email);
        const { data: profsByName } = await supabase.from('professores').select('id').ilike('nome', `%${firstName}%`);
        const allIds = Array.from(new Set([
          professor.id,
          ...(profsByEmail?.map(p => p.id) || []),
          ...(profsByName?.map(p => p.id) || [])
        ])).filter(Boolean);

        let { data: allocs } = await supabase
          .from('alocacoes_v2')
          .select(`disciplina_id, disciplinas (nome)`)
          .eq('turma_id', selectedTurma)
          .in('professor_id', allIds);

        if (!allocs || allocs.length === 0) {
          const { data: allData } = await supabase
            .from('alocacoes_v2')
            .select(`disciplina_id, professor_id, professores(nome), disciplinas (nome)`)
            .eq('turma_id', selectedTurma);
          
          allocs = allData?.filter(a => 
            (a as any).professores?.nome?.toLowerCase().includes(firstName.toLowerCase())
          ) || [];
        }

        if (allocs) {
          allocs.forEach((a: any) => {
            if (a.disciplina_id && a.disciplinas) {
              combinedMap.set(a.disciplina_id, { 
                id: a.disciplina_id, 
                nome: a.disciplinas.nome 
              });
            }
          });
        }

        // Legado
        const { data: legacy } = await supabase
          .from('lista_para_vistos')
          .select('disciplina_id, disciplina_nome')
          .eq('turma_id', selectedTurma)
          .or(`professor_email.eq.${professor.email},professor_nome.ilike.%${firstName}%`);

        if (legacy) {
          legacy.forEach(a => {
            if (!combinedMap.has(a.disciplina_id)) {
              combinedMap.set(a.disciplina_id, { id: a.disciplina_id, nome: a.disciplina_nome });
            }
          });
        }
      } catch (e) {
        console.error("Erro Disciplinas:", e);
      }

      const finalDiscs = Array.from(combinedMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      setDisciplinas(finalDiscs);
      if (finalDiscs.length === 1 && !selectedDisciplina) {
        setSelectedDisciplina(finalDiscs[0].id);
      }
    }
    loadDisciplinas();
  }, [selectedTurma, professor.id, professor.email, professor.nome]);

  // Automação da Seleção da Aula Baseado no Horário
  useEffect(() => {
    async function autoSelectAula() {
      if (hasAutoSelected.current) return;
      if (turmas.length === 0) return;

      const tempoAtual = getCurrentTempo();
      if (!tempoAtual) return; // Fora do horário de aula

      const diaSemana = new Date().getDay(); // 1 = Seg, 5 = Sex
      if (diaSemana < 1 || diaSemana > 5) return;

      try {
        const { data: horarios } = await supabase
          .from('horarios')
          .select('*')
          .eq('professor_id', professor.id)
          .eq('dia_semana', diaSemana)
          .gte('tempo', tempoAtual)
          .order('tempo', { ascending: true });

        if (horarios && horarios.length > 0) {
          const aulaAtual = horarios[0];
          
          // Verifica se a turma está na lista do professor
          const turmaExiste = turmas.find(t => t.id === aulaAtual.turma_id);
          if (turmaExiste) {
            setSelectedTurma(aulaAtual.turma_id);
            // Vamos tentar encontrar a disciplina correspondente
            // Como disciplina pode demorar para carregar (depende da turma),
            // a automação completa da disciplina talvez dependa do próximo useEffect.
            // Para garantir: se o banco retornou uma disciplina e temos acesso a ela:
            if (aulaAtual.disciplina_id) {
               setSelectedDisciplina(aulaAtual.disciplina_id);
            } else if (aulaAtual.disciplina_nome && disciplinas.length > 0) {
               const discId = disciplinas.find(d => d.nome.toLowerCase() === aulaAtual.disciplina_nome.toLowerCase())?.id;
               if (discId) setSelectedDisciplina(discId);
            }
          }
        }
      } catch (e) {
        console.error("Erro ao auto-selecionar turma:", e);
      } finally {
        hasAutoSelected.current = true; // Só tenta uma vez para não travar a escolha manual do usuário
      }
    }
    
    // Roda quando a lista de turmas terminar de carregar
    if (turmas.length > 0) {
       autoSelectAula();
    }
  }, [turmas, professor.id, disciplinas]);

  const handleBimestreChange = (b: number) => {
    setSelectedBimestre(b);
    if (b === 5 && activeTab === 'aulas') {
      setActiveTab('notas');
    }
    onUpdateProfessor({ ...professor, bimestre_atual: b });
  };

  const handleRegistrarAtividade = async () => {
    if (!descricaoAtividade.trim() || !selectedTurma || !selectedDisciplina || isEffectivelyLocked) return;
    setIsRegistrando(true);

    if (selectedAtividadeId) {
      // Atualiza a descrição da atividade existente selecionada pelo ID
      await supabase.from('atividades_diárias')
        .update({ descricao: descricaoAtividade.trim() })
        .eq('id', selectedAtividadeId);
    } else {
      // Cria nova atividade para a data selecionada (permite múltiplas atividades no mesmo dia)
      const { data } = await supabase.from('atividades_diárias').insert({
        id_do_professor: professor.id,
        professor_id: professor.id,
        turma_id: selectedTurma,
        disciplina_id: selectedDisciplina,
        bimestre_id: selectedBimestre,
        data: dataAula,
        descricao: descricaoAtividade.trim()
      }).select('id').single();

      if (data) {
        setSelectedAtividadeId(data.id);
      }
    }

    setIsRegistrando(false);
    setRegistroSucesso(true);
    setAtividadesRefreshKey(k => k + 1);
    setTimeout(() => setRegistroSucesso(false), 2500);
  };

  const handleExcluirAtividade = async () => {
    if (!selectedAtividadeId || !selectedTurma || !selectedDisciplina || isEffectivelyLocked) return;
    
    const confirmDelete = window.confirm("Tem certeza que deseja excluir esta atividade? Isso apagará permanentemente todos os vistos associados a ela.");
    if (!confirmDelete) return;

    setIsRegistrando(true);
    try {
      // 1. Excluir vistos da atividade
      await supabase.from('vistos_v2')
        .delete()
        .eq('atividade_id', selectedAtividadeId);

      // 2. Excluir a atividade diária
      await supabase.from('atividades_diárias')
        .delete()
        .eq('id', selectedAtividadeId);

      // Limpar campos
      setSelectedAtividadeId(null);
      setDescricaoAtividade('');
      setAtividadesRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Erro ao excluir atividade:', err);
      alert('Ocorreu um erro ao excluir a atividade.');
    } finally {
      setIsRegistrando(false);
    }
  };


  const turmaAtual = turmas.find(t => t.id === selectedTurma);
  const disciplinaAtual = disciplinas.find(d => d.id === selectedDisciplina);

  return (
<div className="space-y-6">
      {/* Navegação por Abas Superior */}
      <div className={`grid grid-cols-2 sm:flex sm:items-center gap-2 p-1.5 rounded-2xl border shadow-xl w-full sm:w-fit mx-auto sm:mx-0 ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
      }`}>
        <button
          onClick={() => {
            setActiveTab('aulas');
            if (selectedBimestre === 5) {
              setSelectedBimestre(4); // Reverte para o 4º bimestre ao acessar aulas
            }
          }}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all w-full sm:w-auto ${
            activeTab === 'aulas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 
            theme === 'light' ? 'text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Lançar Aulas
        </button>
        <button
          onClick={() => setActiveTab('notas')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all w-full sm:w-auto ${
            activeTab === 'notas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 
            theme === 'light' ? 'text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Notas & Avaliações
        </button>
        <button
          onClick={() => setActiveTab('relatorios')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all w-full sm:w-auto ${
            activeTab === 'relatorios' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 
            theme === 'light' ? 'text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Relatórios
        </button>
        <button
          onClick={() => setActiveTab('comunicados')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all w-full sm:w-auto relative ${
            activeTab === 'comunicados' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 
            unreadCount > 0 ? 'animate-blink-red' :
            theme === 'light' ? 'text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" /> Comunicados
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-md">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('aniversariantes')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all w-full sm:w-auto ${
            activeTab === 'aniversariantes' ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/40' :
            theme === 'light' ? 'text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
          }`}
        >
          <Cake className="w-4 h-4" /> Aniversários
        </button>
      </div>

      {/* Header Dinâmico */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-900' : 'text-ms-main'}`}>
            {activeTab === 'aulas' && 'Painel de Aulas'}
            {activeTab === 'notas' && 'Gestão de Notas Bimestrais'}
            {activeTab === 'relatorios' && 'Central de Relatórios'}
            {activeTab === 'comunicados' && 'Mural de Comunicados'}
          </h2>
          <p className={`mt-1 font-medium ${theme === 'light' ? 'text-blue-800/70' : 'text-blue-300'}`}>
            {activeTab === 'aulas' && 'Gerencie chamadas e lançamentos acadêmicos diários'}
            {activeTab === 'notas' && 'Cadastre provas, trabalhos e visualize a média da turma'}
            {activeTab === 'relatorios' && 'Gere documentos individuais para pais e coordenação'}
            {activeTab === 'comunicados' && 'Mensagens e solicitações da coordenação pedagógica'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-1 p-1 rounded-lg border ${
            theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-gray-800'
          }`}>
            {[1, 2, 3, 4, 5].map((b) => (
              <button
                key={b}
                onClick={() => handleBimestreChange(b)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${
                  selectedBimestre === b 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : theme === 'light' ? 'text-blue-800 hover:text-blue-900 hover:bg-blue-50' : 'text-blue-200 hover:text-white'
                }`}
              >
                {b === 5 ? 'EXAME FINAL' : `${b}º BIM`}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCalendarModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border shadow-md transition-all cursor-pointer font-bold text-sm ${
              theme === 'light' 
                ? 'bg-white border-blue-100 text-blue-900 hover:border-blue-400' 
                : 'bg-ms-card border-ms-border text-ms-main hover:border-ms-main'
            }`}
          >
            <Calendar className="w-4 h-4 text-[#d4af37]" />
            Calendário 2026
          </button>

          {activeTab === 'aulas' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border shadow-md transition-all hover:border-blue-400 cursor-pointer ${
              theme === 'light' ? 'bg-white border-blue-100' : 'bg-[#001a4d]/50 border-blue-900/50'
            }`} onClick={() => (document.querySelector('input[type="date"]') as HTMLInputElement)?.showPicker()}>
              <Calendar className={`w-4 h-4 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
              <input
                type="date"
                value={dataAula}
                onChange={(e) => setDataAula(e.target.value)}
                className={`text-sm outline-none p-2 rounded-lg transition-colors font-bold cursor-pointer ${
                  theme === 'light' ? 'bg-blue-50/50 text-blue-900' : 'bg-transparent text-blue-100'
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="space-y-6">
        {/* Seção de Filtros (Comum para todos) */}
        <div className={`${theme === 'light' ? 'bg-white' : 'bg-[#0a0f1e]'} rounded-2xl shadow-2xl border border-blue-900/30 overflow-hidden`}>
          <div className="bg-gradient-to-r from-[#002677] to-[#001a4d] px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Filter className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black !text-white uppercase tracking-tighter" style={{ color: '#ffffff' }}>Seleção de Turma</h3>
            </div>
          </div>
          <div className="p-8 bg-gradient-to-b from-transparent to-black/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group">
                <label className={`block text-[10px] font-black uppercase tracking-[0.3em] mb-3 ml-1 ${
                  theme === 'light' ? 'text-blue-900/60' : 'text-blue-400'
                }`}>Turma / Série</label>
                <div className="relative">
                  <select
                    value={selectedTurma}
                    onChange={(e) => setSelectedTurma(e.target.value)}
                    className={`w-full appearance-none border-2 text-base font-bold rounded-2xl p-5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer ${
                      theme === 'light' ? 'bg-blue-50/30 border-blue-100 text-blue-900' : 'bg-[#001a4d]/80 border-blue-900/30 text-blue-100 shadow-2xl'
                    }`}
                  >
                    <option value="" className={theme === 'light' ? 'bg-white text-blue-900' : 'bg-[#001a4d] text-blue-100'}>Selecione uma turma...</option>
                    {turmas.map(turma => (
                      <option 
                        key={turma.id} 
                        value={turma.id} 
                        className={theme === 'light' ? 'bg-white text-blue-900' : 'bg-[#001a4d] text-blue-100'}
                      >
                        {turma.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 pointer-events-none group-hover:scale-110 transition-transform" />
                </div>
              </div>

              <div className="relative group">
                <label className={`block text-[10px] font-black uppercase tracking-[0.3em] mb-3 ml-1 ${
                  theme === 'light' ? 'text-blue-900/60' : 'text-blue-400'
                }`}>Disciplina / Matéria</label>
                <div className="relative">
                  <select
                    value={selectedDisciplina}
                    onChange={(e) => setSelectedDisciplina(e.target.value)}
                    disabled={!selectedTurma}
                    className={`w-full appearance-none border-2 text-base font-bold rounded-2xl p-5 outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-30 transition-all cursor-pointer ${
                      theme === 'light' ? 'bg-blue-50/30 border-blue-100 text-blue-900' : 'bg-[#001a4d]/80 border-blue-900/30 text-blue-100 shadow-2xl'
                    }`}
                  >
                    <option value="" className={theme === 'light' ? 'bg-white text-blue-900' : 'bg-[#001a4d] text-blue-100'}>Selecione uma disciplina...</option>
                    {disciplinas.map(disciplina => (
                      <option 
                        key={disciplina.id} 
                        value={disciplina.id} 
                        className={theme === 'light' ? 'bg-white text-blue-900' : 'bg-[#001a4d] text-blue-100'}
                      >
                        {disciplina.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 pointer-events-none group-hover:scale-110 transition-transform" />
                </div>
              </div>
            </div>
            
            {activeTab === 'aulas' && selectedTurma && (
              <div className="mt-6 pt-6 border-t border-ms-border/50">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${
                  theme === 'light' ? 'text-blue-900/60' : 'text-blue-400'
                }`}>Descrição da Atividade do Dia</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <BookOpen className={`w-4 h-4 ${theme === 'light' ? 'text-blue-600' : 'text-blue-500'}`} />
                    </div>
                    <input
                      type="text"
                      disabled={isEffectivelyLocked}
                      placeholder={isEffectivelyLocked ? "Lançamentos encerrados para este bimestre." : "O que foi ensinado hoje?"}
                      value={descricaoAtividade}
                      onChange={(e) => setDescricaoAtividade(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isEffectivelyLocked && handleRegistrarAtividade()}
                      className={`w-full border text-sm rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all ${
                          theme === 'light' ? 'bg-blue-50/30 border-blue-100 text-blue-900 placeholder:text-blue-900/40' : 'bg-[#001a4d]/50 border-blue-900/50 text-blue-100 placeholder:text-blue-400/50 shadow-inner'
                      }`}
                    />
                  </div>
                  <button
                    onClick={handleRegistrarAtividade}
                    disabled={isRegistrando || !descricaoAtividade.trim() || !selectedDisciplina || isEffectivelyLocked}
                    title={isEffectivelyLocked ? "Bimestre bloqueado para lançamentos" : selectedAtividadeId ? "Salvar alterações da atividade" : "Registrar atividade para a data selecionada"}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                      registroSucesso
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-900/30 active:scale-95'
                    }`}
                  >
                    {registroSucesso
                      ? <><CheckCircle className="w-4 h-4" /> {selectedAtividadeId ? 'Salvo!' : 'Registrado!'}</>
                      : isRegistrando
                        ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /></>
                        : selectedAtividadeId
                          ? <><Save className="w-4 h-4" /> Salvar</>
                          : <><PlusCircle className="w-4 h-4" /> Registrar</>
                    }
                  </button>
                  {selectedAtividadeId && (
                    <button
                      onClick={handleExcluirAtividade}
                      disabled={isRegistrando || isEffectivelyLocked}
                      title={isEffectivelyLocked ? "Bimestre bloqueado" : "Excluir esta atividade permanentemente"}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-red-500/30 text-red-500 hover:bg-red-500/10 shadow-md transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  )}
                </div>

                {/* Atalhos Rápidos — Atividades do Bimestre */}
                {recentAtividades.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        theme === 'light' ? 'text-blue-700/60' : 'text-blue-500'
                      }`}>
                        {isBulkMode
                          ? `📦 Modo Lote — ${bulkSelectedIds.length} selecionada${bulkSelectedIds.length !== 1 ? 's' : ''}`
                          : '⚡ Atividades — clique para editar'
                        }
                      </p>
                      <button
                        onClick={() => {
                          setIsBulkMode(b => {
                            const next = !b;
                            if (next) {
                              setBulkSelectedIds(recentAtividades.map(a => a.id));
                            } else {
                              setBulkSelectedIds([]);
                            }
                            return next;
                          });
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                          isBulkMode
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                            : theme === 'light'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              : 'bg-blue-900/20 text-blue-400 border-blue-800/40 hover:bg-blue-800/40'
                        }`}
                      >
                        <Layers className="w-3 h-3" />
                        {isBulkMode ? 'Sair do Lote' : 'Modo Lote'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentAtividades.map(ativ => {
                        const isDateSelected = ativ.data === dataAula;
                        const isBulkSelected = bulkSelectedIds.includes(ativ.id);
                        const [, month, day] = ativ.data.split('-');
                        const label = `${day}/${month}`;
                        const preview = ativ.descricao ? ativ.descricao.slice(0, 16) + (ativ.descricao.length > 16 ? '...' : '') : 'Sem descrição';
                        return (
                          <button
                            key={ativ.id}
                            onClick={() => {
                              if (isBulkMode) {
                                // Toggle seleção em lote
                                setBulkSelectedIds(prev =>
                                  prev.includes(ativ.id)
                                    ? prev.filter(id => id !== ativ.id)
                                    : [...prev, ativ.id]
                                );
                              } else {
                                // Modo normal: navega para a data
                                setDataAula(ativ.data);
                                setDescricaoAtividade(ativ.descricao || '');
                                setSelectedAtividadeId(ativ.id);
                              }
                            }}
                            title={ativ.descricao}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isBulkMode
                                ? isBulkSelected
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/50'
                                  : theme === 'light'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 border-dashed'
                                    : 'bg-blue-900/10 text-blue-400 border-blue-800/40 border-dashed hover:bg-blue-900/30'
                                : isDateSelected
                                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                                  : theme === 'light'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                    : 'bg-blue-900/20 text-blue-300 border-blue-800/40 hover:bg-blue-800/40 hover:text-white'
                            }`}
                          >
                            {isBulkMode && (
                              <span className={`w-3 h-3 rounded flex items-center justify-center border flex-shrink-0 ${
                                isBulkSelected ? 'bg-white border-white' : 'border-current'
                              }`}>
                                {isBulkSelected && <span className="text-blue-600 text-[8px] font-black leading-none">✓</span>}
                              </span>
                            )}
                            <span className="font-black">{label}</span>
                            <span className="opacity-60">•</span>
                            <span className="opacity-80">{preview}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Dica de uso no modo lote */}
                    {isBulkMode && bulkSelectedIds.length > 1 && (
                      <p className="mt-2 text-[10px] text-blue-400 font-medium">
                        ✔ Selecione os alunos na tabela abaixo e clique no botão de visto — será lançado nas {bulkSelectedIds.length} atividades ao mesmo tempo.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {activeTab === 'comunicados' ? (
          <ProfessorMensagensPanel 
            currentTeacher={professor} 
            theme={theme} 
            onReadConfirmed={fetchUnreadCount} 
          />
        ) : activeTab === 'aniversariantes' ? (
          <AniversariantesPanel />
        ) : !selectedTurma || !selectedDisciplina ? (
          <EmptyState />
        ) : (
          <>
            {/* Banner: Professor é SUBSTITUTO */}
            {substituicaoAtiva && (
              <div className="bg-amber-400/10 border-2 border-amber-400/30 p-5 rounded-2xl flex items-start gap-3 shadow-md animate-in slide-in-from-top-2 duration-300">
                <ArrowRightLeft className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">Modo Substituto Ativo</h4>
                  <p className="text-xs text-amber-300/80 font-bold mt-1">
                    Você está substituindo <span className="text-amber-300">{substituicaoAtiva.titularNome}</span> até <span className="text-amber-300">{new Date(substituicaoAtiva.atestado.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</span>.
                    Todos os lançamentos realizados neste período serão de sua responsabilidade.
                  </p>
                </div>
              </div>
            )}

            {/* Banner: Professor TITULAR em atestado (somente leitura) */}
            {isTitularEmAtestado && (
              <div className="bg-amber-500/10 border-2 border-amber-500/30 p-5 rounded-2xl flex items-start gap-3 shadow-md animate-in slide-in-from-top-2 duration-300">
                <Stethoscope className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-amber-500">Você está de Atestado Médico</h4>
                  <p className="text-xs text-amber-400/80 font-bold mt-1 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Período: {new Date(atestadoAtivo!.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(atestadoAtivo!.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}.
                    Seus lançamentos estão em modo somente leitura durante este período.
                    {atestadoAtivo?.substituto_id && ' Um professor substituto está gerenciando suas turmas.'}
                  </p>
                </div>
              </div>
            )}

            {isBimestreLocked && !isTitularEmAtestado && (
              <div className="bg-red-500/10 border-2 border-red-500/30 text-red-500 p-5 rounded-2xl flex items-start gap-3 shadow-md animate-in slide-in-from-top-2 duration-300">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-red-500">Bimestre Bloqueado pela Coordenação</h4>
                  <p className="text-xs text-red-400 font-bold mt-1">
                    O {selectedBimestre}º Bimestre foi encerrado pela coordenação pedagógica. Os lançamentos de vistos, chamadas e notas deste período estão encerrados e não podem ser criados, alterados ou excluídos por professores.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'aulas' && (
              <StudentList 
                professor={professor} 
                turmaId={selectedTurma} 
                disciplinaId={selectedDisciplina}
                dataAula={dataAula}
                bimestreId={selectedBimestre}
                descricaoAtividade={descricaoAtividade}
                theme={theme}
                onAtividadeLoaded={(desc, id) => {
                  setDescricaoAtividade(desc);
                  setSelectedAtividadeId(id);
                }}
                bulkAtividades={
                  isBulkMode && bulkSelectedIds.length > 1
                    ? recentAtividades.filter(a => bulkSelectedIds.includes(a.id))
                    : []
                }
                isLocked={isEffectivelyLocked}
              />
            )}
            
            {activeTab === 'notas' && selectedBimestre !== 5 && (
              <GradesPanel 
                professor={professor}
                turmaId={selectedTurma}
                disciplinaId={selectedDisciplina}
                bimestreId={selectedBimestre}
                theme={theme}
                refreshKey={atividadesRefreshKey}
                isLocked={isEffectivelyLocked}
              />
            )}

            {activeTab === 'notas' && selectedBimestre === 5 && (
              <ExameFinalPanel 
                professor={professor}
                turmaId={selectedTurma}
                disciplinaId={selectedDisciplina}
                theme={theme}
                isLocked={isEffectivelyLocked}
              />
            )}

            {activeTab === 'relatorios' && (
              <ReportsPanel 
                professor={professor}
                turmaId={selectedTurma}
                disciplinaId={selectedDisciplina}
                bimestreId={selectedBimestre}
                theme={theme}
              />
            )}
          </>
        )}
      </div>
      
      {/* MODAL CALENDÁRIO LETIVO 2026 */}
      <CalendarioLetivoModal 
        isOpen={showCalendarModal} 
        onClose={() => setShowCalendarModal(false)} 
      />
    </div>
  );
}
