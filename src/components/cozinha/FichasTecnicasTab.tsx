import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, ChefHat } from 'lucide-react';
import { SectionIcon } from '../ui/SectionIcon';
import { useAuth } from '../../hooks/useAuth';
import type { EstoqueItem, FichaTecnica, FichaIngrediente } from '../../types/cozinha';
import {
  listarItensEstoque,
  listarFichasTecnicas,
  criarFichaTecnica,
  excluirFichaTecnica,
  listarIngredientesFicha,
  adicionarIngredienteFicha,
  removerIngredienteFicha,
} from '../../services/cozinhaService';

export function FichasTecnicasTab() {
  const { usuarioId } = useAuth();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [ingredientesPorFicha, setIngredientesPorFicha] = useState<Record<string, FichaIngrediente[]>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaFicha, setNovaFicha] = useState({ preparacao: '', modo_preparo: '' });
  const [novoIngrediente, setNovoIngrediente] = useState<Record<string, { item_id: string; per_capita: string }>>({});

  async function carregar() {
    setLoading(true);
    try {
      const [listaItens, listaFichas] = await Promise.all([listarItensEstoque(), listarFichasTecnicas()]);
      setItens(listaItens);
      setFichas(listaFichas);
      const mapa: Record<string, FichaIngrediente[]> = {};
      for (const f of listaFichas) mapa[f.id] = await listarIngredientesFicha(f.id);
      setIngredientesPorFicha(mapa);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriarFicha() {
    if (!novaFicha.preparacao || !usuarioId) {
      setErro('Informe o nome da preparação.');
      return;
    }
    setErro(null);
    try {
      await criarFichaTecnica(novaFicha.preparacao, novaFicha.modo_preparo || null, usuarioId);
      setNovaFicha({ preparacao: '', modo_preparo: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar ficha técnica.');
    }
  }

  async function handleExcluirFicha(id: string) {
    await excluirFichaTecnica(id);
    await carregar();
  }

  async function handleAdicionarIngrediente(fichaId: string) {
    const form = novoIngrediente[fichaId];
    if (!form?.item_id || !form.per_capita) return;
    await adicionarIngredienteFicha(fichaId, form.item_id, Number(form.per_capita));
    setNovoIngrediente({ ...novoIngrediente, [fichaId]: { item_id: '', per_capita: '' } });
    await carregar();
  }

  async function handleRemoverIngrediente(id: string) {
    await removerIngredienteFicha(id);
    await carregar();
  }

  function nomeItem(itemId: string) {
    return itens.find((i) => i.id === itemId)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={ChefHat} cor="emerald" /> Nova ficha técnica</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Preparação (ex.: Arroz branco)" value={novaFicha.preparacao} onChange={(e) => setNovaFicha({ ...novaFicha, preparacao: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Modo de preparo (opcional)" value={novaFicha.modo_preparo} onChange={(e) => setNovaFicha({ ...novaFicha, modo_preparo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <button onClick={handleCriarFicha} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Criar ficha
        </button>
      </div>

      <div className="space-y-4">
        {fichas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ficha técnica cadastrada.</p>
        ) : (
          fichas.map((f) => (
            <div key={f.id} className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-ms-main">{f.preparacao}</p>
                  {f.modo_preparo && <p className="text-xs text-gray-500">{f.modo_preparo}</p>}
                </div>
                <button onClick={() => handleExcluirFicha(f.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="space-y-1">
                {(ingredientesPorFicha[f.id] ?? []).map((ing) => (
                  <div key={ing.id} className="flex items-center justify-between text-sm px-3 py-1.5 bg-ms-dark rounded-lg border border-gray-800">
                    <span className="text-gray-300">{nomeItem(ing.item_id)} — {ing.per_capita}/aluno</span>
                    <button onClick={() => handleRemoverIngrediente(ing.id)} className="p-1 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={novoIngrediente[f.id]?.item_id ?? ''}
                  onChange={(e) => setNovoIngrediente({ ...novoIngrediente, [f.id]: { ...(novoIngrediente[f.id] ?? { per_capita: '' }), item_id: e.target.value } })}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main"
                >
                  <option value="">Ingrediente...</option>
                  {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Per capita"
                  value={novoIngrediente[f.id]?.per_capita ?? ''}
                  onChange={(e) => setNovoIngrediente({ ...novoIngrediente, [f.id]: { ...(novoIngrediente[f.id] ?? { item_id: '' }), per_capita: e.target.value } })}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main w-28"
                />
                <button onClick={() => handleAdicionarIngrediente(f.id)} className="px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                  Adicionar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
