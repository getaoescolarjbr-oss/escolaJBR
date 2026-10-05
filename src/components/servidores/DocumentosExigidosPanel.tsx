import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import {
  excluirDocumentoExigido, listarDocumentosExigidos, salvarDocumentoExigido,
  type DocumentoExigido, type TipoDocumentoExigido,
} from '../../services/cadastroServidorService';

const TIPOS: { valor: TipoDocumentoExigido; rotulo: string }[] = [
  { valor: 'DOCUMENTO_PESSOAL', rotulo: 'Documento pessoal' },
  { valor: 'CERTIFICADO', rotulo: 'Certificado / formação (pede descrição)' },
  { valor: 'ATESTADO_MEDICO', rotulo: 'Atestado médico' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';
const NOVO: Partial<DocumentoExigido> & { rotulo: string } = { rotulo: '', instrucao: '', tipo: 'DOCUMENTO_PESSOAL', obrigatorio: false, ativo: true };

// Quais documentos o servidor novo precisa anexar no cadastro, e quais são obrigatórios.
// Configurado pela Secretária Geral (ou pela Gestão). O cadastro só é enviado com todos os
// obrigatórios ativos anexados (o banco confere).
export function DocumentosExigidosPanel() {
  const [lista, setLista] = useState<DocumentoExigido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<(Partial<DocumentoExigido> & { rotulo: string }) | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLista(await listarDocumentosExigidos(false));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function guardar(doc: Partial<DocumentoExigido> & { rotulo: string }) {
    if (doc.rotulo.trim().length < 2) { setErro('Informe o nome do documento.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      await salvarDocumentoExigido({ ...doc, ordem: doc.ordem ?? (lista.length ? Math.max(...lista.map((x) => x.ordem)) + 10 : 10) });
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(doc: DocumentoExigido, campo: 'obrigatorio' | 'ativo') {
    setLista((l) => l.map((x) => (x.id === doc.id ? { ...x, [campo]: !x[campo] } : x)));
    try { await salvarDocumentoExigido({ ...doc, [campo]: !doc[campo] }); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar.'); await carregar(); }
  }

  // Troca a ordem com o vizinho (as ordens são de 10 em 10, então basta trocar os valores).
  async function mover(i: number, delta: -1 | 1) {
    const a = lista[i], b = lista[i + delta];
    if (!a || !b) return;
    try {
      await Promise.all([salvarDocumentoExigido({ ...a, ordem: b.ordem }), salvarDocumentoExigido({ ...b, ordem: a.ordem })]);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao reordenar.');
    }
  }

  async function excluir(doc: DocumentoExigido) {
    if (!confirm(`Excluir "${doc.rotulo}" da lista? Cadastros já enviados mantêm os arquivos. Para só parar de pedir, prefira desativar.`)) return;
    try { await excluirDocumentoExigido(doc.id); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-ms-main">Documentos exigidos no cadastro de novos servidores</h3>
        <p className="text-xs text-gray-400">
          O servidor anexa estes documentos (pela câmera ou por arquivo) antes de enviar o cadastro. Os <b>obrigatórios</b> impedem o envio enquanto faltarem.
          Servidores já cadastrados não são afetados.
        </p>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {carregando ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
      ) : (
        <div className="space-y-2">
          {lista.map((d, i) => (
            <div key={d.id} className={`flex items-center gap-3 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl ${d.ativo ? '' : 'opacity-50'}`}>
              <div className="flex flex-col shrink-0">
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-0.5 text-gray-500 hover:text-ms-main disabled:opacity-20" aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} className="p-0.5 text-gray-500 hover:text-ms-main disabled:opacity-20" aria-label="Descer"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={() => setEditando(d)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-ms-main truncate">{d.rotulo}</p>
                <p className="text-[11px] text-gray-500 truncate">{d.instrucao || TIPOS.find((t) => t.valor === d.tipo)?.rotulo}</p>
              </button>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer shrink-0">
                <input type="checkbox" checked={d.obrigatorio} onChange={() => alternar(d, 'obrigatorio')} className="accent-amber-500" /> Obrigatório
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer shrink-0">
                <input type="checkbox" checked={d.ativo} onChange={() => alternar(d, 'ativo')} className="accent-green-600" /> Ativo
              </label>
              <button onClick={() => excluir(d)} className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-lg shrink-0" title="Excluir"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {lista.length === 0 && <p className="text-sm text-gray-500">Nenhum documento configurado: o cadastro será enviado sem anexos.</p>}
        </div>
      )}

      {editando ? (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">{editando.id ? 'Editar documento' : 'Novo documento'}</p>
          <input value={editando.rotulo} onChange={(e) => setEditando({ ...editando, rotulo: e.target.value })} placeholder="Nome (ex.: Comprovante de residência)" className={classeInput} />
          <input value={editando.instrucao ?? ''} onChange={(e) => setEditando({ ...editando, instrucao: e.target.value })} placeholder="Instrução para o servidor (opcional)" className={classeInput} />
          <select value={editando.tipo ?? 'DOCUMENTO_PESSOAL'} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoDocumentoExigido })} className={classeInput}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-ms-main cursor-pointer">
            <input type="checkbox" checked={editando.obrigatorio ?? false} onChange={(e) => setEditando({ ...editando, obrigatorio: e.target.checked })} className="accent-amber-500" /> Obrigatório
          </label>
          <div className="flex gap-2">
            <button onClick={() => guardar(editando)} disabled={salvando} className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </button>
            <button onClick={() => { setEditando(null); setErro(null); }} className="flex items-center gap-1 px-4 py-2 bg-ms-dark border border-gray-800 text-gray-300 rounded-lg text-sm"><X className="w-4 h-4" /> Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditando({ ...NOVO })} className="flex items-center gap-2 px-4 py-2 bg-ms-card border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue">
          <Plus className="w-4 h-4" /> Adicionar documento
        </button>
      )}
    </div>
  );
}
