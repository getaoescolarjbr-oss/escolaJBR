import { useEffect, useState } from 'react';
import { Loader2, Plus, Gift } from 'lucide-react';
import type { Recompensa } from '../../types/biblioteca';
import { listarRecompensas, criarRecompensa, atualizarRecompensa } from '../../services/bibliotecaService';

export function RecompensasTab() {
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custoPontos, setCustoPontos] = useState('10');
  const [estoque, setEstoque] = useState('1');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setRecompensas(await listarRecompensas());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!nome.trim() || !custoPontos) {
      setErro('Informe nome e custo em pontos.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarRecompensa({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        imagem_url: null,
        custo_pontos: Number(custoPontos),
        estoque: Number(estoque) || 0,
        ativo: true,
      });
      setNome('');
      setDescricao('');
      setCustoPontos('10');
      setEstoque('1');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar recompensa.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleAtualizarEstoque(r: Recompensa, delta: number) {
    await atualizarRecompensa(r.id, { estoque: Math.max(0, r.estoque + delta) });
    await carregar();
  }

  async function handleToggleAtivo(r: Recompensa) {
    await atualizarRecompensa(r.id, { ativo: !r.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova recompensa</p>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <textarea placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Custo em pontos</label>
            <input type="number" min={1} value={custoPontos} onChange={(e) => setCustoPontos(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Estoque inicial</label>
            <input type="number" min={0} value={estoque} onChange={(e) => setEstoque(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : (
          recompensas.map((r) => (
            <div key={r.id} className={`flex items-center justify-between px-4 py-3 bg-ms-card border rounded-xl ${r.ativo ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
              <div className="flex items-center gap-3">
                <Gift className="w-8 h-8 text-ms-blueText shrink-0" />
                <div>
                  <p className="text-sm font-bold text-ms-main">{r.nome}</p>
                  <p className="text-[10px] text-gray-500">{r.custo_pontos} pontos · estoque: {r.estoque}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleAtualizarEstoque(r, -1)} className="w-7 h-7 bg-ms-dark border border-gray-800 rounded-lg text-gray-400 hover:text-ms-main">-</button>
                  <button onClick={() => handleAtualizarEstoque(r, 1)} className="w-7 h-7 bg-ms-dark border border-gray-800 rounded-lg text-gray-400 hover:text-ms-main">+</button>
                </div>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input type="checkbox" checked={r.ativo} onChange={() => handleToggleAtivo(r)} /> Ativa
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
