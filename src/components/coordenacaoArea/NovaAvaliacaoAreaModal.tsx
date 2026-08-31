import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Turma } from '../../types';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { disciplinaPertenceAArea } from '../../utils/areasConhecimento';
import type { CotaProfessorInput, ModoAvaliacao, NovaAvaliacaoAreaInput, TipoAvaliacao } from '../../types/avaliacoes';
import { criarAvaliacaoArea } from '../../services/avaliacoesService';

interface Props {
  area: AreaConhecimento;
  onClose: () => void;
  onCriada: () => void;
}

interface ProfessorDisciplina {
  professor_id: string;
  professor_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
}

export function NovaAvaliacaoAreaModal({ area, onClose, onCriada }: Props) {
  const [titulo, setTitulo] = useState(`Avaliação de ${area}`);
  const [bimestre, setBimestre] = useState<number>(1);
  const [valorTotal, setValorTotal] = useState<number>(10);
  const [modo, setModo] = useState<ModoAvaliacao>('IMPRESSA');
  const [tipo, setTipo] = useState<TipoAvaliacao>('AVALIACAO');
  const [dataAplicacao, setDataAplicacao] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [instrucoes, setInstrucoes] = useState('Leia atentamente cada questão antes de responder.');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  
  const [professoresArea, setProfessoresArea] = useState<ProfessorDisciplina[]>([]);
  const [cotas, setCotas] = useState<Record<string, number>>({}); // key: `${profId}-${discId}`, value: qtd
  
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Carregar turmas
        const { data: tData } = await supabase.from('turmas').select('*').order('nome');
        setTurmas(tData || []);

        // Carregar professores e disciplinas da área
        const { data: allocData } = await supabase
          .from('alocacoes_v2')
          .select('professor_id, professores(id, nome, area_conhecimento), disciplina_id, disciplinas(id, nome)');

        const mapaProfDisc = new Map<string, ProfessorDisciplina>();
        (allocData || []).forEach((row: any) => {
          const prof = row.professores;
          const disc = row.disciplinas;
          if (prof && disc && (disciplinaPertenceAArea(disc.nome, area) || prof.area_conhecimento === area)) {
            const key = `${prof.id}-${disc.id}`;
            if (!mapaProfDisc.has(key)) {
              mapaProfDisc.set(key, {
                professor_id: prof.id,
                professor_nome: prof.nome,
                disciplina_id: disc.id,
                disciplina_nome: disc.nome,
              });
            }
          }
        });

        // Se não houver alocações diretas com filtro, carregar todos os professores da área
        if (mapaProfDisc.size === 0) {
          const { data: profsData } = await supabase
            .from('professores')
            .select('id, nome, area_conhecimento')
            .order('nome');

          const { data: discsData } = await supabase
            .from('disciplinas')
            .select('id, nome')
            .order('nome');

          const discsDaArea = (discsData || []).filter((d) => disciplinaPertenceAArea(d.nome, area));

          (profsData || []).forEach((p) => {
            if (p.area_conhecimento === area || !p.area_conhecimento) {
              discsDaArea.forEach((d) => {
                const key = `${p.id}-${d.id}`;
                mapaProfDisc.set(key, {
                  professor_id: p.id,
                  professor_nome: p.nome,
                  disciplina_id: d.id,
                  disciplina_nome: d.nome,
                });
              });
            }
          });
        }

        const lista = Array.from(mapaProfDisc.values()).sort((a, b) => a.disciplina_nome.localeCompare(b.disciplina_nome) || a.professor_nome.localeCompare(b.professor_nome));
        setProfessoresArea(lista);

        // Iniciar com cota padrão de 2 questões por professor/disciplina
        const cotasIniciais: Record<string, number> = {};
        lista.forEach((item) => {
          cotasIniciais[`${item.professor_id}-${item.disciplina_id}`] = 2;
        });
        setCotas(cotasIniciais);
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    })();
  }, [area]);

  function toggleTurma(turmaId: string) {
    setTurmasSelecionadas((prev) =>
      prev.includes(turmaId) ? prev.filter((id) => id !== turmaId) : [...prev, turmaId]
    );
  }

  function setCotaQtd(key: string, qtd: number) {
    setCotas((prev) => ({ ...prev, [key]: Math.max(0, qtd) }));
  }

  const totalQuestoesPrevistas = Object.values(cotas).reduce((soma, q) => soma + (Number(q) || 0), 0);

  async function handleSalvar() {
    if (!titulo.trim()) {
      setErro('Informe o título da avaliação.');
      return;
    }
    if (turmasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma turma para a avaliação.');
      return;
    }

    const cotasPayload: CotaProfessorInput[] = professoresArea
      .map((item) => ({
        professor_id: item.professor_id,
        disciplina_id: item.disciplina_id,
        qtd_questoes: cotas[`${item.professor_id}-${item.disciplina_id}`] || 0,
      }))
      .filter((c) => c.qtd_questoes > 0);

    if (cotasPayload.length === 0) {
      setErro('Defina a cota de questões para pelo menos um professor da área.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const payload: NovaAvaliacaoAreaInput = {
        titulo: titulo.trim(),
        area_conhecimento: area,
        bimestre_id: bimestre,
        valor_total: Number(valorTotal),
        modo,
        tipo,
        data_aplicacao: dataAplicacao || null,
        prazo_entrega: modo !== 'IMPRESSA' && prazoEntrega ? new Date(prazoEntrega).toISOString() : null,
        instrucoes: instrucoes.trim() || null,
        turma_ids: turmasSelecionadas,
        cotas: cotasPayload,
      };

      await criarAvaliacaoArea(payload);
      onCriada();
    } catch (e: any) {
      setErro(e.message || 'Erro ao criar avaliação de área.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Elaborar Avaliação da Área — {area}</h2>
            <p className="text-xs text-ms-muted">Crie a avaliação e estipule o número de questões para cada professor da área inserir.</p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
            </div>
          ) : (
            <>
              {/* Informações Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ms-muted mb-1">Título da Avaliação *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Bimestre</label>
                  <select
                    value={bimestre}
                    onChange={(e) => setBimestre(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  >
                    <option value={1}>1º Bimestre</option>
                    <option value={2}>2º Bimestre</option>
                    <option value={3}>3º Bimestre</option>
                    <option value={4}>4º Bimestre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoAvaliacao)}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  >
                    <option value="AVALIACAO">Avaliação (gera nota no boletim)</option>
                    <option value="SIMULADO">Simulado (sem nota no boletim)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Modo de Aplicação</label>
                  <select
                    value={modo}
                    onChange={(e) => setModo(e.target.value as ModoAvaliacao)}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  >
                    <option value="IMPRESSA">Impressa</option>
                    <option value="ONLINE">Online</option>
                    <option value="AMBAS">Impressa e Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Valor Total (Pontos)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={valorTotal}
                    onChange={(e) => setValorTotal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Data de Aplicação</label>
                  <input
                    type="date"
                    value={dataAplicacao}
                    onChange={(e) => setDataAplicacao(e.target.value)}
                    className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  />
                </div>

                {modo !== 'IMPRESSA' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ms-muted mb-1">Prazo de Entrega (Online)</label>
                    <input
                      type="datetime-local"
                      value={prazoEntrega}
                      onChange={(e) => setPrazoEntrega(e.target.value)}
                      className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                  </div>
                )}
              </div>

              {/* Turmas Participantes */}
              <div>
                <label className="block text-xs font-bold text-ms-muted mb-2">Turmas Participantes *</label>
                <div className="flex flex-wrap gap-2">
                  {turmas.map((t) => {
                    const sel = turmasSelecionadas.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleTurma(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          sel
                            ? 'bg-ms-blue text-white border-ms-blue shadow'
                            : 'bg-ms-dark text-gray-400 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        {t.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Distribuição de Cotas de Questões por Professor */}
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ms-main">Cota de Questões por Professor da Área</h3>
                    <p className="text-xs text-ms-muted">Defina quantas questões cada docente deverá inserir na prova.</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-ms-blue/10 text-ms-blueText rounded-full border border-ms-blueText/30">
                    Total previsto: {totalQuestoesPrevistas} questões
                  </span>
                </div>

                <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
                  {professoresArea.length === 0 ? (
                    <p className="p-4 text-xs text-ms-muted text-center">Nenhum professor/disciplina encontrado nesta área.</p>
                  ) : (
                    professoresArea.map((p) => {
                      const key = `${p.professor_id}-${p.disciplina_id}`;
                      const qtd = cotas[key] ?? 0;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 bg-ms-dark/40 hover:bg-ms-dark/80 gap-3">
                          <div>
                            <p className="text-sm font-bold text-ms-main">{p.professor_nome}</p>
                            <p className="text-xs text-ms-muted">{p.disciplina_nome}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ms-muted">Questões:</span>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={qtd}
                              onChange={(e) => setCotaQtd(key, Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-ms-dark border border-gray-700 rounded-lg text-sm font-bold text-center text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || loading}
            onClick={handleSalvar}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Avaliação de Área
          </button>
        </div>
      </div>
    </div>
  );
}
