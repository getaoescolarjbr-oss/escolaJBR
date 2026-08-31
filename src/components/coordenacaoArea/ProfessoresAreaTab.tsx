import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Loader2, Search, Users, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Professor, Turma } from '../../types';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { disciplinaPertenceAArea } from '../../utils/areasConhecimento';
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

export function ProfessoresAreaTab({ area, theme }: Props) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selectedDiary, setSelectedDiary] = useState<AlocacaoArea | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
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
        (allocData || []).forEach((row: any) => {
          const prof = row.professores;
          const disc = row.disciplinas;
          const turma = row.turmas;
          if (prof && disc && turma) {
            if (disciplinaPertenceAArea(disc.nome, area) || prof.area_conhecimento === area) {
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
            }
          }
        });

        // Ordenar por professor e turma
        filtradas.sort((a, b) => a.professor_nome.localeCompare(b.professor_nome) || a.turma_nome.localeCompare(b.turma_nome));
        setAlocacoes(filtradas);
      } catch (e) {
        console.error('Erro ao carregar alocações da área:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [area]);

  // Agrupar por professor
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
            className="w-full pl-9 pr-3 py-1.5 bg-ms-dark border border-gray-800 rounded-xl text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : professoresAgrupados.length === 0 ? (
        <div className="text-center py-12 bg-ms-card border border-gray-800 rounded-2xl p-6">
          <Users className="w-12 h-12 text-ms-muted mx-auto mb-2 opacity-50" />
          <p className="text-ms-main font-bold text-sm">Nenhum professor encontrado para esta área.</p>
          <p className="text-xs text-ms-muted mt-1">Verifique as atribuições de turmas e disciplinas da escola.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professoresAgrupados.map((prof) => (
            <div key={prof.id} className="bg-ms-card border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ms-main">{prof.nome}</h3>
                  <span className="text-[11px] text-blue-400 font-medium">
                    {prof.alocacoes.length} turma(s)/disciplina(s) atribuída(s)
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-gray-800/80">
                {prof.alocacoes.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 bg-ms-dark/60 hover:bg-ms-dark rounded-lg border border-gray-800/80 text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-ms-main">{a.turma_nome}</span>
                      <span className="text-ms-muted ml-2">· {a.disciplina_nome}</span>
                    </div>
                    <button
                      onClick={() => setSelectedDiary(a)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-ms-blue/20 text-ms-blueText hover:bg-ms-blue/30 rounded-md font-bold text-[11px] transition-colors border border-ms-blueText/30"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver Diário
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
