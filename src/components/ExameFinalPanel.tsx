import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, Avaliacao, Student } from '../types';
import { Calculator, Save, AlertCircle, TrendingUp, Printer } from 'lucide-react';
import { arredondarNotaMS, getCorGradiente, calcularMediaAnual, calcularNotaNecessariaExame, calcularFrequenciaAnual, calcularMediaFinalPosExame } from '../utils/academicUtils';
import { printReport } from '../utils/printUtils';

interface ExameFinalPanelProps {
  professor: Professor;
  turmaId: string;
  disciplinaId: string;
  theme: 'dark' | 'light';
  isLocked?: boolean;
}

export function ExameFinalPanel({ professor, turmaId, disciplinaId, theme, isLocked = false }: ExameFinalPanelProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [alunos, setAlunos] = useState<Student[]>([]);
  const [mediasAnuais, setMediasAnuais] = useState<Record<string, number>>({});
  const [frequencias, setFrequencias] = useState<Record<string, number>>({});
  
  // Exame final state
  const [exameAvaliacao, setExameAvaliacao] = useState<Avaliacao | null>(null);
  const [notasExame, setNotasExame] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchAllAnualData() {
      setLoading(true);

      // 1. Fetch Students
      const { data: dataAlunos } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .order('aluno_numero');
      
      const alunosList = dataAlunos as Student[] || [];
      setAlunos(alunosList);

      // 2. Fetch all evaluations across 4 bimestres
      const { data: avaliacoesBimestrais } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .in('bimestre_id', [1, 2, 3, 4]);

      const avalsBimestrais = avaliacoesBimestrais || [];
      const avalBimIds = avalsBimestrais.map(a => a.id);

      // 3. Fetch grades for these evaluations
      let notasBimestraisData: any[] = [];
      if (avalBimIds.length > 0) {
        const { data: nbData } = await supabase
          .from('notas_avaliacoes')
          .select('*')
          .in('avaliacao_id', avalBimIds);
        notasBimestraisData = nbData || [];
      }

      // 4. Fetch all daily activities across 4 bimestres (for Vistos)
      const { data: atividadesDiarias } = await supabase
        .from('atividades_diárias')
        .select('id, bimestre_id')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .in('bimestre_id', [1, 2, 3, 4]);
      
      const ativs = atividadesDiarias || [];
      const ativIds = ativs.map(a => a.id);

      // 5. Fetch Vistos for these activities
      let vistosData: any[] = [];
      if (ativIds.length > 0) {
        const { data: vData } = await supabase
          .from('vistos_v2')
          .select('aluno_id, atividade_id, valor')
          .in('atividade_id', ativIds);
        vistosData = vData || [];
      }

      // Calculate grades per student per bimestre
      const studentGradesPerBimestre: Record<string, Record<number, number>> = {};
      
      alunosList.forEach(aluno => {
        studentGradesPerBimestre[aluno.id] = { 1: 0, 2: 0, 3: 0, 4: 0 };
        
        [1, 2, 3, 4].forEach(bimestre => {
          let somaNotas = 0;
          
          // Avaliacoes do bimestre
          const avalsDoBimestre = avalsBimestrais.filter(a => a.bimestre_id === bimestre);
          avalsDoBimestre.forEach(av => {
            const notaRec = notasBimestraisData.find(n => n.avaliacao_id === av.id && String(n.aluno_id) === String(aluno.id));
            if (notaRec) somaNotas += notaRec.nota;
          });

          // Vistos do bimestre
          const ativsDoBimestre = ativs.filter(a => a.bimestre_id === bimestre);
          let somaPesosVistos = 0;
          ativsDoBimestre.forEach(at => {
            const visto = vistosData.find(v => v.atividade_id === at.id && String(v.aluno_id) === String(aluno.id));
            if (visto) {
              const val = String(visto.valor).trim();
              if (val === '1.0' || val === '+' || val === '.' || val === 'checked') somaPesosVistos += 1.0;
              else if (val === '0.5' || val === 'half') somaPesosVistos += 0.5;
              else if (!isNaN(parseFloat(val))) {
                const num = parseFloat(val);
                somaPesosVistos += num > 1 ? num / 10 : num;
              }
            }
          });
          
          const totalAtivBim = ativsDoBimestre.length;
          let notaVistos = 0;
          if (totalAtivBim > 0) {
            notaVistos = (somaPesosVistos / totalAtivBim) * (professor.config_visto_valor_total || 2.0);
          }
          
          somaNotas += arredondarNotaMS(notaVistos);
          studentGradesPerBimestre[aluno.id][bimestre] = arredondarNotaMS(somaNotas);
        });
      });

      // Calculate Media Anual
      const maDict: Record<string, number> = {};
      alunosList.forEach(aluno => {
        const bimGrades = studentGradesPerBimestre[aluno.id];
        maDict[aluno.id] = calcularMediaAnual([bimGrades[1], bimGrades[2], bimGrades[3], bimGrades[4]]);
      });
      setMediasAnuais(maDict);

      // 6. Fetch Chamadas for frequency
      const { data: chamadasData } = await supabase
        .from('chamadas')
        .select('aluno_id, presenca, data_aula')
        .eq('id_do_professor', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId);

      const chamadas = chamadasData || [];
      const distinctAulas = new Set(chamadas.map(c => c.data_aula)).size;
      
      const freqDict: Record<string, number> = {};
      alunosList.forEach(aluno => {
        const chamadasAluno = chamadas.filter(c => String(c.aluno_id) === String(aluno.id));
        const presencas = chamadasAluno.filter(c => c.presenca).length;
        freqDict[aluno.id] = calcularFrequenciaAnual(presencas, distinctAulas);
      });
      setFrequencias(freqDict);

      // 7. Fetch "Exame Final" Avaliacao (bimestre_id = 5)
      const { data: exameData } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('bimestre_id', 5)
        .maybeSingle();

      if (exameData) {
        setExameAvaliacao(exameData);
        // Fetch grades for Exame Final
        const { data: notasExameData } = await supabase
          .from('notas_avaliacoes')
          .select('*')
          .eq('avaliacao_id', exameData.id);
        
        const neDict: Record<string, number> = {};
        (notasExameData || []).forEach(n => {
          neDict[n.aluno_id] = n.nota;
        });
        setNotasExame(neDict);
      }

      setLoading(false);
    }
    
    fetchAllAnualData();
  }, [professor.id, turmaId, disciplinaId]);

  const handleCreateExameAvaliacao = async () => {
    setIsSaving(true);
    const { data, error } = await supabase.from('avaliacoes').insert({
      professor_id: professor.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 5, // 5 indicates Exame Final
      nome: 'Exame Final',
      valor_maximo: 10
    }).select().single();

    if (!error && data) {
      setExameAvaliacao(data);
    }
    setIsSaving(false);
  };

  const handleUpdateNotaExame = async (alunoId: string, notaVal: number) => {
    if (!exameAvaliacao) return;
    let valorFinal = notaVal;
    if (valorFinal > 10) valorFinal = 10;
    if (valorFinal < 0) valorFinal = 0;

    setNotasExame(prev => ({ ...prev, [alunoId]: valorFinal }));

    await supabase.from('notas_avaliacoes').upsert({
      avaliacao_id: exameAvaliacao.id,
      aluno_id: alunoId,
      nota: valorFinal
    }, { onConflict: 'avaliacao_id,aluno_id' });
  };

  if (loading) return <div className="p-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-xl border border-ms-border overflow-hidden`}>
        <div className={`p-4 border-b ${theme === 'light' ? 'bg-[#e6f0ff] border-[#002677]/20' : 'bg-[#0a1a3a] border-[#002677]/30'} flex justify-between items-center`}>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-[#002677]' : 'text-[#93c5fd]'}`}>Resultados Anuais & Exame Final</h3>
            <p className={`text-[10px] font-bold uppercase mt-1 ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>Fórmula SED-MS: MF = (MA × 3 + EF × 2) / 5</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => printReport(tableRef.current, { 
                title: 'Resultados Anuais & Exame Final',
                subtitle: 'Acompanhamento do exame final e médias consolidadas',
                info: [
                  { label: 'Professor', value: professor.nome }
                ]
              })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            {!exameAvaliacao && (
              <button 
                onClick={handleCreateExameAvaliacao}
                disabled={isSaving || isLocked}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Criando...' : 'Abrir Lançamento de Exame'}
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table ref={tableRef} className="min-w-full divide-y divide-ms-border/30">
            <thead className={theme === 'light' ? 'bg-ms-blue' : 'bg-ms-accent'}>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest sticky left-0 z-10 bg-inherit border-r border-white/10">Estudante</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">Média Anual (MA)</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">Frequência</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest">Situação Inicial</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-600/20">Nota Necessária (EF)</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-blue-600/40">Nota Exame (Input)</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-white uppercase tracking-widest bg-black/40">Resultado Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ms-border/30">
              {alunos.map((aluno, idx) => {
                const ma = mediasAnuais[aluno.id] || 0;
                const freq = frequencias[aluno.id] ?? 100;
                
                let situacaoInicial = 'Em Exame';
                let isExame = false;
                let corSituacao = 'text-yellow-500';

                if (freq < 75) {
                  situacaoInicial = 'Reprovado (Falta)';
                  corSituacao = 'text-red-500';
                } else if (ma >= 6.0) {
                  situacaoInicial = 'Aprovado';
                  corSituacao = 'text-green-500';
                } else {
                  isExame = true;
                }

                const notaNecessaria = isExame ? calcularNotaNecessariaExame(ma) : 0;
                const impossivel = notaNecessaria > 10;
                if (isExame && impossivel) {
                  situacaoInicial = 'Reprovado (Nota)';
                  corSituacao = 'text-red-500';
                }

                const ef = notasExame[aluno.id] || 0;
                let mf = ma;
                if (isExame && !impossivel) {
                  mf = calcularMediaFinalPosExame(ma, ef);
                }

                let resultadoFinal = situacaoInicial;
                let corResultado = corSituacao;

                if (isExame && !impossivel) {
                  if (notasExame[aluno.id] !== undefined) {
                    if (mf >= 5.0) {
                      resultadoFinal = 'Aprovado (Pós-Exame)';
                      corResultado = 'text-green-500';
                    } else {
                      resultadoFinal = 'Reprovado (Pós-Exame)';
                      corResultado = 'text-red-500';
                    }
                  } else {
                    resultadoFinal = 'Aguardando Exame';
                    corResultado = 'text-yellow-500';
                  }
                }

                return (
                  <tr key={aluno.id} className={idx % 2 !== 0 ? (theme === 'light' ? 'bg-blue-50/30' : 'bg-ms-dark/5') : ''}>
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-inherit border-r border-ms-border/30">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-ms-gold">{idx + 1}.</span>
                        <span className={`text-xs font-bold ${theme === 'light' ? 'text-blue-950' : 'text-ms-main'}`}>{aluno.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-black ${getCorGradiente(ma, theme) === '#ef4444' || getCorGradiente(ma, theme) === '#dc2626' ? 'text-red-500' : 'text-blue-500'}`}>
                        {ma.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-bold ${freq >= 75 ? (theme === 'light' ? 'text-blue-900' : 'text-white') : 'text-red-500'}`}>
                        {freq}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${corSituacao}`}>
                        {situacaoInicial}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center bg-blue-500/5">
                      {isExame && !impossivel ? (
                        <span className="text-sm font-black text-yellow-500">{notaNecessaria.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center bg-blue-500/10">
                      {isExame && !impossivel && exameAvaliacao ? (
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          max="10"
                          value={notasExame[aluno.id] ?? ''}
                          onChange={(e) => handleUpdateNotaExame(aluno.id, parseFloat(e.target.value) || 0)}
                          disabled={isLocked}
                          className={`w-16 text-center p-1 rounded text-xs font-bold focus:border-blue-500 outline-none border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-ms-dark/20 border-ms-border text-white'
                          }`}
                        />
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-black ${corResultado}`}>
                          {mf.toFixed(1)}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${corResultado}`}>
                          {resultadoFinal}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
