import { useEffect, useState } from 'react';
import { Search, Heart, Loader2 } from 'lucide-react';
import type { Livro } from '../../types/biblioteca';
import type { FavoritoComLivro } from '../../services/bibliotecaService';
import { listarLivros, listarMeusFavoritos, adicionarFavorito, removerFavorito, criarReservaLivro } from '../../services/bibliotecaService';

interface AlunoAcervoTabProps {
  alunoId: string;
}

export function AlunoAcervoTab({ alunoId }: AlunoAcervoTabProps) {
  const [favoritos, setFavoritos] = useState<FavoritoComLivro[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Livro[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      setFavoritos(await listarMeusFavoritos(alunoId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function handleBuscar() {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      setResultadosBusca(await listarLivros({ busca, somenteAtivos: true }));
    } finally {
      setBuscando(false);
    }
  }

  async function handleFavoritar(livroId: string) {
    setMensagem(null);
    try {
      await adicionarFavorito(alunoId, livroId);
      setFavoritos(await listarMeusFavoritos(alunoId));
      setMensagem('Adicionado aos favoritos!');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Você já tem este livro nos favoritos.');
    }
  }

  async function handleRemoverFavorito(favoritoId: string) {
    await removerFavorito(favoritoId);
    setFavoritos(await listarMeusFavoritos(alunoId));
  }

  async function handleReservar(livroId: string) {
    setMensagem(null);
    try {
      await criarReservaLivro(livroId, alunoId);
      setMensagem('Reserva feita! A biblioteca vai te avisar quando o livro estiver disponível.');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível reservar este título.');
    }
  }

  return (
    <div className="space-y-8">
      {mensagem && <div className="p-3 bg-ms-card border border-ms-blue/30 rounded-xl text-sm text-ms-main">{mensagem}</div>}

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Buscar no acervo</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Título ou autor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="w-full pl-9 pr-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            />
          </div>
          <button onClick={handleBuscar} disabled={buscando} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
          </button>
        </div>
        {resultadosBusca.length > 0 && (
          <div className="space-y-2">
            {resultadosBusca.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-ms-main">{l.titulo}</p>
                  <p className="text-[11px] text-gray-500">{l.autor}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleFavoritar(l.id)} className="p-2 bg-ms-dark border border-gray-800 rounded-lg text-pink-400 hover:border-pink-500/40 transition-colors" title="Favoritar">
                    <Heart className="w-4 h-4" />
                  </button>
                  {l.tipo_acervo === 'FISICO' && (
                    <button onClick={() => handleReservar(l.id)} className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blue transition-colors">
                      Reservar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Meus favoritos</h2>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : favoritos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum favorito ainda — busque um livro acima e toque no coração.</p>
        ) : (
          favoritos.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{f.livro_titulo}</p>
                <p className="text-[11px] text-gray-500">{f.livro_autor}</p>
              </div>
              <button onClick={() => handleRemoverFavorito(f.id)} className="text-[11px] text-gray-400 hover:text-red-400">Remover</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
