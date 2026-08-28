import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Eye, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Pessoa } from '../../types/pessoas';
import type { DocumentoPessoa, TipoDocumentoPessoa } from '../../types/secretaria';
import { listarDocumentos, enviarDocumento, obterUrlAssinada, excluirDocumento } from '../../services/documentosPessoaService';

const ROTULOS_TIPO: Record<TipoDocumentoPessoa, string> = {
  RG_CERTIDAO: 'RG / Certidão de Nascimento',
  CPF: 'CPF',
  COMPROVANTE_RESIDENCIA: 'Comprovante de Residência',
  HISTORICO_ESCOLAR: 'Histórico Escolar',
  OUTRO: 'Outro',
};

interface DocumentosTabProps {
  pessoa: Pessoa;
}

export function DocumentosTab({ pessoa }: DocumentosTabProps) {
  const { usuarioId } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDocumentoPessoa>('RG_CERTIDAO');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setLoading(true);
    try {
      setDocumentos(await listarDocumentos(pessoa.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !usuarioId) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarDocumento(pessoa.id, tipoSelecionado, arquivo, usuarioId);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar documento.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleVisualizar(doc: DocumentoPessoa) {
    try {
      const url = await obterUrlAssinada(doc);
      window.open(url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar link do documento.');
    }
  }

  async function handleExcluir(doc: DocumentoPessoa) {
    if (!confirm(`Excluir o documento "${doc.nome_arquivo}"?`)) return;
    try {
      await excluirDocumento(doc);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir documento.');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Enviar novo documento</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={tipoSelecionado}
            onChange={(e) => setTipoSelecionado(e.target.value as TipoDocumentoPessoa)}
            className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          >
            {Object.entries(ROTULOS_TIPO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Selecionar arquivo
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} accept="application/pdf,image/*" />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : documentos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento enviado ainda.</p>
        ) : (
          documentos.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-ms-blueText shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ms-main truncate">{doc.nome_arquivo}</p>
                  <p className="text-[10px] text-gray-500">{ROTULOS_TIPO[doc.tipo]} · {new Date(doc.enviado_em).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleVisualizar(doc)} className="p-2 hover:bg-ms-blue/20 text-ms-blueText rounded-lg transition-all" title="Visualizar">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleExcluir(doc)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
