import { useEffect, useState } from 'react';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import type { MaterialComSaldo, CategoriaMaterial } from '../../../types/almoxarifado';
import { listarMateriaisComSaldo, criarMaterial, atualizarMaterial } from '../../../services/almoxarifadoService';

const CATEGORIAS: CategoriaMaterial[] = ['EXPEDIENTE', 'LIMPEZA', 'OUTRO'];

export function CatalogoTab() {
  const [materiais, setMateriais] = useState<MaterialComSaldo[]>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaMaterial>('EXPEDIENTE');
  const [unidade, setUnidade] = useState('un');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setMateriais(await listarMateriaisComSaldo());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!nome.trim()) {
      setErro('Informe o nome do material.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarMaterial({ nome: nome.trim(), categoria, unidade: unidade.trim() || 'un', estoque_minimo: Number(estoqueMinimo) || 0, ativo: true });
      setNome('');
      setEstoqueMinimo('0');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar material.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(m: MaterialComSaldo) {
    await atualizarMaterial(m.id, { ativo: !m.ativo });
    await carregar();
  }

  async function handleAtualizarMinimo(m: MaterialComSaldo, valor: string) {
    await atualizarMaterial(m.id, { estoque_minimo: Number(valor) || 0 });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo material</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Nome (ex.: Resma de papel A4)" value={nome} onChange={(e) => setNome(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMaterial)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Unidade (un, cx, pct, L...)" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" min={0} placeholder="Estoque mínimo" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : (
          materiais.map((m) => {
            const abaixoDoMinimo = m.saldo <= m.estoque_minimo;
            return (
              <div key={m.id} className={`flex items-center justify-between px-4 py-3 bg-ms-card border rounded-xl ${m.ativo ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
                <div>
                  <p className="text-sm font-bold text-ms-main flex items-center gap-2">
                    {m.nome}
                    {abaixoDoMinimo && <span title="Saldo no mínimo ou abaixo dele"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>}
                  </p>
                  <p className="text-[10px] text-gray-500">{m.categoria} · saldo: {m.saldo} {m.unidade}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500">mín.</label>
                    <input
                      type="number"
                      min={0}
                      defaultValue={m.estoque_minimo}
                      onBlur={(e) => handleAtualizarMinimo(m, e.target.value)}
                      className="w-16 px-2 py-1 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <input type="checkbox" checked={m.ativo} onChange={() => handleToggleAtivo(m)} /> Ativo
                  </label>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
