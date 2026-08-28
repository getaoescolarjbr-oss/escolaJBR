import { useEffect, useState } from 'react';
import { Loader2, Plus, Paperclip } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Protocolo, StatusProtocolo, AnexoProtocolo } from '../../types/secretaria';
import { listarProtocolos, criarProtocolo, atualizarProtocolo, listarAnexos, anexarArquivo, obterUrlAssinadaAnexo } from '../../services/protocolosService';

const ROTULOS_STATUS: Record<StatusProtocolo, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  ARQUIVADO: 'Arquivado',
};

export function ProtocolosTab() {
  const { usuarioId } = useAuth();
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<StatusProtocolo | ''>('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [protocoloExpandido, setProtocoloExpandido] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<Record<string, AnexoProtocolo[]>>({});
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({ tipo: '', assunto: '', interessado: '', prazo: '', observacoes: '' });

  async function carregar() {
    setLoading(true);
    try {
      setProtocolos(await listarProtocolos(filtro || undefined));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function handleCriar() {
    if (!form.tipo || !form.assunto || !form.interessado) {
      setErro('Preencha tipo, assunto e interessado.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarProtocolo({
        tipo: form.tipo,
        assunto: form.assunto,
        interessado: form.interessado,
        pessoa_id: null,
        prazo: form.prazo || null,
        observacoes: form.observacoes || null,
      });
      setForm({ tipo: '', assunto: '', interessado: '', prazo: '', observacoes: '' });
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar protocolo.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleMudarStatus(p: Protocolo, status: StatusProtocolo) {
    await atualizarProtocolo(p.id, { status });
    await carregar();
  }

  async function toggleAnexos(p: Protocolo) {
    if (protocoloExpandido === p.id) {
      setProtocoloExpandido(null);
      return;
    }
    setProtocoloExpandido(p.id);
    if (!anexos[p.id]) {
      setAnexos({ ...anexos, [p.id]: await listarAnexos(p.id) });
    }
  }

  async function handleAnexar(p: Protocolo, e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !usuarioId) return;
    await anexarArquivo(p.id, arquivo, usuarioId);
    setAnexos({ ...anexos, [p.id]: await listarAnexos(p.id) });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as StatusProtocolo | '')}
          className="px-3 py-2 bg-ms-card border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
        >
          <option value="">Todos os status</option>
          {Object.entries(ROTULOS_STATUS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Protocolo
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Tipo (ex.: Requerimento)" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <input placeholder="Interessado (nome)" value={form.interessado} onChange={(e) => setForm({ ...form, interessado: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          <input placeholder="Assunto" value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          <textarea placeholder="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" rows={2} />
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Protocolo'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : protocolos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum protocolo encontrado.</p>
        ) : (
          protocolos.map((p) => (
            <div key={p.id} className="bg-ms-card border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-black text-ms-main">Nº {p.numero}/{p.ano} — {p.assunto}</p>
                  <p className="text-xs text-gray-500">{p.tipo} · {p.interessado} · recebido em {new Date(p.recebido_em).toLocaleDateString('pt-BR')}</p>
                  {p.prazo && <p className="text-xs text-yellow-500">Prazo: {new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.status}
                    onChange={(e) => handleMudarStatus(p, e.target.value as StatusProtocolo)}
                    className="px-2 py-1 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                  >
                    {Object.entries(ROTULOS_STATUS).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                  <button onClick={() => toggleAnexos(p)} className="p-2 hover:bg-ms-blue/20 text-ms-blueText rounded-lg transition-all" title="Anexos">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {protocoloExpandido === p.id && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                  {(anexos[p.id] ?? []).map((a) => (
                    <button
                      key={a.id}
                      onClick={async () => window.open(await obterUrlAssinadaAnexo(a, p.pessoa_id), '_blank')}
                      className="block text-xs text-ms-blueText hover:underline"
                    >
                      {a.nome_arquivo}
                    </button>
                  ))}
                  <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200">
                    <Paperclip className="w-3.5 h-3.5" /> Anexar arquivo
                    <input type="file" className="hidden" onChange={(e) => handleAnexar(p, e)} />
                  </label>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
