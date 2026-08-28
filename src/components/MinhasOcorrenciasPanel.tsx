import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { AlertTriangle, Loader2, ChevronDown, ChevronRight, Clock, CheckCheck } from 'lucide-react';

interface MinhasOcorrenciasPanelProps {
  professor: Professor;
  theme: 'dark' | 'light';
}

function formatDataOcorrencia(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  if (String(dateStr).includes('-') && !String(dateStr).includes('T')) {
    const [y, m, d] = String(dateStr).split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function MinhasOcorrenciasPanel({ professor, theme }: MinhasOcorrenciasPanelProps) {
  const [loading, setLoading] = useState(true);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [expandedAluno, setExpandedAluno] = useState<string | null>(null);

  useEffect(() => {
    fetchMinhasOcorrencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professor.id]);

  async function fetchMinhasOcorrencias() {
    setLoading(true);
    try {
      const { data: raw, error } = await supabase
        .from('ocorrências')
        .select('*')
        .eq('id_do_professor', professor.id)
        .order('data', { ascending: false });

      if (error) throw error;

      if (raw && raw.length > 0) {
        const studentIds = [...new Set(raw.map(o => o.aluno_id).filter(Boolean))];
        const classIds = [...new Set(raw.map(o => o.turma_id).filter(Boolean))];

        const [studentsRes, classesRes] = await Promise.all([
          supabase.from('alunos').select('id, nome, aluno_numero, turma_id').in('id', studentIds),
          supabase.from('turmas').select('id, nome').in('id', classIds)
        ]);

        const studentsMap = new Map(studentsRes.data?.map(s => [s.id, s]) || []);
        const classesMap = new Map(classesRes.data?.map(c => [c.id, c]) || []);

        setOcorrencias(raw.map(o => ({
          ...o,
          aluno: o.aluno_id ? studentsMap.get(o.aluno_id) : null,
          turma: o.turma_id ? classesMap.get(o.turma_id) : null,
        })));
      } else {
        setOcorrencias([]);
      }
    } catch (err) {
      console.error('Erro ao buscar minhas ocorrências:', err);
    } finally {
      setLoading(false);
    }
  }

  const porAluno = ocorrencias.reduce((acc: Record<string, { aluno: any; turma: any; items: any[] }>, o) => {
    const key = o.aluno_id || 'sem-aluno';
    if (!acc[key]) acc[key] = { aluno: o.aluno, turma: o.turma, items: [] };
    acc[key].items.push(o);
    return acc;
  }, {});

  const alunosOrdenados = Object.entries(porAluno).sort((a, b) =>
    (a[1].aluno?.nome || '').localeCompare(b[1].aluno?.nome || '')
  );

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Carregando suas ocorrências...</p>
      </div>
    );
  }

  if (ocorrencias.length === 0) {
    return (
      <div className={`rounded-2xl border p-12 text-center shadow-xl ${theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'}`}>
        <CheckCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <p className={`font-bold text-lg ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Nenhuma ocorrência registrada.</p>
        <p className="text-gray-500 text-sm mt-1">Você ainda não registrou nenhuma ocorrência disciplinar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-black text-red-500 uppercase tracking-widest">
        {ocorrencias.length} ocorrência{ocorrencias.length > 1 ? 's' : ''} registrada{ocorrencias.length > 1 ? 's' : ''} por você, em {alunosOrdenados.length} aluno{alunosOrdenados.length > 1 ? 's' : ''}
      </p>

      {alunosOrdenados.map(([alunoId, grupo]) => {
        const isOpen = expandedAluno === alunoId;
        return (
          <div key={alunoId} className={`rounded-2xl border shadow-xl overflow-hidden ${theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'}`}>
            <button
              onClick={() => setExpandedAluno(isOpen ? null : alunoId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-500/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>{grupo.aluno?.nome || 'Aluno Desconhecido'}</p>
                  <p className="text-[10px] font-black text-ms-blueText uppercase">
                    {grupo.aluno?.aluno_numero ? `Nº ${grupo.aluno.aluno_numero} · ` : ''}{grupo.turma?.nome || 'Sem Turma'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500/10 text-red-500 border border-red-500/30">
                  {grupo.items.length}
                </span>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-ms-border/40 divide-y divide-ms-border/20">
                {grupo.items.map((o: any) => (
                  <div key={o.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500">{o.tipo || 'Ocorrência Disciplinar'}</span>
                      <span className="text-[10px] font-bold text-gray-500">{formatDataOcorrencia(o.data || o.data_registro)}</span>
                    </div>
                    <p className={`text-sm leading-relaxed font-bold ${theme === 'light' ? 'text-blue-900' : 'text-gray-300'}`}>{o.descricao}</p>
                    <div className="mt-2 space-y-2">
                      {o.visto_coordenador ? (
                        <div className="inline-flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[9px] font-bold uppercase">
                          <CheckCheck className="w-3 h-3" /> Visualizada pela Coordenação
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-[9px] font-bold uppercase">
                          <Clock className="w-3 h-3" /> Aguardando leitura da Coordenação
                        </div>
                      )}
                      {o.devolutiva_coordenador && (
                        <div className="flex flex-col gap-0.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2">
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Devolutiva da Coordenação</p>
                          <p className="text-xs text-emerald-300 leading-relaxed">{o.devolutiva_coordenador}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
