import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { AREAS_CONHECIMENTO } from '../../utils/areasConhecimento';
import { TeacherDiaryModal } from '../TeacherDiaryModal';
import { getCurrentBimestre } from '../../utils/academicUtils';

interface Props {
  area: AreaConhecimento;
  theme: 'dark' | 'light';
}

interface ProfessorDaArea {
  id: string;
  nome: string;
  email: string | null;
  area_conhecimento: string | null;
  config_visto_valor_total?: number;
  alocacoes: {
    id: string;
    turma_id: string;
    turma_nome: string;
    disciplina_id: string;
    disciplina_nome: string;
  }[];
}

export function ProfessoresAreaTab({ area, theme }: Props) {
  const [professores, setProfessores] = useState<ProfessorDaArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selectedDiary, setSelectedDiary] = useState<{
    professor_id: string;
    professor_nome: string;
    disciplina_id: string;
    disciplina_nome: string;
    turma_id: string;
    turma_nome: string;
    config_visto_valor_total?: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. Busca professores via RPC (SECURITY DEFINER, inclui normalização de área)
        const { data: profsData, error: profsError } = await supabase
          .rpc('rpc_listar_professores_area', { p_area_conhecimento: area });

        if (profsError) {
          console.error('[ProfessoresAreaTab] Erro ao buscar professores:', profsError);
        }
        console.log('[ProfessoresAreaTab] área:', area, '| professores encontrados:', profsData?.length ?? 0);

        // 2. Para cada professor, busca as alocações
        const lista: ProfessorDaArea[] = [];
        for (const prof of profsData || []) {
          const { data: allocData } = await supabase
            .from('turma_disciplina_professor')
            .select(`
              id,
              turma_id,
              turmas (id, nome),
              disciplina_id,
              disciplinas (id, nome)
            `)
            .eq('professor_id', prof.id);

          lista.push({
            id: prof.id,
            nome: prof.nome,
            email: prof.email,
            area_conhecimento: prof.area_conhecimento,
            config_visto_valor_total: prof.config_visto_valor_total,
            alocacoes: (allocData || []).map((row: any) => ({
              id: row.id,
              turma_id: row.turma_id,
              turma_nome: row.turmas?.nome || '',
              disciplina_id: row.disciplina_id,
              disciplina_nome: row.disciplinas?.nome || '',
            })),
          });
        }

        if (!cancelled) {
          setProfessores(lista);
        }
      } catch (e) {
        console.error('Erro ao carregar professores da área:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [area]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return professores;
    const b = busca.toLowerCase();
    return professores.filter(
      (p) =>
        p.nome.toLowerCase().includes(b) ||
        p.alocacoes.some(
          (a) =>
            a.disciplina_nome.toLowerCase().includes(b) ||
            a.turma_nome.toLowerCase().includes(b)
        )
    );
  }, [professores, busca]);

  const comAlocacao = filtrados.filter((p) => p.alocacoes.length > 0);
  const semAlocacao = filtrados.filter((p) => p.alocacoes.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-ms-main">Docentes de {area}</h2>
          <p className="text-xs text-ms-muted">
            {professores.length > 0
              ? `${professores.length} professor(es) nesta área.`
              : 'Acompanhe o diário, chamadas e notas dos professores da sua área.'}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar docente, turma ou matéria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <Users className="w-12 h-12 text-ms-muted mx-auto mb-2 opacity-50" />
          <p className="text-ms-main font-bold text-sm">Nenhum professor encontrado para {area}.</p>
          <p className="text-xs text-ms-muted mt-1">
            Verifique se os professores estão cadastrados com a área correta no painel de Servidores.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Com alocações */}
          {comAlocacao.length > 0 && (
            <div className="space-y-3">
              {semAlocacao.length > 0 && (
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Com turmas atribuídas ({comAlocacao.length})
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comAlocacao.map((prof) => (
                  <div key={prof.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-black text-blue-800 dark:text-blue-300 flex-shrink-0">
                        {prof.nome.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-ms-main leading-tight">{prof.nome}</h3>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          {prof.alocacoes.length} turma(s)/disciplina(s)
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-800">
                      {prof.alocacoes.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-ms-dark/60 hover:bg-gray-100 dark:hover:bg-ms-dark rounded-lg border border-gray-200 dark:border-gray-800 text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-ms-main">{a.turma_nome}</span>
                            <span className="text-ms-muted ml-2">· {a.disciplina_nome}</span>
                          </div>
                          <button
                            onClick={() =>
                              setSelectedDiary({
                                professor_id: prof.id,
                                professor_nome: prof.nome,
                                disciplina_id: a.disciplina_id,
                                disciplina_nome: a.disciplina_nome,
                                turma_id: a.turma_id,
                                turma_nome: a.turma_nome,
                                config_visto_valor_total: prof.config_visto_valor_total,
                              })
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-ms-blue/20 text-blue-800 dark:text-ms-blueText hover:bg-blue-200 dark:hover:bg-ms-blue/30 rounded-md font-bold text-[11px] transition-colors border border-blue-300 dark:border-ms-blueText/30"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Diário
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sem alocações */}
          {semAlocacao.length > 0 && (
            <div className="space-y-3">
              {comAlocacao.length > 0 && (
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Sem turmas atribuídas ({semAlocacao.length})
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {semAlocacao.map((prof) => (
                  <div key={prof.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-black text-gray-700 dark:text-gray-200 flex-shrink-0">
                      {prof.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ms-main">{prof.nome}</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">Sem turma atribuída ainda</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedDiary && (
        <TeacherDiaryModal
          isOpen={true}
          onClose={() => setSelectedDiary(null)}
          professorId={selectedDiary.professor_id}
          professorNome={selectedDiary.professor_nome}
          disciplinaId={selectedDiary.disciplina_id}
          disciplinaNome={selectedDiary.disciplina_nome}
          turmaId={selectedDiary.turma_id}
          turmaNome={selectedDiary.turma_nome}
          theme={theme}
          initialBimestre={getCurrentBimestre()}
          configVistoValorTotal={selectedDiary.config_visto_valor_total || 2.0}
        />
      )}
    </div>
  );
}
