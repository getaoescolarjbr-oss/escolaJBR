import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, CalendarClock } from 'lucide-react';
import { SectionIcon } from '../../ui/SectionIcon';
import type { JornadaServidor, TurnoJornada } from '../../../types/rh';
import { listarJornadas, criarJornada, excluirJornada } from '../../../services/rhService';
import { listarProfessoresParaSelecao } from '../../../services/agendamentoService';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function EscalaTab() {
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [jornadas, setJornadas] = useState<JornadaServidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState({
    servidor_id: '',
    turno: 'Matutino' as TurnoJornada,
    dias_semana: [] as number[],
    hora_inicio: '07:00',
    hora_fim: '11:00',
    vigencia_inicio: new Date().toISOString().slice(0, 10),
    vigencia_fim: '',
  });

  async function carregar() {
    setLoading(true);
    try {
      const [listaProfessores, listaJornadas] = await Promise.all([listarProfessoresParaSelecao(), listarJornadas()]);
      setProfessores(listaProfessores);
      setJornadas(listaJornadas);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  function toggleDia(dia: number) {
    setNova((n) => ({
      ...n,
      dias_semana: n.dias_semana.includes(dia) ? n.dias_semana.filter((d) => d !== dia) : [...n.dias_semana, dia].sort(),
    }));
  }

  async function handleCriar() {
    if (!nova.servidor_id || nova.dias_semana.length === 0) {
      setErro('Selecione o servidor e ao menos um dia da semana.');
      return;
    }
    setErro(null);
    try {
      await criarJornada({
        servidor_id: nova.servidor_id,
        turno: nova.turno,
        dias_semana: nova.dias_semana,
        hora_inicio: nova.hora_inicio,
        hora_fim: nova.hora_fim,
        vigencia_inicio: nova.vigencia_inicio,
        vigencia_fim: nova.vigencia_fim || null,
      });
      setNova({ ...nova, servidor_id: '', dias_semana: [] });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar jornada.');
    }
  }

  async function handleExcluir(id: string) {
    await excluirJornada(id);
    await carregar();
  }

  function nomeServidor(servidorId: string) {
    return professores.find((p) => p.id === servidorId)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={CalendarClock} cor="blue" /> Nova jornada</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={nova.servidor_id} onChange={(e) => setNova({ ...nova, servidor_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Servidor...</option>
            {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={nova.turno} onChange={(e) => setNova({ ...nova, turno: e.target.value as TurnoJornada })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Noturno">Noturno</option>
            <option value="Integral">Integral</option>
          </select>
          <div />
          <input type="time" value={nova.hora_inicio} onChange={(e) => setNova({ ...nova, hora_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="time" value={nova.hora_fim} onChange={(e) => setNova({ ...nova, hora_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <div />
          <input type="date" value={nova.vigencia_inicio} onChange={(e) => setNova({ ...nova, vigencia_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" placeholder="Vigência até (opcional)" value={nova.vigencia_fim} onChange={(e) => setNova({ ...nova, vigencia_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDia(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                nova.dias_semana.includes(idx) ? 'bg-ms-blue text-white border-ms-blueText' : 'bg-ms-dark text-gray-400 border-gray-800 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={handleCriar} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Criar jornada
        </button>
      </div>

      <div className="space-y-2">
        {jornadas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma jornada cadastrada.</p>
        ) : (
          jornadas.map((j) => (
            <div key={j.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{nomeServidor(j.servidor_id)} — {j.turno}</p>
                <p className="text-[11px] text-gray-500">
                  {j.dias_semana.map((d) => DIAS_SEMANA[d]).join(', ')} · {j.hora_inicio.slice(0, 5)}–{j.hora_fim.slice(0, 5)}
                  {j.vigencia_fim ? ` · até ${new Date(j.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <button onClick={() => handleExcluir(j.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
