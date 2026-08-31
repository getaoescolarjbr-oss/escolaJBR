import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Search, Users, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Professor, Turma } from '../../types';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { disciplinaPertenceAArea, normalizarArea } from '../../utils/areasConhecimento';
import { TeacherDiaryModal } from '../TeacherDiaryModal';
import { getCurrentBimestre } from '../../utils/academicUtils';

interface Props {
  area: AreaConhecimento;
  theme: 'dark' | 'light';
}

interface AlocacaoArea {
  id: string;
  professor_id: string;
  professor_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
  turma_id: string;
  turma_nome: string;
  config_visto_valor_total?: number;
}

interface ProfSemAlocacao {
  id: string;
  nome: string;
  area_conhecimento: string | null;
}

export function ProfessoresAreaTab({ area, theme }: Props) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoArea[]>([]);
  const [profsSemAlocacao, setProfsSemAlocacao] = useState<ProfSemAlocacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selectedDiary, setSelectedDiary] = useState<AlocacaoArea | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1. Busca alocações com professores
        const { data: allocData } = await supabase
          .from('turma_disciplina_professor')
          .select(`
            id,
            turma_id,
            turmas (id, nome),
            disciplina_id,
            disciplinas (id, nome),
            professor_id,
            professores (id, nome, area_conhecimento, config_visto_valor_total)
          `);

        const filtradas: AlocacaoArea[] = [];
        const professoresComAlocacao = new Set<string>();

        (allocData || []).forEach((row: any) => {
          const prof = row.professores;
          const disc = row.disciplinas;
          const turma = row.turmas;
          if (prof && disc && turma) {
            const profArea = normalizarArea(prof.area_conhecimento);
            if (disciplinaPertenceAArea(disc.nome, area) || profArea === area) {
              filtradas.push({
                id: row.id,
                professor_id: prof.id,
                professor_nome: prof.nome,
                disciplina_id: disc.id,
                disciplina_nome: disc.nome,
                turma_id: turma.id,
                turma_nome: turma.nome,
                config_visto_valor_total: prof.config_visto_valor_total,
              });
              professoresComAlocacao.add(prof.id);
            }
          }
        });

        filtradas.sort((a, b) => a.professor_nome.localeCompare(b.professor_nome) || a.turma_nome.localeCompare(b.turma_nome));
        setAlocacoes(filtradas);

        // 2. Busca professores da área sem nenhuma alocação
        const { data: profsData } = await supabase
          .from('professores')
          .select('id, nome, area_conhecimento')
          .not('id', 'in', professoresComAlocacao.size > 0
            ? `(${Array.from(professoresComAlocacao).map((id) => `'${id}'`).join(',')})`
            : '(null)'
          );

        const semAlocacao: ProfSemAlocacao[] = (profsData || []).filter(
          (p: any) => normalizarArea(p.area_conhecimento) === area
        );
        setProfsSemAlocacao(semAlocacao);
      } catch (e) {
        console.error('Erro ao carregar professores da área:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [area]);

  // Agrupar por professor (com alocações)
  const professoresAgrupados = useMemo(() => {
    const map = new Map<string, { nome: string; alocacoes: AlocacaoArea[] }>();
    alocacoes.forEach((aloc) => {
      const entry = map.get(aloc.professor_id) ?? { nome: aloc.professor_nome, alocacoes: [] };
      entry.alocacoes.push(aloc);
      map.set(aloc.professor_id, entry);
    });

    let lista = Array.from(map.entries()).map(([id, val]) => ({
      id,
      nome: val.nome,
      alocacoes: val.alocacoes,
    }));

    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nome.toLowerCase().includes(b) ||
          p.alocacoes.some((a) => a.disciplina_nome.toLowerCase().includes(b) || a.turma_nome.toLowerCase().includes(b))
      );
    }
    return lista;
  }, [alocacoes, busca]);

  const profsSemAlocacaoFiltrados = useMemo(() => {
    if (!busca.trim()) return profsSemAlocacao;
    const b = busca.toLowerCase();
    return profsSemAlocacao.filter((p) => p.nome.toLowerCase().includes(b));
  }, [profsSemAlocacao, busca]);

  const totalProfessores = professoresAgrupados.length + profsSemAlocacaoFiltrados.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-ms-main">Docentes de {area}</h2>
          <p className="text-xs text-ms-muted">
            Acompanhe o diário, lançamento de vistos, chamadas e notas dos professores da sua área de conhecimento.
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
      ) : totalProfessores === 0 ? (
        <div className="text-center py-12 bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <Users className="w-12 h-12 text-ms-muted mx-auto mb-2 opacity-50" />
          <p className="text-ms-main font-bold text-sm">Nenhum professor encontrado para {area}.</p>
          <p className="text-xs text-ms-muted mt-1">
            Verifique se os professores estão cadastrados com a área de conhecimento correta no painel de Servidores.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Professores com alocações */}
          {professoresAgrupados.length > 0 && (
            <div className="space-y-3">
              {profsSemAlocacaoFiltrados.length > 0 && (
                <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Com turmas atribuídas ({professoresAgrupados.length})
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {professoresAgrupados.map((prof) => (
                  <div key={prof.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-ms-main">{prof.nome}</h3>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          {prof.alocacoes.length} turma(s)/disciplina(s) atribuída(s)
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
                            onClick={() => setSelectedDiary(a)}
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

          {/* Professores sem alocação mas da área */}
          {profsSemAlocacaoFiltrados.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                Sem turmas atribuídas ({profsSemAlocacaoFiltrados.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profsSemAlocacaoFiltrados.map((prof) => (
                  <div key={prof.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-black text-gray-700 dark:text-gray-200 flex-shrink-0">
                      {prof.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ms-main">{prof.nome}</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">Sem turma atribuída</p>
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
