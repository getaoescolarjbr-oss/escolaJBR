import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, Loader2, X } from 'lucide-react';
import type { Avaliacao, ItemPendenteCorrecao } from '../../../types/avaliacoes';
import { TIPO_QUESTAO_LABEL, normalizarTipoQuestao } from '../../../types/bancoQuestoes';
import { renderLightMarkup } from '../../../lib/questionMarkup';
import { corrigirItemDissertativo, listarItensPendentesCorrecao } from '../../../services/avaliacoesService';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
  /** Chamado ao fechar depois de ter corrigido algo, pra a lista recarregar. */
  onCorrigido: () => void;
}

const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

function chaveAluno(item: ItemPendenteCorrecao) {
  return item.aluno_id;
}

// numeric do Postgres chega como string em algumas versões do supabase-js.
function valorMaximo(item: ItemPendenteCorrecao) {
  return Number(item.valor) || 0;
}

// Correção manual das respostas escritas (dissertativa/redação) de uma prova. Lista
// aluno + questão + o que o aluno escreveu, e grava nota/observação item a item via
// rpc_corrigir_item_dissertativo — é a RPC que recalcula a nota da prova e o
// status_correcao da resposta, o client não escreve direto na tabela.
export function CorrigirDissertativasModal({ avaliacao, onClose, onCorrigido }: Props) {
  const [itens, setItens] = useState<ItemPendenteCorrecao[] | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [houveCorrecao, setHouveCorrecao] = useState(false);
  const [apenasPendentes, setApenasPendentes] = useState(true);

  useEffect(() => {
    listarItensPendentesCorrecao(avaliacao.id)
      .then((lista) => {
        setItens(lista);
        setNotas(Object.fromEntries(lista.map((i) => [i.item_id, i.valor_obtido !== null ? String(i.valor_obtido) : ''])));
        setObservacoes(Object.fromEntries(lista.map((i) => [i.item_id, i.observacao_professor ?? ''])));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as respostas para correção.'));
  }, [avaliacao.id]);

  const visiveis = useMemo(
    () => (itens ?? []).filter((i) => (apenasPendentes ? !i.corrigido : true)),
    [itens, apenasPendentes]
  );
  const totalPendentes = useMemo(() => (itens ?? []).filter((i) => !i.corrigido).length, [itens]);

  // Agrupa por aluno só pra leitura: o professor corrige um aluno de cada vez.
  const grupos = useMemo(() => {
    const mapa = new Map<string, { nome: string; turma: string | null; itens: ItemPendenteCorrecao[] }>();
    for (const item of visiveis) {
      const chave = chaveAluno(item);
      const grupo = mapa.get(chave) ?? { nome: item.aluno_nome, turma: item.turma_nome, itens: [] };
      grupo.itens.push(item);
      mapa.set(chave, grupo);
    }
    for (const grupo of mapa.values()) grupo.itens.sort((a, b) => a.ordem - b.ordem);
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [visiveis]);

  async function salvar(item: ItemPendenteCorrecao) {
    const bruto = (notas[item.item_id] ?? '').replace(',', '.').trim();
    if (bruto === '') {
      setErro('Informe a nota antes de salvar.');
      return;
    }
    const valor = Number(bruto);
    if (!Number.isFinite(valor) || valor < 0 || valor > valorMaximo(item)) {
      setErro(`A nota precisa estar entre 0 e ${valorMaximo(item).toFixed(2)}.`);
      return;
    }
    setSalvandoId(item.item_id);
    setErro(null);
    try {
      await corrigirItemDissertativo(item.item_id, valor, (observacoes[item.item_id] ?? '').trim() || null);
      setHouveCorrecao(true);
      setItens((prev) =>
        (prev ?? []).map((i) =>
          i.item_id === item.item_id
            ? { ...i, corrigido: true, valor_obtido: valor, observacao_professor: (observacoes[item.item_id] ?? '').trim() || null }
            : i
        )
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a correção.');
    } finally {
      setSalvandoId(null);
    }
  }

  function fechar() {
    if (houveCorrecao) onCorrigido();
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Corrigir dissertativas — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted flex items-center gap-1.5 mt-0.5">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {itens ? `${totalPendentes} resposta(s) aguardando correção de ${itens.length} no total` : 'Carregando...'}
            </p>
          </div>
          <button onClick={fechar} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!itens && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />}

          {itens && (
            <label className="flex items-center gap-2 text-sm text-ms-muted font-bold cursor-pointer w-fit">
              <input type="checkbox" checked={apenasPendentes} onChange={(e) => setApenasPendentes(e.target.checked)} />
              Mostrar só as que faltam corrigir
            </label>
          )}

          {itens && grupos.length === 0 && (
            <p className="text-center text-ms-muted py-12">
              {itens.length === 0
                ? 'Esta avaliação não tem respostas escritas para corrigir.'
                : 'Todas as respostas escritas já foram corrigidas.'}
            </p>
          )}

          {grupos.map((grupo) => (
            <div key={grupo.nome + (grupo.turma ?? '')} className="space-y-3">
              <h3 className="text-sm font-black text-ms-main">
                {grupo.nome}
                {grupo.turma && <span className="text-ms-muted font-bold"> · {grupo.turma}</span>}
              </h3>

              {grupo.itens.map((item) => {
                const tipo = normalizarTipoQuestao(item.tipo);
                return (
                  <div key={item.item_id} className="bg-ms-dark/40 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="text-sm text-ms-main flex-1 min-w-[220px]">
                        {renderLightMarkup(
                          item.statement,
                          `c-${item.item_id}`,
                          <span className="font-bold text-ms-blueText">{item.ordem + 1}. </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ms-gold/20 text-ms-gold">
                          {TIPO_QUESTAO_LABEL[tipo]}
                        </span>
                        <span className="text-xs text-ms-muted font-bold">Vale {valorMaximo(item).toFixed(2)}</span>
                        {item.corrigido && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-700/30 text-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Corrigida
                          </span>
                        )}
                      </div>
                    </div>

                    {item.criterios_correcao && (
                      <div className="border-l-4 border-ms-gold pl-3 text-xs text-ms-muted">
                        <p className="font-black uppercase tracking-wider text-ms-gold mb-0.5">
                          {tipo === 'REDACAO' ? 'Competências avaliadas' : 'Resposta esperada'}
                        </p>
                        {renderLightMarkup(item.criterios_correcao, `crit-${item.item_id}`)}
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-ms-main mb-1">Resposta do aluno</p>
                      <p className="whitespace-pre-wrap text-sm text-ms-main bg-ms-card border border-gray-800 rounded-lg px-3 py-2">
                        {item.resposta_texto?.trim() ? item.resposta_texto : 'Em branco — o aluno não escreveu nada.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-end">
                      <div>
                        <label className="text-xs font-bold text-ms-muted">Nota (0 a {valorMaximo(item).toFixed(2)})</label>
                        <input
                          inputMode="decimal"
                          value={notas[item.item_id] ?? ''}
                          onChange={(e) =>
                            setNotas((prev) => ({ ...prev, [item.item_id]: e.target.value.replace(/[^\d.,]/g, '') }))
                          }
                          placeholder="0,00"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-ms-muted">Observação para o aluno (opcional)</label>
                        <input
                          value={observacoes[item.item_id] ?? ''}
                          onChange={(e) => setObservacoes((prev) => ({ ...prev, [item.item_id]: e.target.value }))}
                          placeholder="Ex.: faltou justificar o segundo argumento"
                          className={inputClass}
                        />
                      </div>
                      <button
                        onClick={() => salvar(item)}
                        disabled={salvandoId === item.item_id}
                        className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
                      >
                        {salvandoId === item.item_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {item.corrigido ? 'Regravar' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={fechar} className="px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
