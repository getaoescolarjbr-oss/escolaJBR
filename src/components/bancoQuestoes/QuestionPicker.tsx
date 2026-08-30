import { useEffect, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import type { FilterOptions, FiltroQuestoes, Question, TipoQuestao } from '../../types/bancoQuestoes';
import { TIPOS_QUESTAO, TIPO_QUESTAO_LABEL } from '../../types/bancoQuestoes';
import { buscarAssuntosPorDisciplina, buscarFilterOptions, listarQuestoes } from '../../services/bancoQuestoesService';
import { QuestionCard } from './QuestionCard';
import { QuestionEditorDialog } from './QuestionEditorDialog';
import { useAuth } from '../../hooks/useAuth';

const PAGE_SIZE = 10;

const selectClass =
  'w-full min-w-0 px-3 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue truncate';

interface QuestionPickerProps {
  selecionadas: Map<string, Question>;
  onToggleSelecionar: (q: Question) => void;
  onContinuar?: () => void;
}

// Filtros + lista + seleção do banco de questões — extraído de QuestoesTab.tsx pra ser
// reaproveitado também no passo 1 do gerador de avaliações (ver avaliacoes/NovaAvaliacaoTab.tsx).
// O contador de selecionadas fica com quem usa este componente (selecionadas.size), pra cada
// tela decidir onde/como mostrar. Criar/editar questão também fica autocontido aqui — a
// questão criada/editada entra no banco compartilhado, visível para todos.
export function QuestionPicker({ selecionadas, onToggleSelecionar, onContinuar }: QuestionPickerProps) {
  const { hasAnyRole, usuarioId } = useAuth();
  const podeEditar = hasAnyRole(['GESTAO', 'PROFESSOR']);
  const [opcoes, setOpcoes] = useState<FilterOptions | null>(null);
  const [assuntosDisciplina, setAssuntosDisciplina] = useState<string[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroQuestoes>({ page: 0 });
  const [busca, setBusca] = useState('');
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Question | null>(null);
  const [criando, setCriando] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const { questoes, total } = await listarQuestoes({ ...filtro, pageSize: PAGE_SIZE });
        setQuestoes(questoes);
        setTotal(total);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [filtro, refreshKey]);

  function atualizarFiltro(patch: Partial<FiltroQuestoes>) {
    setFiltro((f) => ({ ...f, ...patch, page: 0 }));
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaAtual = (filtro.page ?? 0) + 1;
  const assuntosParaFiltro = assuntosDisciplina ?? opcoes?.assuntos ?? [];

  return (
    <div className="space-y-6">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            className={selectClass}
            value={filtro.discipline ?? ''}
            onChange={(e) => atualizarFiltro({ discipline: e.target.value || undefined, assunto: undefined })}
          >
            <option value="">Disciplina...</option>
            {opcoes?.disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {/* Enum fixo do banco (questions.tipo) — não vem de question_bank_filter_options(). */}
          <select
            className={selectClass}
            value={filtro.tipo ?? ''}
            onChange={(e) => atualizarFiltro({ tipo: (e.target.value || undefined) as TipoQuestao | undefined })}
          >
            <option value="">Tipo...</option>
            {TIPOS_QUESTAO.map((t) => <option key={t} value={t}>{TIPO_QUESTAO_LABEL[t]}</option>)}
          </select>
          <select className={selectClass} value={filtro.assunto ?? ''} onChange={(e) => atualizarFiltro({ assunto: e.target.value || undefined })}>
            <option value="">{filtro.discipline ? 'Assunto...' : 'Assunto (escolha a disciplina)'}</option>
            {assuntosParaFiltro.map((a) => <option key={a} value={a}>{a}</option>)}
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

        {podeEditar && usuarioId && (
          <label className="flex items-center gap-2 text-sm text-ms-muted font-bold cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={!!filtro.apenasMinhas}
              onChange={(e) => atualizarFiltro({ apenasMinhas: e.target.checked ? usuarioId : undefined })}
            />
            Somente minhas questões
          </label>
        )}
      </div>

      <div className="flex items-center justify-between bg-ms-blue/10 border border-ms-blueText/40 rounded-xl px-5 py-3">
        <p className="text-sm text-ms-main font-bold">{selecionadas.size} questão(ões) selecionada(s)</p>
        <div className="flex items-center gap-3">
          {onContinuar && (
            <button
              disabled={selecionadas.size === 0}
              onClick={onContinuar}
              className="px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              Continuar com {selecionadas.size} questão(ões)
            </button>
          )}
          {podeEditar && (
            <button
              onClick={() => setCriando(true)}
              className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" />
              Nova questão
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>
      ) : questoes.length === 0 ? (
        <p className="text-center text-ms-muted py-12">Nenhuma questão encontrada com estes filtros.</p>
      ) : (
        <>
          <div className="space-y-4">
            {questoes.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                selecionada={selecionadas.has(q.id)}
                onToggleSelecionar={() => onToggleSelecionar(q)}
                onEditar={podeEditar ? () => setEditando(q) : undefined}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-ms-muted">
            <span>{total} questões encontradas</span>
            <div className="flex items-center gap-3">
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
          </div>
        </>
      )}

      {(editando || criando) && (
        <QuestionEditorDialog
          questao={criando ? null : editando}
          onClose={() => {
            setEditando(null);
            setCriando(false);
          }}
          onSalvo={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
