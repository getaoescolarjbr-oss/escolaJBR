import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Terceirizado, FuncaoTerceirizado } from '../../../types/rh';
import { listarTerceirizados, criarTerceirizado, atualizarTerceirizado } from '../../../services/rhService';

const ROTULOS_FUNCAO: Record<FuncaoTerceirizado, string> = {
  LIMPEZA: 'Limpeza',
  MERENDA: 'Merenda',
  VIGILANCIA: 'Vigilância',
  OUTRO: 'Outro',
};

export function TerceirizadosTab() {
  const [terceirizados, setTerceirizados] = useState<Terceirizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: '', empresa: '', funcao: 'LIMPEZA' as FuncaoTerceirizado, contato: '' });

  async function carregar() {
    setLoading(true);
    try {
      setTerceirizados(await listarTerceirizados());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.nome) {
      setErro('Informe o nome.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarTerceirizado({
        nome: novo.nome,
        empresa: novo.empresa || null,
        funcao: novo.funcao,
        contato: novo.contato || null,
        ativo: true,
      });
      setNovo({ nome: '', empresa: '', funcao: 'LIMPEZA', contato: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar terceirizado.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(t: Terceirizado) {
    await atualizarTerceirizado(t.id, { ativo: !t.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo terceirizado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Empresa (opcional)" value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={novo.funcao} onChange={(e) => setNovo({ ...novo, funcao: e.target.value as FuncaoTerceirizado })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_FUNCAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input placeholder="Contato" value={novo.contato} onChange={(e) => setNovo({ ...novo, contato: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
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
          terceirizados.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">
                  {t.nome} <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-black">{ROTULOS_FUNCAO[t.funcao]}</span>
                </p>
                <p className="text-[10px] text-gray-500">{t.empresa || 'sem empresa'} · {t.contato || 'sem contato'}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={t.ativo} onChange={() => handleToggleAtivo(t)} /> Ativo
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
