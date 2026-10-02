import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Avaliacao } from '../../types/avaliacoes';
import { listarMinhasAvaliacoes } from '../../services/avaliacoesService';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  quantidade: number;
  onClose: () => void;
  onEscolher: (avaliacao: Avaliacao) => void;
}

// Escolhe em qual avaliação individual (ainda rascunho) as questões selecionadas entram.
// Avaliações de área/gerais têm fluxo próprio de cotas, e as já publicadas não recebem questão
// por aqui — para essas, o professor usa o botão Editar em Minhas Avaliações.
export function AdicionarAAvaliacaoModal({ quantidade, onClose, onEscolher }: Props) {
  const { usuarioId } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarMinhasAvaliacoes()
      .then((todas) => setAvaliacoes(todas.filter((a) => !a.eh_prova_area && a.status === 'RASCUNHO' && a.criado_por === usuarioId)))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar suas avaliações.'));
  }, [usuarioId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Adicionar a uma avaliação</h2>
            <p className="text-xs text-ms-muted">{quantidade} {quantidade === 1 ? 'questão' : 'questões'} · só rascunhos individuais seus</p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {avaliacoes === null && !erro && <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400" />}
          {avaliacoes?.length === 0 && (
            <p className="text-sm text-ms-muted">
              Você não tem avaliação individual em rascunho. Crie uma em Minhas Avaliações (botão “Nova avaliação”) e volte aqui.
            </p>
          )}
          {avaliacoes?.map((a) => (
            <button
              key={a.id}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-left hover:border-ms-blue"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ms-main truncate">{a.titulo}</span>
                <span className="block text-xs text-ms-muted truncate">{a.disciplina ?? 'Sem disciplina'}</span>
              </span>
              <span className="text-xs text-ms-muted shrink-0">{a.total_questoes ?? 0} {(a.total_questoes ?? 0) === 1 ? 'questão' : 'questões'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
