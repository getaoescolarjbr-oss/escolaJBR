import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Turma } from '../../types';
import type { Question } from '../../types/bancoQuestoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { AREAS_CONHECIMENTO } from '../../utils/areasConhecimento';
import type { AvaliacaoArea, NovaAvaliacaoGeralInput } from '../../types/avaliacoes';
import type { ModoEmbaralhar } from '../../types/correcaoOmr';
import { buscarInstrucoesPadrao, buscarModoNota, criarAvaliacaoGeral, definirModoNota, editarAvaliacaoGeral } from '../../services/avaliacoesService';
import { getCurrentBimestre } from '../../utils/academicUtils';
import { CamposAvaliacaoComuns, CamposSoNota, versoesEfetivas, type ValoresCamposAvaliacao } from './CamposAvaliacaoComuns';
import { SortearQuestoesPanel } from './SortearQuestoesPanel';

interface Props {
  onClose: () => void;
  onCriada: () => void;
  /** Presente = modo edição (só antes de publicar). */
  avaliacaoExistente?: AvaliacaoArea;
  /** Avaliação geral só de nota: sem questões, só cria o campo de nota para os professores. */
  somenteNota?: boolean;
}

// ISO (UTC) → valor de input datetime-local em hora local.
function paraDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Modalidade = 'COM_NOTA' | 'PUBLICO';

interface ConfigArea {
  ativa: boolean;
  qtd: number;
  gerarAuto: boolean;
  sorteadas: Question[];
}

const QTD_PADRAO_POR_AREA = 10;

export function NovaAvaliacaoGeralModal({ onClose, onCriada, avaliacaoExistente: ex, somenteNota }: Props) {
  const editando = !!ex;
  const soNota = ex ? !!ex.somente_nota : !!somenteNota;
  const [campos, setCampos] = useState<ValoresCamposAvaliacao>(() => ({
    titulo: ex?.titulo ?? (soNota ? 'Avaliação Geral (nota)' : 'Avaliação Geral'),
    bimestre: ex?.bimestre_id ?? getCurrentBimestre(),
    valorTotal: ex ? Number(ex.valor_total) : 10,
    modo: ex?.modo ?? 'IMPRESSA',
    tipo: ex?.tipo ?? 'AVALIACAO',
    dataAplicacao: ex?.data_aplicacao ?? '',
    prazoEntrega: ex?.prazo_entrega ? paraDatetimeLocal(ex.prazo_entrega) : '',
    instrucoes: ex?.instrucoes ?? '',
    embaralhar: (ex?.embaralhar as ModoEmbaralhar) ?? 'NENHUM',
    qtdVersoes: ex?.qtd_versoes ?? 1,
    modoVersoes: 'FIXO',
    posicaoCartao: ex?.cartao_separado ? 'SEPARADO' : (ex?.cartao_posicao ?? 'FIM'),
    modoNota: 'DIRETA',
    ponderadaEscopo: 'PROVA',
  }));
  const atualizarCampos = (patch: Partial<ValoresCamposAvaliacao>) => setCampos((prev) => ({ ...prev, ...patch }));

  const [modalidade, setModalidade] = useState<Modalidade>(ex?.tipo === 'SIMULADO' ? 'PUBLICO' : 'COM_NOTA');
  const [lancarPublico, setLancarPublico] = useState(ex?.tipo === 'SIMULADO' ? !!ex.lancar_no_boletim : false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>(ex?.turma_ids ?? []);
  const [totalQuestoes, setTotalQuestoes] = useState(ex?.qtd_questoes_total ?? QTD_PADRAO_POR_AREA * AREAS_CONHECIMENTO.length);
  const [areas, setAreas] = useState<Record<AreaConhecimento, ConfigArea>>(() =>
    Object.fromEntries(
      AREAS_CONHECIMENTO.map((a): [AreaConhecimento, ConfigArea] => {
        if (!ex) return [a, { ativa: true, qtd: QTD_PADRAO_POR_AREA, gerarAuto: false, sorteadas: [] }];
        const salva = ex.areas?.find((x) => x.area_conhecimento === a);
        return [a, { ativa: !!salva, qtd: salva?.qtd_questoes ?? QTD_PADRAO_POR_AREA, gerarAuto: false, sorteadas: [] }];
      })
    ) as unknown as Record<AreaConhecimento, ConfigArea>
  );
  // Editando: área que já tem questão não pode ser retirada (o servidor também recusa).
  const inseridasPorArea = Object.fromEntries((ex?.areas ?? []).map((a) => [a.area_conhecimento, a.qtd_inserida])) as Record<string, number>;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('turmas').select('*').order('nome');
        setTurmas(data || []);
        if (!editando) {
          const texto = await buscarInstrucoesPadrao().catch(() => '');
          if (texto) atualizarCampos({ instrucoes: texto });
        } else if (!soNota) {
          const salvo = await buscarModoNota(ex!.id).catch(() => null);
          if (salvo) atualizarCampos({ modoNota: salvo.modo_nota, ponderadaEscopo: salvo.ponderada_escopo });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const areasAtivas = AREAS_CONHECIMENTO.filter((a) => areas[a].ativa);
  const somaAreas = areasAtivas.reduce((s, a) => s + (areas[a].qtd || 0), 0);

  function atualizarArea(area: AreaConhecimento, patch: Partial<ConfigArea>) {
    setAreas((prev) => ({ ...prev, [area]: { ...prev[area], ...patch } }));
  }

  // Reparte o total entre as áreas marcadas; a sobra da divisão vai para as primeiras.
  function dividirIgualmente() {
    if (areasAtivas.length === 0) return;
    const base = Math.floor(totalQuestoes / areasAtivas.length);
    const resto = totalQuestoes % areasAtivas.length;
    setAreas((prev) => {
      const novo = { ...prev };
      areasAtivas.forEach((a, i) => {
        const qtd = base + (i < resto ? 1 : 0);
        novo[a] = { ...prev[a], qtd, sorteadas: prev[a].sorteadas.slice(0, qtd) };
      });
      return novo;
    });
  }

  function escolherModalidade(m: Modalidade) {
    setModalidade(m);
    // Simulado público é respondido pelo link, então o padrão passa a ser online.
    if (m === 'PUBLICO' && campos.modo === 'IMPRESSA') atualizarCampos({ modo: 'ONLINE' });
  }

  function toggleTurma(id: string) {
    setTurmasSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSalvar() {
    if (!campos.titulo.trim()) { setErro('Informe o título da avaliação.'); return; }
    if (areasAtivas.length === 0) { setErro('Selecione pelo menos uma área participante.'); return; }
    if (!soNota && areasAtivas.some((a) => !areas[a].qtd || areas[a].qtd < 1)) {
      setErro('Cada área participante precisa de pelo menos 1 questão.');
      return;
    }
    if (!soNota && somaAreas !== totalQuestoes) {
      setErro(`A soma das áreas (${somaAreas}) precisa ser igual ao total de questões (${totalQuestoes}).`);
      return;
    }
    if (turmasSelecionadas.length === 0) { setErro('Selecione pelo menos uma turma.'); return; }
    const excedida = areasAtivas.find((a) => areas[a].sorteadas.length > areas[a].qtd);
    if (excedida) { setErro(`A área ${excedida} tem mais questões sorteadas do que a quantidade prevista.`); return; }

    setSalvando(true);
    setErro(null);
    try {
      const dados: NovaAvaliacaoGeralInput = {
        titulo: campos.titulo.trim(),
        bimestre_id: campos.bimestre,
        valor_total: Number(campos.valorTotal),
        modo: campos.modo,
        tipo: modalidade === 'COM_NOTA' ? 'AVALIACAO' : 'SIMULADO',
        lancar_no_boletim: modalidade === 'COM_NOTA' ? true : lancarPublico,
        data_aplicacao: campos.dataAplicacao || null,
        prazo_entrega: campos.modo !== 'IMPRESSA' && campos.prazoEntrega ? new Date(campos.prazoEntrega).toISOString() : null,
        instrucoes: campos.instrucoes.trim() || null,
        turma_ids: turmasSelecionadas,
        areas: areasAtivas.map((a) => ({
          area: a,
          qtd_questoes: soNota ? 0 : areas[a].qtd,
          questoes: !soNota && areas[a].gerarAuto ? areas[a].sorteadas.map((q) => q.id) : [],
        })),
        embaralhar: campos.embaralhar,
        qtd_versoes: versoesEfetivas(campos),
        cartao_separado: campos.posicaoCartao === 'SEPARADO',
        cartao_posicao: campos.posicaoCartao === 'INICIO' ? 'INICIO' : 'FIM',
        somente_nota: soNota,
      };
      let provaId = ex?.id ?? '';
      if (editando) await editarAvaliacaoGeral(ex!.id, dados);
      else provaId = await criarAvaliacaoGeral(dados);
      // Só de nota: a nota é digitada à mão, não há cálculo a escolher.
      if (!soNota) await definirModoNota(provaId, campos.modoNota, campos.ponderadaEscopo);
      onCriada();
    } catch (e: any) {
      setErro(e.message || `Erro ao ${editando ? 'salvar' : 'criar'} avaliação geral.`);
    } finally {
      setSalvando(false);
    }
  }

  const cardModalidade = (m: Modalidade, titulo: string, descricao: string) => {
    const sel = modalidade === m;
    return (
      <button
        type="button"
        onClick={() => escolherModalidade(m)}
        className={`flex-1 text-left p-3 rounded-xl border-2 transition-all ${
          sel ? 'border-ms-blue bg-blue-50 dark:bg-ms-blue/10' : 'border-gray-200 dark:border-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${sel ? 'border-ms-blue' : 'border-gray-400'}`}>
            {sel && <span className="w-2 h-2 rounded-full bg-ms-blue" />}
          </span>
          <span className="text-sm font-bold text-ms-main">{titulo}</span>
        </div>
        <p className="text-xs text-ms-muted mt-1 ml-6">{descricao}</p>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">
              {editando ? 'Editar' : soNota ? 'Nova' : 'Criar'} Avaliação Geral{soNota ? ' só de Nota' : ''}
            </h2>
            <p className="text-xs text-ms-muted">
              {soNota
                ? 'Sem questões: só cria o campo de nota no diário. Depois de criada, cada coordenador de área escolhe quais professores recebem a nota.'
                : editando
                ? 'Ajuste os dados, as turmas e as áreas. As questões já inseridas ou sorteadas continuam; área com questão não pode ser retirada.'
                : 'Uma prova única, com um só gabarito, montada pelas áreas. Depois de criada, cada coordenador de área escolhe quem recebe a nota e quem insere as questões da sua parte.'}
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
              {/* 1. Modalidade */}
              {!soNota && (
              <div>
                <label className="block text-xs font-bold text-ms-muted mb-2">Modalidade *</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {cardModalidade('COM_NOTA', 'Avaliação com nota', 'Cria o campo de nota no boletim das turmas selecionadas, para os professores escolhidos por cada área.')}
                  {cardModalidade('PUBLICO', 'Avaliação pública sem login', 'O aluno responde pelo link digitando o código do SGDE.')}
                </div>
                {modalidade === 'PUBLICO' && (
                  <label className="flex items-center gap-2 mt-3 text-sm text-ms-main cursor-pointer">
                    <input type="checkbox" checked={lancarPublico} onChange={(e) => setLancarPublico(e.target.checked)} />
                    Gerar nota no boletim (os professores escolhidos lançam a nota depois, em "Resultados")
                  </label>
                )}
              </div>
              )}

              {/* Dados da prova (mesmos da Avaliação de Área) */}
              {soNota ? (
                <CamposSoNota valores={campos} onChange={atualizarCampos} />
              ) : (
                <CamposAvaliacaoComuns
                  valores={campos}
                  onChange={atualizarCampos}
                  turmasSelecionadas={turmasSelecionadas}
                  onErro={setErro}
                />
              )}

              {/* 2. Áreas e distribuição */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-ms-main">{soNota ? 'Áreas participantes' : 'Áreas participantes e questões'}</h3>
                    <p className="text-xs text-ms-muted">
                      {soNota
                        ? 'O coordenador de cada área marcada escolhe quais professores da área recebem a nota.'
                        : 'A prova sai em blocos, nesta ordem. Marque "Gerar automaticamente" para já sortear as questões de uma área.'}
                    </p>
                  </div>
                  {!soNota && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-ms-muted">Total de questões</label>
                    <input
                      type="number"
                      min={1}
                      value={totalQuestoes}
                      onChange={(e) => setTotalQuestoes(Number(e.target.value))}
                      className="w-20 px-2 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-center text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                    <button
                      type="button"
                      onClick={dividirIgualmente}
                      className="px-2.5 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-ms-main rounded-lg border border-gray-300 dark:border-gray-700"
                    >
                      Dividir igualmente
                    </button>
                  </div>
                  )}
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
                  {AREAS_CONHECIMENTO.map((a) => {
                    const cfg = areas[a];
                    const excluirOutras = AREAS_CONHECIMENTO.filter((o) => o !== a).flatMap((o) => areas[o].sorteadas.map((q) => q.id));
                    const inseridas = inseridasPorArea[a] ?? 0;
                    return (
                      <div key={a} className={`p-3 space-y-3 ${cfg.ativa ? '' : 'opacity-60'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => inseridas === 0 && atualizarArea(a, { ativa: !cfg.ativa })}
                            title={inseridas > 0 ? `Já tem ${inseridas} questão(ões) — não pode ser retirada` : undefined}
                            className={`flex items-center gap-3 select-none ${inseridas > 0 ? 'cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center border ${
                                cfg.ativa ? 'bg-ms-blue border-ms-blue text-white' : 'border-gray-400 dark:border-gray-600 bg-white dark:bg-ms-dark'
                              }`}
                            >
                              {cfg.ativa && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                            <span className="text-sm font-bold text-ms-main">{a}</span>
                          </button>
                          {cfg.ativa && !soNota && (
                            <div className="flex items-center gap-3 flex-wrap">
                              {editando ? (
                                <span className="text-xs text-ms-muted">{inseridas} já na prova</span>
                              ) : (
                              <label className="flex items-center gap-1.5 text-xs text-ms-main cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cfg.gerarAuto}
                                  onChange={(e) => atualizarArea(a, { gerarAuto: e.target.checked })}
                                />
                                Gerar automaticamente
                              </label>
                              )}
                              <span className="text-xs text-ms-muted">Questões:</span>
                              <input
                                type="number"
                                min={1}
                                value={cfg.qtd}
                                onChange={(e) => atualizarArea(a, { qtd: Number(e.target.value) })}
                                className="w-16 px-2 py-1 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-center text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                              />
                            </div>
                          )}
                        </div>
                        {cfg.ativa && !soNota && cfg.gerarAuto && (
                          <SortearQuestoesPanel
                            area={a}
                            qtdMaxima={cfg.qtd}
                            excluir={excluirOutras}
                            sorteadas={cfg.sorteadas}
                            onChange={(qs) => atualizarArea(a, { sorteadas: qs })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {!soNota && (
                <p className={`text-xs font-bold ${somaAreas === totalQuestoes ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  Soma das áreas: {somaAreas} de {totalQuestoes} questões
                  {somaAreas !== totalQuestoes && ' — ajuste as quantidades ou use "Dividir igualmente".'}
                </p>
                )}
              </div>

              {/* 3. Turmas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-ms-muted">Turma(s) que vão receber esta avaliação *</label>
                  <button
                    type="button"
                    onClick={() => setTurmasSelecionadas(turmasSelecionadas.length === turmas.length ? [] : turmas.map((t) => t.id))}
                    className="text-[11px] font-bold text-ms-blueText hover:underline"
                  >
                    {turmasSelecionadas.length === turmas.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                </div>
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
                            : 'bg-gray-100 dark:bg-ms-dark text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800 hover:border-gray-400'
                        }`}
                      >
                        {t.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
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
            disabled={salvando || loading}
            onClick={handleSalvar}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40 shadow transition-all"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {editando ? 'Salvar Alterações' : soNota ? 'Criar Avaliação só de Nota' : 'Criar Avaliação Geral'}
          </button>
        </div>
      </div>
    </div>
  );
}
