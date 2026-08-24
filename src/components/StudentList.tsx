import { useEffect, useState } from 'react';
import type { Professor, ListaParaVistos } from '../types';
import { supabase } from '../lib/supabase';
import { StudentRow } from './StudentRow';
import { OcorrenciaLoteModal } from './OcorrenciaLoteModal';
import { getBimestreFromDate, getConfigPorTurma } from '../utils/academicUtils';
import { AlertTriangle, Info, Loader2, Save, ShieldAlert } from 'lucide-react';
import { autoUpdateExpiredAbsences } from '../utils/studentUtils';

export interface StudentGradeBreakdown {
  mediaFinal: number;
  notaVistos: number;
  valorMaximoVistos: number;
  avaliacoes: {
    nome: string;
    nota: number;
    valorMaximo: number;
  }[];
}

interface StudentListProps {
  professor: Professor;
  turmaId: string;
  disciplinaId: string;
  dataAula?: string;
  bimestreId: number;
  descricaoAtividade: string;
  theme: 'dark' | 'light';
  onAtividadeLoaded?: (descricao: string, id: string | null) => void;
  bulkAtividades?: { id: string; data: string; descricao: string }[];
  isLocked?: boolean;
  // ID da atividade controlado pelo Dashboard (ex.: atalho clicado ou "Nova Atividade").
  // Quando muda, sincroniza a atividade/vistos exibidos sem esperar um refetch completo.
  selectedAtividadeId?: string | null;
  // true logo após "Nova Atividade": o próximo visto marcado deve criar uma atividade
  // nova em vez de reaproveitar a mais recente do dia.
  forceNovaAtividade?: boolean;
}

export function StudentList({ professor, turmaId, disciplinaId, dataAula = new Date().toISOString().split('T')[0], bimestreId, descricaoAtividade, theme, onAtividadeLoaded, bulkAtividades = [], isLocked = false, selectedAtividadeId, forceNovaAtividade = false }: StudentListProps) {
  // Config efetiva para esta turma (per-turma ou global)
  const configEfetivo = getConfigPorTurma(professor, turmaId);
  const [alunos, setAlunos] = useState<ListaParaVistos[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAtividades, setTotalAtividades] = useState(0);
  const [estatisticasVistos, setEstatisticasVistos] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [notasDetalhes, setNotasDetalhes] = useState<Record<string, StudentGradeBreakdown>>({});

  const [vistosDoDia, setVistosDoDia] = useState<Record<string, string>>({});
  const [presencasDoDia, setPresencasDoDia] = useState<Record<string, boolean>>({});
  const [atividadeIdHoje, setAtividadeIdHoje] = useState<string | null>(null);
  const [bulkRefreshTrigger, setBulkRefreshTrigger] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saidasAtivas, setSaidasAtivas] = useState<Record<string, string>>({});
  const [isOcorrenciaLoteOpen, setIsOcorrenciaLoteOpen] = useState(false);

  // Callback chamado quando um StudentRow cria uma nova atividade —
  // garante que todos os rows subsequentes usem o mesmo ID.
  const handleAtividadeCreated = (novoId: string) => {
    setAtividadeIdHoje(novoId);
    // Avisa o Dashboard: a atividade criada por um visto (ex.: após "Nova Atividade")
    // vira a atividade selecionada, evitando que "Registrar" crie outra duplicada.
    onAtividadeLoaded?.(descricaoAtividade, novoId);
  };

  // Sincroniza com o ID controlado pelo Dashboard (atalho de atividade clicado ou
  // "Nova Atividade"), sem esperar o refetch completo por mudança de data/turma/disciplina.
  useEffect(() => {
    if (selectedAtividadeId === undefined) return;
    if (selectedAtividadeId === atividadeIdHoje) return;

    if (!selectedAtividadeId) {
      // "Nova Atividade": mantém a atividade anterior salva no banco, só limpa a exibição
      setAtividadeIdHoje(null);
      setVistosDoDia({});
      return;
    }

    setAtividadeIdHoje(selectedAtividadeId);
    supabase
      .from('vistos_v2')
      .select('aluno_id, valor')
      .eq('atividade_id', selectedAtividadeId)
      .then(({ data }) => {
        const mapVistos: Record<string, string> = {};
        (data || []).forEach(v => { mapVistos[String(v.aluno_id).trim()] = String(v.valor); });
        setVistosDoDia(mapVistos);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAtividadeId]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // 1. Buscar Alunos da Turma (Fonte de Dados Oficial)
      const { data: dataAlunos, error: errAlunos } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .order('aluno_numero');

      if (!errAlunos && dataAlunos) {
        // Mapeia os dados da tabela 'alunos' para o formato que o componente espera
        const mappedAlunos = dataAlunos.map(a => ({
          aluno_id: a.id,
          aluno_nome: a.nome,
          aluno_numero: a.aluno_numero,
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          professor_id: professor.id,
          professor_nome: professor.nome,
          disciplina_nome: '', // Será preenchido se necessário, mas o ID é o que importa
          turma_nome: '',
          status: a.status,
          atestado_inicio: a.atestado_inicio,
          atestado_fim: a.atestado_fim
        }));
        setAlunos(mappedAlunos);

        // Auto-update expired absences and update state
        autoUpdateExpiredAbsences(dataAlunos, (updatedAlunos) => {
          const remapped = updatedAlunos.map(a => ({
            aluno_id: a.id,
            aluno_nome: a.nome,
            aluno_numero: a.aluno_numero,
            turma_id: turmaId,
            disciplina_id: disciplinaId,
            professor_id: professor.id,
            professor_nome: professor.nome,
            disciplina_nome: '',
            turma_nome: '',
            status: a.status,
            atestado_inicio: a.atestado_inicio,
            atestado_fim: a.atestado_fim
          }));
          setAlunos(remapped);
        });
      }

      // 2. Buscar Atividade Diária do Dia Selecionado
      // Pode haver mais de uma atividade no mesmo dia (turma/disciplina) — usamos
      // a mais recente como padrão ao abrir a aba; as demais ficam nos atalhos.
      const { data: atividadesHojeList } = await supabase
        .from('atividades_diárias')
        .select('id, descricao')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('data', dataAula)
        .order('created_at', { ascending: false })
        .limit(1);
      const atividadeHoje = atividadesHojeList?.[0] || null;

      if (atividadeHoje) {
        setAtividadeIdHoje(atividadeHoje.id);
        if (onAtividadeLoaded) {
            onAtividadeLoaded(atividadeHoje.descricao || '', atividadeHoje.id);
        }
        // 3. Buscar Vistos da Atividade de Hoje
        const { data: vistosHoje } = await supabase
          .from('vistos_v2')
          .select('aluno_id, valor')
          .eq('atividade_id', atividadeHoje.id);
        
        if (vistosHoje) {
          const mapVistos: Record<string, string> = {};
          vistosHoje.forEach(v => { 
            // Normaliza aluno_id para string para garantir match com aluno.aluno_id
            mapVistos[String(v.aluno_id).trim()] = String(v.valor); 
          });
          setVistosDoDia(mapVistos);
        }
      } else {
        setAtividadeIdHoje(null);
        setVistosDoDia({});
        if (onAtividadeLoaded) {
            onAtividadeLoaded('', null);
        }
      }

      // 4. Buscar Presenças do Dia (Chamada) — usa professor_id
      const { data: chamadasHoje } = await supabase
        .from('chamadas')
        .select('aluno_id, presenca')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('data_aula', dataAula);
      
      if (chamadasHoje) {
          const mapPresenca: Record<string, boolean> = {};
          chamadasHoje.forEach(c => { mapPresenca[String(c.aluno_id).trim()] = c.presenca; });
          setPresencasDoDia(mapPresenca);
      } else {
          setPresencasDoDia({});
      }

      // 5. Buscar Total de Atividades no Bimestre para %
      // Primeiro busca as atividades do bimestre para obter os IDs
      const { data: atividadesBimestre } = await supabase
        .from('atividades_diárias')
        .select('id')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', bimestreId);
      
      const ativIds = atividadesBimestre?.map(a => a.id) || [];
      
      // O total é a contagem real. Se hoje for o primeiro visto, a atividade
      // já foi/será criada no handleVistoAction, então usamos ativIds.length.
      // Mas se não há atividade hoje ainda e nenhuma no bimestre, setamos 1 
      // para indicar que "esta aula" contará quando o primeiro visto for lançado.
      const totalReal = ativIds.length;
      const totalComHoje = atividadeHoje ? totalReal : Math.max(totalReal, 1);
      setTotalAtividades(totalComHoje);

      // 6. Buscar estatísticas gerais do bimestre (join via IDs já obtidos)
      let currentStats: Record<string, number> = {};
      if (ativIds.length > 0) {
        const { data: dataVistosGerais } = await supabase
          .from('vistos_v2')
          .select('atividade_id, aluno_id, valor')
          .in('atividade_id', ativIds);

        if (dataVistosGerais) {
          const stats: Record<string, number> = {};
          // Deduplica por (atividade_id, aluno_id): se houver duplicatas no banco,
          // usa apenas o PRIMEIRO registro encontrado para cada par.
          const seenPairs = new Set<string>();
          dataVistosGerais.forEach(v => {
            const cleanAlunoId = String(v.aluno_id).trim();
            const cleanAtivId  = String(v.atividade_id).trim();
            const pairKey = `${cleanAtivId}__${cleanAlunoId}`;
            if (seenPairs.has(pairKey)) return; // ignora duplicatas
            seenPairs.add(pairKey);

            let peso = 0;
            const val = String(v.valor).trim();
            if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
            else if (val === '0.5' || val === 'half') peso = 0.5;
            else if (!isNaN(parseFloat(val))) {
                const num = parseFloat(val);
                peso = num > 1 ? num / 10 : num;
            }
            if (peso > 0) {
               stats[cleanAlunoId] = (stats[cleanAlunoId] || 0) + peso;
            }
          });
          currentStats = stats;
          setEstatisticasVistos(stats);
        }
      } else {
        setEstatisticasVistos({});
      }

      // 7. Buscar Avaliações Bimestrais e Notas
      const { data: avaliacoes } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', bimestreId);
      
      const avalIdsToFetch = avaliacoes?.map(a => a.id) || [];
      let notasAlunoArr: any[] = [];
      if (avalIdsToFetch.length > 0) {
          const { data: dataNotas } = await supabase
            .from('notas_avaliacoes')
            .select('*')
            .in('avaliacao_id', avalIdsToFetch);
          notasAlunoArr = dataNotas || [];
      }

      // Processar notas e construir o breakdown por aluno
      const breakdownObj: Record<string, StudentGradeBreakdown> = {};
      if (dataAlunos) {
          dataAlunos.forEach(aluno => {
              const cleanId = String(aluno.id).trim();
              const alunoNotas = notasAlunoArr.filter(n => String(n.aluno_id).trim() === cleanId);
              
              const detalheAvaliacoes = avaliacoes?.map(av => {
                  const notaObj = alunoNotas.find(n => n.avaliacao_id === av.id);
                  return {
                      nome: av.nome || 'Avaliação',
                      nota: notaObj?.nota || 0,
                      valorMaximo: av.valor_maximo || 10
                  };
              }) || [];

              let somaNotas = detalheAvaliacoes.reduce((acc, curr) => acc + curr.nota, 0);
              let pesosVistoAluno = currentStats[cleanId] || 0;
              
              if (aluno.status === 'Transferido' || aluno.status === 'Remanejado' || aluno.status === 'Cancelada') {
                  somaNotas = 0;
                  pesosVistoAluno = 0;
                  currentStats[cleanId] = 0;
              }
              
              const totalAtivCalculado = totalComHoje;
              const maxVistosPoints = configEfetivo.config_visto_valor_total || 2.0;
              // Limita pesosVistoAluno ao máximo possível (totalAtivCalculado) para evitar notas acima do máximo
              const pesosVistoAlunoCapped = Math.min(pesosVistoAluno, totalAtivCalculado);
              const notaVistoFinal = totalAtivCalculado > 0 ? (pesosVistoAlunoCapped / totalAtivCalculado) * maxVistosPoints : 0;

              breakdownObj[cleanId] = {
                  mediaFinal: somaNotas + notaVistoFinal,
                  notaVistos: notaVistoFinal,
                  valorMaximoVistos: maxVistosPoints,
                  avaliacoes: detalheAvaliacoes
              };
          });
      }
      setEstatisticasVistos(currentStats);
      setNotasDetalhes(breakdownObj);

      // 8. Buscar Saídas de Sala (Sincronização)
      const { data: saidas } = await supabase
        .from('saidas_sala')
        .select('id, aluno_id')
        .eq('turma_id', turmaId)
        .eq('status', 'Fora');
      
      if (saidas) {
          const mapSaidas: Record<string, string> = {};
          saidas.forEach(s => { mapSaidas[String(s.aluno_id).trim()] = s.id; });
          setSaidasAtivas(mapSaidas);
      } else {
          setSaidasAtivas({});
      }

      setLoading(false);
    }
    
    if (turmaId && disciplinaId) {
      fetchData();
    }
  }, [professor.id, turmaId, disciplinaId, bimestreId, dataAula, refreshTrigger]);

  // Polling para saidas_sala para manter sincronizado com o mobile
  useEffect(() => {
    if (!turmaId) return;
    const fetchSaidas = async () => {
      const { data: saidas } = await supabase
        .from('saidas_sala')
        .select('id, aluno_id')
        .eq('turma_id', turmaId)
        .eq('status', 'Fora');
      
      if (saidas) {
          const mapSaidas: Record<string, string> = {};
          saidas.forEach(s => { mapSaidas[String(s.aluno_id).trim()] = s.id; });
          setSaidasAtivas(mapSaidas);
      } else {
          setSaidasAtivas({});
      }
    };
    
    const interval = setInterval(fetchSaidas, 15000); // sync a cada 15 segundos
    return () => clearInterval(interval);
  }, [turmaId]);

  const handleUpdateVistoStat = (alunoId: string, valorAntigo: string | null, novoValor: string | null) => {
    const getPeso = (v: string | null) => {
        if (!v) return 0;
        const val = String(v).trim();
        if (val === '1.0' || val === '+' || val === '.' || val === 'checked') return 1.0;
        if (val === '0.5' || val === 'half') return 0.5;
        const num = parseFloat(val);
        if (isNaN(num)) return 0;
        return num > 1 ? num / 10 : num;
    };

    const pesoAntigo = getPeso(valorAntigo);
    const pesoNovo = getPeso(novoValor);

    if (pesoAntigo === pesoNovo) return;

    let newTotal = totalAtividades;
    if (totalAtividades === 0 && pesoNovo > 0) {
      setTotalAtividades(1);
      newTotal = 1;
    }

    const maxVistosPoints = configEfetivo.config_visto_valor_total || 2.0;

    // ──────────────────────────────────────────────────────────────────────────
    // CORREÇÃO: usa o functional updater (prev) em vez da closure stale.
    // Quando "Desmarcar Todas" chama onUpdateVisto N vezes em sequência, cada
    // chamada recebe o valor JÁ ATUALIZADO de prev, acumulando corretamente.
    // Usando a closure (estatisticasVistos[alunoId]) todas as chamadas leriam
    // o mesmo valor antigo e o resultado final seria errado.
    // ──────────────────────────────────────────────────────────────────────────
    setEstatisticasVistos(prev => {
      const currentCount = prev[alunoId] || 0;
      const rawCount = Math.max(0, currentCount - pesoAntigo + pesoNovo);
      const newCount = Math.min(rawCount, newTotal); // cap ao total de atividades
      return { ...prev, [alunoId]: newCount };
    });

    setNotasDetalhes(prev => {
      const studentBreakdown = prev[alunoId];
      if (!studentBreakdown) return prev;

      // Delta-based: ajusta o notaVistos atual pelo delta da mudança.
      // Lê studentBreakdown.notaVistos do prev (já atualizado) a cada chamada.
      const deltaNota = newTotal > 0 ? ((pesoNovo - pesoAntigo) / newTotal) * maxVistosPoints : 0;
      const rawNota = studentBreakdown.notaVistos + deltaNota;
      const newNotaVisto = Math.min(maxVistosPoints, Math.max(0, rawNota));
      const somaNotas = studentBreakdown.avaliacoes.reduce((acc, curr) => acc + curr.nota, 0);

      return {
        ...prev,
        [alunoId]: {
          ...studentBreakdown,
          notaVistos: newNotaVisto,
          mediaFinal: somaNotas + newNotaVisto
        }
      };
    });

    // Atualiza o mapa local de vistos do dia para persistência imediata
    setVistosDoDia(prev => ({
        ...prev,
        [alunoId]: novoValor || ''
    }));
  };


  const handleManualSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Recarrega o contador real do banco
    const { count } = await supabase
      .from('atividades_diárias')
      .select('*', { count: 'exact', head: true })
      .eq('id_do_professor', professor.id)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', disciplinaId)
      .eq('bimestre_id', bimestreId);
    
    // Se o banco retornar 0 mas temos marcações na tela, mantemos 1
    const hasAnyVisto = Object.values(estatisticasVistos).some(v => v > 0);
    setTotalAtividades(Math.max(count || 0, hasAnyVisto ? 1 : 0));

    setShowSuccess(true);
    setIsSaving(false);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleMarkAllAll = async () => {
    if (isLocked) return;
    
    setIsMarkingAll(true);
    const defaultVal = configEfetivo.config_visto_metodo === 'ponto' ? '.' : 
                       configEfetivo.config_visto_metodo === 'simbolico' ? '+' : 
                       configEfetivo.config_visto_metodo === 'gradual' ? '1.0' : '10';
    
    const ativIds = bulkAtividades.map(a => a.id);
    const validAlunos = alunos.filter(a => {
      if (a.status === 'Transferido' || a.status === 'Remanejado' || a.status === 'Cancelada') return false;
      return true;
    });
    
    const alunoIds = validAlunos.map(a => String(a.aluno_id).trim());
    
    if (ativIds.length > 0 && alunoIds.length > 0) {
      const { data: existing } = await supabase
        .from('vistos_v2')
        .select('atividade_id, aluno_id, valor')
        .in('atividade_id', ativIds)
        .in('aluno_id', alunoIds);
        
      const existingMap = new Set(existing?.map(e => `${e.atividade_id}_${e.aluno_id}`) || []);
      
      const totalPossible = validAlunos.length * bulkAtividades.length;
      let existingDefaultCount = 0;
      
      existing?.forEach(e => {
          if (e.valor === defaultVal) existingDefaultCount++;
      });
      
      const isAllMarked = existingDefaultCount === totalPossible;

      if (isAllMarked) {
          if (!confirm('Deseja DESMARCAR todas as atividades para todos os alunos válidos?')) {
             setIsMarkingAll(false);
             return;
          }
          await supabase.from('vistos_v2').delete()
            .in('atividade_id', ativIds)
            .in('aluno_id', alunoIds);
            
          setBulkRefreshTrigger(prev => prev + 1);
          setRefreshTrigger(prev => prev + 1);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
      } else {
          if (!confirm('Deseja MARCAR todas as atividades pendentes para todos os alunos válidos?')) {
             setIsMarkingAll(false);
             return;
          }
          const inserts: any[] = [];
          validAlunos.forEach(aluno => {
            const cleanId = String(aluno.aluno_id).trim();
            bulkAtividades.forEach(ativ => {
               if (!existingMap.has(`${ativ.id}_${cleanId}`)) {
                   inserts.push({
                       atividade_id: ativ.id,
                       aluno_id: cleanId,
                       valor: defaultVal
                   });
               }
            });
          });
          
          if (inserts.length > 0) {
              const allInserts = [
                ...(existing?.map(e => ({ atividade_id: e.atividade_id, aluno_id: e.aluno_id, valor: defaultVal })) || []),
                ...inserts
              ];
              
              await supabase.from('vistos_v2').delete()
                 .in('atividade_id', ativIds)
                 .in('aluno_id', alunoIds);
                 
              await supabase.from('vistos_v2').insert(allInserts);
              
              setBulkRefreshTrigger(prev => prev + 1);
              setRefreshTrigger(prev => prev + 1);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 3000);
          }
      }
    }
    setIsMarkingAll(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legenda e Ações */}
      <div className={`flex flex-wrap items-center justify-between gap-4 px-6 py-3 rounded-2xl border shadow-lg ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-dark/5 border-ms-border'
      }`}>
          <div className="flex flex-wrap items-center gap-6">
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-900/20"></div>
                 <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}>Ótimo (&gt;80%)</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-900/20"></div>
                 <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}>Bom (60-79%)</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-900/20"></div>
                 <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-yellow-700' : 'text-yellow-500'}`}>Alerta (40-59%)</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-900/20"></div>
                 <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-red-700' : 'text-red-500'}`}>Crítico (≤35% ou nota &lt;3,5)</span>
             </div>
             <div className={`hidden lg:flex items-center gap-1.5 pl-4 border-l ${theme === 'light' ? 'border-blue-100 text-blue-800' : 'border-gray-700 text-blue-300'} text-[10px] font-bold`}>
                 <span>💡 Dica: Clique no nome do aluno ou abra o registro de ocorrência (⚠️) e clique em "Ver Ficha" para ver o histórico completo de ocorrências.</span>
             </div>
          </div>

         <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black uppercase ${theme === 'light' ? 'text-blue-900' : 'text-ms-main'}`}>
                    {totalAtividades} Atividades no {bimestreId}º BIM
                </span>
                {showSuccess && (
                    <span className="text-[10px] font-bold text-green-500 animate-bounce">✓ Dados sincronizados com sucesso!</span>
                )}
            </div>

            <button
                 onClick={() => setIsOcorrenciaLoteOpen(true)}
                 title="Registrar ocorrência para múltiplos alunos ao mesmo tempo"
                 className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                     theme === 'light'
                       ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300'
                       : 'bg-red-900/20 text-red-400 border-red-700/40 hover:bg-red-900/40'
                 } active:scale-95`}
             >
                 <ShieldAlert className="w-4 h-4" />
                 <span className="hidden md:inline">Ocorrência em Lote</span>
                 <span className="md:hidden">Ocorr. Lote</span>
             </button>
            
            <button
                 onClick={handleManualSave}
                 disabled={isSaving || isLocked}
                 className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                     isSaving || isLocked ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-ms-blue hover:bg-blue-700 text-white shadow-lg shadow-blue-900/40 active:scale-95'
                 }`}
             >
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                 {isSaving ? 'Salvando...' : 'Salvar Lançamentos'}
             </button>
         </div>
      </div>

      <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-md border border-ms-border overflow-hidden transition-all duration-300`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ms-border/50">
            <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'}>
              <tr>
                <th scope="col" className="md:px-6 px-2 md:py-4 py-2.5 text-left text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">
                  Aluno
                </th>
                <th scope="col" className="md:px-6 px-0.5 md:py-4 py-2.5 text-center text-[10px] md:text-xs font-bold text-white uppercase tracking-widest w-10 md:w-24">
                  <span className="hidden md:inline">% Realizado</span>
                  <span className="md:hidden">% Real.</span>
                </th>
                {professor.habilitar_chamada_interna && (
                  <th scope="col" className="md:px-6 px-1 md:py-4 py-2.5 text-center text-[10px] md:text-xs font-bold text-white uppercase tracking-widest w-20 md:w-32">
                    <span className="hidden md:inline">Chamada</span>
                    <span className="md:hidden">Presença</span>
                  </th>
                )}
                <th scope="col" className="md:px-4 px-0.5 md:py-4 py-2.5 text-center text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">
                  {bulkAtividades.length > 1 ? (
                    <div className="flex flex-col items-center gap-1 md:gap-2">
                       <span className="hidden md:inline">Vistos por Atividade ({bulkAtividades.length})</span>
                       <span className="md:hidden">Vistos ({bulkAtividades.length})</span>
                       {!isLocked && (
                         <button 
                           onClick={handleMarkAllAll}
                           disabled={isMarkingAll}
                           className={`vistar-todas-btn flex flex-col items-center justify-center text-center gap-0.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase leading-tight border transition-all ${isMarkingAll ? 'opacity-50' : 'hover:scale-105 active:scale-95'} ${theme === 'light' ? 'bg-white !text-[#003366] border-blue-200 shadow-sm' : 'bg-ms-dark !text-blue-200 border-blue-500/30 shadow-sm'}`}
                           title="Vistar todas as atividades da turma"
                         >
                           <style dangerouslySetInnerHTML={{ __html: `
                             .light-theme .vistar-todas-btn,
                             .light-theme .vistar-todas-btn span,
                             .light-theme .vistar-todas-btn * {
                               color: #003366 !important;
                             }
                           ` }} />
                           {isMarkingAll ? (
                             <Loader2 className="w-3 h-3 animate-spin !text-[#003366] dark:!text-blue-200" />
                           ) : (
                             <span className="!text-[#003366] dark:!text-blue-200 font-black">Vistar todas as<br/>atividades da turma</span>
                           )}
                         </button>
                       )}
                    </div>
                  ) : (
                    <>
                      <span className="hidden md:inline">Lançar Visto ({configEfetivo.config_visto_metodo})</span>
                      <span className="md:hidden">Visto ({configEfetivo.config_visto_metodo})</span>
                    </>
                  )}
                </th>
                <th scope="col" className="md:px-6 px-0.5 md:py-4 py-2.5 text-center text-[10px] md:text-xs font-bold text-white uppercase tracking-widest w-16 md:w-40">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ms-border/50">
              {alunos.map((aluno, index) => (
                <StudentRow 
                  key={`${turmaId}-${disciplinaId}-${aluno.aluno_id}`} 
                  aluno={aluno} 
                  professor={professor} 
                  dataAula={dataAula}
                  bimestreId={bimestreId}
                  descricaoAtividade={descricaoAtividade}
                  atividadesRealizadas={estatisticasVistos[String(aluno.aluno_id).trim()] || 0}
                  totalAtividades={totalAtividades}
                  index={index}
                  theme={theme}
                  onUpdateVisto={handleUpdateVistoStat}
                  initialVisto={vistosDoDia[String(aluno.aluno_id).trim()]}
                  initialPresenca={presencasDoDia[String(aluno.aluno_id).trim()]}
                  initialSaidaId={saidasAtivas[String(aluno.aluno_id).trim()] || null}
                  atividadeIdHoje={atividadeIdHoje}
                  onAtividadeCreated={handleAtividadeCreated}
                  forceNovaAtividade={forceNovaAtividade && !atividadeIdHoje}
                  bulkAtividades={bulkAtividades}
                  bulkRefreshTrigger={bulkRefreshTrigger}
                  gradeBreakdown={notasDetalhes[aluno.aluno_id]}
                  isLocked={isLocked}
                />
              ))}
              {alunos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500 font-medium italic">Nenhum aluno encontrado para esta turma.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OcorrenciaLoteModal
        isOpen={isOcorrenciaLoteOpen}
        onClose={() => setIsOcorrenciaLoteOpen(false)}
        alunos={alunos}
        professorId={professor.id}
        turmaId={turmaId}
        disciplinaId={disciplinaId}
        onSuccess={() => {}}
      />
    </div>
  );
}
