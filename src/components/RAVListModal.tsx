import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, ListaParaVistos } from '../types';
import { X, Printer, Sparkles, AlertCircle, FileText, CheckCircle2, AlertTriangle, HelpCircle, Save, Loader2, CheckCheck } from 'lucide-react';
import { arredondarNotaMS, getCorGradiente } from '../utils/academicUtils';
import { printReport } from '../utils/printUtils';
import { DecimalInput } from './DecimalInput';

interface RAVListModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  professor: Professor;
  turmaId: string;
  disciplinaId: string;
  bimestreId: number;
}

interface RAVStudentRow {
  aluno_id: string;
  aluno_nome: string;
  aluno_numero: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
  mediaSemestral: number;
  notaNecessariaSemestral: number;
  notaNecessariaAnual: number;
  elegivelSemestral: boolean;
  elegivelBimestral: boolean;
  notaRAV: number | null; // nota já lançada no RAV
}

export function RAVListModal({
  isOpen,
  onClose,
  theme,
  professor,
  turmaId,
  disciplinaId,
  bimestreId
}: RAVListModalProps) {
  const [loading, setLoading] = useState(true);
  const [alunos, setAlunos] = useState<RAVStudentRow[]>([]);
  const [ravMode, setRavMode] = useState<'bimestral' | 'semestral'>('bimestral');
  const [turmaNome, setTurmaNome] = useState('');
  const [disciplinaNome, setDisciplinaNome] = useState('');

  // Lançamento de notas RAV
  const [ravAvalId, setRavAvalId] = useState<string | null>(null);
  const [notasInput, setNotasInput] = useState<Record<string, string>>({});
  const [savingAluno, setSavingAluno] = useState<string | null>(null);
  const [savedAlunos, setSavedAlunos] = useState<Set<string>>(new Set());

  const printTableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      try {
        // 1. Carregar configuração do RAV
        const { data: ravConfig } = await supabase
          .from('landing_avisos')
          .select('*')
          .eq('titulo', 'RAV_CONFIG')
          .eq('cor_alerta', 'config')
          .maybeSingle();

        let activeMode: 'bimestral' | 'semestral' = 'bimestral';
        if (ravConfig && ravConfig.mensagem) {
          activeMode = ravConfig.mensagem.trim() as 'bimestral' | 'semestral';
        } else {
          const cached = localStorage.getItem('school-rav-mode') as 'bimestral' | 'semestral';
          if (cached) activeMode = cached;
        }
        setRavMode(activeMode);

        // 2. Buscar informações da turma e disciplina
        const { data: turmaData } = await supabase
          .from('turmas')
          .select('nome')
          .eq('id', turmaId)
          .maybeSingle();
        if (turmaData) setTurmaNome(turmaData.nome);

        const { data: discData } = await supabase
          .from('disciplinas')
          .select('nome')
          .eq('id', disciplinaId)
          .maybeSingle();
        if (discData) setDisciplinaNome(discData.nome);

        // 3. Buscar Alunos — excluir inativos (Transferido, Remanejado, Cancelada)
        const { data: dataAlunos } = await supabase
          .from('alunos')
          .select('*')
          .eq('turma_id', turmaId)
          .not('status', 'in', '("Transferido","Remanejado","Cancelada")')
          .order('aluno_numero');

        if (!dataAlunos) {
          setAlunos([]);
          setLoading(false);
          return;
        }

        // 4. Buscar todas as avaliações da classe para todos os 4 bimestres
        const { data: dataAval } = await supabase
          .from('avaliacoes')
          .select('*')
          .eq('professor_id', professor.id)
          .eq('turma_id', turmaId)
          .eq('disciplina_id', disciplinaId);

        // 5. Buscar todas as notas de avaliações
        let dataNotas: any[] = [];
        if (dataAval && dataAval.length > 0) {
          const avalIds = dataAval.map(a => a.id);
          const { data: fetchedNotas } = await supabase
            .from('notas_avaliacoes')
            .select('*')
            .in('avaliacao_id', avalIds);
          if (fetchedNotas) dataNotas = fetchedNotas;
        }

        // 6. Buscar todas as atividades diárias de todos os bimestres
        const { data: atividades } = await supabase
          .from('atividades_diárias')
          .select('id, bimestre_id')
          .eq('id_do_professor', professor.id)
          .eq('turma_id', turmaId)
          .eq('disciplina_id', disciplinaId);

        // 7. Buscar todos os vistos dessas atividades
        let vistosList: any[] = [];
        const ativIds = atividades?.map(a => a.id) || [];
        if (ativIds.length > 0) {
          const { data: fetchedVistos } = await supabase
            .from('vistos_v2')
            .select('*')
            .in('atividade_id', ativIds);
          if (fetchedVistos) vistosList = fetchedVistos;
        }

        // 8. Buscar ou criar avaliação de RAV para este bimestre
        let ravAvaliacaoId: string | null = null;
        const { data: existingRAV } = await supabase
          .from('avaliacoes')
          .select('id')
          .eq('professor_id', professor.id)
          .eq('turma_id', turmaId)
          .eq('disciplina_id', disciplinaId)
          .eq('bimestre_id', bimestreId)
          .eq('nome', 'RAV')
          .maybeSingle();

        if (existingRAV) {
          ravAvaliacaoId = existingRAV.id;
        } else {
          // Criar avaliação RAV com valor máximo = 10 (a nota do RAV substitui a média do bimestre)
          const { data: newRAV } = await supabase
            .from('avaliacoes')
            .insert({
              professor_id: professor.id,
              turma_id: turmaId,
              disciplina_id: disciplinaId,
              bimestre_id: bimestreId,
              nome: 'RAV',
              valor_maximo: 10,
              publicada: false
            })
            .select('id')
            .single();
          if (newRAV) ravAvaliacaoId = newRAV.id;
        }
        setRavAvalId(ravAvaliacaoId);

        // 9. Buscar notas de RAV já lançadas
        const notasRAVMap: Record<string, number> = {};
        if (ravAvaliacaoId) {
          const { data: notasRAVData } = await supabase
            .from('notas_avaliacoes')
            .select('aluno_id, nota')
            .eq('avaliacao_id', ravAvaliacaoId);
          if (notasRAVData) {
            notasRAVData.forEach(n => {
              notasRAVMap[String(n.aluno_id)] = n.nota;
            });
          }
        }

        // Mapear dados organizando por bimestre
        const processedRows: RAVStudentRow[] = dataAlunos.map(aluno => {
          const aId = String(aluno.id).trim();
          
          // Calcular a média de cada bimestre — retorna soma BRUTA (sem arredondamento)
          // O arredondamento ocorre apenas no display final, igual ao boletim.
          const calcularBimestre = (bNum: number): number => {
            // Filtrar avaliações deste bimestre
            const avalBimestre = dataAval?.filter(a => a.bimestre_id === bNum) || [];
            let somaAval = 0;
            
            avalBimestre.forEach(av => {
              const notaVal = dataNotas.find(n => n.aluno_id === aluno.id && n.avaliacao_id === av.id);
              if (notaVal) {
                somaAval += notaVal.nota;
              }
            });

            // Filtrar vistos deste bimestre
            const ativBimestre = atividades?.filter(a => a.bimestre_id === bNum) || [];
            const ativIdsBim = ativBimestre.map(a => a.id);
            
            let notaVisto = 0;
            if (ativIdsBim.length > 0) {
              const vistosBim = vistosList.filter(v => ativIdsBim.includes(v.atividade_id) && String(v.aluno_id).trim() === aId);
              let somaPesos = 0;
              
              vistosBim.forEach(v => {
                let peso = 0;
                const val = String(v.valor).trim();
                
                if (val === '1.0' || val === '+' || val === '.' || val === 'checked') peso = 1.0;
                else if (val === '0.5' || val === 'half') peso = 0.5;
                else if (!isNaN(parseFloat(val))) {
                  const num = parseFloat(val);
                  peso = num > 1 ? num / 10 : num;
                }
                
                somaPesos += peso;
              });

              const realizacao = somaPesos / ativIdsBim.length;
              const vistoValorMax = professor.config_visto_valor_total || 2.0;
              notaVisto = Number((realizacao * vistoValorMax).toFixed(2));
            }

            // Retorna a soma bruta — arredondamento feito apenas no display
            return somaAval + notaVisto;
          };

          const b1Raw = calcularBimestre(1);
          const b2Raw = calcularBimestre(2);
          const b3Raw = calcularBimestre(3);
          const b4Raw = calcularBimestre(4);

          // Arredondar apenas para exibição e comparações de elegibilidade
          const b1 = arredondarNotaMS(b1Raw);
          const b2 = arredondarNotaMS(b2Raw);
          const b3 = arredondarNotaMS(b3Raw);
          const b4 = arredondarNotaMS(b4Raw);

          // Determinar semestre correspondente ao bimestre ativo
          const isPrimeiroSemestre = bimestreId <= 2;
          const mediaSemestral = isPrimeiroSemestre ? (b1 + b2) / 2 : (b3 + b4) / 2;

          // ELEGIBILIDADE: usar valores arredondados (mesma visualização do professor no boletim)
          const activeBimGrade = bimestreId === 1 ? b1 : bimestreId === 2 ? b2 : bimestreId === 3 ? b3 : b4;
          const elegivelBimestral = activeBimGrade < 6.0;
          const elegivelSemestral = mediaSemestral < 6.0;
          
          // Fórmulas de Recuperação
          let notaNecessariaSemestral = 0;
          if (isPrimeiroSemestre) {
            notaNecessariaSemestral = Math.max(0, 12.0 - b1);
          } else {
            notaNecessariaSemestral = Math.max(0, 12.0 - b3);
          }

          // Projeção especial de aprovação anual para o B4 (24 pontos consolidados)
          let notaNecessariaAnual = 0;
          if (bimestreId === 4) {
            notaNecessariaAnual = Math.max(0, 24.0 - b1 - b2 - b3);
          }

          const notaRAV = notasRAVMap[aId] ?? null;

          return {
            aluno_id: aluno.id,
            aluno_nome: aluno.nome,
            aluno_numero: aluno.aluno_numero,
            b1, b2, b3, b4,
            mediaSemestral,
            notaNecessariaSemestral,
            notaNecessariaAnual,
            elegivelSemestral,
            elegivelBimestral,
            notaRAV
          };
        });

        // Filtrar alunos que precisam de RAV com base no modo ativo
        let filteredAlunos = processedRows;
        if (activeMode === 'bimestral') {
          filteredAlunos = processedRows.filter(a => a.elegivelBimestral);
        } else {
          filteredAlunos = processedRows.filter(a => {
            if (bimestreId === 4) {
              const totalJaAdquirido = a.b1 + a.b2 + a.b3;
              const precisaParaPassarDireto = 24.0 - totalJaAdquirido;
              return a.elegivelSemestral || precisaParaPassarDireto > a.b4;
            }
            return a.elegivelSemestral;
          });
        }

        setAlunos(filteredAlunos);

        // Inicializar inputs com notas já lançadas
        const inputsInit: Record<string, string> = {};
        filteredAlunos.forEach(a => {
          if (a.notaRAV !== null) inputsInit[a.aluno_id] = String(a.notaRAV);
        });
        setNotasInput(inputsInit);
        setSavedAlunos(new Set(filteredAlunos.filter(a => a.notaRAV !== null).map(a => a.aluno_id)));
      } catch (err) {
        console.error('Erro ao montar relatório de RAV:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, professor.id, turmaId, disciplinaId, bimestreId, professor.config_visto_valor_total]);

  if (!isOpen) return null;

  // Salvar nota RAV de um aluno
  async function handleSaveNotaRAV(alunoId: string) {
    if (!ravAvalId) return;
    const rawVal = notasInput[alunoId];
    const nota = parseFloat(String(rawVal).replace(',', '.'));
    if (isNaN(nota) || nota < 0 || nota > 10) {
      alert('Digite uma nota válida entre 0 e 10.');
      return;
    }
    setSavingAluno(alunoId);
    try {
      const { error } = await supabase
        .from('notas_avaliacoes')
        .upsert({ avaliacao_id: ravAvalId, aluno_id: alunoId, nota }, { onConflict: 'avaliacao_id,aluno_id' });
      if (error) throw error;
      setSavedAlunos(prev => new Set(prev).add(alunoId));
      // Atualiza o notaRAV localmente
      setAlunos(prev => prev.map(a => a.aluno_id === alunoId ? { ...a, notaRAV: nota } : a));
    } catch (err: any) {
      alert('Erro ao salvar nota RAV: ' + err.message);
    } finally {
      setSavingAluno(null);
    }
  }

  const handlePrint = () => {
    const isPrimeiroSemestre = bimestreId <= 2;
    const semName = isPrimeiroSemestre ? '1º Semestre (B1 + B2)' : '2º Semestre (B3 + B4)';
    
    printReport(printTableRef.current, {
      title: `RELATÓRIO RAV — RECUPERAR PARA AVANÇAR — ${ravMode.toUpperCase()}`,
      subtitle: `Bimestre Referência: ${bimestreId}º Bimestre — Regra: ${ravMode === 'bimestral' ? 'Média Bimestral < 6.0' : 'Média Semestral < 6.0'}`,
      info: [
        { label: 'Turma', value: turmaNome },
        { label: 'Disciplina', value: disciplinaNome },
        { label: 'Professor(a)', value: professor.nome },
        { label: 'Período Regulador', value: ravMode === 'bimestral' ? `${bimestreId}º Bimestre` : semName }
      ]
    });
  };

  const isPrimeiroSemestre = bimestreId <= 2;
  const activeSemName = isPrimeiroSemestre ? '1º Semestre' : '2º Semestre';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-6xl rounded-3xl overflow-hidden border shadow-2xl flex flex-col max-h-[90vh] ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
      } animate-in zoom-in duration-300`}>
        
        {/* Header */}
        <div className={`px-8 py-5 border-b flex items-center justify-between ${
          theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-ms-dark/30 border-ms-border'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ms-blue/20 flex items-center justify-center text-ms-blue border border-ms-blue/20">
              <Sparkles className="w-5 h-5 text-[#d4af37] animate-pulse" />
            </div>
            <div>
              <h2 className={`text-lg font-black tracking-tight ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>
                Alunos de RAV — Recuperar para Avançar
              </h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">
                Regra Escolar Ativa: <span className="text-ms-blue">{ravMode === 'bimestral' ? 'Bimestral' : 'Semestral'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2.5 rounded-full transition-colors ${
              theme === 'light' ? 'hover:bg-blue-100/50 text-blue-900' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          {/* Header Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50/30 border-blue-100/50' : 'bg-ms-dark/20 border-ms-border/40'}`}>
              <span className="block text-[8px] font-black uppercase text-gray-500 tracking-wider">Turma</span>
              <span className={`text-sm font-bold ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>{turmaNome || '—'}</span>
            </div>
            <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50/30 border-blue-100/50' : 'bg-ms-dark/20 border-ms-border/40'}`}>
              <span className="block text-[8px] font-black uppercase text-gray-500 tracking-wider">Disciplina</span>
              <span className={`text-sm font-bold ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>{disciplinaNome || '—'}</span>
            </div>
            <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50/30 border-blue-100/50' : 'bg-ms-dark/20 border-ms-border/40'}`}>
              <span className="block text-[8px] font-black uppercase text-gray-500 tracking-wider">Bimestre Referência</span>
              <span className={`text-sm font-bold text-ms-blue`}>{bimestreId}º Bimestre</span>
            </div>
            <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50/30 border-blue-100/50' : 'bg-ms-dark/20 border-ms-border/40'}`}>
              <span className="block text-[8px] font-black uppercase text-gray-500 tracking-wider">Total de Alunos de RAV</span>
              <span className="text-sm font-bold text-red-500">{alunos.length} alunos</span>
            </div>
          </div>

          {/* Guidebox explaining math projection */}
          <div className={`p-5 rounded-2xl border flex gap-4 text-xs leading-relaxed ${
            theme === 'light' ? 'bg-blue-50 border-blue-100 text-blue-900 shadow-sm' : 'bg-ms-dark/30 border-ms-border text-gray-400'
          }`}>
            <AlertCircle className="w-6 h-6 text-ms-blue flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-ms-blue block mb-1">Entenda as Regras Matemáticas das Projeções:</strong>
              {ravMode === 'bimestral' ? (
                <p>
                  No modelo **Bimestral**, todos os alunos que obtiveram média inferior a **6.0** no bimestre vigente ({bimestreId}º Bimestre) entram de RAV. A nota mínima exigida para recuperação é **6.0** para substituir ou complementar a nota original.
                </p>
              ) : (
                <div className="space-y-1">
                  <p>
                    No modelo **Semestral**, avaliamos a média consolidada do semestre ({activeSemName}). 
                    Os alunos com média semestral inferior a **6.0** precisam atingir uma nota específica no bimestre vigente para fechar o semestre com média 6,0.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 mt-2">
                    <li><strong>Nota Necessária Semestral (B{bimestreId}):</strong> {isPrimeiroSemestre ? `12.0 - B1` : `12.0 - B3`}. Esta é a nota necessária para alcançar média 6,0 no semestre.</li>
                    {bimestreId === 4 && (
                      <li>
                        <strong>Aprovação Anual Direta (Anual):</strong> <code className="bg-black/20 px-1 py-0.5 rounded text-emerald-400">24.0 - (B1 + B2 + B3)</code>. Mostra a nota necessária no 4º bimestre para que o aluno seja aprovado de forma direta no ano (atingindo 24 pontos totais), evitando o Exame Final.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Computando projeções e notas...</p>
            </div>
          ) : alunos.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-ms-border rounded-2xl bg-black/5">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className={`text-base font-black ${theme === 'light' ? 'text-blue-950' : 'text-white'}`}>Nenhum Aluno de RAV!</h3>
              <p className="text-xs text-gray-500 mt-1">Todos os estudantes obtiveram médias dentro da meta estabelecida.</p>
            </div>
          ) : (
            <div className={`border rounded-2xl shadow-xl overflow-hidden ${
              theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-dark border-ms-border'
            }`}>
              <div className="overflow-x-auto">
                {/* Print target table */}
                <table ref={printTableRef} className="min-w-full divide-y divide-ms-border/30">
                  <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'}>
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest border-r border-white/10">Nº / Aluno</th>
                      <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">B1</th>
                      <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">B2</th>
                      <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">B3</th>
                      <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">B4</th>
                      {ravMode === 'semestral' ? (
                        <>
                          <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-900/40">Média Semestral</th>
                          <th className="px-5 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-amber-600/30">Nota Necessária (B{bimestreId})</th>
                          {bimestreId === 4 && (
                            <th className="px-5 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-emerald-600/30">Aprovação Anual Direta</th>
                          )}
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-900/40">Média Bimestre</th>
                          <th className="px-5 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-amber-600/30">Nota Necessária RAV</th>
                        </>
                      )}
                      <th className="px-5 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-emerald-700/50">🎯 Nota RAV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ms-border/30">
                    {alunos.map((aluno, idx) => {
                      // Determine primary average
                      const mediaBimestralAtiva = bimestreId === 1 ? aluno.b1 : bimestreId === 2 ? aluno.b2 : bimestreId === 3 ? aluno.b3 : aluno.b4;
                      
                      return (
                        <tr key={aluno.aluno_id} className={idx % 2 !== 0 ? 'bg-ms-dark/5' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap border-r border-ms-border/30">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-ms-gold">{aluno.aluno_numero}.</span>
                              <span className={`text-xs font-bold ${theme === 'light' ? 'text-blue-950' : 'text-ms-main'}`}>
                                {aluno.aluno_nome}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-xs">{aluno.b1.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-bold text-xs">{aluno.b2.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-bold text-xs">{aluno.b3.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-bold text-xs">{aluno.b4.toFixed(1)}</td>
                          
                          {ravMode === 'semestral' ? (
                            <>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black`} style={{ backgroundColor: `${getCorGradiente(aluno.mediaSemestral, theme)}20`, color: getCorGradiente(aluno.mediaSemestral, theme) }}>
                                  {aluno.mediaSemestral.toFixed(1)}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center bg-amber-500/5">
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-black text-[#d4af37]">
                                    {aluno.notaNecessariaSemestral.toFixed(1)}
                                  </span>
                                  <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Pontos</span>
                                </div>
                              </td>
                              {bimestreId === 4 && (
                                <td className="px-5 py-4 text-center bg-emerald-500/5">
                                  {aluno.notaNecessariaAnual > 10 ? (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-black text-red-500">
                                        {aluno.notaNecessariaAnual.toFixed(1)}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black uppercase text-[7px] tracking-wider mt-1">Requer Exame Final</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-black text-emerald-400">
                                        {aluno.notaNecessariaAnual.toFixed(1)}
                                      </span>
                                      <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Pontos</span>
                                    </div>
                                  )}
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black`} style={{ backgroundColor: `${getCorGradiente(mediaBimestralAtiva, theme)}20`, color: getCorGradiente(mediaBimestralAtiva, theme) }}>
                                  {mediaBimestralAtiva.toFixed(1)}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center bg-amber-500/5">
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-black text-[#d4af37]">6.0</span>
                                  <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Média Escolar</span>
                                </div>
                              </td>
                            </>
                          )}

                          {/* Coluna de lançamento de nota RAV */}
                          <td className="px-4 py-3 bg-emerald-500/5">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="relative">
                                <DecimalInput
                                  value={notasInput[aluno.aluno_id] ?? ''}
                                  onChange={val => {
                                    setNotasInput(prev => ({ ...prev, [aluno.aluno_id]: String(val) }));
                                    setSavedAlunos(prev => { const s = new Set(prev); s.delete(aluno.aluno_id); return s; });
                                  }}
                                  max={10}
                                  disabled={savingAluno === aluno.aluno_id}
                                  className={`w-20 px-2 py-1.5 text-center text-sm font-black rounded-lg border outline-none transition-all ${
                                    savedAlunos.has(aluno.aluno_id)
                                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                      : theme === 'light'
                                        ? 'border-blue-200 bg-blue-50 text-blue-900 focus:ring-2 focus:ring-ms-blue'
                                        : 'border-ms-border bg-ms-dark text-white focus:ring-2 focus:ring-ms-blue'
                                  }`}
                                  placeholder="0.0"
                                />
                              </div>
                              <button
                                onClick={() => handleSaveNotaRAV(aluno.aluno_id)}
                                disabled={savingAluno === aluno.aluno_id || !notasInput[aluno.aluno_id]}
                                title="Salvar nota RAV"
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow disabled:opacity-40 ${
                                  savedAlunos.has(aluno.aluno_id)
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-ms-blue hover:bg-blue-500 text-white'
                                }`}
                              >
                                {savingAluno === aluno.aluno_id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : savedAlunos.has(aluno.aluno_id) ? (
                                  <CheckCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {/* Indicador se nota RAV aprova o aluno */}
                            {aluno.notaRAV !== null && (
                              <div className={`mt-1 text-center text-[8px] font-black uppercase tracking-wider ${
                                aluno.notaRAV >= 6.0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {aluno.notaRAV >= 6.0 ? '✓ Aprovado no RAV' : '✗ Abaixo da média'}
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
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-8 py-5 border-t flex justify-end items-center gap-4 ${
          theme === 'light' ? 'bg-blue-50/20 border-blue-100' : 'bg-ms-dark/30 border-ms-border'
        }`}>
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              theme === 'light' 
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || alunos.length === 0}
            className="flex items-center gap-2 px-8 py-3.5 bg-ms-blue hover:bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório RAV
          </button>
        </div>
      </div>
    </div>
  );
}
