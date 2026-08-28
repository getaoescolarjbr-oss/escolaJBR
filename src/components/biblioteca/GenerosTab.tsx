import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Genero } from '../../types/biblioteca';
import { listarGeneros, criarGenero, atualizarGenero } from '../../services/bibliotecaService';

export function GenerosTab() {
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setGeneros(await listarGeneros());
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
      setErro('Informe o nome do gênero.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarGenero(nome.trim());
      setNome('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar gênero.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(g: Genero) {
    await atualizarGenero(g.id, { ativo: !g.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo gênero</p>
        <div className="flex gap-3">
          <input
            placeholder="Ex.: Aventura, Fantasia, Ficção..."
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="flex-1 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : (
          generos.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <p className="text-sm font-bold text-ms-main">{g.nome}</p>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={g.ativo} onChange={() => handleToggleAtivo(g)} /> Ativo
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
