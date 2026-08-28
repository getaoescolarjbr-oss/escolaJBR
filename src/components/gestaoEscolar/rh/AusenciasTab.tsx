import { useEffect, useState } from 'react';
import { Loader2, Plus, Upload, FileText, ShieldAlert, ShieldOff } from 'lucide-react';
import type { AusenciaServidor, TipoAusencia, StatusOficialAusencia } from '../../../types/rh';
import {
  listarAusencias,
  criarAusencia,
  atualizarStatusOficialAusencia,
  encerrarAusencia,
  enviarDocumentoAusencia,
  obterUrlDocumentoAusencia,
} from '../../../services/rhService';
import { listarProfessoresParaSelecao } from '../../../services/agendamentoService';

const ROTULOS_TIPO: Record<TipoAusencia, string> = {
  ATESTADO: 'Atestado médico',
  LICENCA: 'Licença',
  FERIAS: 'Férias',
  FALTA: 'Falta',
  OUTRO: 'Outro',
};

const ROTULOS_STATUS_OFICIAL: Record<StatusOficialAusencia, string> = {
  INTERNO: 'Interno (não enviado à SED)',
  ENVIADO_SED: 'Enviado à SED',
  DEFERIDO: 'Deferido pela SED',
  PUBLICADO_DO: 'Publicado em Diário Oficial',
};

export function AusenciasTab() {
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaServidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoDoc, setEnviandoDoc] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [novo, setNovo] = useState({ professor_id: '', tipo: 'ATESTADO' as TipoAusencia, data_inicio: today, data_fim: today, substituto_id: '', processo_sed_ref: '', observacoes: '' });

  async function carregar() {
    setLoading(true);
    try {
      const [listaProfessores, listaAusencias] = await Promise.all([listarProfessoresParaSelecao(), listarAusencias()]);
      setProfessores(listaProfessores);
      setAusencias(listaAusencias);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.professor_id) {
      setErro('Selecione o servidor.');
      return;
    }
    setErro(null);
    try {
      await criarAusencia({
        professor_id: novo.professor_id,
        tipo: novo.tipo,
        data_inicio: novo.data_inicio,
        data_fim: novo.data_fim,
        substituto_id: novo.substituto_id || null,
        processo_sed_ref: novo.processo_sed_ref || null,
        observacoes: novo.observacoes || null,
      });
      setNovo({ professor_id: '', tipo: 'ATESTADO', data_inicio: today, data_fim: today, substituto_id: '', processo_sed_ref: '', observacoes: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar ausência.');
    }
  }

  async function handleStatusOficial(a: AusenciaServidor, statusOficial: StatusOficialAusencia) {
    await atualizarStatusOficialAusencia(a.id, statusOficial, a.processo_sed_ref);
    await carregar();
  }

  async function handleProcessoSedRef(a: AusenciaServidor, processoSedRef: string) {
    await atualizarStatusOficialAusencia(a.id, a.status_oficial, processoSedRef || null);
    await carregar();
  }

  async function handleEncerrar(a: AusenciaServidor) {
    await encerrarAusencia(a.id, today);
    await carregar();
  }

  async function handleEnviarDocumento(ausenciaId: string, arquivo: File) {
    setEnviandoDoc(ausenciaId);
    setErro(null);
    try {
      await enviarDocumentoAusencia(ausenciaId, arquivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar documento.');
    } finally {
      setEnviandoDoc(null);
    }
  }

  async function handleVerDocumento(a: AusenciaServidor) {
    try {
      const url = await obterUrlDocumentoAusencia(a);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir documento.');
    }
  }

  function nomeProfessor(id: string) {
    return professores.find((p) => p.id === id)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="p-3 bg-amber-950/20 border border-amber-900/50 rounded-lg text-xs text-amber-400 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Dado sensível de saúde (LGPD). Visível apenas a Gestão e Secretaria (e ao próprio servidor, para seus
        registros). O status oficial e o processo SED são apenas rótulos manuais — este app não defere licença nem
        formaliza nada perante a SED; o ato oficial acontece na SUGESP.
      </div>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova ausência</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novo.professor_id} onChange={(e) => setNovo({ ...novo, professor_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Servidor...</option>
            {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoAusencia })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input type="date" value={novo.data_inicio} onChange={(e) => setNovo({ ...novo, data_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" min={novo.data_inicio} value={novo.data_fim} onChange={(e) => setNovo({ ...novo, data_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={novo.substituto_id} onChange={(e) => setNovo({ ...novo, substituto_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Substituto (opcional)...</option>
            {professores.filter((p) => p.id !== novo.professor_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <input placeholder="Processo SED (opcional)" value={novo.processo_sed_ref} onChange={(e) => setNovo({ ...novo, processo_sed_ref: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <textarea placeholder="Observações (opcional)" value={novo.observacoes} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-20" />
        <button onClick={handleCriar} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </div>

      <div className="space-y-2">
        {ausencias.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ausência registrada.</p>
        ) : (
          ausencias.map((a) => (
            <div key={a.id} className={`px-4 py-3 rounded-xl border space-y-2 ${a.ativo ? 'bg-ms-card border-gray-800' : 'bg-ms-dark border-gray-800 opacity-60'}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-ms-main">{nomeProfessor(a.professor_id)} — {ROTULOS_TIPO[a.tipo]}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(a.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {a.substituto_id && ` · Substituto: ${nomeProfessor(a.substituto_id)}`}
                  </p>
                  {a.observacoes && <p className="text-xs text-gray-400 mt-1">{a.observacoes}</p>}
                </div>
                {a.ativo && (
                  <button onClick={() => handleEncerrar(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-[10px] font-black">
                    <ShieldOff className="w-3 h-3" /> Encerrar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select value={a.status_oficial} onChange={(e) => handleStatusOficial(a, e.target.value as StatusOficialAusencia)} className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                  {Object.entries(ROTULOS_STATUS_OFICIAL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
                <input
                  placeholder="Nº processo SED"
                  defaultValue={a.processo_sed_ref ?? ''}
                  onBlur={(e) => handleProcessoSedRef(a, e.target.value)}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main w-40"
                />
                {a.documento_path ? (
                  <button onClick={() => handleVerDocumento(a)} className="flex items-center gap-1.5 text-xs font-bold text-ms-blueText hover:text-blue-400">
                    <FileText className="w-3.5 h-3.5" /> Ver documento
                  </button>
                ) : (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer">
                    {enviandoDoc === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Anexar documento
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEnviarDocumento(a.id, f); }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
