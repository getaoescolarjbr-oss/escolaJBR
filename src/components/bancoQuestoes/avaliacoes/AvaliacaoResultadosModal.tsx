import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Avaliacao, ResultadoAluno } from '../../../types/avaliacoes';
import { listarResultadosAvaliacao } from '../../../services/avaliacoesService';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

export function AvaliacaoResultadosModal({ avaliacao, onClose }: Props) {
  const [resultados, setResultados] = useState<ResultadoAluno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarResultadosAvaliacao(avaliacao.id)
      .then(setResultados)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os resultados.'));
  }, [avaliacao.id]);

  const enviadas = resultados?.filter((r) => r.finalizado_em) ?? [];
  const media = enviadas.length > 0 ? enviadas.reduce((soma, r) => soma + (r.nota ?? 0), 0) / enviadas.length : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-ms-main">Resultados — {avaliacao.titulo}</h2>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!resultados && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />}

          {resultados && (
            <>
              <div className="flex items-center justify-between text-sm text-ms-muted">
                <span>{enviadas.length} de {resultados.length} aluno(s) enviaram</span>
                {media !== null && <span className="font-bold text-ms-main">Média: {media.toFixed(2)}</span>}
              </div>

              {resultados.length === 0 ? (
                <p className="text-center text-ms-muted py-8">Nenhum aluno vinculado às turmas desta avaliação.</p>
              ) : (
                <div className="space-y-2">
                  {resultados.map((r) => (
                    <div key={r.aluno_id} className="flex items-center justify-between px-4 py-3 bg-ms-dark border border-gray-800 rounded-lg">
                      <div>
                        <p className="text-sm font-bold text-ms-main">{r.aluno_nome}</p>
                        <p className="text-xs text-ms-muted">{r.turma_nome ?? '—'}</p>
                      </div>
                      <div className="text-right">
                        {r.finalizado_em ? (
                          <p className="text-sm font-bold text-ms-main">{(r.nota ?? 0).toFixed(2)}</p>
                        ) : (
                          <p className="text-xs text-ms-muted">Pendente</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
