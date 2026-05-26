import { useState, useEffect, useMemo, useRef } from 'react';
import type { Professor, ListaParaVistos } from '../types';
import { supabase } from '../lib/supabase';
import { Check, X, AlertTriangle, LogOut, Loader2, Plus, Minus } from 'lucide-react';
import { OcorrenciaModal } from './OcorrenciaModal';
import type { StudentGradeBreakdown } from './StudentList';
import { getBimestreFromDate } from '../utils/academicUtils';

interface StudentRowProps {
  aluno: ListaParaVistos;
  professor: Professor;
  dataAula: string;
  bimestreId: number;
  descricaoAtividade: string;
  atividadesRealizadas: number;
  totalAtividades: number;
  index: number;
  theme: 'dark' | 'light';
  onUpdateVisto: (alunoId: string, valorAntigo: string | null, novoValor: string | null) => void;
  initialVisto?: string;
  initialPresenca?: boolean;
  atividadeIdHoje: string | null;
  onAtividadeCreated?: (id: string) => void;
  bulkAtividades?: { id: string; data: string; descricao: string }[];
  bulkRefreshTrigger?: number;
  gradeBreakdown?: StudentGradeBreakdown;
  isLocked?: boolean;
}

export function StudentRow({ aluno, professor, dataAula, bimestreId, descricaoAtividade, atividadesRealizadas, totalAtividades, index, theme, onUpdateVisto, initialVisto, initialPresenca, atividadeIdHoje, onAtividadeCreated, bulkAtividades = [], bulkRefreshTrigger = 0, gradeBreakdown, isLocked = false }: StudentRowProps) {
  const [presenca, setPresenca] = useState<boolean | null>(initialPresenca ?? null);
  const [valorVisto, setValorVisto] = useState<string | null>(initialVisto ?? null);
  const [atividadeId, setAtividadeId] = useState<string | null>(atividadeIdHoje);
  
  const isPosterior = useMemo(() => {
    if (aluno.status !== 'Transferido' && aluno.status !== 'Remanejado' && aluno.status !== 'Cancelada') {
      return false;
    }
    const exitBim = getBimestreFromDate(aluno.atestado_inicio);
    return exitBim !== null && bimestreId > exitBim;
  }, [aluno.status, aluno.atestado_inicio, bimestreId]);

  const [isChamadaLoading, setIsChamadaLoading] = useState(false);
  const [isVistoLoading, setIsVistoLoading] = useState(false);

  // Estado para controles individuais por atividade no modo lote
  const [bulkVistos, setBulkVistos] = useState<Record<string, string | null>>({});
  const [bulkVistoLoading, setBulkVistoLoading] = useState<Record<string, boolean>>({});

  // Saida de sala state
  const [isFora, setIsFora] = useState(false);
  const [showDestinoMenu, setShowDestinoMenu] = useState(false);
  const [saidaId, setSaidaId] = useState<string | null>(null);
  const [isOcorrenciaOpen, setIsOcorrenciaOpen] = useState(false);

  // Ref para fechar o menu ao clicar fora
  const destinoMenuRef = useRef<HTMLDivElement>(null);
  const gradeBreakdownRef = useRef<HTMLDivElement>(null);

  const destinations = ['Banheiro', 'Coordenação', 'Direção', 'Bebedouro', 'Outro'];

  // ─── Controla o modal de Média Final ──────────────────────────────────────
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(false);

  useEffect(() => {
    if (!showGradeBreakdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (gradeBreakdownRef.current && !gradeBreakdownRef.current.contains(e.target as Node)) {
        setShowGradeBreakdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGradeBreakdown]);

  // Atualiza estados locais se as props iniciais mudarem (ex: mudança de data)
  useEffect(() => {
    setPresenca(initialPresenca ?? null);
    setValorVisto(initialVisto ?? null);
    setAtividadeId(atividadeIdHoje);
  }, [initialPresenca, initialVisto, atividadeIdHoje]);

  // ─── Fecha menu de saída ao clicar fora ───────────────────────────────────
  useEffect(() => {
    if (!showDestinoMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (destinoMenuRef.current && !destinoMenuRef.current.contains(e.target as Node)) {
        setShowDestinoMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDestinoMenu]);

  // ─── Bug Fix 1: Chamada — delete + insert em vez de upsert sem onConflict ─
  const handleChamada = async (status: boolean) => {
    const alunoId = String(aluno.aluno_id).trim();

    // Clicou no mesmo estado → desmarca
    if (presenca === status) {
      setPresenca(null);
      setIsChamadaLoading(true);
      await supabase.from('chamadas').delete()
        .eq('aluno_id', alunoId)
        .eq('professor_id', professor.id)
        .eq('disciplina_id', aluno.disciplina_id)
        .eq('turma_id', aluno.turma_id)
        .eq('data_aula', dataAula);
      setIsChamadaLoading(false);
      return;
    }

    setPresenca(status);
    setIsChamadaLoading(true);

    // Exclui registro anterior do dia (se houver) antes de inserir novo
    await supabase.from('chamadas').delete()
      .eq('aluno_id', alunoId)
      .eq('professor_id', professor.id)
      .eq('disciplina_id', aluno.disciplina_id)
      .eq('turma_id', aluno.turma_id)
      .eq('data_aula', dataAula);

    const { error } = await supabase.from('chamadas').insert({
      aluno_id: alunoId,
      professor_id: professor.id,
      disciplina_id: aluno.disciplina_id,
      turma_id: aluno.turma_id,
      presenca: status,
      data_aula: dataAula
    });

    if (error) {
      console.error('Erro ao salvar chamada:', error);
      setPresenca(null); // reverte UI em caso de erro
    }

    setIsChamadaLoading(false);
  };

  // Carrega os vistos existentes para as atividades em lote sempre que a seleção muda ou refreshTrigger disparar
  useEffect(() => {
    if (bulkAtividades.length <= 1) { setBulkVistos({}); return; }
    const alunoId = String(aluno.aluno_id).trim();
    const ids = bulkAtividades.map(a => a.id);
    supabase.from('vistos_v2')
      .select('atividade_id, valor')
      .in('atividade_id', ids)
      .eq('aluno_id', alunoId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach(v => { map[v.atividade_id] = v.valor; });
          setBulkVistos(map);
        }
      });
  }, [bulkAtividades, aluno.aluno_id, bulkRefreshTrigger]);

  // Salva visto individual de uma atividade específica (modo lote)
  const handleBulkVistoAction = async (ativId: string, valor: string) => {
    setBulkVistoLoading(prev => ({ ...prev, [ativId]: true }));
    const alunoId = String(aluno.aluno_id).trim();
    const prevVal = bulkVistos[ativId] ?? null;
    const newVal = prevVal === valor ? null : valor; // toggle

    setBulkVistos(prev => ({ ...prev, [ativId]: newVal }));

    await supabase.from('vistos_v2').delete()
      .eq('atividade_id', ativId)
      .eq('aluno_id', alunoId);

    if (newVal !== null && newVal !== '') {
      await supabase.from('vistos_v2').insert({
        atividade_id: ativId,
        aluno_id: alunoId,
        valor: newVal
      });
    }

    setBulkVistoLoading(prev => ({ ...prev, [ativId]: false }));
    onUpdateVisto(aluno.aluno_id, prevVal, newVal);
  };

  const handleMarkAllIndividual = async () => {
    if (isPosterior || isLocked) return;
    
    setIsVistoLoading(true);
    const defaultVal = professor.config_visto_metodo === 'ponto' ? '.' : 
                       professor.config_visto_metodo === 'simbolico' ? '+' : 
                       professor.config_visto_metodo === 'gradual' ? '1.0' : '10';
    
    const alunoId = String(aluno.aluno_id).trim();
    const newBulkVistos = { ...bulkVistos };
    const inserts: any[] = [];
    const deletes: string[] = [];
    
    bulkAtividades.forEach(ativ => {
      const prevVal = bulkVistos[ativ.id];
      if (prevVal !== defaultVal) {
        newBulkVistos[ativ.id] = defaultVal;
        inserts.push({
          atividade_id: ativ.id,
          aluno_id: alunoId,
          valor: defaultVal
        });
        deletes.push(ativ.id);
        
        onUpdateVisto(aluno.aluno_id, prevVal ?? null, defaultVal);
      }
    });
    
    if (inserts.length > 0) {
      setBulkVistos(newBulkVistos);
      await supabase.from('vistos_v2').delete()
        .in('atividade_id', deletes)
        .eq('aluno_id', alunoId);
      await supabase.from('vistos_v2').insert(inserts);
    }
    
    setIsVistoLoading(false);
  };

  const handleVistoAction = async (valor: string) => {
    if (!descricaoAtividade) {
        alert('Descreva a atividade no topo primeiro para poder lançar os vistos!');
        return;
    }
    setIsVistoLoading(true);
    const prevValor = valorVisto;
    const alunoId = String(aluno.aluno_id).trim();

    // Se clicar no mesmo valor, desmarca
    if (valorVisto === valor) {
        setValorVisto(null);
        if (atividadeId) {
            await supabase.from('vistos_v2').delete()
                .eq('atividade_id', atividadeId)
                .eq('aluno_id', alunoId);
            onUpdateVisto(aluno.aluno_id, prevValor, null);
        }
    } else {
        setValorVisto(valor);
        
        // ─── Garante que a atividade existe (SELECT-then-INSERT, sem depender de UNIQUE constraint) ───
        let currentAtividadeId = atividadeId;
        if (!currentAtividadeId) {
            // 1. Tenta encontrar atividade já existente para este professor/turma/data
            const { data: existing } = await supabase
                .from('atividades_diárias')
                .select('id')
                .eq('id_do_professor', professor.id)
                .eq('turma_id', aluno.turma_id)
                .eq('disciplina_id', aluno.disciplina_id)
                .eq('data', dataAula)
                .maybeSingle();

            if (existing) {
                // Atividade já existe (criada por outro row)
                currentAtividadeId = existing.id;
            } else {
                // 2. Não existe: cria nova
                const { data: newAtividade, error: ativError } = await supabase
                    .from('atividades_diárias')
                    .insert({
                        id_do_professor: professor.id,
                        professor_id: professor.id,
                        turma_id: aluno.turma_id,
                        disciplina_id: aluno.disciplina_id,
                        bimestre_id: bimestreId,
                        data: dataAula,
                        descricao: descricaoAtividade || 'Atividade lançada'
                    })
                    .select('id')
                    .single();

                if (ativError) {
                    // INSERT falhou (corrida entre rows) — tenta SELECT novamente
                    const { data: retry } = await supabase
                        .from('atividades_diárias')
                        .select('id')
                        .eq('id_do_professor', professor.id)
                        .eq('turma_id', aluno.turma_id)
                        .eq('disciplina_id', aluno.disciplina_id)
                        .eq('data', dataAula)
                        .maybeSingle();
                    if (retry) currentAtividadeId = retry.id;
                } else if (newAtividade) {
                    currentAtividadeId = newAtividade.id;
                }
            }

            if (currentAtividadeId) {
                setAtividadeId(currentAtividadeId);
                // Notifica StudentList para compartilhar este ID com todos os outros rows
                onAtividadeCreated?.(currentAtividadeId);
            }
        }

        if (currentAtividadeId) {
            // DELETE primeiro para evitar duplicatas (não depende de UNIQUE constraint)
            await supabase.from('vistos_v2').delete()
                .eq('atividade_id', currentAtividadeId)
                .eq('aluno_id', alunoId);

            const { error: vistoError } = await supabase.from('vistos_v2').insert({
                atividade_id: currentAtividadeId,
                aluno_id: alunoId,
                valor: valor
            });

            if (vistoError) {
                console.error('Erro ao salvar visto:', vistoError);
                setValorVisto(prevValor);
            } else {
                onUpdateVisto(aluno.aluno_id, prevValor, valor);
            }
        }
    }
    setIsVistoLoading(false);
  };

  // Cálculo do percentual em tempo real
  const percentual = useMemo(() => {
    const getPeso = (v: string | null) => {
        if (!v) return 0;
        const val = String(v).trim();
        if (val === '1.0' || val === '+' || val === '.' || val === 'checked') return 1.0;
        if (val === '0.5' || val === 'half') return 0.5;
        const num = parseFloat(val);
        if (isNaN(num)) return 0;
        return num > 1 ? num / 10 : num;
    };

    const pesoAntigo = getPeso(initialVisto || null);
    const pesoNovo = getPeso(valorVisto);
    const diff = pesoNovo - pesoAntigo;
    const realizadas = Math.max(0, atividadesRealizadas + diff);
    const total = totalAtividades;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((realizadas / total) * 100));
  }, [atividadesRealizadas, totalAtividades, valorVisto, initialVisto]);

  const pendente = 100 - percentual;

  const handleSaida = async (destino: string) => {
    setShowDestinoMenu(false);
    setIsFora(true);
    const { data } = await supabase.from('saidas_sala').insert({
      aluno_id: String(aluno.aluno_id).trim(),
      disciplina_id: aluno.disciplina_id,
      turma_id: aluno.turma_id,
      id_do_professor: professor.id,
      destino: destino,
      hora_saida: new Date().toISOString(),
      status: 'Fora'
    }).select('id').single();
    if (data) setSaidaId(data.id);
  };

  // ─── Bug Fix 2: Retorno funciona mesmo sem saidaId em memória ─────────────
  const handleRetorno = async () => {
    setIsFora(false);

    if (saidaId) {
      // Caso normal: temos o ID em memória
      await supabase.from('saidas_sala').update({
        hora_retorno: new Date().toISOString(),
        status: 'Retornou'
      }).eq('id', saidaId);
      setSaidaId(null);
    } else {
      // Fallback: busca o registro "Fora" mais recente deste aluno no banco
      const { data } = await supabase.from('saidas_sala')
        .select('id')
        .eq('aluno_id', String(aluno.aluno_id).trim())
        .eq('status', 'Fora')
        .order('hora_saida', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        await supabase.from('saidas_sala').update({
          hora_retorno: new Date().toISOString(),
          status: 'Retornou'
        }).eq('id', data.id);
      }
    }
  };

  return (
    <>
      <tr className={`transition-all duration-200 border-b border-ms-border/30 bg-[var(--bg-row-even)] ${
        index % 2 !== 0 ? 'bg-[var(--bg-row-odd)]' : ''
      } ${isFora ? 'bg-amber-900/10' : 'hover:bg-ms-dark/5'}`}>
        <td className="px-6 py-5 whitespace-nowrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-base flex-shrink-0 border border-blue-500/20 shadow-sm">
              {aluno.aluno_numero || aluno.aluno_nome?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-black tracking-tight uppercase ${
                  aluno.status === 'Transferido' || aluno.status === 'Remanejado'
                    ? 'line-through text-gray-500 opacity-60'
                    : theme === 'light' ? 'text-[#003366]' : 'text-ms-main'
                }`}>
                  {aluno.aluno_numero && <span className="text-ms-gold font-black mr-2">{aluno.aluno_numero}.</span>}
                  {aluno.aluno_nome}
                </p>
                {aluno.status && aluno.status !== 'Ativo' && (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-normal ${
                    aluno.status === 'Transferido' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                    aluno.status === 'Remanejado' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    aluno.status === 'Atestado' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {aluno.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {!isPosterior && (
                  percentual < 40 ? (
                    <span className="flex items-center gap-1 text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">CRÍTICO</span>
                  ) : percentual <= 59 ? (
                    <span className="flex items-center gap-1 text-[8px] font-black bg-yellow-500 text-white px-2 py-0.5 rounded-full">ALERTA</span>
                  ) : percentual <= 79 ? (
                    <span className="flex items-center gap-1 text-[8px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">BOM</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[8px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full">ÓTIMO</span>
                  )
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="px-6 py-5 text-center">
            <div className="inline-flex flex-col items-center gap-1">
                {isPosterior ? (
                  <span className="text-[11px] font-black text-gray-500 italic">N/A</span>
                ) : (
                  <>
                    <span className={`text-[11px] font-black ${
                      percentual >= 80 ? 'text-green-500' :
                      percentual >= 60 ? 'text-blue-500' :
                      percentual >= 40 ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                        {percentual}%
                    </span>
                    <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${
                          percentual >= 80 ? 'bg-green-500' :
                          percentual >= 60 ? 'bg-blue-500' :
                          percentual >= 40 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} style={{ width: `${percentual}%` }}></div>
                    </div>
                  </>
                )}

                {/* Grade Breakdown Trigger */}
                {gradeBreakdown && !isPosterior && (
                  <div className="relative mt-2" ref={gradeBreakdownRef}>
                    <button 
                      onClick={() => setShowGradeBreakdown(!showGradeBreakdown)}

                      className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                        gradeBreakdown.mediaFinal >= 6.0 
                          ? 'border-blue-500/30 text-blue-600 bg-blue-500/5 hover:bg-blue-500/10' 
                          : 'border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10'
                      }`}
                    >
                      <span className={`text-[8px] uppercase tracking-widest font-black opacity-70 mb-0.5 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Média</span>
                      <span className="text-sm leading-none font-black">{gradeBreakdown.mediaFinal.toFixed(1)}</span>
                    </button>

                    {/* Breakdown Modal/Popup */}
                    {showGradeBreakdown && (
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-56 rounded-2xl shadow-2xl z-[100] border p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 ${
                        theme === 'light' ? 'bg-white/95 border-gray-200 shadow-blue-900/10' : 'bg-ms-card/95 border-gray-700 shadow-black/50'
                      }`}>
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-b border-r ${
                          theme === 'light' ? 'bg-white border-gray-200' : 'bg-ms-card border-gray-700'
                        }`} />
                        <div className="relative z-10">
                          <p className={`text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-3 text-center ${
                            theme === 'light' ? 'text-gray-500 border-gray-100' : 'text-gray-400 border-gray-700'
                          }`}>
                            Composição da Média
                          </p>
                          <div className="space-y-3">
                            {gradeBreakdown.avaliacoes.map((av, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span className={`font-semibold ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>{av.nome}</span>
                                <span className="font-black text-blue-600">{av.nota.toFixed(1)} <span className="text-[9px] font-bold text-gray-400">/ {av.valorMaximo}</span></span>
                              </div>
                            ))}
                            <div className="flex justify-between items-center text-xs">
                              <span className={`font-semibold ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>Vistos na Rotina</span>
                              <span className="font-black text-blue-600">{gradeBreakdown.notaVistos.toFixed(1)} <span className="text-[9px] font-bold text-gray-400">/ {gradeBreakdown.valorMaximoVistos}</span></span>
                            </div>
                          </div>
                          <div className={`mt-4 pt-3 border-t flex justify-between items-center ${
                            theme === 'light' ? 'border-gray-100' : 'border-gray-700'
                          }`}>
                            <span className={`text-[11px] font-black uppercase ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Média Final</span>
                            <span className={`text-base font-black ${gradeBreakdown.mediaFinal >= 6.0 ? 'text-green-500' : 'text-red-500'}`}>
                              {gradeBreakdown.mediaFinal.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
        </td>
        
        {professor.habilitar_chamada_interna && (
          <td className="px-6 py-5 text-center">
             <div className="flex items-center justify-center gap-2">
                <button 
                  onClick={() => handleChamada(true)} 
                  disabled={isChamadaLoading || isLocked || isPosterior}
                  className={`p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    presenca === true 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-900/50 scale-110' 
                      : theme === 'light' 
                        ? 'bg-green-500/25 text-green-700 hover:bg-green-500/40' 
                        : 'bg-gray-800 text-blue-200 hover:bg-gray-700'
                  }`}
                >
                  {isChamadaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => handleChamada(false)} 
                  disabled={isChamadaLoading || isLocked || isPosterior}
                  className={`p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    presenca === false 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-900/50 scale-110' 
                      : theme === 'light' 
                        ? 'bg-red-500/25 text-red-700 hover:bg-red-500/40' 
                        : 'bg-gray-800 text-blue-200 hover:bg-gray-700'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
          </td>
        )}

        <td className="px-4 py-4 text-center">
            {bulkAtividades.length > 1 ? (
              // ── MODO LOTE: controles individuais por atividade ─────────────
              <div className="flex items-end gap-3 justify-center flex-wrap">
                {bulkAtividades.map(ativ => {
                  const [, month, day] = ativ.data.split('-');
                  const dateLabel = `${day}/${month}`;
                  const val = bulkVistos[ativ.id] ?? null;
                  const isLdg = bulkVistoLoading[ativ.id] ?? false;
                  const selectCls = `text-xs font-bold rounded border outline-none cursor-pointer transition-all focus:ring-2 focus:ring-blue-500 ${
                    theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-gray-900 border-gray-700 text-white'
                  }`;

                  return (
                    <div key={ativ.id} className="flex flex-col items-center gap-1 relative group/tooltip">
                      <span 
                        className={`text-[9px] font-black cursor-help transition-all hover:scale-105 ${theme === 'light' ? 'text-blue-700/70' : 'text-blue-400'}`}
                      >
                        {dateLabel}
                      </span>
                      {/* Tooltip Premium da Descrição da Atividade */}
                      <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:flex flex-col items-center z-[110] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                        <div className={`w-48 p-2.5 rounded-xl border shadow-2xl backdrop-blur-md text-left ${
                          theme === 'light' 
                            ? 'bg-white/95 border-blue-100 text-blue-900 shadow-blue-900/10' 
                            : 'bg-ms-card/95 border-gray-700 text-white shadow-black/50'
                        }`}>
                          <p className={`text-[8px] font-black uppercase tracking-widest border-b pb-1 mb-1.5 ${
                            theme === 'light' ? 'text-blue-600 border-blue-50' : 'text-ms-gold border-gray-700'
                          }`}>
                            Atividade — {dateLabel}
                          </p>
                          <p className={`text-[10px] leading-relaxed font-bold break-words whitespace-normal ${
                            theme === 'light' ? 'text-blue-950' : 'text-gray-200'
                          }`}>
                            {ativ.descricao || 'Sem descrição'}
                          </p>
                        </div>
                        <div className={`w-2.5 h-2.5 rotate-45 -mt-1.5 border-b border-r ${
                          theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-gray-700'
                        }`} />
                      </div>

                      {/* Ponto */}
                      {professor.config_visto_metodo === 'ponto' && (
                        <button
                          onClick={() => handleBulkVistoAction(ativ.id, '.')}
                          disabled={isLdg || isLocked || isPosterior}
                          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                            val === '.'
                              ? 'bg-blue-600 border-blue-400 scale-110 shadow-lg shadow-blue-900/40'
                              : theme === 'light' ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' : 'bg-gray-800 border-gray-600 hover:border-blue-500'
                          }`}
                        >
                          {isLdg
                            ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                            : <div className={`w-2.5 h-2.5 rounded-full ${val === '.' ? 'bg-white' : theme === 'light' ? 'bg-blue-400' : 'bg-blue-400'}`} />
                          }
                        </button>
                      )}

                      {/* Aberto */}
                      {professor.config_visto_metodo === 'aberto' && (
                        <input
                          type="number" min="0" max="10" step="0.1"
                          value={val || ''}
                          onChange={(e) => handleBulkVistoAction(ativ.id, e.target.value)}
                          disabled={isLdg || isLocked || isPosterior}
                          placeholder="0"
                          className={`w-12 text-center py-1 px-1 rounded border outline-none font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 ${
                            theme === 'light' ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-gray-900 border-gray-700 text-white'
                          }`}
                        />
                      )}

                      {/* Simbólico: + / - */}
                      {professor.config_visto_metodo === 'simbolico' && (
                        <select
                          value={val || ''}
                          onChange={(e) => handleBulkVistoAction(ativ.id, e.target.value)}
                          disabled={isLdg || isLocked || isPosterior}
                          className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed py-1 px-1 w-12`}
                        >
                          <option value="">—</option>
                          <option value="+">+</option>
                          <option value="-">−</option>
                        </select>
                      )}

                      {/* Gradual: 0 / 0.5 / 1.0 */}
                      {professor.config_visto_metodo === 'gradual' && (
                        <select
                          value={val || ''}
                          onChange={(e) => handleBulkVistoAction(ativ.id, e.target.value)}
                          disabled={isLdg || isLocked || isPosterior}
                          className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed py-1 px-1 w-14`}
                        >
                          <option value="">—</option>
                          <option value="0">0</option>
                          <option value="0.5">0,5</option>
                          <option value="1.0">1,0</option>
                        </select>
                      )}

                      {isLdg && professor.config_visto_metodo !== 'ponto' && (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                      )}
                    </div>
                  );
                })}
                
                {/* Botão Marcar Todos (Individual) */}
                {!isPosterior && !isLocked && bulkAtividades.length > 1 && (
                   <button
                     onClick={handleMarkAllIndividual}
                     disabled={isVistoLoading}
                     className={`ml-2 px-2 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-800 text-blue-400 hover:bg-gray-700'} disabled:opacity-50`}
                     title="Marcar todas as atividades para este aluno"
                   >
                     {isVistoLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Todos'}
                   </button>
                )}
              </div>
            ) : (
              // ── MODO NORMAL: visto da atividade do dia ──────────────────
              <div className="flex items-center justify-center gap-1">
                {professor.config_visto_metodo === 'gradual' && (
                    <div className="flex gap-1">
                        {['0', '0.5', '1.0'].map(v => (
                            <button key={v} onClick={() => handleVistoAction(v)} disabled={isLocked || isPosterior} className={`px-2 py-1.5 rounded-md text-[10px] font-black border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${valorVisto === v ? 'bg-blue-600 text-white border-blue-400' : theme === 'light' ? 'bg-blue-500/25 text-blue-700 border-blue-500/20' : 'bg-gray-800 text-blue-200 border-gray-700'}`}>{v}</button>
                        ))}
                    </div>
                )}
                {professor.config_visto_metodo === 'simbolico' && (
                    <div className="flex gap-1">
                        <button onClick={() => handleVistoAction('+')} disabled={isLocked || isPosterior} className={`p-2 rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${valorVisto === '+' ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/50' : theme === 'light' ? 'bg-blue-500/25 text-blue-700 border-blue-500/20' : 'bg-gray-800 text-blue-200 border-gray-700'}`}><Plus className="w-4 h-4" /></button>
                        <button onClick={() => handleVistoAction('-')} disabled={isLocked || isPosterior} className={`p-2 rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${valorVisto === '-' ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-900/50' : theme === 'light' ? 'bg-red-500/25 text-red-700 border-red-500/20' : 'bg-gray-800 text-blue-200 border-gray-700'}`}><Minus className="w-4 h-4" /></button>
                    </div>
                )}
                {professor.config_visto_metodo === 'ponto' && (
                    <button
                        onClick={() => handleVistoAction('.')}
                        disabled={isLocked || isPosterior}
                        className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                            valorVisto === '.'
                                ? 'bg-blue-600 text-white border-blue-400 scale-110 shadow-lg'
                                : theme === 'light'
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                                    : 'bg-gray-800 text-blue-200 border-gray-700'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${valorVisto === '.' ? 'bg-white' : theme === 'light' ? 'bg-blue-400' : 'bg-blue-300'}`}></div>
                    </button>
                )}
                {professor.config_visto_metodo === 'aberto' && (
                    <div className="relative w-20">
                        <input
                            type="number" min="0" max="10" step="0.1"
                            value={valorVisto || ''}
                            onChange={(e) => handleVistoAction(e.target.value)}
                            disabled={isLocked || isPosterior}
                            className={`w-full text-center p-2 rounded-lg border outline-none font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                theme === 'light'
                                    ? 'bg-blue-50 border-blue-100 text-blue-900 focus:ring-2 focus:ring-blue-500'
                                    : 'bg-gray-900 border-gray-700 text-white focus:ring-2 focus:ring-ms-gold'
                            }`}
                            placeholder="0.0"
                        />
                    </div>
                )}
                {isVistoLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500 ml-1" />}
              </div>
            )}
        </td>

        {/* ─── Ações: Ocorrência + Saída de Sala ─── */}
        <td className="px-6 py-4 whitespace-nowrap text-center">
          {/* relative aqui para o dropdown se posicionar corretamente */}
          <div className="relative flex items-center justify-center gap-2" ref={destinoMenuRef}>
            <button
              onClick={() => setIsOcorrenciaOpen(true)}
              disabled={isLocked}
              className="p-2.5 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (isFora) {
                  handleRetorno();
                } else {
                  setShowDestinoMenu(prev => !prev);
                }
              }}
              disabled={(isLocked && !isFora) || isPosterior}
              className={`p-2.5 rounded-lg border transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isFora
                  ? 'bg-amber-500 text-white border-amber-400'
                  : 'border-red-500/30 text-red-500 hover:bg-red-500/10'
              }`}
            >
              <LogOut className={`w-4 h-4 ${isFora ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown de destinos — fecha ao clicar fora via useEffect */}
            {showDestinoMenu && (
              <div className={`absolute right-0 top-full mt-2 w-44 rounded-xl shadow-2xl z-50 py-1.5 border ${
                theme === 'light'
                  ? 'bg-white border-blue-100'
                  : 'bg-ms-card border-gray-700'
              }`}>
                <p className={`px-4 pt-1 pb-2 text-[9px] font-black uppercase tracking-widest border-b mb-1 ${
                  theme === 'light' ? 'text-blue-400 border-blue-50' : 'text-blue-400 border-gray-700'
                }`}>Para onde foi?</p>
                {destinations.map(d => (
                  <button
                    key={d}
                    onClick={() => handleSaida(d)}
                    className={`block w-full text-left px-4 py-2 text-xs font-semibold transition-colors ${
                      theme === 'light'
                        ? 'text-blue-800 hover:bg-blue-50 hover:text-blue-900'
                        : 'text-blue-200 hover:bg-blue-600/20 hover:text-white'
                    }`}
                  >{d}</button>
                ))}
              </div>
            )}
          </div>
        </td>
      </tr>

      <OcorrenciaModal 
        isOpen={isOcorrenciaOpen}
        onClose={() => setIsOcorrenciaOpen(false)}
        alunoId={aluno.aluno_id}
        alunoNome={aluno.aluno_nome}
        professorId={professor.id}
        turmaId={aluno.turma_id}
        disciplinaId={aluno.disciplina_id}
        onSuccess={() => {}}
      />
    </>
  );
}
