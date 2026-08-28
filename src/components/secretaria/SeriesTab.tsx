import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { SerieReferencia } from '../../types/secretaria';
import { listarSeries, criarSerie, atualizarSerie } from '../../services/secretariaService';

export function SeriesTab() {
  const [series, setSeries] = useState<SerieReferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ codigo: '', nome: '', ordem: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setSeries(await listarSeries());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.codigo || !novo.nome || !novo.ordem) {
      setErro('Preencha código, nome e ordem.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarSerie({ codigo: novo.codigo, nome: novo.nome, ordem: Number(novo.ordem) });
      setNovo({ codigo: '', nome: '', ordem: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar série.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(s: SerieReferencia) {
    await atualizarSerie(s.id, { ativo: !s.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova série/segmento</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Código (ex.: EF06)" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value.toUpperCase() })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" placeholder="Ordem" value={novo.ordem} onChange={(e) => setNovo({ ...novo, ordem: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
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
          series.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <span className="text-sm text-ms-main"><span className="font-black">{s.codigo}</span> — {s.nome}</span>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={s.ativo} onChange={() => handleToggleAtivo(s)} /> Ativa
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
