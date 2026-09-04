import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TaxonomyField, TaxonomyTerm } from '../../../types/bancoQuestoes';
import { TAXONOMY_FIELD_LABELS } from '../../../types/bancoQuestoes';
import {
  buscarFilterOptions,
  contarQuestoesPorDisciplina,
  criarTermo,
  excluirDisciplinaComQuestoes,
  excluirTermo,
  listarTermos,
  renomearTermo,
} from '../../../services/bancoQuestoesService';
import { useAuth } from '../../../hooks/useAuth';

const CAMPOS_GESTAO: TaxonomyField[] = ['discipline', 'level', 'area', 'difficulty', 'assunto', 'topico', 'banca', 'orgao', 'cargo'];
// Coordenação de área só pode mexer em assunto/tópico (RLS libera só esses dois campos pra
// esse papel — ver permitir_coordenacao_area_editar_assunto_topico.sql).
const CAMPOS_COORDENACAO: TaxonomyField[] = ['assunto', 'topico'];

export function CategoriasTab() {
  const { hasAnyRole } = useAuth();
  const isGestao = hasAnyRole(['GESTAO']);
  const CAMPOS = isGestao ? CAMPOS_GESTAO : CAMPOS_COORDENACAO;
  const [campo, setCampo] = useState<TaxonomyField>(CAMPOS[0]);
  const [termos, setTermos] = useState<TaxonomyTerm[]>([]);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindoLote, setExcluindoLote] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valorEdicao, setValorEdicao] = useState('');
  const [renomeando, setRenomeando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      if (campo === 'discipline') {
        // As questões reaproveitadas do outro projeto entraram só com `questions.discipline`
        // preenchido, sem registro correspondente em question_taxonomy_terms — por isso a lista
        // usa buscarFilterOptions() (que já une as duas fontes) em vez de só listarTermos().
        const [termosDb, opcoes] = await Promise.all([listarTermos('discipline'), buscarFilterOptions()]);
        const porValor = new Map(termosDb.map((t) => [t.value, t] as const));
        const todasDisciplinas = Array.from(new Set([...opcoes.disciplines, ...termosDb.map((t) => t.value)])).sort();
        const lista: TaxonomyTerm[] = todasDisciplinas.map(
          (value) => porValor.get(value) ?? { id: '', field: 'discipline', value }
        );
        setTermos(lista);
        const pares = await Promise.all(
          lista.map(async (t) => [t.value, await contarQuestoesPorDisciplina(t.value)] as const)
        );
        setContagens(Object.fromEntries(pares));
      } else {
        const lista = await listarTermos(campo);
        setTermos(lista);
        setContagens({});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelecionados(new Set());
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, [campo]);

  function toggleSelecionado(chave: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  async function handleCriar() {
    if (!valor.trim()) {
      setErro('Informe o valor.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarTermo(campo, valor.trim());
      setValor('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar termo.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(termo: TaxonomyTerm) {
    if (campo !== 'discipline') {
      await excluirTermo(termo.id);
      await carregar();
      return;
    }

    const n = contagens[termo.value] ?? (await contarQuestoesPorDisciplina(termo.value));
    const confirmado =
      n > 0
        ? confirm(
            `A disciplina "${termo.value}" tem ${n} questão${n === 1 ? '' : 'ões'} cadastrada${n === 1 ? '' : 's'} no banco.\n\n` +
              `Excluir vai apagar essa disciplina E todas as questões dela permanentemente. Confirma?`
          )
        : confirm(`Excluir a disciplina "${termo.value}"?`);
    if (!confirmado) return;

    setExcluindo(termo.id || termo.value);
    try {
      await excluirDisciplinaComQuestoes(termo.value, termo.id || undefined);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir disciplina.');
    } finally {
      setExcluindo(null);
    }
  }

  function iniciarEdicao(t: TaxonomyTerm) {
    setEditandoId(t.id || t.value);
    setValorEdicao(t.value);
  }

  async function handleRenomear(t: TaxonomyTerm) {
    const novoValor = valorEdicao.trim();
    if (!novoValor || novoValor === t.value) {
      setEditandoId(null);
      return;
    }
    setRenomeando(true);
    setErro(null);
    try {
      // Termo sem id (ex.: disciplina reaproveitada só via questions.discipline, sem registro
      // próprio em question_taxonomy_terms) precisa ser criado antes de poder renomear.
      const id = t.id || (await criarTermo(campo, t.value)).id;
      await renomearTermo(id, campo, t.value, novoValor);
      setEditandoId(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao renomear termo.');
    } finally {
      setRenomeando(false);
    }
  }

  async function handleExcluirLote() {
    const alvos = termos.filter((t) => selecionados.has(t.id || t.value));
    if (alvos.length === 0) return;

    const totalQuestoes = alvos.reduce((soma, t) => soma + (contagens[t.value] ?? 0), 0);
    const confirmado = confirm(
      `Excluir ${alvos.length} disciplina${alvos.length === 1 ? '' : 's'} (${alvos.map((t) => t.value).join(', ')})?\n\n` +
        `Isso vai apagar ${totalQuestoes} questão${totalQuestoes === 1 ? '' : 'ões'} permanentemente.`
    );
    if (!confirmado) return;

    setExcluindoLote(true);
    setErro(null);
    try {
      for (const t of alvos) {
        await excluirDisciplinaComQuestoes(t.value, t.id || undefined);
      }
      setSelecionados(new Set());
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir disciplinas em lote.');
    } finally {
      setExcluindoLote(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap gap-2">
        {CAMPOS.map((c) => (
          <button
            key={c}
            onClick={() => setCampo(c)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              campo === c ? 'bg-ms-blue text-white' : 'bg-ms-card text-ms-muted border border-gray-800'
            }`}
          >
            {TAXONOMY_FIELD_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo termo — {TAXONOMY_FIELD_LABELS[campo]}</p>
        <div className="flex gap-3">
          <input
            placeholder={`Novo valor de ${TAXONOMY_FIELD_LABELS[campo].toLowerCase()}...`}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            className="flex-1 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      {campo === 'discipline' && selecionados.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-ms-card border border-red-900/50 rounded-xl">
          <p className="text-sm text-ms-main">
            {selecionados.size} disciplina{selecionados.size === 1 ? '' : 's'} selecionada{selecionados.size === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelecionados(new Set())}
              disabled={excluindoLote}
              className="text-xs text-ms-muted hover:text-ms-main transition-colors disabled:opacity-50"
            >
              Limpar seleção
            </button>
            <button
              onClick={handleExcluirLote}
              disabled={excluindoLote}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-900/50 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {excluindoLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir selecionadas
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : termos.length === 0 ? (
          <p className="text-center text-ms-muted py-6 text-sm">Nenhum termo cadastrado ainda.</p>
        ) : (
          termos.map((t) => {
            const chave = t.id || t.value;
            const editando = editandoId === chave;
            return (
              <div key={chave} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                {editando ? (
                  <>
                    <input
                      autoFocus
                      value={valorEdicao}
                      onChange={(e) => setValorEdicao(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenomear(t)}
                      className="flex-1 mr-2 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRenomear(t)}
                        disabled={renomeando}
                        className="text-ms-muted hover:text-ms-blueText transition-colors disabled:opacity-50"
                        aria-label="Salvar"
                      >
                        {renomeando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        disabled={renomeando}
                        className="text-ms-muted hover:text-ms-main transition-colors disabled:opacity-50"
                        aria-label="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {campo === 'discipline' && (
                        <input
                          type="checkbox"
                          checked={selecionados.has(chave)}
                          onChange={() => toggleSelecionado(chave)}
                          className="w-4 h-4 rounded border-gray-800 accent-ms-blue"
                        />
                      )}
                      <p className="text-sm font-bold text-ms-main">{t.value}</p>
                      {campo === 'discipline' && (
                        <span className="text-xs text-ms-muted">
                          {contagens[t.value] ?? 0} questão{(contagens[t.value] ?? 0) === 1 ? '' : 'ões'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => iniciarEdicao(t)}
                        className="text-ms-muted hover:text-ms-blueText transition-colors"
                        aria-label="Renomear"
                        title="Renomear (atualiza também as questões que já usam esse valor)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(t)}
                        disabled={excluindo === chave || excluindoLote}
                        className="text-ms-muted hover:text-red-400 transition-colors disabled:opacity-50"
                        aria-label="Excluir"
                      >
                        {excluindo === chave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
