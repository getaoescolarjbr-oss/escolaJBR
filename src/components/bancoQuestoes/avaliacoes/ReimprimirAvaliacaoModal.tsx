import { useEffect, useRef, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { Avaliacao } from '../../../types/avaliacoes';
import { PROVA_QUESTOES_CSS, entraNoCartaoResposta, printProva } from '../../../utils/printProva';
import { obterQuestoesDaAvaliacao } from '../../../services/avaliacoesService';
import { buscarQuestoesPorIds } from '../../../services/bancoQuestoesService';
import { QuestaoImpressa } from '../QuestaoImpressa';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

// Reimpressão de uma avaliação já salva — reconstrói o mesmo layout do AvaliacaoPreviewModal
// a partir dos dados persistidos, sem gravar nada de novo (só leitura + printProva).
export function ReimprimirAvaliacaoModal({ avaliacao, onClose }: Props) {
  const [questoes, setQuestoes] = useState<Question[] | null>(null);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const itens = await obterQuestoesDaAvaliacao(avaliacao.id);
        const questoesBanco = await buscarQuestoesPorIds(itens.map((i) => i.question_id));
        const porId = new Map(questoesBanco.map((q) => [q.id, q]));
        const ordenadas = itens
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((i) => porId.get(i.question_id))
          .filter((q): q is Question => !!q);
        setQuestoes(ordenadas);
        setValores(Object.fromEntries(itens.map((i) => [i.question_id, i.valor])));
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar as questões desta avaliação.');
      }
    })();
  }, [avaliacao.id]);

  function imprimir() {
    printProva(previewRef.current, avaliacao.titulo || 'Avaliação');
  }

  const dataFormatada = avaliacao.data_aplicacao
    ? new Date(avaliacao.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <h2 className="text-lg font-bold text-ms-main">Reimprimir — {avaliacao.titulo}</h2>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!questoes && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />}

          {questoes && (
            <div className="border border-gray-800 rounded-xl p-4 bg-white overflow-x-auto">
              {/* Mesmo CSS da impressão — ver printProva.ts. */}
              <style>{PROVA_QUESTOES_CSS}</style>
              <div ref={previewRef} style={{ color: '#1a1a2e', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11pt' }}>
                <div className="prova-header" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', gap: 12 }}>
                  <img
                    src={`${window.location.origin}/logo.png.png`}
                    alt="Logo da escola"
                    className="prova-logo"
                    style={{ height: '100%', width: 'auto', maxWidth: 110, objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div className="prova-header-info">
                    <div className="prova-escola">E.E. José Barbosa Rodrigues</div>
                    <div className="prova-titulo">{avaliacao.titulo}</div>
                    {avaliacao.disciplina && <div className="prova-meta">Disciplina: {avaliacao.disciplina}</div>}
                    <div className="prova-aluno">
                      <span>Nome: ______________________________________________</span>
                      <span>Turma: {(avaliacao.turma_nomes ?? []).join(', ') || '__________'}</span>
                      <span>Data: {dataFormatada}</span>
                    </div>
                  </div>
                  <div className="prova-nota-box">
                    <span className="prova-nota-label">Nota</span>
                  </div>
                </div>

                {avaliacao.instrucoes && <div className="prova-instrucoes">{avaliacao.instrucoes}</div>}

                <div className="questoes-coluna duas-colunas">
                  {questoes.map((q, i) => (
                    <QuestaoImpressa key={q.id} questao={q} indice={i} valor={valores[q.id] ?? 0} />
                  ))}
                </div>

                {/* Só as objetivas entram no cartão; a numeração continua sendo a da prova. */}
                {questoes.some(entraNoCartaoResposta) && (
                  <div className="cartao-resposta">
                    <div className="cartao-titulo">Cartão resposta</div>
                    <div className="cartao-grid">
                      {questoes
                        .map((q, i) => ({ q, numero: i + 1 }))
                        .filter(({ q }) => entraNoCartaoResposta(q))
                        .map(({ q, numero }) => (
                          <div className="cartao-item" key={q.id}>
                            <span className="cartao-num">{numero}.</span>
                            <div className="cartao-bolhas">
                              {LETRAS.slice(0, q.alternatives.length).map((letra) => (
                                <span className="bolha" key={letra}>{letra}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 no-print">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800">
            Fechar
          </button>
          <button
            onClick={imprimir}
            disabled={!questoes}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
