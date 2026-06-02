import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Calendar, ClipboardList, AlertTriangle, LogOut, FileText, Loader2, ChevronRight, BookOpen, Activity, Clock, FileBadge, CheckCheck } from 'lucide-react';
import { AtaModal } from './AtaModal';
import { OcorrenciaModal } from './OcorrenciaModal';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  theme: 'dark' | 'light';
  bimestre?: number;
  isCoordinator?: boolean;
  professor?: any;
}

export function StudentProfileModal({ 
  isOpen, 
  onClose, 
  studentId, 
  studentName, 
  theme, 
  bimestre,
  isCoordinator = false,
  professor
}: StudentProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [vistos, setVistos] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [saidas, setSaidas] = useState<any[]>([]);
  const [atrasos, setAtrasos] = useState<any[]>([]);
  const [saidasAntecipadas, setSaidasAntecipadas] = useState<any[]>([]);
  const [atividadesPorDisciplina, setAtividadesPorDisciplina] = useState<Record<string, number>>({});
  
  // Atas e Ocorrências
  const [templates, setTemplates] = useState<any[]>([]);
  const [atasEmitidas, setAtasEmitidas] = useState<any[]>([]);
  const [showAtaMenu, setShowAtaMenu] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [selectedAtaEmitida, setSelectedAtaEmitida] = useState<any | null>(null);
  const [isOcorrenciaOpen, setIsOcorrenciaOpen] = useState(false);
  const [studentTurmaId, setStudentTurmaId] = useState<string>('');

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentData();
    }
  }, [isOpen, studentId, bimestre]);

  async function fetchStudentData() {
    setLoading(true);
    try {
      // 1. Fetch Vistos (Anotações)
      let queryVistos = supabase
        .from('vistos_v2')
        .select('*, atividade_id!inner(data, descricao, disciplinas(nome), professores!professor_id(nome), bimestre_id)')
        .eq('aluno_id', studentId);
      
      if (bimestre) {
        queryVistos = queryVistos.eq('atividade_id.bimestre_id', bimestre);
      }
      
      const { data: vistosData } = await queryVistos.order('atividade_id(data)', { ascending: false });
      
      if (vistosData) setVistos(vistosData);

      // 2. Fetch Ocorrências (busca em duas etapas para contornar falta de FK relacional no banco)
      const { data: ocorrenciasData } = await supabase
        .from('ocorrências')
        .select('*')
        .eq('aluno_id', studentId)
        .order('data', { ascending: false });
      
      if (ocorrenciasData && ocorrenciasData.length > 0) {
        const profIds = [...new Set(ocorrenciasData.map(o => o.id_do_professor).filter(Boolean))];
        if (profIds.length > 0) {
          const { data: profsData } = await supabase
            .from('professores')
            .select('id, nome, cargo')
            .in('id', profIds);
          
          if (profsData) {
            const profsMap = new Map(profsData.map(p => [p.id, p]));
            const ocorrenciasComProf = ocorrenciasData.map(o => {
              if (o.id_do_professor && profsMap.has(o.id_do_professor)) {
                return {
                  ...o,
                  professores: profsMap.get(o.id_do_professor)
                };
              }
              return o;
            });
            setOcorrencias(ocorrenciasComProf);
          } else {
            setOcorrencias(ocorrenciasData);
          }
        } else {
          setOcorrencias(ocorrenciasData);
        }
      } else {
        setOcorrencias([]);
      }

      // 3. Fetch Saídas de Sala
      const { data: saidasData } = await supabase
        .from('saidas_sala')
        .select('*')
        .eq('aluno_id', studentId)
        .order('data', { ascending: false });
      
      if (saidasData) setSaidas(saidasData);

      // 3b. Fetch Atrasos (nova tabela)
      const { data: atrasosData } = await supabase
        .from('atrasos')
        .select('*')
        .eq('aluno_id', studentId)
        .order('created_at', { ascending: false });
      if (atrasosData) setAtrasos(atrasosData);

      // 3c. Fetch Saídas Antecipadas
      const { data: saidasAntData } = await supabase
        .from('saidas_antecipadas')
        .select('*')
        .eq('aluno_id', studentId)
        .order('created_at', { ascending: false });
      if (saidasAntData) setSaidasAntecipadas(saidasAntData);

      // 4. Fetch Atividades Diárias da Turma para cálculo de desempenho
      const { data: alunoInfo } = await supabase.from('alunos').select('turma_id').eq('id', studentId).single();
      if (alunoInfo?.turma_id) {
          setStudentTurmaId(alunoInfo.turma_id);
          let queryAtivs = supabase
              .from('atividades_diárias')
              .select('id, disciplinas(nome)')
              .eq('turma_id', alunoInfo.turma_id);
          
          if (bimestre) {
              queryAtivs = queryAtivs.eq('bimestre_id', bimestre);
          }
          
          const { data: atividadesData } = await queryAtivs;
          
          if (atividadesData) {
              const contagem: Record<string, number> = {};
              atividadesData.forEach((a: any) => {
                  const discNome = a.disciplinas?.nome;
                  if (discNome) {
                      contagem[discNome] = (contagem[discNome] || 0) + 1;
                  }
              });
              setAtividadesPorDisciplina(contagem);
          }
      }

      // 5. Fetch Templates e Atas Emitidas
      const { data: templatesData } = await supabase.from('atas_templates').select('*');
      if (templatesData) setTemplates(templatesData);

      const { data: atasData } = await supabase.from('atas_alunos').select('*').eq('aluno_id', String(studentId).trim());
      if (atasData) setAtasEmitidas(atasData);

    } catch (err) {
      console.error('Error fetching student profile data:', err);
    } finally {
      setLoading(false);
    }
  }

  function calculateExitDuration(saidaStr: string, retornoStr: string): number {
    if (!saidaStr || !retornoStr) return 0;
    try {
      let hS, mS, hR, mR;
      
      if (saidaStr.includes('T')) {
          const dS = new Date(saidaStr);
          hS = dS.getHours(); mS = dS.getMinutes();
      } else {
          const parts = saidaStr.split(':');
          hS = Number(parts[0]); mS = Number(parts[1]);
      }
      
      if (retornoStr.includes('T')) {
          const dR = new Date(retornoStr);
          hR = dR.getHours(); mR = dR.getMinutes();
      } else {
          const parts = retornoStr.split(':');
          hR = Number(parts[0]); mR = Number(parts[1]);
      }
      
      if (isNaN(hS) || isNaN(mS) || isNaN(hR) || isNaN(mR)) return 0;
      const diff = (hR * 60 + mR) - (hS * 60 + mS);
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return timeStr.substring(0, 5);
  };

  const totalMinutosFora = saidas.reduce((acc, s) => {
    return acc + calculateExitDuration(s.hora_saida || s.horario_saida, s.hora_retorno || s.horario_retorno);
  }, 0);

  const formatDuration = (mins: number) => {
    if (mins === 0) return '0 min';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}h ${remMins}min`;
    }
    return `${remMins} min`;
  };

  if (!isOpen) return null;

  // Calculos de Desempenho
  const vistosPorDisciplina: Record<string, number> = {};
  vistos.forEach((v: any) => {
     const disc = v.atividade_id?.disciplinas?.nome || v.atividade_id?.disciplina_nome;
     if (disc) {
         let peso = 0;
         const val = String(v.valor).trim();
         if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
         else if (val === '0.5' || val === 'half') peso = 0.5;
         else if (!isNaN(parseFloat(val))) {
             const num = parseFloat(val);
             peso = num > 1 ? num / 10 : num;
         }
         vistosPorDisciplina[disc] = (vistosPorDisciplina[disc] || 0) + peso;
     }
  });

  const todasDisciplinas = Object.keys(atividadesPorDisciplina).sort();
  const filterOcorrencias = ocorrencias.filter(o => !o.tipo?.toLowerCase().includes('atraso'));
  const filterAtrasos = ocorrencias.filter(o => o.tipo?.toLowerCase().includes('atraso'));

  return (
    <div className="fixed inset-0 z-[150] flex items-start sm:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-ms-card w-full max-w-5xl h-[100dvh] sm:h-[90vh] sm:rounded-[2.5rem] border-0 sm:border sm:border-ms-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="px-4 sm:px-8 py-3 sm:py-5 bg-gradient-to-r from-ms-blue/20 to-transparent border-b border-ms-border flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-ms-blue/20 flex items-center justify-center text-lg sm:text-xl font-black text-ms-blue border border-ms-blue/30 shadow-inner flex-shrink-0">
              {studentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-2xl font-black text-white tracking-tight leading-tight truncate">{studentName}</h2>
              <p className="text-[10px] text-[#004b93] dark:text-blue-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                <FileText className="w-3 h-3 text-ms-blue" /> Ficha do Estudante
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 relative">
            {isCoordinator && (
              <>
                <button
                  onClick={() => setIsOcorrenciaOpen(true)}
                  className="p-2 sm:px-4 sm:py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-900/30 transition-colors flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Registrar Ocorrência</span>
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowAtaMenu(!showAtaMenu)}
                    className="p-2 sm:px-4 sm:py-2.5 bg-ms-blue text-white font-bold rounded-xl text-sm shadow-lg shadow-ms-blue/30 hover:bg-ms-blue/90 transition-colors flex items-center gap-2"
                  >
                    <FileBadge className="w-4 h-4" />
                    <span className="hidden sm:inline">Criar Ata</span>
                  </button>
                  
                  {showAtaMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-ms-card rounded-xl shadow-2xl border border-gray-100 dark:border-ms-border overflow-hidden z-50">
                      <div className="p-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 pb-2 pt-1">Modelos Disponíveis</p>
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                               setSelectedTemplate(t);
                               setSelectedAtaEmitida(null);
                               setShowAtaMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-ms-border rounded-lg transition-colors flex items-center gap-2"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-500" /> {t.titulo}
                          </button>
                        ))}
                        {templates.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-500 font-medium">Nenhum modelo cadastrado.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <button onClick={onClose} className="p-2 sm:p-3 hover:bg-white/5 rounded-xl sm:rounded-2xl transition-all group">
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-8 sm:space-y-10 custom-scrollbar">
          {loading ? (
            <div className="h-full py-40 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-ms-blue mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando panorama escolar...</p>
            </div>
          ) : (
            <>
              {/* SEÇÃO 1: PAINEL SUPERIOR CONSOLIDADO (Desempenho + Métricas de Rotina) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Desempenho Acadêmico (7 cols) */}
                <div className="lg:col-span-7 bg-ms-dark/20 border-2 border-ms-blue/40 rounded-[2rem] p-6 shadow-lg shadow-ms-blue/5">
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-ms-blue" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Desempenho por Disciplina {bimestre ? `— ${bimestre}º Bimestre` : ''}
                    </h3>
                  </div>

                  {todasDisciplinas.length === 0 ? (
                    <p className="text-center py-10 text-gray-500 font-medium italic text-sm">Sem atividades acadêmicas registradas nesta turma.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                      {todasDisciplinas.map(disc => {
                        const totalAtiv = atividadesPorDisciplina[disc] || 0;
                        const acumulado = vistosPorDisciplina[disc] || 0;
                        const percentual = totalAtiv > 0 ? Math.min(100, Math.round((acumulado / totalAtiv) * 100)) : 0;
                        
                        let barColor = 'bg-red-500';
                        if (percentual >= 70) barColor = 'bg-green-500';
                        else if (percentual >= 40) barColor = 'bg-yellow-500';

                        return (
                          <div key={disc} className="bg-black/25 rounded-xl p-3 border border-ms-blue/30 flex flex-col justify-between hover:border-ms-blue/60 transition-all">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[11px] font-black text-white uppercase tracking-wide truncate max-w-[130px]" title={disc}>{disc}</span>
                              <span className="text-[11px] font-black text-ms-blue">{percentual}%</span>
                            </div>
                            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden shadow-inner mb-2">
                              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${percentual}%` }} />
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                              <span>Vistos: {acumulado.toFixed(1)}</span>
                              <span>Total: {totalAtiv}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Histórico de Atas Emitidas */}
                {atasEmitidas.length > 0 && (
                  <div className="lg:col-span-7 bg-white/5 border-2 border-white/10 rounded-[2rem] p-6 mt-4 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <FileBadge className="w-5 h-5 text-gray-400" />
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Atas Emitidas</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {atasEmitidas.map(ata => (
                        <button
                          key={ata.id}
                          onClick={() => {
                             const tmpl = templates.find(t => t.id === ata.template_id);
                             setSelectedTemplate(tmpl || { id: ata.template_id, titulo: ata.titulo, conteudo: '' });
                             setSelectedAtaEmitida(ata);
                          }}
                          className="bg-black/20 hover:bg-black/40 rounded-xl p-4 border border-white/5 text-left transition-colors flex items-start justify-between group"
                        >
                          <div>
                            <p className="text-sm font-bold text-white mb-1">
                              {ata.numero_sequencial ? `Ata Nº ${String(ata.numero_sequencial).padStart(3, '0')} - ` : ''}{ata.titulo}
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                              {ata.data_ata 
                                ? `Data: ${new Date(ata.data_ata + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                : `Criada em: ${new Date(ata.created_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          {ata.imagem_assinatura_url && (
                            <span className="bg-green-500/20 text-green-400 text-[9px] font-black uppercase px-2 py-1 rounded-md">Assinada</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Métricas de Rotina e Saída de Sala (5 cols) */}
                <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                  {/* Tempo Total Fora de Sala */}
                  <div className="col-span-2 bg-blue-500/5 border-2 border-blue-500/50 rounded-[2rem] p-6 flex flex-col justify-between h-full min-h-[120px] shadow-lg shadow-blue-500/5">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Tempo Fora de Sala</span>
                      <LogOut className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="mt-3">
                      <p className="text-3xl font-black text-blue-600 tracking-tight leading-none">
                        {formatDuration(totalMinutosFora)}
                      </p>
                      <p className="text-[10px] text-blue-800 font-bold mt-1 uppercase">Total acumulado em {saidas.length} saídas</p>
                    </div>
                  </div>

                  {/* Ocorrências */}
                  <div className="bg-red-500/5 border-2 border-red-500/50 rounded-2xl p-5 flex flex-col justify-between min-h-[105px] shadow-lg shadow-red-500/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Ocorrências</span>
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-red-600 leading-none">{filterOcorrencias.length}</p>
                      <p className="text-[9px] text-red-600 font-bold mt-1 uppercase">Eventos disciplinares</p>
                    </div>
                  </div>

                  {/* Atrasos */}
                  <div className="bg-orange-500/5 border-2 border-orange-500/50 rounded-2xl p-5 flex flex-col justify-between min-h-[105px] shadow-lg shadow-orange-500/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Atrasos</span>
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-2xl font-black text-orange-600 leading-none">{filterAtrasos.length + atrasos.length}</p>
                      <p className="text-[9px] text-orange-700 font-bold mt-1 uppercase">Entradas tardias</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* SEÇÃO 2: HISTÓRICO DE OCORRÊNCIAS DISCIPLINARES */}
              <div className="border-t border-ms-border/40 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center border-2 border-red-500/30">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Histórico de Ocorrências</h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">Eventos disciplinares do estudante</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filterOcorrencias.length === 0 ? (
                    <div className="p-8 text-center bg-ms-dark/10 rounded-2xl border-2 border-dashed border-gray-800">
                      <p className="text-xs text-gray-500 font-bold uppercase">Nenhuma ocorrência registrada para este estudante.</p>
                    </div>
                  ) : (
                    filterOcorrencias.map((o, i) => {
                      const isCoord = o.professores?.cargo === 'Coordenador' || 
                                      o.professores?.cargo === 'Diretor' || 
                                      o.professores?.cargo === 'Vice-Diretor' || 
                                      o.registrado_por_cargo === 'Coordenador' || 
                                      o.registrado_por_cargo === 'Diretor' || 
                                      o.registrado_por_cargo === 'Vice-Diretor';
                      
                      return (
                        <div key={i} className={`p-5 rounded-2xl border-2 flex gap-4 transition-all ${
                          isCoord 
                            ? 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40' 
                            : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                        }`}>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isCoord ? 'text-purple-400' : 'text-red-500'}`}>
                                  {o.tipo || 'Ocorrência Disciplinar'}
                                </span>
                                {isCoord && (
                                  <span className="bg-purple-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md animate-pulse">
                                    COORDENAÇÃO
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-gray-500">{new Date(o.data || o.data_registro || o.created_at || new Date()).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed font-bold">{o.descricao}</p>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 items-center text-[9px] font-bold uppercase">
                              <div className="text-gray-500 flex items-center gap-1.5">
                                <span>Registrado por:</span>
                                <span className="text-gray-400">
                                  {o.professores?.nome || o.registrado_por || 'Sistema'}
                                  {o.professores?.cargo || o.registrado_por_cargo ? ` (${o.professores?.cargo || o.registrado_por_cargo})` : ''}
                                </span>
                              </div>
                              
                              {isCoord ? (
                                <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <CheckCheck className="w-3 h-3" />
                                  <span>Processado pela Coordenação</span>
                                </div>
                              ) : o.visto_coordenador ? (
                                <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  <CheckCheck className="w-3 h-3" />
                                  <span>Visualizado pela Coordenação em {new Date(o.data_visualizacao_coordenador).toLocaleDateString('pt-BR')} às {new Date(o.data_visualizacao_coordenador).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  <Clock className="w-3 h-3" />
                                  <span>Aguardando leitura da Coordenação</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SEÇÃO 3: HISTÓRICO DE ATRASOS */}
              <div className="border-t border-ms-border/40 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border-2 border-orange-500/30">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Histórico de Atrasos</h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">Registros de entradas tardias na unidade escolar</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[...filterAtrasos.map((o: any) => ({ ...o, _source: 'ocorrencia' })), ...atrasos.map((a: any) => ({ ...a, _source: 'atraso' }))]
                    .sort((a,b) => new Date(b.data||b.created_at).getTime() - new Date(a.data||a.created_at).getTime())
                    .length === 0 ? (
                    <div className="p-8 text-center bg-ms-dark/10 rounded-2xl border-2 border-dashed border-gray-800">
                      <p className="text-xs text-gray-500 font-bold uppercase">Nenhum atraso registrado.</p>
                    </div>
                  ) : (
                    [...filterAtrasos.map((o: any) => ({ ...o, _source: 'ocorrencia' })), ...atrasos.map((a: any) => ({ ...a, _source: 'atraso' }))]
                      .sort((a,b) => new Date(b.data||b.created_at).getTime() - new Date(a.data||a.created_at).getTime())
                      .map((o, i) => (
                        <div key={i} className="p-4 bg-orange-500/5 rounded-2xl border-2 border-orange-500/20 hover:border-orange-500/40 transition-all">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Atraso de Entrada</span>
                            <span className="text-[10px] font-bold text-gray-500">{new Date(o.data||o.created_at||o.data_hora).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-sm text-gray-300 font-bold">{o.descricao || o.motivo || 'Entrada tardia.'}</p>
                          {o.responsavel && <p className="text-[10px] text-gray-500 mt-1">Responsável: <span className="text-gray-400">{o.responsavel}</span></p>}
                          <div className="mt-2 text-[9px] text-gray-600 uppercase font-black">
                            Registrado por: {o.professores?.nome || o.registrado_por || 'Sistema'}
                            {o.professores?.cargo || o.registrado_por_cargo ? ` (${o.professores?.cargo || o.registrado_por_cargo})` : ''}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* SEÇÃO 3b: SAÍDAS ANTECIPADAS */}
              <div className="border-t border-ms-border/40 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center border-2 border-red-500/30">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Saídas Antecipadas</h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">Saídas antes do término do período escolar</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {saidasAntecipadas.length === 0 ? (
                    <div className="p-8 text-center bg-ms-dark/10 rounded-2xl border-2 border-dashed border-gray-800">
                      <p className="text-xs text-gray-500 font-bold uppercase">Nenhuma saída antecipada registrada.</p>
                    </div>
                  ) : saidasAntecipadas.map((s, i) => (
                    <div key={i} className="p-4 bg-red-500/5 rounded-2xl border-2 border-red-500/20 hover:border-red-500/40 transition-all">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Saída Antecipada</span>
                        <span className="text-[10px] font-bold text-gray-500">{new Date(s.created_at||s.data_hora).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div><p className="text-[9px] text-gray-600 uppercase font-black">Responsável</p><p className="text-sm text-white font-bold">{s.nome_responsavel}</p></div>
                        {s.parentesco && <div><p className="text-[9px] text-gray-600 uppercase font-black">Parentesco</p><p className="text-sm text-white font-bold">{s.parentesco}</p></div>}
                        {s.documento_responsavel && <div><p className="text-[9px] text-gray-600 uppercase font-black">Documento</p><p className="text-xs text-gray-400">{s.documento_responsavel}</p></div>}
                      </div>
                      {s.assinatura_base64 && (
                        <div className="mt-2">
                          <p className="text-[9px] text-gray-600 uppercase font-black mb-1">✅ Assinatura Digital</p>
                          <img src={s.assinatura_base64} alt="Assinatura" className="h-12 border border-gray-700 rounded-lg bg-white p-1" />
                        </div>
                      )}
                      <div className="mt-2 text-[9px] text-gray-600 uppercase font-black">Registrado por: {s.registrado_por || 'Sistema'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 4: HISTÓRICO DE SAÍDAS DE SALA */}
              <div className="border-t border-ms-border/40 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border-2 border-orange-500/30">
                    <LogOut className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Histórico de Saídas de Sala</h3>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">Controle de saídas autorizadas durante as aulas</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {saidas.length === 0 ? (
                    <div className="p-8 text-center bg-ms-dark/10 rounded-2xl border-2 border-dashed border-gray-800">
                      <p className="text-xs text-gray-500 font-bold uppercase">Nenhuma saída de sala registrada.</p>
                    </div>
                  ) : (
                    saidas.map((s, i) => (
                      <div key={i} className="p-5 bg-orange-500/5 rounded-2xl border-2 border-orange-500/20 flex items-center justify-between hover:border-orange-500/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <LogOut className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white mb-0.5">{s.destino || s.motivo || 'Motivo não especificado'}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(s.data || s.hora_saida || new Date()).toLocaleDateString()} às {formatTime(s.hora_saida || s.horario_saida)}</p>
                          </div>
                        </div>
                        {s.hora_retorno || s.horario_retorno ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-0.5">Retornou em</span>
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-green-500" />
                              {formatTime(s.hora_retorno || s.horario_retorno)} ({calculateExitDuration(s.hora_saida || s.horario_saida, s.hora_retorno || s.horario_retorno)} min)
                            </span>
                          </div>
                        ) : (
                          <span className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider">Ausente</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-3 sm:py-4 bg-ms-dark/30 border-t border-ms-border flex justify-end flex-shrink-0">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Relatório Consolidado • Sistema de Gestão Escolar</p>
        </div>
      </div>

      {selectedTemplate && (
        <AtaModal
          aluno={{ id: studentId, aluno_id: studentId, nome: studentName } as any}
          template={selectedTemplate}
          ataExistente={selectedAtaEmitida}
          bimestreAtual={bimestre || 1}
          onClose={() => {
            setSelectedTemplate(null);
            setSelectedAtaEmitida(null);
          }}
          onUploadSuccess={() => {
            fetchStudentData(); // Recarrega para mostrar a ata no histórico
          }}
        />
      )}

      {isOcorrenciaOpen && (
        <OcorrenciaModal
          isOpen={isOcorrenciaOpen}
          onClose={() => setIsOcorrenciaOpen(false)}
          alunoId={studentId}
          alunoNome={studentName}
          professorId={professor?.id || ''}
          turmaId={studentTurmaId}
          disciplinaId={null}
          onSuccess={() => {
            fetchStudentData(); // Recarrega para mostrar a ocorrência no histórico
          }}
          isCoordinator={true}
          professorName={professor?.nome || ''}
          professorCargo={professor?.cargo || ''}
        />
      )}
    </div>
  );
}
