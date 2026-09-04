import { useEffect, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { FilterOptions, FiltroQuestoes, Question } from '../../../types/bancoQuestoes';
import {
  buscarAssuntosPorDisciplina,
  buscarFilterOptions,
  buscarTopicosPorAssunto,
  excluirQuestao,
  listarQuestoes,
} from '../../../services/bancoQuestoesService';
import { QuestionEditorDialog } from '../QuestionEditorDialog';
import { QuestionCard } from '../QuestionCard';

const PAGE_SIZE = 20;

const selectClass =
  'w-full min-w-0 px-3 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue truncate';

// podeCriar=false (COORDENACAO_AREA): esconde "Nova questão" — RLS só libera
// UPDATE/DELETE pra esse papel, não INSERT (ver permitir_coordenacao_area_excluir_questoes.sql
// e permitir_coordenacao_area_editar_assunto_topico.sql). Visualizar e editar (assunto/tópico
// incluso) ficam abertos pra quem chega nessa aba, já que só GESTAO/COORDENACAO_AREA chegam aqui.
interface GerenciarTabProps {
  podeCriar?: boolean;
}

export function GerenciarTab({ podeCriar = true }: GerenciarTabProps) {
  const [opcoes, setOpcoes] = useState<FilterOptions | null>(null);
  const [assuntosDisciplina, setAssuntosDisciplina] = useState<string[] | null>(null);
  const [topicosAssunto, setTopicosAssunto] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<FiltroQuestoes>({ page: 0 });
  const [busca, setBusca] = useState('');
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Question | null>(null);
  const [visualizando, setVisualizando] = useState<Question | null>(null);

  useEffect(() => {
    buscarFilterOptions().then(setOpcoes).catch(() => setOpcoes(null));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!filtro.discipline) {
        setAssuntosDisciplina(null);
        return;
      }
      buscarAssuntosPorDisciplina(filtro.discipline)
        .then(setAssuntosDisciplina)
        .catch(() => setAssuntosDisciplina([]));
    }, 0);
    return () => clearTimeout(timeout);
  }, [filtro.discipline]);

  useEffect(() => {
    if (!filtro.assunto) {
      setTopicosAssunto([]);
      return;
    }
    buscarTopicosPorAssunto(filtro.assunto)
      .then(setTopicosAssunto)
      .catch(() => setTopicosAssunto([]));
  }, [filtro.assunto]);

  async function carregar() {
    setLoading(true);
    try {
      const { questoes, total } = await listarQuestoes({ ...filtro, pageSize: PAGE_SIZE });
      setQuestoes(questoes);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, [filtro]);

  function atualizarFiltro(patch: Partial<FiltroQuestoes>) {
    setFiltro((f) => ({ ...f, ...patch, page: 0 }));
  }

  async function handleExcluir(id: string) {
    await excluirQuestao(id);
    await carregar();
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaAtual = (filtro.page ?? 0) + 1;
  const assuntosParaFiltro = assuntosDisciplina ?? opcoes?.assuntos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ms-muted">{total} questões cadastradas</p>
        {podeCriar && (
          <button
            onClick={() => setCriando(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" /> Nova questão
          </button>
        )}
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ms-muted" />
            <input
              placeholder="Buscar no enunciado..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && atualizarFiltro({ busca })}
              className="w-full pl-10 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
            />
          </div>
          <button onClick={() => atualizarFiltro({ busca })} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600">
            Buscar
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <select
            className={selectClass}
            value={filtro.discipline ?? ''}
            onChange={(e) => atualizarFiltro({ discipline: e.target.value || undefined, assunto: undefined, topico: undefined })}
          >
            <option value="">Disciplina...</option>
            {opcoes?.disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            className={selectClass}
            value={filtro.assunto ?? ''}
            onChange={(e) => atualizarFiltro({ assunto: e.target.value || undefined, topico: undefined })}
          >
            <option value="">{filtro.discipline ? 'Assunto...' : 'Assunto (escolha a disciplina)'}</option>
            {assuntosParaFiltro.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={selectClass} value={filtro.topico ?? ''} onChange={(e) => atualizarFiltro({ topico: e.target.value || undefined })}>
            <option value="">{filtro.assunto ? 'Tópico...' : 'Tópico (escolha o assunto)'}</option>
            {topicosAssunto.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={selectClass} value={filtro.level ?? ''} onChange={(e) => atualizarFiltro({ level: e.target.value || undefined })}>
            <option value="">Nível...</option>
            {opcoes?.levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className={selectClass} value={filtro.difficulty ?? ''} onChange={(e) => atualizarFiltro({ difficulty: e.target.value || undefined })}>
            <option value="">Dificuldade...</option>
            {opcoes?.difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={selectClass} value={filtro.banca ?? ''} onChange={(e) => atualizarFiltro({ banca: e.target.value || undefined })}>
            <option value="">Banca...</option>
            {opcoes?.bancas.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className={selectClass} value={filtro.ano ?? ''} onChange={(e) => atualizarFiltro({ ano: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Ano...</option>
            {opcoes?.anos.sort((a, b) => b - a).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>
      ) : questoes.length === 0 ? (
        <p className="text-center text-ms-muted py-12">Nenhuma questão encontrada com estes filtros.</p>
      ) : (
        <>
          <div className="space-y-2">
            {questoes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ms-blueText">
                    {q.discipline}
                    {q.assunto ? ` — ${q.assunto}` : ''}
                    {q.topico ? `: ${q.topico}` : ''}
                  </p>
                  <p className="text-sm text-ms-main truncate">{q.statement}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setVisualizando(q)} title="Visualizar questão" className="text-ms-muted hover:text-ms-blueText">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditando(q)} title="Editar questão" className="text-ms-muted hover:text-ms-blueText">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleExcluir(q.id)} title="Excluir questão" className="text-ms-muted hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-ms-muted">
            <button
              disabled={paginaAtual <= 1}
              onClick={() => setFiltro((f) => ({ ...f, page: (f.page ?? 0) - 1 }))}
              className="px-3 py-1.5 rounded-lg border border-gray-800 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>Página {paginaAtual} de {totalPaginas}</span>
            <button
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setFiltro((f) => ({ ...f, page: (f.page ?? 0) + 1 }))}
              className="px-3 py-1.5 rounded-lg border border-gray-800 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </>
      )}

      {podeCriar && criando && (
        <QuestionEditorDialog
          questao={null}
          onClose={() => setCriando(false)}
          onSalvo={carregar}
        />
      )}

      {editando && (
        <QuestionEditorDialog
          questao={editando}
          onClose={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}

      {visualizando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ms-main">Visualizar questão</h3>
              <button onClick={() => setVisualizando(null)} className="text-ms-muted hover:text-ms-main">
                <X className="w-5 h-5" />
              </button>
            </div>
            <QuestionCard question={visualizando} />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditando(visualizando);
                  setVisualizando(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-800 text-ms-muted font-bold hover:text-ms-main"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={() => {
                  handleExcluir(visualizando.id);
                  setVisualizando(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-900/50 font-bold hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
