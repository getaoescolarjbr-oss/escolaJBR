import { useEffect, useState } from 'react';
import { Eye, Loader2, X } from 'lucide-react';
import type { Avaliacao, QuestaoParaAluno } from '../../../types/avaliacoes';
import { obterQuestoesAvaliacaoPreview } from '../../../services/avaliacoesService';
import { QuestaoAlunoView } from '../../aluno/QuestaoAlunoView';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

// Mostra ao professor a avaliação exatamente como o aluno vai vê-la. Usa o mesmo
// QuestaoAlunoView de RealizarAvaliacaoModal de propósito: se a tela do aluno
// mudar, esta muda junto. A diferença é só que aqui nada é enviado — marcar uma
// alternativa serve pra conferir o comportamento, não grava resposta nenhuma.
export function PreviewAvaliacaoAlunoModal({ avaliacao, onClose }: Props) {
  const [questoes, setQuestoes] = useState<QuestaoParaAluno[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterQuestoesAvaliacaoPreview(avaliacao.id)
      .then(setQuestoes)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as questões.'));
  }, [avaliacao.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">{avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted flex items-center gap-1.5 mt-0.5">
              <Eye className="w-3.5 h-3.5" />
              Visão do aluno · nenhuma resposta é gravada
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!questoes && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />}
          {questoes?.length === 0 && <p className="text-sm text-ms-muted">Esta avaliação não tem questões.</p>}

          {questoes?.map((q, i) => (
            <QuestaoAlunoView
              key={q.question_id}
              questao={q}
              indice={i}
              letraMarcada={respostas[q.question_id] ?? null}
              somenteLeitura={false}
              onMarcar={(letra) => setRespostas((prev) => ({ ...prev, [q.question_id]: letra }))}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800">
          <p className="text-sm text-ms-muted">
            {questoes ? `${questoes.length} questão(ões)` : ''}
          </p>
          <button onClick={onClose} className="px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
