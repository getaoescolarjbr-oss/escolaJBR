import { Check, PenLine, XCircle } from 'lucide-react';
import type { ItemResultadoSubmissao, QuestaoParaAluno } from '../../types/avaliacoes';
import { TIPO_QUESTAO_LABEL, ehQuestaoEscrita, normalizarTipoQuestao, ordenarAlternativas } from '../../types/bancoQuestoes';
import { renderLightMarkup } from '../../lib/questionMarkup';

interface Props {
  questao: QuestaoParaAluno;
  indice: number;
  letraMarcada: string | null;
  /** Texto digitado nas questões dissertativas/redação. */
  textoResposta?: string;
  /** Só existe depois de enviar: pinta acerto/erro e revela o gabarito. */
  resultado?: ItemResultadoSubmissao;
  somenteLeitura: boolean;
  onMarcar?: (letra: string) => void;
  onEscrever?: (texto: string) => void;
}

// Renderização de UMA questão na visão do aluno. Fica num componente próprio
// porque o professor tem um preview dessa mesma tela (PreviewAvaliacaoModal) e a
// exigência é que ele veja exatamente o que o aluno verá — duas cópias do JSX
// divergiriam na primeira alteração.
//
// Objetiva mostra as alternativas; dissertativa e redação mostram uma área de
// texto com contador — nesses tipos `alternatives` vem vazio e não existe
// gabarito para revelar, a nota depende da correção manual do professor.
export function QuestaoAlunoView({
  questao,
  indice,
  letraMarcada,
  textoResposta = '',
  resultado,
  somenteLeitura,
  onMarcar,
  onEscrever,
}: Props) {
  const tipo = normalizarTipoQuestao(questao.tipo);
  const escrita = ehQuestaoEscrita(tipo);

  return (
    <div className="border-b border-gray-800 pb-4 last:border-0">
      <div className="text-sm text-ms-main">
        {renderLightMarkup(
          questao.statement,
          `p-${questao.question_id}`,
          <span className="font-bold text-ms-blueText">
            {indice + 1}. <span className="font-normal text-ms-muted text-xs">({Number(questao.valor).toFixed(2)} pt)</span>{' '}
          </span>
        )}
        {escrita && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ms-gold/20 text-ms-gold text-[11px] font-bold align-middle">
            <PenLine className="w-3 h-3" />
            {TIPO_QUESTAO_LABEL[tipo]}
          </span>
        )}
      </div>
      {questao.image_url && <img src={questao.image_url} alt="" className="max-w-full rounded-lg my-2" />}

      {escrita ? (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={textoResposta}
            onChange={(e) => onEscrever?.(e.target.value)}
            readOnly={somenteLeitura}
            rows={tipo === 'REDACAO' ? 14 : 6}
            placeholder={
              somenteLeitura
                ? 'Sem resposta escrita.'
                : tipo === 'REDACAO'
                ? 'Escreva sua redação aqui...'
                : 'Escreva sua resposta aqui...'
            }
            className={`w-full px-3 py-2 bg-ms-dark border rounded-lg text-sm text-ms-main resize-y outline-none focus:ring-2 focus:ring-ms-blue ${
              somenteLeitura ? 'border-gray-800 opacity-80' : 'border-gray-700'
            }`}
          />
          <div className="flex items-center justify-between gap-3 text-xs text-ms-muted">
            <span>Esta questão é corrigida pelo professor — a nota não sai na hora.</span>
            <span className="shrink-0 tabular-nums">{textoResposta.length} caractere(s)</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {ordenarAlternativas(questao.alternatives).map((a) => {
            const marcada = letraMarcada === a.letter;
            const correta = resultado && a.letter === resultado.correct_letter;
            const errouEssa = resultado && marcada && !resultado.correta;
            return (
              <label
                key={a.letter}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${somenteLeitura ? '' : 'cursor-pointer'} ${
                  resultado
                    ? correta
                      ? 'border-emerald-600 bg-emerald-900/20'
                      : errouEssa
                      ? 'border-red-600 bg-red-900/20'
                      : 'border-gray-800'
                    : marcada
                    ? 'border-ms-blueText bg-ms-blue/10'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name={questao.question_id}
                  checked={marcada}
                  disabled={somenteLeitura}
                  onChange={() => onMarcar?.(a.letter)}
                />
                <span className="font-bold">{a.letter})</span>
                <span className="flex-1 text-ms-main">
                  {renderLightMarkup(a.text, `p-${questao.question_id}-${a.letter}`, undefined, 'left')}
                </span>
                {resultado && correta && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                {resultado && errouEssa && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
