import { useEffect, useState } from 'react';
import { Heart, Flag, Loader2, Star, Quote } from 'lucide-react';
import type { Livro } from '../../types/biblioteca';
import { listarLivros } from '../../services/bibliotecaService';
import type { ResenhaFeed } from '../../services/bibliotecaSocialService';
import { listarFeedResenhas, criarResenha, curtirResenha, descurtirResenha, denunciarResenha, obterFraseDoDia } from '../../services/bibliotecaSocialService';

interface AlunoFeedTabProps {
  alunoId: string;
}

export function AlunoFeedTab({ alunoId }: AlunoFeedTabProps) {
  const [feed, setFeed] = useState<ResenhaFeed[]>([]);
  const [frase, setFrase] = useState<{ texto: string; autor: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [livroBusca, setLivroBusca] = useState('');
  const [livrosEncontrados, setLivrosEncontrados] = useState<Livro[]>([]);
  const [livroSelecionado, setLivroSelecionado] = useState<Livro | null>(null);
  const [nota, setNota] = useState(5);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [feedAtual, fraseAtual] = await Promise.all([listarFeedResenhas(alunoId), obterFraseDoDia()]);
      setFeed(feedAtual);
      setFrase(fraseAtual);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function handleBuscarLivro(valor: string) {
    setLivroBusca(valor);
    setLivroSelecionado(null);
    setLivrosEncontrados(valor.trim().length >= 2 ? await listarLivros({ busca: valor, somenteAtivos: true }) : []);
  }

  async function handlePublicar() {
    if (!livroSelecionado || !texto.trim()) {
      setErro('Escolha um livro e escreva sua resenha.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await criarResenha({ aluno_id: alunoId, livro_id: livroSelecionado.id, nota, texto: texto.trim() });
      setTexto('');
      setLivroSelecionado(null);
      setLivroBusca('');
      setMensagem(
        resultado.status === 'VISIVEL'
          ? 'Resenha publicada!'
          : 'Sua resenha foi enviada, mas o filtro automático identificou um possível problema — a equipe da biblioteca vai revisar antes de publicar.'
      );
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar resenha.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleCurtir(resenha: ResenhaFeed) {
    if (resenha.minhaCurtida) await descurtirResenha(resenha.id, alunoId);
    else await curtirResenha(resenha.id, alunoId);
    setFeed(await listarFeedResenhas(alunoId));
  }

  async function handleDenunciar(resenhaId: string) {
    const motivo = window.prompt('Por que você está denunciando esta resenha?');
    if (!motivo) return;
    try {
      await denunciarResenha(resenhaId, alunoId, motivo);
      setMensagem('Denúncia enviada para a equipe da biblioteca.');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao denunciar.');
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {frase && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 flex items-start gap-3">
          <Quote className="w-5 h-5 text-ms-blue shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ms-main italic">"{frase.texto}"</p>
            {frase.autor && <p className="text-[11px] text-gray-500 mt-1">— {frase.autor}</p>}
          </div>
        </div>
      )}

      {mensagem && <div className="p-3 bg-ms-card border border-ms-blue/30 rounded-xl text-sm text-ms-main">{mensagem}</div>}

      <section className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Escrever resenha</p>
        <div className="relative">
          <input
            placeholder={livroSelecionado ? livroSelecionado.titulo : 'Buscar livro por título...'}
            value={livroSelecionado ? livroSelecionado.titulo : livroBusca}
            onChange={(e) => handleBuscarLivro(e.target.value)}
            className="w-full px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          {livrosEncontrados.length > 0 && !livroSelecionado && (
            <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              {livrosEncontrados.map((l) => (
                <button key={l.id} onClick={() => { setLivroSelecionado(l); setLivrosEncontrados([]); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                  {l.titulo}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setNota(n)}>
              <Star className={`w-5 h-5 ${n <= nota ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
            </button>
          ))}
        </div>
        <textarea
          placeholder="O que você achou desse livro?"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none"
        />
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handlePublicar} disabled={enviando} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar'}
        </button>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-gray-400">Resenhas da escola</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma resenha publicada ainda — seja o primeiro!</p>
        ) : (
          feed.map((r) => (
            <div key={r.id} className="bg-ms-card border border-gray-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-ms-main">{r.aluno_nome.split(' ')[0]} · {r.livro_titulo}</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: r.nota }).map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
                </div>
              </div>
              <p className="text-sm text-gray-300">{r.texto}</p>
              <div className="flex items-center gap-4 pt-1">
                <button onClick={() => handleCurtir(r)} className={`flex items-center gap-1 text-[11px] ${r.minhaCurtida ? 'text-pink-400' : 'text-gray-500 hover:text-pink-400'}`}>
                  <Heart className={`w-3.5 h-3.5 ${r.minhaCurtida ? 'fill-pink-400' : ''}`} /> {r.curtidas > 0 && r.curtidas}
                </button>
                {r.aluno_id !== alunoId && (
                  <button onClick={() => handleDenunciar(r.id)} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400">
                    <Flag className="w-3.5 h-3.5" /> Denunciar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
