import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import { buscarQuestoesPorIds } from '../../services/bancoQuestoesService';
import {
  excluirListaQuestoes,
  listarListasQuestoes,
  obterIdsDaLista,
  removerQuestaoDaLista,
  renomearListaQuestoes,
  type ListaQuestoes,
} from '../../services/listasQuestoesService';
import { QuestionCard } from './QuestionCard';

interface Props {
  selecionadas: Map<string, Question>;
  onToggleSelecionar: (q: Question) => void;
  /** Muda quando o pai salva questões numa lista, para recarregar as contagens. */
  versao: number;
}

// "Minhas listas": conjuntos pessoais de questões separados do banco para usar depois. A seleção
// e as ações (adicionar a avaliação, copiar, gerar prova) são as mesmas do banco — ficam no pai.
export function MinhasListasView({ selecionadas, onToggleSelecionar, versao }: Props) {
  const [listas, setListas] = useState<ListaQuestoes[] | null>(null);
  const [listaId, setListaId] = useState<string | null>(null);
  const [questoes, setQuestoes] = useState<Question[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarListas = useCallback(async () => {
    try {
      const l = await listarListasQuestoes();
      setListas(l);
      setListaId((atual) => (atual && l.some((x) => x.id === atual) ? atual : l[0]?.id ?? null));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar suas listas.');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregarListas, 0);
    return () => clearTimeout(t);
  }, [carregarListas, versao]);

  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(() => {
      if (!listaId) {
        setQuestoes(null);
        return;
      }
      setQuestoes(null);
      obterIdsDaLista(listaId)
        .then((ids) => buscarQuestoesPorIds(ids).then((qs) => ids.map((id) => qs.find((q) => q.id === id)).filter((q): q is Question => !!q)))
        .then((qs) => { if (!cancelado) setQuestoes(qs); })
        .catch((e) => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a lista.'); });
    }, 0);
    return () => { cancelado = true; clearTimeout(t); };
  }, [listaId, versao]);

  async function renomear(l: ListaQuestoes) {
    const nome = prompt('Novo nome da lista:', l.nome)?.trim();
    if (!nome || nome === l.nome) return;
    try {
      await renomearListaQuestoes(l.id, nome);
      await carregarListas();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível renomear.');
    }
  }

  async function excluir(l: ListaQuestoes) {
    if (!confirm(`Excluir a lista “${l.nome}”? As questões continuam no banco; só a lista é apagada.`)) return;
    try {
      await excluirListaQuestoes(l.id);
      await carregarListas();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  }

  async function remover(questionId: string) {
    if (!listaId) return;
    try {
      await removerQuestaoDaLista(listaId, questionId);
      setQuestoes((atual) => atual?.filter((q) => q.id !== questionId) ?? null);
      setListas((atual) => atual?.map((l) => (l.id === listaId ? { ...l, total: Math.max(0, l.total - 1) } : l)) ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover da lista.');
    }
  }

  if (listas === null && !erro) return <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 my-12" />;

  const atual = listas?.find((l) => l.id === listaId) ?? null;

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
      {listas?.length === 0 ? (
        <p className="text-center text-ms-muted py-12 text-sm">
          Você ainda não tem listas. No Banco de questões, marque as questões e use “Salvar em lista”.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {listas?.map((l) => (
              <button
                key={l.id}
                onClick={() => setListaId(l.id)}
                aria-pressed={l.id === listaId}
                className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                  l.id === listaId ? 'bg-ms-blue text-white border-ms-blue' : 'bg-ms-card text-ms-main border-gray-800 hover:border-ms-blue'
                }`}
              >
                {l.nome} <span className="opacity-70 font-normal">({l.total})</span>
              </button>
            ))}
          </div>

          {atual && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ms-main">{atual.nome}</p>
              <div className="flex gap-2">
                <button onClick={() => renomear(atual)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-ms-muted border border-gray-800 rounded-lg hover:text-ms-main">
                  <Pencil className="w-3.5 h-3.5" /> Renomear
                </button>
                <button onClick={() => excluir(atual)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-400 border border-gray-800 rounded-lg hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir lista
                </button>
              </div>
            </div>
          )}

          {questoes === null && !erro && <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400 my-8" />}
          {questoes?.length === 0 && <p className="text-center text-ms-muted py-8 text-sm">Esta lista está vazia.</p>}
          {questoes?.map((q) => (
            <div key={q.id} className="space-y-2">
              <QuestionCard question={q} selecionada={selecionadas.has(q.id)} onToggleSelecionar={() => onToggleSelecionar(q)} />
              <div className="flex justify-end">
                <button onClick={() => remover(q.id)} className="text-xs font-bold text-ms-muted hover:text-red-400">
                  Remover desta lista
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
