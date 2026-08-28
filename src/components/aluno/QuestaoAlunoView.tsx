import { Check, XCircle } from 'lucide-react';
import type { ItemResultadoSubmissao, QuestaoParaAluno } from '../../types/avaliacoes';
import { renderLightMarkup } from '../../lib/questionMarkup';

interface Props {
  questao: QuestaoParaAluno;
  indice: number;
  letraMarcada: string | null;
  /** Só existe depois de enviar: pinta acerto/erro e revela o gabarito. */
  resultado?: ItemResultadoSubmissao;
  somenteLeitura: boolean;
  onMarcar?: (letra: string) => void;
}

// Renderização de UMA questão na visão do aluno. Fica num componente próprio
// porque o professor tem um preview dessa mesma tela (PreviewAvaliacaoModal) e a
// exigência é que ele veja exatamente o que o aluno verá — duas cópias do JSX
// divergiriam na primeira alteração.
export function QuestaoAlunoView({ questao, indice, letraMarcada, resultado, somenteLeitura, onMarcar }: Props) {
  return (
    <div className="border-b border-gray-800 pb-4 last:border-0">
      <div className="text-sm text-ms-main">
        {renderLightMarkup(questao.statement, `p-${questao.question_id}`, <span className="font-bold text-ms-blueText">{indice + 1}. </span>)}
        <span className="text-xs text-ms-muted ml-1">({Number(questao.valor).toFixed(2)} pt)</span>
      </div>
      {questao.image_url && <img src={questao.image_url} alt="" className="max-w-full rounded-lg my-2" />}
      <div className="space-y-2 mt-2">
        {questao.alternatives.map((a) => {
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
    </div>
  );
}
