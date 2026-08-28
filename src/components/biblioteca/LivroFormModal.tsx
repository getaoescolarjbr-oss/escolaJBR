import { useState } from 'react';
import { X, Loader2, Save, Upload, BookOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Livro, Genero, Colecao, TipoAcervo } from '../../types/biblioteca';
import { criarLivro, atualizarLivro, enviarCapa, enviarArquivoOnline } from '../../services/bibliotecaService';

interface LivroFormModalProps {
  livro: Livro | null;
  generos: Genero[];
  colecoes: Colecao[];
  onClose: () => void;
  onSalvo: () => void;
}

const campoClasse = 'w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

export function LivroFormModal({ livro, generos, colecoes, onClose, onSalvo }: LivroFormModalProps) {
  const { usuarioId } = useAuth();

  const [titulo, setTitulo] = useState(livro?.titulo ?? '');
  const [autor, setAutor] = useState(livro?.autor ?? '');
  const [isbn, setIsbn] = useState(livro?.isbn ?? '');
  const [editora, setEditora] = useState(livro?.editora ?? '');
  const [anoPublicacao, setAnoPublicacao] = useState(livro?.ano_publicacao?.toString() ?? '');
  const [generoId, setGeneroId] = useState(livro?.genero_id ?? '');
  const [colecaoId, setColecaoId] = useState(livro?.colecao_id ?? '');
  const [volume, setVolume] = useState(livro?.volume?.toString() ?? '');
  const [sinopse, setSinopse] = useState(livro?.sinopse ?? '');
  const [tipoAcervo, setTipoAcervo] = useState<TipoAcervo>(livro?.tipo_acervo ?? 'FISICO');
  const [dominioPublico, setDominioPublico] = useState(livro?.dominio_publico ?? false);
  const [fonteDominioPublico, setFonteDominioPublico] = useState(livro?.fonte_dominio_publico ?? '');
  const [ativo, setAtivo] = useState(livro?.ativo ?? true);

  const [arquivoCapa, setArquivoCapa] = useState<File | null>(null);
  const [previewCapa, setPreviewCapa] = useState<string | null>(livro?.capa_url ?? null);
  const [arquivoOnline, setArquivoOnline] = useState<File | null>(null);
  const [arquivoOnlineAtual, setArquivoOnlineAtual] = useState(livro?.arquivo_url ?? null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Regra não negociável de direito autoral, espelhada aqui na tela (o CHECK no
  // banco é a garantia de verdade — isto é só para orientar quem preenche o
  // formulário antes de tentar salvar).
  function handleTipoAcervoChange(tipo: TipoAcervo) {
    setTipoAcervo(tipo);
    if (tipo === 'ONLINE') setDominioPublico(true);
  }

  function handleCapaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoCapa(file);
    setPreviewCapa(URL.createObjectURL(file));
  }

  async function handleSalvar() {
    if (!titulo.trim() || !autor.trim()) {
      setErro('Título e autor são obrigatórios.');
      return;
    }
    if (dominioPublico && !fonteDominioPublico.trim()) {
      setErro('Informe a fonte do domínio público (ex.: Domínio Público - MEC, Project Gutenberg).');
      return;
    }
    if (tipoAcervo === 'ONLINE' && !arquivoOnline && !arquivoOnlineAtual) {
      setErro('Envie o arquivo de domínio público para um livro do tipo Acervo Online.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const dados = {
        titulo: titulo.trim(),
        autor: autor.trim(),
        isbn: isbn.trim() || null,
        editora: editora.trim() || null,
        ano_publicacao: anoPublicacao ? Number(anoPublicacao) : null,
        genero_id: generoId || null,
        colecao_id: colecaoId || null,
        volume: volume ? Number(volume) : null,
        sinopse: sinopse.trim() || null,
        tipo_acervo: tipoAcervo,
        dominio_publico: dominioPublico,
        fonte_dominio_publico: dominioPublico ? fonteDominioPublico.trim() : null,
        ativo,
      };

      let livroId = livro?.id;
      if (livro) {
        await atualizarLivro(livro.id, dados);
      } else {
        const criado = await criarLivro({
          ...dados,
          capa_url: null,
          arquivo_url: null,
          criado_por: usuarioId,
        });
        livroId = criado.id;
      }

      if (livroId) {
        const atualizacoes: Record<string, string> = {};
        if (arquivoCapa) atualizacoes.capa_url = await enviarCapa(arquivoCapa, livroId);
        if (arquivoOnline) atualizacoes.arquivo_url = await enviarArquivoOnline(arquivoOnline, livroId);
        if (Object.keys(atualizacoes).length > 0) await atualizarLivro(livroId, atualizacoes);
      }

      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar livro.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-ms-card max-w-2xl w-full rounded-2xl shadow-2xl relative my-auto border border-gray-800">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-ms-blueText" />
            <p className="text-sm font-black text-ms-main">{livro ? 'Editar livro' : 'Novo livro'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-ms-dark rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campoClasse} />
            <input placeholder="Autor *" value={autor} onChange={(e) => setAutor(e.target.value)} className={campoClasse} />
            <input placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} className={campoClasse} />
            <input placeholder="Editora" value={editora} onChange={(e) => setEditora(e.target.value)} className={campoClasse} />
            <input type="number" placeholder="Ano de publicação" value={anoPublicacao} onChange={(e) => setAnoPublicacao(e.target.value)} className={campoClasse} />
            <input type="number" placeholder="Volume (se for de uma coleção)" value={volume} onChange={(e) => setVolume(e.target.value)} className={campoClasse} />
            <select value={generoId} onChange={(e) => setGeneroId(e.target.value)} className={campoClasse}>
              <option value="">Gênero (opcional)</option>
              {generos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
            <select value={colecaoId} onChange={(e) => setColecaoId(e.target.value)} className={campoClasse}>
              <option value="">Coleção/série (opcional)</option>
              {colecoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <textarea placeholder="Sinopse" value={sinopse} onChange={(e) => setSinopse(e.target.value)} rows={3} className={`${campoClasse} resize-none`} />

          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">Capa</p>
            <div className="flex items-center gap-4">
              {previewCapa && <img src={previewCapa} alt="Capa" className="w-16 h-20 object-cover rounded-lg border border-gray-800" />}
              <label className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-gray-300 cursor-pointer hover:border-ms-blueText transition-colors">
                <Upload className="w-4 h-4" /> Enviar imagem
                <input type="file" accept="image/*" onChange={handleCapaChange} className="hidden" />
              </label>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main">Tipo de acervo</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleTipoAcervoChange('FISICO')}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${tipoAcervo === 'FISICO' ? 'bg-ms-blue text-white border-ms-blueText' : 'bg-ms-dark text-gray-400 border-gray-800'}`}
              >
                Físico (com exemplares)
              </button>
              <button
                type="button"
                onClick={() => handleTipoAcervoChange('ONLINE')}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${tipoAcervo === 'ONLINE' ? 'bg-ms-blue text-white border-ms-blueText' : 'bg-ms-dark text-gray-400 border-gray-800'}`}
              >
                Acervo Online (domínio público)
              </button>
            </div>

            {tipoAcervo === 'ONLINE' && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                <p className="text-[11px] text-amber-500">
                  Só é permitido publicar no Acervo Online obras de domínio público, com a fonte registrada. Nunca hospede
                  arquivos protegidos por direito autoral — o banco recusa a gravação sem essas duas condições.
                </p>
                <input
                  placeholder="Fonte do domínio público (ex.: Domínio Público - MEC, Project Gutenberg) *"
                  value={fonteDominioPublico}
                  onChange={(e) => setFonteDominioPublico(e.target.value)}
                  className={campoClasse}
                />
                <div className="flex items-center gap-4">
                  {arquivoOnlineAtual && !arquivoOnline && (
                    <a href={arquivoOnlineAtual} target="_blank" rel="noreferrer" className="text-xs text-ms-blueText hover:underline">Arquivo atual</a>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-gray-300 cursor-pointer hover:border-ms-blueText transition-colors">
                    <Upload className="w-4 h-4" /> {arquivoOnline ? arquivoOnline.name : 'Enviar arquivo (PDF/texto) *'}
                    <input
                      type="file"
                      accept=".pdf,.txt,.epub"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { setArquivoOnline(f); setArquivoOnlineAtual(null); } }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ms-main">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo (visível no acervo)
          </label>

          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>

        <div className="p-6 border-t border-gray-800 flex justify-end">
          <button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
