import { useEffect, useState } from 'react';
import type { Professor, ListaParaVistos } from '../types';
import { supabase } from '../lib/supabase';
import { StudentRow } from './StudentRow';
import { AlertTriangle, Info, Loader2, Save } from 'lucide-react';

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
}

export function StudentList({ professor, turmaId, disciplinaId, dataAula = new Date().toISOString().split('T')[0], bimestreId, descricaoAtividade, theme, onAtividadeLoaded, bulkAtividades = [], isLocked = false }: StudentListProps) {
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

  // Callback chamado quando um StudentRow cria uma nova atividade —
  // garante que todos os rows subsequentes usem o mesmo ID.
  const handleAtividadeCreated = (novoId: string) => {
    setAtividadeIdHoje(novoId);
  };

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
          turma_nome: ''
        }));
        setAlunos(mappedAlunos);
      }

      // 2. Buscar Atividade Diária do Dia Selecionado
      const { data: atividadeHoje } = await supabase
        .from('atividades_diárias')
        .select('id, descricao')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('data', dataAula)
        .maybeSingle();

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
          .select('aluno_id, valor')
          .in('atividade_id', ativIds);

        if (dataVistosGerais) {
          const stats: Record<string, number> = {};
          dataVistosGerais.forEach(v => {
            let peso = 0;
            const val = String(v.valor).trim();
            if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
            else if (val === '0.5' || val === 'half') peso = 0.5;
            else if (!isNaN(parseFloat(val))) {
                const num = parseFloat(val);
                peso = num > 1 ? num / 10 : num;
            }
            if (peso > 0) {
               const cleanId = String(v.aluno_id).trim();
               stats[cleanId] = (stats[cleanId] || 0) + peso;
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

              const somaNotas = detalheAvaliacoes.reduce((acc, curr) => acc + curr.nota, 0);
              
              const totalAtivCalculado = totalComHoje;
              const pesosVistoAluno = currentStats[cleanId] || 0;
              const maxVistosPoints = professor.config_visto_valor_total || 2.0;
              const notaVistoFinal = totalAtivCalculado > 0 ? (pesosVistoAluno / totalAtivCalculado) * maxVistosPoints : 0;

              breakdownObj[cleanId] = {
                  mediaFinal: somaNotas + notaVistoFinal,
                  notaVistos: notaVistoFinal,
                  valorMaximoVistos: maxVistosPoints,
                  avaliacoes: detalheAvaliacoes
              };
          });
      }
      setNotasDetalhes(breakdownObj);

      setLoading(false);
    }
    
    if (turmaId && disciplinaId) {
      fetchData();
    }
  }, [professor.id, turmaId, disciplinaId, bimestreId, dataAula]);

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

    if (pesoAntigo !== pesoNovo) {
      const newVistosCount = Math.max(0, (estatisticasVistos[alunoId] || 0) - pesoAntigo + pesoNovo);
      setEstatisticasVistos(prev => ({
        ...prev,
        [alunoId]: newVistosCount
      }));
      
      let newTotal = totalAtividades;
      if (totalAtividades === 0 && pesoNovo > 0) {
        setTotalAtividades(1);
        newTotal = 1;
      }

      setNotasDetalhes(prev => {
        const studentBreakdown = prev[alunoId];
        if (!studentBreakdown) return prev;
        
        const maxVistosPoints = professor.config_visto_valor_total || 2.0;
        const newNotaVisto = newTotal > 0 ? (newVistosCount / newTotal) * maxVistosPoints : 0;
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

      // Atualiza também o mapa local de vistos do dia para persistência imediata
      setVistosDoDia(prev => ({
          ...prev,
          [alunoId]: novoValor || ''
      }));
    }
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
                 <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-red-700' : 'text-red-500'}`}>Crítico (&lt;39%)</span>
             </div>
          </div>

         <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black uppercase ${theme === 'light' ? 'text-blue-900' : 'text-ms-main'}`}>
                    {totalAtividades} Atividades no {bimestreId}º BIM
                </span>
                {showSuccess && (
                    <span className="text-[10px] font-bold text-green-500 animate-bounce">✓ Dados sincronizados com sucesso!</span>
                )}
            </div>
            
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
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-widest">
                  Aluno
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-widest w-24">
                  % Realizado
                </th>
                {professor.habilitar_chamada_interna && (
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-widest w-32">
                    Chamada
                  </th>
                )}
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-widest">
                  {bulkAtividades.length > 1
                    ? `Vistos por Atividade (${bulkAtividades.length} selecionadas)`
                    : `Lançar Visto (${professor.config_visto_metodo})`
                  }
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-widest w-40">
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
                  atividadeIdHoje={atividadeIdHoje}
                  onAtividadeCreated={handleAtividadeCreated}
                  bulkAtividades={bulkAtividades}
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
    </div>
  );
}
