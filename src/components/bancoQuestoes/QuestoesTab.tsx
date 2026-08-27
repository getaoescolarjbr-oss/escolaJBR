import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Copy, Check, FileText } from 'lucide-react';
import type { FilterOptions, FiltroQuestoes, Question } from '../../types/bancoQuestoes';
import { buscarAssuntosPorDisciplina, buscarFilterOptions, listarQuestoes } from '../../services/bancoQuestoesService';
import { QuestionCard } from './QuestionCard';
import { QuestionEditorDialog } from './QuestionEditorDialog';
import { buildFonte } from '../../lib/questionMarkup';
import { GerarProvaModal } from './GerarProvaModal';
import { useAuth } from '../../hooks/useAuth';

const PAGE_SIZE = 10;

const selectClass =
  'w-full min-w-0 px-3 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue truncate';

export function QuestoesTab() {
  const { hasAnyRole } = useAuth();
  const podeEditar = hasAnyRole(['GESTAO', 'PROFESSOR']);
  const [opcoes, setOpcoes] = useState<FilterOptions | null>(null);
  const [assuntosDisciplina, setAssuntosDisciplina] = useState<string[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroQuestoes>({ page: 0 });
  const [busca, setBusca] = useState('');
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [copiado, setCopiado] = useState(false);
  const [gerarProvaAberto, setGerarProvaAberto] = useState(false);
  const [editando, setEditando] = useState<Question | null>(null);

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

  function toggleSelecionar(q: Question) {
    setSelecionadas((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  const questoesSelecionadas = useMemo(() => Array.from(selecionadas.values()), [selecionadas]);
  const assuntosParaFiltro = assuntosDisciplina ?? opcoes?.assuntos ?? [];

  async function copiarSelecionadas() {
    const texto = questoesSelecionadas
      .map((q, i) => {
        const alternativas = q.alternatives.map((a) => `${a.letter}) ${a.text.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}`).join('\n');
        return `${i + 1}. ${q.statement.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}\n${alternativas}\n(Fonte: ${buildFonte(q)})\n`;
      })
      .join('\n');
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaAtual = (filtro.page ?? 0) + 1;

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
      </div>

      {selecionadas.size > 0 && (
        <div className="flex items-center justify-between bg-ms-blue/10 border border-ms-blue/40 rounded-xl px-5 py-3">
          <p className="text-sm text-ms-main font-bold">{selecionadas.size} questão(ões) selecionada(s)</p>
          <div className="flex items-center gap-2">
            <button onClick={copiarSelecionadas} className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800">
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar selecionadas'}
            </button>
            <button onClick={() => setGerarProvaAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
              <FileText className="w-4 h-4" />
              Gerar prova/simulado
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>
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
                onToggleSelecionar={() => toggleSelecionar(q)}
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

      {gerarProvaAberto && (
        <GerarProvaModal questoes={questoesSelecionadas} onClose={() => setGerarProvaAberto(false)} />
      )}

      {editando && (
        <QuestionEditorDialog
          questao={editando}
          onClose={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
