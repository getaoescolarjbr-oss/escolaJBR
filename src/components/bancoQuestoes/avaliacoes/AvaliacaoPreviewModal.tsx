import { useRef, useState } from 'react';
import { Loader2, Printer, Save, Send, X } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { NovaAvaliacaoInput } from '../../../types/avaliacoes';
import { renderLightMarkup } from '../../../lib/questionMarkup';
import { printProva } from '../../../utils/printProva';
import { criarAvaliacao } from '../../../services/avaliacoesService';

interface Props {
  config: Omit<NovaAvaliacaoInput, 'questoes'>;
  questoes: Question[];
  valoresPorQuestao: Record<string, number>;
  turmaNomes: string[];
  onVoltar: () => void;
  onSalvo: () => void;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

function textoLimpo(texto: string) {
  return texto.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '').trim();
}

function alternativasCabemNaLinha(q: Question) {
  const total = q.alternatives.reduce((soma, a) => soma + textoLimpo(a.text).length, 0);
  return total <= 60;
}

// Passo 3 do gerador: preview idêntico ao GerarProvaModal (mesmo printProva.ts), mas agora
// persistindo a avaliação no banco antes de imprimir/publicar em vez de ser só um documento
// avulso.
export function AvaliacaoPreviewModal({ config, questoes, valoresPorQuestao, turmaNomes, onVoltar, onSalvo }: Props) {
  const [posicaoCartao, setPosicaoCartao] = useState<'inicio' | 'fim'>('fim');
  const [colunas, setColunas] = useState<1 | 2>(2);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const conteudos = Array.from(new Set(questoes.map((q) => q.assunto).filter((a): a is string => !!a))).join(', ');
  const dataFormatada = config.dataAplicacao
    ? new Date(config.dataAplicacao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  const questoesInput = questoes.map((q, i) => ({ question_id: q.id, ordem: i, valor: valoresPorQuestao[q.id] ?? 0 }));

  async function salvar(status: 'RASCUNHO' | 'PUBLICADA', imprimirDepois: boolean) {
    setSalvando(true);
    setErro(null);
    try {
      await criarAvaliacao({ ...config, questoes: questoesInput }, status);
      if (imprimirDepois) printProva(previewRef.current, config.titulo || 'Avaliação');
      onSalvo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null);
      setErro(msg || 'Não foi possível salvar a avaliação.');
    } finally {
      setSalvando(false);
    }
  }

  const cartaoResposta = (
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
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <h2 className="text-lg font-bold text-ms-main">Revisar avaliação ({questoes.length} questões)</h2>
          <button onClick={onVoltar} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
            <div>
              <label className="text-xs font-bold text-ms-muted">Cartão resposta</label>
              <select
                className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                value={posicaoCartao}
                onChange={(e) => setPosicaoCartao(e.target.value as 'inicio' | 'fim')}
              >
                <option value="inicio">No início</option>
                <option value="fim">No final</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Colunas das questões</label>
              <select
                className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                value={colunas}
                onChange={(e) => setColunas(Number(e.target.value) as 1 | 2)}
              >
                <option value={1}>1 coluna</option>
                <option value={2}>2 colunas</option>
              </select>
            </div>
          </div>

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
                  <div className="prova-titulo">{config.titulo || 'Avaliação'}</div>
                  {config.disciplina && <div className="prova-meta">Disciplina: {config.disciplina}</div>}
                  {conteudos && <div className="prova-meta">Conteúdo(s): {conteudos}</div>}
                  <div className="prova-aluno">
                    <span>Nome: ______________________________________________</span>
                    <span>Turma: {turmaNomes.join(', ') || '__________'}</span>
                    <span>Data: {dataFormatada}</span>
                  </div>
                </div>
                <div className="prova-nota-box">
                  <span className="prova-nota-label">Nota</span>
                </div>
              </div>

              {config.instrucoes && <div className="prova-instrucoes">{config.instrucoes}</div>}

              {posicaoCartao === 'inicio' && cartaoResposta}

              <div className={`questoes-coluna${colunas === 2 ? ' duas-colunas' : ''}`}>
                {questoes.map((q, i) => (
                  <div className="questao" key={q.id}>
                    <div className="questao-enunciado">
                      {renderLightMarkup(q.statement, `p-${q.id}`, <span className="questao-num">{i + 1}. </span>)}
                      {' '}<span style={{ fontSize: '0.8em', color: '#666' }}>({(valoresPorQuestao[q.id] ?? 0).toFixed(2)} pt)</span>
                    </div>
                    {q.image_url && <img src={q.image_url} alt="" className="questao-img" />}
                    <div className={alternativasCabemNaLinha(q) ? 'alternativas-linha' : 'alternativas-coluna'}>
                      {q.alternatives.map((a) => (
                        <div className="alternativa" key={a.letter}>
                          <b>{a.letter})</b>
                          <div className="alternativa-texto">{renderLightMarkup(a.text, `p-${q.id}-${a.letter}`, undefined, 'left')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {posicaoCartao === 'fim' && cartaoResposta}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800 no-print">
          <div>
            {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onVoltar} disabled={salvando} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800 disabled:opacity-40">
              Voltar
            </button>
            <button
              onClick={() => salvar('RASCUNHO', false)}
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-40"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar rascunho
            </button>
            {(config.modo === 'IMPRESSA' || config.modo === 'AMBAS') && (
              <button
                onClick={() => salvar(config.modo === 'IMPRESSA' ? 'PUBLICADA' : 'PUBLICADA', true)}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-40"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Salvar e imprimir
              </button>
            )}
            <button
              onClick={() => salvar('PUBLICADA', false)}
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar e publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
