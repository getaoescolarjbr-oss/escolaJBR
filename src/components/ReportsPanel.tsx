import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, ListaParaVistos } from '../types';
import { AlertCircle, Printer, Settings2, Users, Calculator, ArrowLeft } from 'lucide-react';
import { autoUpdateExpiredAbsences } from '../utils/studentUtils';
import { arredondarNotaMS, getCorGradiente, estaAprovado, getBimestreFromDate } from '../utils/academicUtils';
import { MatriculaModal } from './MatriculaModal';
import { ExameFinalPanel } from './ExameFinalPanel';
import { printReport } from '../utils/printUtils';

interface ReportsPanelProps {
  professor: Professor;
  turmaId: string;
  disciplinaId: string;
  bimestreId: number;
  theme: 'dark' | 'light';
  isLocked?: boolean;
}

export function ReportsPanel({ professor, turmaId, disciplinaId, bimestreId, theme, isLocked = false }: ReportsPanelProps) {
  const [alunos, setAlunos] = useState<ListaParaVistos[]>([]);
  const [stats, setStats] = useState<Record<string, { totalVistos: number; totalAtiv: number; media: number; bimestreEntrada: number }>>({});
  const [loading, setLoading] = useState(true);
  
  // Estados para o Painel de Desempenho Anual
  const [reportTab, setReportTab] = useState<'bimestral' | 'anual'>(bimestreId === 5 ? 'anual' : 'bimestral');
  // Exame Final não tem "bimestre" pra comparar — só o menu de Desempenho Anual
  // faz sentido aqui, com um botão pra abrir o lançamento das notas do exame.
  const [mostrarLancamentoExame, setMostrarLancamentoExame] = useState(false);
  const [statsAnual, setStatsAnual] = useState<Record<string, {
    b1: number;
    b2: number;
    b3: number;
    b4: number;
    soma: number;
    mediaAnual: number;
    mediaAnualOriginal?: number;
    aprovado: boolean;
    bimestreEntrada: number;
    exitBim: number | null;
    status?: string;
  }>>({});
  const [loadingAnual, setLoadingAnual] = useState(false);
  
  // Modal de Matrícula
  const [selectedAluno, setSelectedAluno] = useState<{ id: string; nome: string } | null>(null);

  // Refs para impressão
  const tableAnualRef = useRef<HTMLTableElement>(null);
  const tableBimestralRef = useRef<HTMLDivElement>(null);

  const fetchReportData = async () => {
    setLoading(true);
    
    // 1. Buscar Alunos da Turma (Fonte de Dados Oficial)
    const { data: dataAlunos } = await supabase
      .from('alunos')
      .select('*')
      .eq('turma_id', turmaId)
      .order('aluno_numero');
    
    if (!dataAlunos) return;
    
    const mapped = dataAlunos.map(a => ({
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
    setAlunos(mapped as any);

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

    const alunoIds = dataAlunos.map(a => a.id);

    // 2. Buscar Informação de Matrícula
    const { data: dataMatricula } = await supabase
      .from('matricula_info')
      .select('*')
      .in('aluno_id', alunoIds);

    // 3. Buscar Atividades do Bimestre
    const { data: atividades } = await supabase
      .from('atividades_diárias')
      .select('id')
      .eq('id_do_professor', professor.id)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', disciplinaId)
      .eq('bimestre_id', bimestreId);
    
    const ativIds = atividades?.map(a => a.id) || [];
    const totalAtiv = ativIds.length;

    // 4. Buscar Vistos Realizados (apenas se houver atividades)
    let vistos: any[] = [];
    if (ativIds.length > 0) {
        const { data: dataVistos } = await supabase
          .from('vistos_v2')
          .select('aluno_id, valor')
          .in('atividade_id', ativIds);
        vistos = dataVistos || [];
    }

    // 5. Buscar Médias (Notas)
    const { data: avaliacoes } = await supabase
      .from('avaliacoes')
      .select('id, nome')
      .eq('professor_id', professor.id)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', disciplinaId)
      .eq('bimestre_id', bimestreId);

    const avalIds = avaliacoes?.map(a => a.id) || [];
    // RAV é recuperação: substitui a média do bimestre quando é maior, não soma junto
    // com o resto (ver mesma regra em GradesPanel.tsx).
    const ravAvalId = avaliacoes?.find(a => a.nome === 'RAV')?.id;
    let notas: any[] = [];
    if (avalIds.length > 0) {
        const { data: dataNotas } = await supabase
          .from('notas_avaliacoes')
          .select('*')
          .in('avaliacao_id', avalIds);
        notas = dataNotas || [];
    }

    // Processar Tudo
    const newStats: Record<string, any> = {};
    mapped.forEach(aluno => {
      const currentAlunoId = String(aluno.aluno_id).trim();
      const matricula = dataMatricula?.find(m => String(m.aluno_id).trim() === currentAlunoId);
      const bimestreEntrada = matricula?.bimestre_entrada || 1;

      const vistosAluno = vistos?.filter(v => String(v.aluno_id).trim() === currentAlunoId && v.valor !== '0' && v.valor !== '-') || [];
      const notasAluno = notas?.filter(n => String(n.aluno_id).trim() === currentAlunoId) || [];
      const somaNotas = notasAluno.filter(n => n.avaliacao_id !== ravAvalId).reduce((acc, curr) => acc + (curr.nota || 0), 0);
      const notaRav = notasAluno.find(n => n.avaliacao_id === ravAvalId)?.nota;

      const pesosVisto = vistosAluno.reduce((acc, v) => {
          if (v.valor === '1.0' || v.valor === '+' || v.valor === '.') return acc + 1;
          if (v.valor === '0.5') return acc + 0.5;
          return acc;
      }, 0);
      const notaVistoFinal = totalAtiv > 0 ? (pesosVisto / totalAtiv) * (professor.config_visto_valor_total || 2.0) : 0;
      const mediaSemRav = somaNotas + notaVistoFinal;

      newStats[aluno.aluno_id] = {
          totalVistos: vistosAluno.length,
          totalAtiv: totalAtiv,
          media: notaRav !== undefined && notaRav > mediaSemRav ? notaRav : mediaSemRav,
          bimestreEntrada: bimestreEntrada
      };
    });

    setStats(newStats);
    setLoading(false);
  };

  const fetchAnualData = async () => {
    setLoadingAnual(true);
    try {
      const { data: dataAlunos } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .order('aluno_numero');
      
      if (!dataAlunos) return;

      const mapped = dataAlunos.map(a => ({
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
      setAlunos(mapped as any);

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

      const alunoIds = dataAlunos.map(a => a.id);

      const { data: dataMatricula } = await supabase
        .from('matricula_info')
        .select('*')
        .in('aluno_id', alunoIds);

      const { data: atividades } = await supabase
        .from('atividades_diárias')
        .select('id, bimestre_id')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId);
      
      const atividadesPorBimestre: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
      atividades?.forEach(a => {
        const bId = a.bimestre_id || 1;
        if (atividadesPorBimestre[bId]) {
          atividadesPorBimestre[bId].push(a.id);
        }
      });

      const allAtivIds = atividades?.map(a => a.id) || [];
      let vistos: any[] = [];
      if (allAtivIds.length > 0) {
        const { data: dataVistos } = await supabase
          .from('vistos_v2')
          .select('aluno_id, atividade_id, valor')
          .in('atividade_id', allAtivIds);
        vistos = dataVistos || [];
      }

      const { data: avaliacoes } = await supabase
        .from('avaliacoes')
        .select('id, bimestre_id, valor_maximo, nome')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId);

      const allAvalIds = avaliacoes?.map(a => a.id) || [];

      const avaliacoesPorBimestre: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
      // RAV é recuperação: substitui a média do bimestre quando é maior, não soma
      // junto com o resto (mesma regra em GradesPanel.tsx/fetchReportData acima).
      const ravAvalIdsPorBimestre: Record<number, string | undefined> = {};
      avaliacoes?.forEach(av => {
        const bId = av.bimestre_id || 1;
        if (avaliacoesPorBimestre[bId]) {
          avaliacoesPorBimestre[bId].push(av.id);
          if (av.nome === 'RAV') ravAvalIdsPorBimestre[bId] = av.id;
        }
      });

      let notas: any[] = [];
      if (allAvalIds.length > 0) {
        const { data: dataNotas } = await supabase
          .from('notas_avaliacoes')
          .select('aluno_id, avaliacao_id, nota')
          .in('avaliacao_id', allAvalIds);
        notas = dataNotas || [];
      }

      const newStatsAnual: Record<string, any> = {};
      mapped.forEach(aluno => {
        const currentAlunoId = String(aluno.aluno_id).trim();
        const matricula = dataMatricula?.find(m => String(m.aluno_id).trim() === currentAlunoId);
        const bimestreEntrada = matricula?.bimestre_entrada || 1;

        // Determinar o bimestre de saída (se houver)
        let exitBim: number | null = null;
        if (aluno.status === 'Transferido' || aluno.status === 'Remanejado' || aluno.status === 'Cancelada') {
          exitBim = getBimestreFromDate(aluno.atestado_inicio);
        }

        const mediasBimestrais: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

        for (let b = 1; b <= 4; b++) {
          if (b < bimestreEntrada) {
            mediasBimestrais[b] = 0;
            continue;
          }
          if (exitBim !== null && b > exitBim) {
            mediasBimestrais[b] = 0;
            continue;
          }

          const ativIdsBim = atividadesPorBimestre[b] || [];
          const totalAtivBim = ativIdsBim.length;
          let notaVistoFinal = 0;
          if (totalAtivBim > 0) {
            const vistosBim = vistos.filter(v => 
              String(v.aluno_id).trim() === currentAlunoId && 
              ativIdsBim.includes(v.atividade_id) &&
              v.valor !== '0' && v.valor !== '-'
            );
            const pesosVisto = vistosBim.reduce((acc, v) => {
              if (v.valor === '1.0' || v.valor === '+' || v.valor === '.') return acc + 1;
              if (v.valor === '0.5') return acc + 0.5;
              return acc;
            }, 0);
            notaVistoFinal = (pesosVisto / totalAtivBim) * (professor.config_visto_valor_total || 2.0);
          }

          const avalIdsBim = avaliacoesPorBimestre[b] || [];
          const ravAvalId = ravAvalIdsPorBimestre[b];
          let somaNotasBim = 0;
          let notaRavBim: number | undefined;
          if (avalIdsBim.length > 0) {
            const notasBimReal = notas.filter(n =>
              String(n.aluno_id).trim() === currentAlunoId &&
              avalIdsBim.includes(n.avaliacao_id)
            );
            somaNotasBim = notasBimReal.filter(n => n.avaliacao_id !== ravAvalId).reduce((acc, curr) => acc + (curr.nota || 0), 0);
            notaRavBim = notasBimReal.find(n => n.avaliacao_id === ravAvalId)?.nota;
          }

          const mediaBimSemRav = somaNotasBim + notaVistoFinal;
          mediasBimestrais[b] = arredondarNotaMS(notaRavBim !== undefined && notaRavBim > mediaBimSemRav ? notaRavBim : mediaBimSemRav);
        }

        const bimestresCursados = exitBim !== null
          ? Math.max(0, exitBim - bimestreEntrada + 1)
          : (4 - bimestreEntrada + 1);

        let soma = 0;
        const fimBim = exitBim !== null ? exitBim : 4;
        for (let b = bimestreEntrada; b <= fimBim; b++) {
          soma += mediasBimestrais[b];
        }

        const mediaAnualOriginal = bimestresCursados > 0 ? (soma / bimestresCursados) : 0;
        
        let mediaAnualArredondada = mediaAnualOriginal;
        let aprovado = false;
        
        if (mediaAnualOriginal >= 6.0) {
          aprovado = true;
        } else if (mediaAnualOriginal >= 5.875) {
          mediaAnualArredondada = 6.0;
          aprovado = true;
        }

        newStatsAnual[aluno.aluno_id] = {
          b1: mediasBimestrais[1],
          b2: mediasBimestrais[2],
          b3: mediasBimestrais[3],
          b4: mediasBimestrais[4],
          soma: soma,
          mediaAnual: mediaAnualArredondada,
          mediaAnualOriginal: mediaAnualOriginal,
          aprovado: aprovado,
          bimestreEntrada: bimestreEntrada,
          exitBim: exitBim,
          status: aluno.status
        };
      });

      setStatsAnual(newStatsAnual);
    } catch (e) {
      console.error("Erro ao carregar dados anuais:", e);
    } finally {
      setLoadingAnual(false);
    }
  };

  useEffect(() => {
    // Exame Final (bimestreId 5) não tem atividades/vistos bimestrais de verdade —
    // só o Desempenho Anual é exibido nesse caso, então não faz sentido buscar.
    if (turmaId && disciplinaId && bimestreId !== 5) {
      fetchReportData();
    } else if (bimestreId === 5) {
      setLoading(false);
    }
  }, [professor.id, turmaId, disciplinaId, bimestreId]);

  useEffect(() => {
    if (turmaId && disciplinaId && reportTab === 'anual') {
      fetchAnualData();
    }
  }, [professor.id, turmaId, disciplinaId, reportTab]);

  useEffect(() => {
    if (bimestreId === 5) setReportTab('anual');
  }, [bimestreId]);

  if (loading) return <div className="p-20 text-center text-gray-500">Gerando relatórios e analisando métricas...</div>;

  // Transferido/Remanejado/Cancelada não estão mais frequentando — não contam no
  // total da turma nem entram na triagem de "estado crítico" (senão apareceriam
  // sempre com 0% atividades / nota 0, mascarando quem realmente precisa de atenção).
  const alunosAtivos = alunos.filter(a => a.status !== 'Transferido' && a.status !== 'Remanejado' && a.status !== 'Cancelada');

  const alunosCriticos = alunosAtivos.filter(a => {
      const s = stats[a.aluno_id];
      if (!s) return false;
      const percRealizado = s.totalAtiv > 0 ? Math.round((s.totalVistos / s.totalAtiv) * 100) : 0;
      const notaBaixa = arredondarNotaMS(s.media) < 3.5;
      const atividadesBaixas = s.totalAtiv > 0 && percRealizado <= 35;
      return atividadesBaixas || notaBaixa;
  });

  return (
    <div className="space-y-8">
      {/* Sub-Navegação da Central de Relatórios — no Exame Final não existe "bimestre"
          pra comparar, então só o Desempenho Anual faz sentido aqui. */}
      {bimestreId !== 5 && (
        <div className={`flex p-1 rounded-xl w-fit ${
          theme === 'light' ? 'bg-blue-50/80 border border-blue-100/50' : 'bg-black/20'
        }`}>
            <button
              onClick={() => setReportTab('bimestral')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  reportTab === 'bimestral'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : theme === 'light'
                      ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/40'
                      : 'text-blue-200 hover:text-white'
              }`}
            >
                Desempenho do Bimestre
            </button>
            <button
              onClick={() => setReportTab('anual')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  reportTab === 'anual'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : theme === 'light'
                      ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/40'
                      : 'text-blue-200 hover:text-white'
              }`}
            >
                Desempenho Anual
            </button>
        </div>
      )}

      {bimestreId === 5 && mostrarLancamentoExame && (
        <button
          onClick={() => setMostrarLancamentoExame(false)}
          className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-blue-700 hover:text-blue-900' : 'text-blue-300 hover:text-white'}`}
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Desempenho Anual
        </button>
      )}

      {bimestreId === 5 && mostrarLancamentoExame ? (
        <ExameFinalPanel professor={professor} turmaId={turmaId} disciplinaId={disciplinaId} theme={theme} isLocked={isLocked} />
      ) : (
      <>
      {reportTab === 'anual' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {loadingAnual ? (
              <div className="p-20 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-xs text-gray-500 font-bold uppercase tracking-wider">Calculando médias de todos os bimestres...</p>
              </div>
            ) : (
              <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-xl border border-ms-border overflow-hidden`}>
                  <div className={`p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    theme === 'light' ? 'bg-[#e6f0ff] border-[#002677]/20' : 'bg-[#0a1a3a] border-[#002677]/30'
                  }`}>
                      <div>
                          <h3 className={`text-lg font-black uppercase tracking-widest ${theme === 'light' ? 'text-[#002677]' : 'text-[#93c5fd]'}`}>
                              Painel de Desempenho Anual
                          </h3>
                          <p className={`text-[10px] font-bold uppercase mt-1 ${theme === 'light' ? 'text-blue-800' : 'text-blue-300'}`}>
                              Acompanhamento das notas de cada bimestre, somatório e status de aprovação
                          </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${
                          theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-black/30 border-blue-900/30 text-blue-200'
                        }`}>
                           📌 Regra JBR: Média Anual ≥ 6.0
                        </div>
                        {bimestreId === 5 && (
                          <button
                            onClick={() => setMostrarLancamentoExame(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                          >
                            <Calculator className="w-3.5 h-3.5" /> Lançar Notas do Exame Final
                          </button>
                        )}
                        <button
                          onClick={() => printReport(tableAnualRef.current, {
                            title: 'Relatório de Desempenho Anual',
                            subtitle: 'Notas bimestrais, somatório e situação final',
                          })}
                          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                        >
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                      </div>
                  </div>
                  
                  {/* Mobile: cards empilhados com as notas em etiquetas que quebram linha —
                      mais confiável do que depender do usuário arrastar a tabela pro lado. */}
                  <div className="sm:hidden divide-y divide-ms-border/30">
                    {alunos.map((aluno, idx) => {
                      const s = statsAnual[aluno.aluno_id] || { b1: 0, b2: 0, b3: 0, b4: 0, soma: 0, mediaAnual: 0, aprovado: false, bimestreEntrada: 1, exitBim: null };
                      const bEntrada = s.bimestreEntrada || 1;
                      const bimestres = [
                        { n: 1, val: s.b1, na: bEntrada > 1 || (s.exitBim !== null && s.exitBim < 1) },
                        { n: 2, val: s.b2, na: bEntrada > 2 || (s.exitBim !== null && s.exitBim < 2) },
                        { n: 3, val: s.b3, na: bEntrada > 3 || (s.exitBim !== null && s.exitBim < 3) },
                        { n: 4, val: s.b4, na: s.exitBim !== null && s.exitBim < 4 },
                      ];
                      return (
                        <div key={aluno.aluno_id} className={`p-4 space-y-2.5 ${idx % 2 !== 0 ? (theme === 'light' ? 'bg-[#fcfdfe]' : 'bg-[#0d131f]') : ''}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${
                              aluno.status === 'Transferido' || aluno.status === 'Remanejado'
                                ? 'line-through text-gray-500 opacity-60'
                                : theme === 'light' ? 'text-blue-950' : 'text-white'
                            }`}>
                              <span className="text-[10px] font-black text-ms-gold mr-1">{idx + 1}.</span>
                              {aluno.aluno_nome}
                            </span>
                            {aluno.status && aluno.status !== 'Ativo' && (
                              <span className={`shrink-0 text-[8px] px-2 py-0.5 rounded-full font-black uppercase border tracking-normal ${
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
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {bimestres.map((b) => (
                              <span key={b.n} className={`px-2 py-1 rounded-lg text-[10px] font-black ${b.na ? 'bg-gray-500/10 text-gray-400 italic font-medium' : 'bg-ms-dark/40 text-ms-main'}`}>
                                {b.n}º BIM: {b.na ? 'N/A' : b.val.toFixed(1)}
                              </span>
                            ))}
                            <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-500/5 text-blue-500">
                              Soma: {s.soma.toFixed(1)}
                            </span>
                            <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-500/10" style={{ color: getCorGradiente(s.mediaAnual, theme) }}>
                              Média: {s.mediaAnual.toFixed(1)}
                            </span>
                          </div>

                          {aluno.status && aluno.status !== 'Ativo' && aluno.status !== 'Atestado' ? (
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                aluno.status === 'Transferido' ? 'bg-orange-500/15 text-orange-500 border border-orange-500/20' :
                                aluno.status === 'Remanejado' ? 'bg-purple-500/15 text-purple-500 border border-purple-500/20' :
                                'bg-red-500/15 text-red-500 border border-red-500/20'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  aluno.status === 'Transferido' ? 'bg-orange-500' :
                                  aluno.status === 'Remanejado' ? 'bg-purple-500' :
                                  'bg-red-500'
                                }`} />
                                {aluno.status}
                            </div>
                          ) : (
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                s.aprovado
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-red-500/15 text-red-500 border border-red-500/20'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.aprovado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {s.aprovado ? 'Aprovado' : 'Exame'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {alunos.length === 0 && (
                      <p className="py-10 text-center text-gray-500 text-xs italic">Nenhum aluno encontrado para esta turma.</p>
                    )}
                  </div>

                  <div className="hidden sm:block overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <table ref={tableAnualRef} className="w-full divide-y divide-ms-border/30">
                          <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'}>
                          <tr>
                               <th className={`px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest sticky left-0 z-10 border-r border-white/10 whitespace-nowrap ${
                                 theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'
                               }`}>Estudante</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">1º BIM</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">2º BIM</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">3º BIM</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">4º BIM</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap bg-blue-600/10">Somatório</th>
                              <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap bg-blue-600/20">Média Anual</th>
                              <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap bg-black/40">Status Final</th>
                          </tr>
                          </thead>
                          <tbody className="divide-y divide-ms-border/30">
                          {alunos.map((aluno, idx) => {
                               const s = statsAnual[aluno.aluno_id] || { b1: 0, b2: 0, b3: 0, b4: 0, soma: 0, mediaAnual: 0, aprovado: false, bimestreEntrada: 1, exitBim: null };
                               const bEntrada = s.bimestreEntrada || 1;

                               return (
                               <tr key={aluno.aluno_id} className={idx % 2 !== 0 ? 'bg-ms-dark/5' : ''}>
                                   <td className={`px-6 py-4 whitespace-nowrap sticky left-0 z-10 border-r border-ms-border/30 ${
                                     idx % 2 !== 0
                                       ? theme === 'light' ? 'bg-[#fcfdfe]' : 'bg-[#0d131f]'
                                       : theme === 'light' ? 'bg-white' : 'bg-[#0d1117]'
                                   }`}>
                                   <div className="flex items-center gap-3">
                                       <span className="text-[10px] font-black text-ms-gold">{idx + 1}.</span>
                                       <span className={`text-xs font-bold ${
                                         aluno.status === 'Transferido' || aluno.status === 'Remanejado'
                                           ? 'line-through text-gray-500 opacity-60'
                                           : theme === 'light' ? 'text-blue-950' : 'text-white'
                                       }`}>
                                         {aluno.aluno_nome}
                                         {aluno.status && aluno.status !== 'Ativo' && (
                                           <span className={`ml-2 text-[8px] px-2 py-0.5 rounded-full font-black uppercase border tracking-normal ${
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
                                   
                                   {/* Notas Bimestrais adaptadas à matrícula e saída */}
                                   <td className={`px-4 py-4 text-center text-xs font-black whitespace-nowrap ${(bEntrada > 1 || (s.exitBim !== null && s.exitBim < 1)) ? 'text-gray-400 italic font-medium' : ''}`}>
                                     {(bEntrada > 1 || (s.exitBim !== null && s.exitBim < 1)) ? 'N/A' : s.b1.toFixed(1)}
                                   </td>
                                   <td className={`px-4 py-4 text-center text-xs font-black whitespace-nowrap ${(bEntrada > 2 || (s.exitBim !== null && s.exitBim < 2)) ? 'text-gray-400 italic font-medium' : ''}`}>
                                     {(bEntrada > 2 || (s.exitBim !== null && s.exitBim < 2)) ? 'N/A' : s.b2.toFixed(1)}
                                   </td>
                                   <td className={`px-4 py-4 text-center text-xs font-black whitespace-nowrap ${(bEntrada > 3 || (s.exitBim !== null && s.exitBim < 3)) ? 'text-gray-400 italic font-medium' : ''}`}>
                                     {(bEntrada > 3 || (s.exitBim !== null && s.exitBim < 3)) ? 'N/A' : s.b3.toFixed(1)}
                                   </td>
                                   <td className={`px-4 py-4 text-center text-xs font-black whitespace-nowrap ${(s.exitBim !== null && s.exitBim < 4) ? 'text-gray-400 italic font-medium' : ''}`}>
                                     {(s.exitBim !== null && s.exitBim < 4) ? 'N/A' : s.b4.toFixed(1)}
                                   </td>

                                   {/* Somatório */}
                                   <td className="px-4 py-4 text-center text-xs font-black whitespace-nowrap bg-blue-500/5 text-blue-500">
                                     {s.soma.toFixed(1)}
                                   </td>

                                   {/* Média Anual */}
                                   <td className="px-4 py-4 text-center text-xs font-black whitespace-nowrap bg-blue-500/10" style={{ color: getCorGradiente(s.mediaAnual, theme) }}>
                                     {s.mediaAnual.toFixed(1)}
                                   </td>

                                   {/* Status de Aprovação */}
                                   <td className="px-6 py-4 text-center whitespace-nowrap">
                                       {aluno.status && aluno.status !== 'Ativo' && aluno.status !== 'Atestado' ? (
                                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                             aluno.status === 'Transferido' ? 'bg-orange-500/15 text-orange-500 border border-orange-500/20' :
                                             aluno.status === 'Remanejado' ? 'bg-purple-500/15 text-purple-500 border border-purple-500/20' :
                                             'bg-red-500/15 text-red-500 border border-red-500/20'
                                         }`}>
                                             <span className={`w-1.5 h-1.5 rounded-full ${
                                               aluno.status === 'Transferido' ? 'bg-orange-500' :
                                               aluno.status === 'Remanejado' ? 'bg-purple-500' :
                                               'bg-red-500'
                                             }`} />
                                             {aluno.status}
                                         </div>
                                       ) : (
                                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                             s.aprovado 
                                               ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20' 
                                               : 'bg-red-500/15 text-red-500 border border-red-500/20'
                                         }`}>
                                             <span className={`w-1.5 h-1.5 rounded-full ${s.aprovado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                             {s.aprovado ? 'Aprovado' : 'Exame'}
                                         </div>
                                       )}
                                   </td>
                               </tr>
                               );
                           })}
                          {alunos.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-gray-500 text-xs italic">Nenhum aluno encontrado para esta turma.</td>
                            </tr>
                          )}
                          </tbody>
                      </table>
                  </div>
              </div>
            )}
        </div>
      ) : (
        <>
          {/* Alertas Rápidos da Coordenação */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500 text-white rounded-lg shadow-lg shadow-red-900/40"><AlertCircle className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Alunos em Estado Crítico</h3>
                    <p className="text-[10px] text-red-400/60 uppercase font-black">Risco de evasão ou reprovação — atividades ≤35% e/ou nota &lt;3,5</p>
                    </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {alunosCriticos.map(a => {
                  const s = stats[a.aluno_id];
                  const perc = s && s.totalAtiv > 0 ? Math.round((s.totalVistos / s.totalAtiv) * 100) : null;
                  const nota = s ? arredondarNotaMS(s.media) : null;
                  return (
                    <div key={a.aluno_id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-red-500/20">
                      <span className="text-xs font-bold text-white">{a.aluno_nome}</span>
                      <div className="flex items-center gap-1.5">
                        {perc !== null && perc <= 35 && (
                          <span className="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded-full font-black shadow-lg">
                            {perc}% ativ.
                          </span>
                        )}
                        {nota !== null && nota < 3.5 && (
                          <span className="text-[9px] bg-red-700 text-white px-2 py-0.5 rounded-full font-black shadow-lg">
                            Nota {nota.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {alunosCriticos.length === 0 && <p className="text-xs text-gray-500 italic py-4">Nenhum aluno em estado crítico nesta disciplina.</p>}
              </div>
          </div>

          {/* Cartões Individuais - Reestilizados como Lista Vertical */}
          <div className="space-y-6">
            <div ref={tableBimestralRef} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg ${
                theme === 'light' ? 'bg-[#e6f4ea] border-[#34a853]/20' : 'bg-[#0a2e1a] border-[#34a853]/30'
            }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#34a853] text-white rounded-lg shadow-md shadow-[#1e5e2f]/40">
                      <Users className="w-5 h-5" />
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'light' ? 'text-[#1e5e2f]' : 'text-[#a7ffc4]'}`}>
                      Panorama de Desempenho - {alunosAtivos.length} Alunos
                  </h3>
                </div>
                <button
                  onClick={() => {
                    // Build simple table for bimestral print
                    const table = document.createElement('table');
                    const thead = document.createElement('thead');
                    thead.innerHTML = `<tr><th>Nº</th><th>Estudante</th><th>Média</th><th>Vistos</th><th>Status</th></tr>`;
                    const tbody = document.createElement('tbody');
                    alunosAtivos.forEach((aluno, idx) => {
                      const s = stats[aluno.aluno_id] || { totalVistos: 0, totalAtiv: 0, media: 0 };
                      const perc = s.totalAtiv > 0 ? Math.round((s.totalVistos / s.totalAtiv) * 100) : 0;
                      const ap = estaAprovado(s.media, 6);
                      const tr = document.createElement('tr');
                      tr.innerHTML = `<td>${idx+1}</td><td>${aluno.aluno_nome}</td><td>${arredondarNotaMS(s.media).toFixed(1)}</td><td>${perc}%</td><td style="color:${ap?'#16a34a':'#dc2626'};font-weight:900">${ap?'Aprovado':'Abaixo da Média'}</td>`;
                      tbody.appendChild(tr);
                    });
                    table.appendChild(thead);
                    table.appendChild(tbody);
                    printReport(table, {
                      title: `Relatório Bimestral — ${bimestreId}º Bimestre`,
                      subtitle: 'Médias e percentual de atividades realizadas',
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
            </div>

            <div className="flex flex-col gap-3">
                {alunos.map(aluno => {
                    const s = stats[aluno.aluno_id] || { totalVistos: 0, totalAtiv: 0, media: 0, bimestreEntrada: 1 };
                    const percRealizado = s.totalAtiv > 0 ? Math.round((s.totalVistos / s.totalAtiv) * 100) : 0;
                    // Transferido/Remanejado/Cancelada não conta mais como aluno ativo desta
                    // turma — risca o nome e mostra o status, independente de quando saiu, em
                    // vez de cair como "crítico" só porque não tem atividades/nota.
                    const isPosterior = aluno.status === 'Transferido' || aluno.status === 'Remanejado' || aluno.status === 'Cancelada';
                    const isCritico = !isPosterior && (percRealizado <= 35 || arredondarNotaMS(s.media) < 3.5);
                    // Não é veredito de aprovação (isso só existe no fim do ano, no Exame
                    // Final) — é só a posição da média em relação a 6, válida em qualquer
                    // bimestre.
                    const mediaArred = arredondarNotaMS(s.media);
                    const statusMedia: 'abaixo' | 'na_media' | 'acima' =
                      mediaArred < 6 ? 'abaixo' : mediaArred === 6 ? 'na_media' : 'acima';
                    const statusMediaLabel = { abaixo: 'Abaixo da Média', na_media: 'Na Média', acima: 'Acima da Média' }[statusMedia];
                    const statusMediaCor = { abaixo: 'text-red-400', na_media: 'text-yellow-500', acima: 'text-green-500' }[statusMedia];

                    return (
                        <div key={aluno.aluno_id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all hover:translate-x-1 ${
                            isCritico 
                                ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                                : theme === 'light' ? 'bg-white border-blue-50 hover:border-blue-200' : 'bg-ms-card border-ms-border hover:border-ms-blueText/30'
                        }`}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm border ${
                                    isCritico ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                }`}>
                                    {aluno.aluno_numero || aluno.aluno_nome.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold truncate ${
                                      isPosterior
                                        ? 'line-through text-gray-500 opacity-60'
                                        : theme === 'light' ? 'text-blue-950' : 'text-white'
                                    }`}>
                                        {aluno.aluno_nome}
                                        {isCritico && (
                                            <span className="ml-2 text-[8px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter animate-pulse">
                                                Crítico
                                            </span>
                                        )}
                                        {isPosterior && (
                                            <span className={`ml-2 text-[8px] px-2 py-0.5 rounded-full font-black uppercase border tracking-normal ${
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
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            Média: <span style={isPosterior ? {} : { color: getCorGradiente(s.media, theme) }}>{isPosterior ? 'N/A' : arredondarNotaMS(s.media).toFixed(1)}</span>
                                        </span>
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            Vistos: <span className={
                                              isPosterior ? 'text-gray-550' :
                                              percRealizado >= 80 ? 'text-green-500' :
                                              percRealizado >= 60 ? 'text-blue-500' :
                                              percRealizado >= 40 ? 'text-yellow-500' :
                                              'text-red-500'
                                            }>{isPosterior ? 'N/A' : `${percRealizado}%`}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mt-3 sm:mt-0 ml-14 sm:ml-0">
                                <div className="flex flex-col items-end">
                                    <span className={`text-[9px] font-black uppercase ${
                                      isPosterior
                                        ? aluno.status === 'Transferido' ? 'text-orange-400' : aluno.status === 'Remanejado' ? 'text-purple-400' : 'text-red-400'
                                        : statusMediaCor
                                    }`}>
                                        {isPosterior ? aluno.status : statusMediaLabel}
                                    </span>
                                    <span className="text-[8px] text-gray-500 font-bold uppercase">Status</span>
                                </div>
                                
                                <button 
                                    onClick={() => setSelectedAluno({ id: aluno.aluno_id, nome: aluno.aluno_nome })}
                                    className={`p-2 rounded-lg transition-all ${
                                        theme === 'light' ? 'bg-blue-50 text-blue-400 hover:text-blue-600 hover:bg-blue-100' : 'bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700'
                                    }`}
                                    title="Configurar Matrícula"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
        </>
      )}
      </>
      )}

      <MatriculaModal
        isOpen={!!selectedAluno}
        onClose={() => setSelectedAluno(null)}
        alunoId={selectedAluno?.id || ''}
        alunoNome={selectedAluno?.nome || ''}
        onUpdate={reportTab === 'bimestral' ? fetchReportData : fetchAnualData}
      />
    </div>
  );
}
