import { useEffect, useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { SectionIcon } from '../../ui/SectionIcon';
import type { FrequenciaServidor, StatusFrequencia, Terceirizado } from '../../../types/rh';
import { listarFrequenciaDoDia, registrarFrequenciaServidor, registrarFrequenciaTerceirizado, listarTerceirizados } from '../../../services/rhService';
import { listarProfessoresParaSelecao } from '../../../services/agendamentoService';

const ROTULOS_STATUS: Record<StatusFrequencia, string> = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  ATRASO: 'Atraso',
  ABONADA: 'Abonada',
  AFASTADO: 'Afastado',
};

const CORES_STATUS: Record<StatusFrequencia, string> = {
  PRESENTE: 'bg-green-500/10 text-green-500 border-green-500/20',
  AUSENTE: 'bg-red-500/10 text-red-500 border-red-500/20',
  ATRASO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ABONADA: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  AFASTADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function FrequenciaTab() {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [terceirizados, setTerceirizados] = useState<Terceirizado[]>([]);
  const [frequencias, setFrequencias] = useState<FrequenciaServidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [listaProfessores, listaTerceirizados, listaFrequencias] = await Promise.all([
        listarProfessoresParaSelecao(),
        listarTerceirizados(),
        listarFrequenciaDoDia(data),
      ]);
      setProfessores(listaProfessores);
      setTerceirizados(listaTerceirizados.filter((t) => t.ativo));
      setFrequencias(listaFrequencias);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function handleMarcar(servidorId: string | null, terceirizadoId: string | null, status: StatusFrequencia) {
    const chave = servidorId ?? terceirizadoId ?? '';
    setSalvando(chave);
    setErro(null);
    try {
      if (servidorId) await registrarFrequenciaServidor(servidorId, data, status);
      else if (terceirizadoId) await registrarFrequenciaTerceirizado(terceirizadoId, data, status);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar frequência.');
    } finally {
      setSalvando(null);
    }
  }

  function statusAtual(servidorId: string | null, terceirizadoId: string | null): StatusFrequencia | null {
    const registro = frequencias.find((f) => (servidorId ? f.servidor_id === servidorId : f.terceirizado_id === terceirizadoId));
    return registro?.status ?? null;
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
      </div>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={UserCheck} cor="blue" /> Servidores</p>
        {professores.map((p) => {
          const atual = statusAtual(p.id, null);
          return (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl gap-3 flex-wrap">
              <span className="text-sm font-bold text-ms-main">{p.nome}</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ROTULOS_STATUS) as StatusFrequencia[]).map((s) => (
                  <button
                    key={s}
                    disabled={salvando === p.id}
                    onClick={() => handleMarcar(p.id, null, s)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                      atual === s ? CORES_STATUS[s] : 'bg-ms-dark text-gray-500 border-gray-800 hover:text-gray-300'
                    }`}
                  >
                    {ROTULOS_STATUS[s]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Terceirizados</p>
        {terceirizados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum terceirizado ativo cadastrado.</p>
        ) : (
          terceirizados.map((t) => {
            const atual = statusAtual(null, t.id);
            return (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl gap-3 flex-wrap">
                <div>
                  <span className="text-sm font-bold text-ms-main">{t.nome}</span>
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-black">Terceirizado</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ROTULOS_STATUS) as StatusFrequencia[]).map((s) => (
                    <button
                      key={s}
                      disabled={salvando === t.id}
                      onClick={() => handleMarcar(null, t.id, s)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${
                        atual === s ? CORES_STATUS[s] : 'bg-ms-dark text-gray-500 border-gray-800 hover:text-gray-300'
                      }`}
                    >
                      {ROTULOS_STATUS[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
