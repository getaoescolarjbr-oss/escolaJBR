import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Colecao } from '../../types/biblioteca';
import { listarColecoes, criarColecao } from '../../services/bibliotecaService';

export function ColecoesTab() {
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setColecoes(await listarColecoes());
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
      setErro('Informe o nome da coleção/série.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarColecao({ nome: nome.trim(), descricao: descricao.trim() || null });
      setNome('');
      setDescricao('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar coleção.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova coleção/série</p>
        <input
          placeholder="Ex.: Harry Potter, Diário de um Banana..."
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
        />
        <textarea
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none"
        />
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
          colecoes.map((c) => (
            <div key={c.id} className="px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <p className="text-sm font-bold text-ms-main">{c.nome}</p>
              {c.descricao && <p className="text-[10px] text-gray-500">{c.descricao}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
