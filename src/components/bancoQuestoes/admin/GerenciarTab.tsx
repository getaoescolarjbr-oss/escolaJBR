import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import { excluirQuestao, listarQuestoes } from '../../../services/bancoQuestoesService';
import { QuestionEditorDialog } from '../QuestionEditorDialog';

const PAGE_SIZE = 20;

// Aqui só cria e exclui questões — a edição fica na aba Consultar, onde dá pra filtrar
// por disciplina antes de abrir o editor (ver QuestoesTab.tsx).
export function GerenciarTab() {
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const { questoes, total } = await listarQuestoes({ page, pageSize: PAGE_SIZE });
      setQuestoes(questoes);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, [page]);

  async function handleExcluir(id: string) {
    await excluirQuestao(id);
    await carregar();
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ms-muted">{total} questões cadastradas</p>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" /> Nova questão
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>
      ) : (
        <>
          <div className="space-y-2">
            {questoes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ms-blue">{q.discipline}{q.assunto ? ` — ${q.assunto}` : ''}</p>
                  <p className="text-sm text-ms-main truncate">{q.statement}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleExcluir(q.id)} className="text-ms-muted hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-ms-muted">
            <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-800 disabled:opacity-40">
              Anterior
            </button>
            <span>Página {page + 1} de {totalPaginas}</span>
            <button disabled={page + 1 >= totalPaginas} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-800 disabled:opacity-40">
              Próxima
            </button>
          </div>
        </>
      )}

      {criando && (
        <QuestionEditorDialog
          questao={null}
          onClose={() => setCriando(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
