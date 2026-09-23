import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Plus, X } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import type { AvaliacaoArea } from '../../types/avaliacoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { disciplinaPertenceAAreaEstrita } from '../../utils/areasConhecimento';
import {
  configurarAreaAvaliacaoGeral,
  listarProfessoresDasTurmas,
  type ProfessorDisciplinaTurmas,
} from '../../services/avaliacoesService';
import { buscarQuestoesPorIds } from '../../services/bancoQuestoesService';
import { SortearQuestoesPanel } from './SortearQuestoesPanel';

interface Props {
  avaliacao: AvaliacaoArea;
  area: AreaConhecimento;
  onClose: () => void;
  onSalvo: () => void;
}

const chave = (p: { professor_id: string; disciplina_id: string }) => `${p.professor_id}-${p.disciplina_id}`;

export function ConfigurarAreaGeralModal({ avaliacao, area, onClose, onSalvo }: Props) {
  const infoArea = avaliacao.areas?.find((a) => a.area_conhecimento === area);
  const qtdArea = infoArea?.qtd_questoes ?? 0;
  const cotasDaArea = useMemo(
    () => (avaliacao.cotas ?? []).filter((c) => c.area_conhecimento === area),
    [avaliacao.cotas, area]
  );
  const qtdInseridaPorKey = useMemo(
    () => Object.fromEntries(cotasDaArea.map((c) => [chave(c), c.qtd_inserida])) as Record<string, number>,
    [cotasDaArea]
  );
  const somenteLeitura = avaliacao.status === 'PUBLICADA' || !avaliacao.edicao_permitida;

  const [pool, setPool] = useState<ProfessorDisciplinaTurmas[]>([]);
  const [extras, setExtras] = useState<string[]>([]); // chaves de professores de outras áreas incluídos
  const [recebeNota, setRecebeNota] = useState<Record<string, boolean>>({});
  const [insere, setInsere] = useState<Record<string, boolean>>({});
  const [qtdCota, setQtdCota] = useState<Record<string, number>>({});
  const [gerarAuto, setGerarAuto] = useState(false);
  const [sorteadas, setSorteadas] = useState<Question[]>([]);
  const [adicionar, setAdicionar] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const lista = await listarProfessoresDasTurmas(avaliacao.turma_ids ?? []);
        setPool(lista);
        const daArea = new Set(lista.filter((p) => disciplinaPertenceAAreaEstrita(p.disciplina_nome, area)).map(chave));

        const notasSalvas = (avaliacao.notas_professores ?? []).filter((n) => n.area_conhecimento === area);
        const notas: Record<string, boolean> = {};
        if (infoArea?.configurada) {
          notasSalvas.forEach((n) => { notas[chave(n)] = true; });
        } else {
          daArea.forEach((k) => { notas[k] = true; });
        }
        setRecebeNota(notas);

        const ins: Record<string, boolean> = {};
        const qtds: Record<string, number> = {};
        cotasDaArea.forEach((c) => { ins[chave(c)] = true; qtds[chave(c)] = c.qtd_questoes; });
        setInsere(ins);
        setQtdCota(qtds);

        // Quem já foi escolhido antes mas não é da área continua visível na lista.
        const jaEscolhidos = [...notasSalvas.map(chave), ...cotasDaArea.map(chave)];
        setExtras(Array.from(new Set(jaEscolhidos.filter((k) => !daArea.has(k)))));

        const idsSorteadas = infoArea?.questoes_sorteadas ?? [];
        if (idsSorteadas.length > 0) {
          const qs = await buscarQuestoesPorIds(idsSorteadas);
          const porId = new Map(qs.map((q) => [q.id, q]));
          setSorteadas(idsSorteadas.map((id) => porId.get(id)).filter((q): q is Question => !!q));
          setGerarAuto(true);
        }
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar professores das turmas.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avaliacao.id, area]);

  const porChave = useMemo(() => new Map(pool.map((p) => [chave(p), p])), [pool]);
  const lista = useMemo(() => {
    const daArea = pool.filter((p) => disciplinaPertenceAAreaEstrita(p.disciplina_nome, area));
    const outros = extras.map((k) => porChave.get(k)).filter((p): p is ProfessorDisciplinaTurmas => !!p);
    return [...daArea, ...outros];
  }, [pool, extras, porChave, area]);
  const disponiveisParaAdicionar = pool.filter((p) => !lista.some((l) => chave(l) === chave(p)));

  const somaCotas = lista.filter((p) => insere[chave(p)]).reduce((s, p) => s + (qtdCota[chave(p)] || 0), 0);
  const qtdSorteadas = gerarAuto ? sorteadas.length : 0;
  const distribuido = somaCotas + qtdSorteadas;
  const excluirOutrasAreas = (avaliacao.areas ?? [])
    .filter((a) => a.area_conhecimento !== area)
    .flatMap((a) => a.questoes_sorteadas);

  function toggleInsere(k: string) {
    if ((qtdInseridaPorKey[k] ?? 0) > 0) return;
    setInsere((prev) => ({ ...prev, [k]: !prev[k] }));
    setQtdCota((prev) => ({ ...prev, [k]: prev[k] || 1 }));
  }

  function incluirProfessor() {
    if (!adicionar) return;
    setExtras((prev) => [...prev, adicionar]);
    setRecebeNota((prev) => ({ ...prev, [adicionar]: true }));
    setAdicionar('');
  }

  async function handleSalvar() {
    if (distribuido > qtdArea) {
      setErro(`A distribuição (${distribuido}) passa das ${qtdArea} questões da área.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const notas = lista.filter((p) => recebeNota[chave(p)]).map((p) => ({ professor_id: p.professor_id, disciplina_id: p.disciplina_id }));
      const cotas = lista
        .filter((p) => insere[chave(p)])
        .map((p) => ({ professor_id: p.professor_id, disciplina_id: p.disciplina_id, qtd_questoes: qtdCota[chave(p)] || 1 }));
      await configurarAreaAvaliacaoGeral(avaliacao.id, area, notas, cotas, gerarAuto ? sorteadas.map((q) => q.id) : []);
      onSalvo();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar a configuração da área.');
    } finally {
      setSalvando(false);
    }
  }

  const checkbox = (ativo: boolean, travado = false) => (
    <span
      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
        ativo ? 'bg-ms-blue border-ms-blue text-white' : 'border-gray-400 dark:border-gray-600 bg-white dark:bg-ms-dark'
      } ${travado ? 'opacity-60' : ''}`}
    >
      {ativo && <Check className="w-3.5 h-3.5 stroke-[3]" />}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Configurar {area} — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted">
              Esta área tem <strong className="text-ms-blueText">{qtdArea} questão(ões)</strong> na avaliação geral. Escolha quem
              recebe a nota e quem insere as questões.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {somenteLeitura && (
            <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>A avaliação está publicada ou com a edição bloqueada. Dá para conferir, mas não para salvar.</span>
            </div>
          )}
          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-xs">
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
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-xs font-bold text-ms-muted mb-1">
                    Incluir professor de outra área (que dá aula nas turmas desta avaliação)
                  </label>
                  <select
                    value={adicionar}
                    onChange={(e) => setAdicionar(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  >
                    <option value="">Selecione...</option>
                    {disponiveisParaAdicionar.map((p) => (
                      <option key={chave(p)} value={chave(p)}>{p.professor_nome} — {p.disciplina_nome}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={incluirProfessor}
                  disabled={!adicionar}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-ms-main rounded-xl text-xs font-bold border border-gray-300 dark:border-gray-700 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Incluir
                </button>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-3 px-3 py-2 bg-gray-50 dark:bg-ms-dark/40 text-[11px] font-bold text-ms-muted">
                  <span>Professor / disciplina</span>
                  <span className="w-16 sm:w-28 text-center">Recebe a nota</span>
                  <span className="w-28 sm:w-44 text-center">Insere questões</span>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {lista.length === 0 && (
                    <p className="p-6 text-xs text-ms-muted text-center">
                      Nenhum professor de {area} dá aula nas turmas desta avaliação. Use o campo acima para incluir alguém.
                    </p>
                  )}
                  {lista.map((p) => {
                    const k = chave(p);
                    const inserida = qtdInseridaPorKey[k] ?? 0;
                    const travado = inserida > 0;
                    return (
                      <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-3 items-center px-3 py-2">
                        <div>
                          <p className="text-sm font-bold text-ms-main">
                            {p.professor_nome}
                            {extras.includes(k) && <span className="ml-1.5 text-[10px] font-bold text-ms-muted">(outra área)</span>}
                          </p>
                          <p className="text-xs text-ms-muted">{p.disciplina_nome}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecebeNota((prev) => ({ ...prev, [k]: !prev[k] }))}
                          className="w-16 sm:w-28 flex justify-center"
                        >
                          {checkbox(!!recebeNota[k])}
                        </button>
                        <div className="w-28 sm:w-44 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleInsere(k)}
                            title={travado ? `Já inseriu ${inserida} questão(ões) — não pode ser removido` : undefined}
                          >
                            {checkbox(!!insere[k], travado)}
                          </button>
                          <input
                            type="number"
                            min={Math.max(1, inserida)}
                            disabled={!insere[k]}
                            value={qtdCota[k] ?? 1}
                            onChange={(e) => setQtdCota((prev) => ({ ...prev, [k]: Math.max(1, inserida, Number(e.target.value)) }))}
                            className="w-14 sm:w-16 px-2 py-1 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-center text-ms-main outline-none focus:ring-2 focus:ring-ms-blue disabled:opacity-40"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-ms-main cursor-pointer">
                  <input type="checkbox" checked={gerarAuto} onChange={(e) => setGerarAuto(e.target.checked)} />
                  Gerar automaticamente (sortear do banco as questões que faltam)
                </label>
                {gerarAuto && (
                  <SortearQuestoesPanel
                    area={area}
                    qtdMaxima={Math.max(0, qtdArea - somaCotas)}
                    excluir={excluirOutrasAreas}
                    sorteadas={sorteadas}
                    onChange={setSorteadas}
                  />
                )}
              </div>

              <p
                className={`text-xs font-bold ${
                  distribuido === qtdArea
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : distribuido > qtdArea
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                Distribuídas: {distribuido} de {qtdArea} ({somaCotas} por professores + {qtdSorteadas} sorteadas)
                {distribuido < qtdArea && ' — dá para salvar assim e completar depois; a publicação só libera com a área completa.'}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-ms-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || loading || somenteLeitura}
            onClick={handleSalvar}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40 shadow transition-all"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar configuração da área
          </button>
        </div>
      </div>
    </div>
  );
}
