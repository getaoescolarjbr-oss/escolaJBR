import { useEffect, useState } from 'react';
import { Loader2, Plus, Search, BookCopy, Globe, Pencil } from 'lucide-react';
import type { Livro, Genero, Colecao } from '../../types/biblioteca';
import { listarLivros, listarGeneros, listarColecoes, type FiltroLivros } from '../../services/bibliotecaService';
import { LivroFormModal } from './LivroFormModal';
import { ExemplaresModal } from './ExemplaresModal';

export function LivrosTab() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipoAcervo, setTipoAcervo] = useState<FiltroLivros['tipoAcervo'] | ''>('');
  const [generoId, setGeneroId] = useState('');

  const [livroEditando, setLivroEditando] = useState<Livro | null | undefined>(undefined);
  const [livroExemplares, setLivroExemplares] = useState<Livro | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [l, g, c] = await Promise.all([
        listarLivros({ busca: busca || undefined, tipoAcervo: tipoAcervo || undefined, generoId: generoId || undefined }),
        listarGeneros(),
        listarColecoes(),
      ]);
      setLivros(l);
      setGeneros(g);
      setColecoes(c);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nomeGenero(id: string | null) {
    return generos.find((g) => g.id === id)?.nome ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Buscar por título ou autor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregar()}
            className="w-full pl-9 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>
        <select value={tipoAcervo} onChange={(e) => setTipoAcervo(e.target.value as FiltroLivros['tipoAcervo'] | '')} className="px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
          <option value="">Todos os tipos</option>
          <option value="FISICO">Físico</option>
          <option value="ONLINE">Acervo Online</option>
        </select>
        <select value={generoId} onChange={(e) => setGeneroId(e.target.value)} className="px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
          <option value="">Todos os gêneros</option>
          {generos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <button onClick={carregar} className="px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-sm text-gray-300 hover:border-ms-blue transition-colors">Filtrar</button>
        <button onClick={() => setLivroEditando(null)} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Novo livro
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
      ) : livros.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum livro encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {livros.map((l) => (
            <div key={l.id} className={`bg-ms-card border rounded-2xl p-4 flex gap-4 ${l.ativo ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}>
              <div className="w-16 h-20 shrink-0 rounded-lg bg-ms-dark border border-gray-800 overflow-hidden flex items-center justify-center">
                {l.capa_url ? <img src={l.capa_url} alt={l.titulo} className="w-full h-full object-cover" /> : <BookCopy className="w-6 h-6 text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ms-main truncate">{l.titulo}</p>
                <p className="text-[11px] text-gray-500 truncate">{l.autor}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {nomeGenero(l.genero_id) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-ms-dark border border-gray-800 text-gray-400">{nomeGenero(l.genero_id)}</span>}
                  {l.tipo_acervo === 'ONLINE' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1"><Globe className="w-3 h-3" /> Online</span>
                  )}
                  {!l.ativo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">Inativo</span>}
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => setLivroEditando(l)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-ms-main font-bold"><Pencil className="w-3 h-3" /> Editar</button>
                  {l.tipo_acervo === 'FISICO' && (
                    <button onClick={() => setLivroExemplares(l)} className="flex items-center gap-1 text-[11px] text-ms-blue hover:underline font-bold"><BookCopy className="w-3 h-3" /> Exemplares</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {livroEditando !== undefined && (
        <LivroFormModal
          livro={livroEditando}
          generos={generos}
          colecoes={colecoes}
          onClose={() => setLivroEditando(undefined)}
          onSalvo={carregar}
        />
      )}

      {livroExemplares && <ExemplaresModal livro={livroExemplares} onClose={() => setLivroExemplares(null)} />}
    </div>
  );
}
