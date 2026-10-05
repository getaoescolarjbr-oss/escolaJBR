import { useEffect, useRef, useState } from 'react';
import { Camera, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { DocumentoPessoa, TipoDocumentoPessoa } from '../../types/secretaria';
import { enviarDocumento, excluirDocumento, listarDocumentos, obterUrlAssinada } from '../../services/documentosPessoaService';
import { ScannerDocumento } from './ScannerDocumento';
import { CATEGORIAS_SERVIDOR } from '../../utils/categoriasServidor';

interface Props {
  pessoaId: string;
  tipo: TipoDocumentoPessoa;
  nomeServidor: string;
  // Só a lista (sem enviar): usado quando o envio é feito por outro componente (assinatura digital).
  somenteLista?: boolean;
  // Muda quando outro componente guardou um documento: relê a lista.
  recarregarChave?: number;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// Documentos de UMA categoria da ficha do servidor: envia por câmera (escâner) ou arquivo,
// com descrição, e lista/abre/exclui o que já foi guardado.
export function DocumentosServidor({ pessoaId, tipo, nomeServidor, somenteLista = false, recarregarChave = 0 }: Props) {
  const { usuarioId } = useAuth();
  const categoria = CATEGORIAS_SERVIDOR.find((c) => c.tipo === tipo)!;
  const [docs, setDocs] = useState<DocumentoPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escaneando, setEscaneando] = useState<File | 'camera' | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setDocs((await listarDocumentos(pessoaId)).filter((d) => d.tipo === tipo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar documentos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { setDescricao(''); setErro(null); void carregar(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoaId, tipo, recarregarChave]);

  function descricaoOk(): boolean {
    if (categoria.descricaoObrigatoria && !descricao.trim()) {
      setErro(`Preencha "${categoria.rotuloDescricao}" antes de enviar.`);
      return false;
    }
    setErro(null);
    return true;
  }

  async function enviar(arquivo: File) {
    if (!usuarioId) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarDocumento(pessoaId, tipo, arquivo, usuarioId, descricao.trim() || undefined);
      setDescricao('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar o documento.');
    } finally {
      setEnviando(false);
    }
  }

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    // Foto passa pelo escâner (recorte + melhoria); PDF vai direto.
    if (arquivo.type.startsWith('image/')) setEscaneando(arquivo);
    else void enviar(arquivo);
  }

  async function ver(doc: DocumentoPessoa) {
    try { window.open(await obterUrlAssinada(doc), '_blank'); }
    catch (e) { alert(e instanceof Error ? e.message : 'Erro ao abrir o documento.'); }
  }

  async function excluir(doc: DocumentoPessoa) {
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return;
    try { await excluirDocumento(doc); await carregar(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  }

  return (
    <div className="space-y-4">
      {!somenteLista && (
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{categoria.rotuloDescricao}{categoria.descricaoObrigatoria ? ' *' : ''}</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={categoria.placeholder}
            className="mt-1 w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => descricaoOk() && setEscaneando('camera')} disabled={enviando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
            <Camera className="w-4 h-4" /> Escanear com a câmera
          </button>
          <button onClick={() => descricaoOk() && arquivoRef.current?.click()} disabled={enviando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-ms-dark border border-gray-700 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue disabled:opacity-50">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar PDF ou imagem
          </button>
          <input ref={arquivoRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={aoEscolherArquivo} />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>
      )}

      {carregando ? (
        <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-ms-blueText" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum documento nesta categoria.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-ms-blueText shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ms-main truncate">{d.observacoes || d.nome_arquivo}</p>
                  <p className="text-[10px] text-gray-500 truncate">{d.nome_arquivo} · {new Date(d.enviado_em).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => ver(d)} className="p-2 hover:bg-ms-blue/20 text-ms-blueText rounded-lg" title="Abrir"><Eye className="w-4 h-4" /></button>
                <button onClick={() => excluir(d)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {escaneando && (
        <ScannerDocumento
          nomeArquivo={`${semAcento(categoria.rotulo)}-${semAcento(nomeServidor)}-${new Date().toISOString().slice(0, 10)}`}
          arquivoInicial={escaneando === 'camera' ? null : escaneando}
          onFechar={() => setEscaneando(null)}
          onConcluir={(pdf) => { setEscaneando(null); void enviar(pdf); }}
        />
      )}
    </div>
  );
}
