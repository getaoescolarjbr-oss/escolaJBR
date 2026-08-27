import { useEffect, useRef, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { Avaliacao } from '../../../types/avaliacoes';
import { renderLightMarkup } from '../../../lib/questionMarkup';
import { printProva } from '../../../utils/printProva';
import { obterQuestoesDaAvaliacao } from '../../../services/avaliacoesService';
import { buscarQuestoesPorIds } from '../../../services/bancoQuestoesService';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

function textoLimpo(texto: string) {
  return texto.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '').trim();
}

function alternativasCabemNaLinha(q: Question) {
  const total = q.alternatives.reduce((soma, a) => soma + textoLimpo(a.text).length, 0);
  return total <= 60;
}

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
          {!questoes && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />}

          {questoes && (
            <div className="border border-gray-800 rounded-xl p-4 bg-white overflow-x-auto">
              <style>{`
                .questoes-coluna.duas-colunas { column-count: 2; column-gap: 18px; column-rule: 1px solid #999; }
                .questao { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ddd; }
                .questao-num { font-weight: 900; color: #002677; }
                .questao-enunciado { margin: 3px 0 5px; line-height: 1.35; text-align: justify; }
                .questao-img { max-width: 100%; margin: 4px 0; }
                .prova-nota-box { display: flex; flex-direction: column; width: 74px; min-width: 74px; flex-shrink: 0; border: 1.5px solid #002677; border-radius: 6px; overflow: hidden; }
                .prova-nota-label { font-size: 0.72em; font-weight: 900; color: #002677; text-align: center; text-transform: uppercase; letter-spacing: 0.4px; padding: 3px 0; border-bottom: 1.5px solid #002677; background: #f0f4ff; }
                .alternativas-linha { display: flex; flex-wrap: wrap; gap: 4px 14px; }
                .alternativas-coluna { display: flex; flex-direction: column; gap: 3px; }
                .alternativa { display: flex; gap: 4px; align-items: flex-start; }
                .alternativa b { flex-shrink: 0; }
                .alternativa-texto { flex: 1; text-align: justify; }
              `}</style>
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
                    <div className="questao" key={q.id}>
                      <div className="questao-enunciado">
                        {renderLightMarkup(q.statement, `p-${q.id}`, <span className="questao-num">{i + 1}. </span>)}
                        {' '}<span style={{ fontSize: '0.8em', color: '#666' }}>({(valores[q.id] ?? 0).toFixed(2)} pt)</span>
                      </div>
                      {q.image_url && <img src={q.image_url} alt="" className="questao-img" />}
                      <div className={alternativasCabemNaLinha(q) ? 'alternativas-linha' : 'alternativas-coluna'}>
                        {q.alternatives.map((a) => (
                          <div className="alternativa" key={a.letter}>
                            <b>{a.letter})</b>
                            <div className="alternativa-texto">{renderLightMarkup(a.text, `p-${q.id}-${a.letter}`)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cartao-resposta">
                  <div className="cartao-titulo">Cartão resposta</div>
                  <div className="cartao-grid">
                    {questoes.map((q, i) => (
                      <div className="cartao-item" key={q.id}>
                        <span className="cartao-num">{i + 1}.</span>
                        <div className="cartao-bolhas">
                          {LETRAS.slice(0, q.alternatives.length).map((letra) => (
                            <span className="bolha" key={letra}>{letra}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
