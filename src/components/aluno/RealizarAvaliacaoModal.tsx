import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import type { AvaliacaoAluno, ItemResultadoSubmissao, QuestaoParaAluno } from '../../types/avaliacoes';
import { obterQuestoesAvaliacaoAluno, submeterRespostasAvaliacao } from '../../services/avaliacoesService';
import { QuestaoAlunoView } from './QuestaoAlunoView';

interface Props {
  avaliacao: AvaliacaoAluno;
  onClose: () => void;
  onEnviada: () => void;
}

// Busca as questões sem gabarito (rpc_questoes_avaliacao_aluno), deixa o aluno responder e
// envia via rpc_submeter_resposta_avaliacao — a correção é 100% server-side, o gabarito só
// chega ao client na resposta dessa submissão (feedback imediato).
export function RealizarAvaliacaoModal({ avaliacao, onClose, onEnviada }: Props) {
  const [questoes, setQuestoes] = useState<QuestaoParaAluno[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ItemResultadoSubmissao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const jaEnviada = avaliacao.resposta_status === 'ENVIADA';

  useEffect(() => {
    obterQuestoesAvaliacaoAluno(avaliacao.avaliacao_id)
      .then((qs) => {
        setQuestoes(qs);
        setRespostas(Object.fromEntries(qs.filter((q) => q.letra_marcada).map((q) => [q.question_id, q.letra_marcada as string])));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as questões.'));
  }, [avaliacao.avaliacao_id]);

  const respondidas = useMemo(() => Object.keys(respostas).length, [respostas]);
  const resultadoPorQuestao = useMemo(() => new Map((resultado ?? []).map((r) => [r.question_id, r])), [resultado]);

  function marcar(questionId: string, letra: string) {
    if (jaEnviada || resultado) return;
    setRespostas((prev) => ({ ...prev, [questionId]: letra }));
  }

  async function enviar() {
    if (!questoes) return;
    if (!confirm(`Enviar avaliação com ${respondidas} de ${questoes.length} questão(ões) respondida(s)?`)) return;
    setEnviando(true);
    setErro(null);
    try {
      const itens = await submeterRespostasAvaliacao(
        avaliacao.avaliacao_id,
        Object.entries(respostas).map(([question_id, letra]) => ({ question_id, letra }))
      );
      setResultado(itens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a avaliação.');
    } finally {
      setEnviando(false);
    }
  }

  const notaFinal = resultado && resultado.length > 0 ? resultado[0].nota_final : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-ms-main">{avaliacao.titulo}</h2>
          <button onClick={resultado ? onEnviada : onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!questoes && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />}

          {notaFinal !== null && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-4 text-center">
              <p className="text-sm text-ms-muted">Avaliação enviada!</p>
              <p className="text-2xl font-bold text-emerald-300">Nota: {notaFinal.toFixed(2)}</p>
            </div>
          )}

          {jaEnviada && !resultado && avaliacao.nota !== null && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-4 text-center">
              <p className="text-2xl font-bold text-emerald-300">Nota: {Number(avaliacao.nota).toFixed(2)}</p>
            </div>
          )}

          {questoes?.map((q, i) => (
            <QuestaoAlunoView
              key={q.question_id}
              questao={q}
              indice={i}
              letraMarcada={respostas[q.question_id] ?? null}
              resultado={resultadoPorQuestao.get(q.question_id)}
              somenteLeitura={jaEnviada || !!resultado}
              onMarcar={(letra) => marcar(q.question_id, letra)}
            />
          ))}
        </div>

        {questoes && !jaEnviada && !resultado && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800">
            <p className="text-sm text-ms-muted">{respondidas} de {questoes.length} respondida(s)</p>
            <button
              onClick={enviar}
              disabled={enviando}
              className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </button>
          </div>
        )}

        {resultado && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
            <button onClick={onEnviada} className="px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
