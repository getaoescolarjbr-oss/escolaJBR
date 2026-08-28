import { useEffect, useState } from 'react';
import { Loader2, Plus, XCircle, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Recurso, SerieReserva, OcorrenciaSerieResultado } from '../../types/agendamento';
import type { ReservaComRecurso } from '../../services/agendamentoService';
import {
  listarRecursos,
  listarProfessoresParaSelecao,
  listarTurmas,
  listarSeries,
  criarSerieRecorrente,
  cancelarSerie,
  listarOcorrenciasSerie,
} from '../../services/agendamentoService';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function SeriesTab() {
  const { usuarioId } = useAuth();
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [series, setSeries] = useState<SerieReserva[]>([]);
  const [ocorrenciasPorSerie, setOcorrenciasPorSerie] = useState<Record<string, ReservaComRecurso[]>>({});
  const [serieExpandida, setSerieExpandida] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<OcorrenciaSerieResultado[] | null>(null);

  const [form, setForm] = useState({
    recurso_id: '', professor_id: '', dia_semana: 1, hora_inicio: '08:00', hora_fim: '09:00',
    vigencia_inicio: new Date().toISOString().slice(0, 10), vigencia_fim: '', turma_id: '', finalidade: '',
  });

  async function carregar() {
    setLoading(true);
    try {
      const [listaRecursos, listaProfessores, listaTurmas, listaSeries] = await Promise.all([
        listarRecursos(), listarProfessoresParaSelecao(), listarTurmas(), listarSeries(),
      ]);
      setRecursos(listaRecursos);
      setProfessores(listaProfessores);
      setTurmas(listaTurmas);
      setSeries(listaSeries);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!form.recurso_id || !form.professor_id || !form.vigencia_fim) {
      setErro('Preencha recurso, professor e vigência final.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await criarSerieRecorrente({
        recurso_id: form.recurso_id,
        professor_id: form.professor_id,
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        vigencia_inicio: form.vigencia_inicio,
        vigencia_fim: form.vigencia_fim,
        turma_id: form.turma_id || null,
        finalidade: form.finalidade || null,
      });
      setResultado(res);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar série recorrente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExpandir(serieId: string) {
    if (serieExpandida === serieId) {
      setSerieExpandida(null);
      return;
    }
    setSerieExpandida(serieId);
    if (!ocorrenciasPorSerie[serieId]) {
      const lista = await listarOcorrenciasSerie(serieId);
      setOcorrenciasPorSerie((o) => ({ ...o, [serieId]: lista }));
    }
  }

  async function handleCancelarSerie(serieId: string) {
    if (!confirm('Cancelar esta série a partir de hoje? Ocorrências passadas ficam preservadas no histórico.')) return;
    await cancelarSerie(serieId);
    setOcorrenciasPorSerie((o) => { const novo = { ...o }; delete novo[serieId]; return novo; });
    await carregar();
  }

  function nomeRecurso(id: string) { return recursos.find((r) => r.id === id)?.nome ?? '—'; }
  function nomeProfessor(id: string) { return professores.find((p) => p.id === id)?.nome ?? '—'; }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-xs text-gray-500">
        Gera uma reserva por semana dentro do período de vigência. Cada ocorrência passa pela mesma checagem de
        conflito de uma reserva avulsa — um conflito numa data específica é reportado abaixo, sem cancelar as demais.
      </p>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova aula fixa recorrente</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.recurso_id} onChange={(e) => setForm({ ...form, recurso_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Recurso...</option>
            {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Professor...</option>
            {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={form.dia_semana} onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <select value={form.turma_id} onChange={(e) => setForm({ ...form, turma_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Turma (opcional)...</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" placeholder="Vigência até" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <input placeholder="Finalidade (opcional)" value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <button onClick={handleCriar} disabled={salvando || !usuarioId} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar série
        </button>

        {resultado && (
          <div className="space-y-1.5 pt-2 border-t border-gray-800">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Resultado por ocorrência</p>
            {resultado.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${r.sucesso ? 'bg-green-950/10 text-green-400' : 'bg-amber-950/10 text-amber-500'}`}>
                <span>{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                <span className="flex items-center gap-1">
                  {r.sucesso ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {r.sucesso ? 'Criada' : r.motivo}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {series.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma série cadastrada.</p>
        ) : (
          series.map((s) => {
            const expandida = serieExpandida === s.id;
            return (
              <div key={s.id} className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden">
                <button onClick={() => handleExpandir(s.id)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-black text-ms-main flex items-center gap-2">
                      {nomeRecurso(s.recurso_id)} — {nomeProfessor(s.professor_id)}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black border ${s.status === 'ATIVA' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                        {s.status === 'ATIVA' ? 'Ativa' : 'Cancelada'}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {DIAS_SEMANA[s.dia_semana]}, {s.hora_inicio.slice(0, 5)}–{s.hora_fim.slice(0, 5)} · {new Date(s.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(s.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {expandida ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {expandida && (
                  <div className="px-5 pb-5 space-y-2 border-t border-gray-800 pt-4">
                    {s.status === 'ATIVA' && (
                      <button onClick={() => handleCancelarSerie(s.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-black hover:bg-red-500/20">
                        <XCircle className="w-3.5 h-3.5" /> Cancelar série (a partir de hoje)
                      </button>
                    )}
                    <div className="space-y-1">
                      {(ocorrenciasPorSerie[s.id] ?? []).map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-xs px-3 py-1.5 bg-ms-dark rounded-lg border border-gray-800">
                          <span className="text-gray-300">{new Date(o.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          <span className={o.status === 'CANCELADA' ? 'text-gray-600 line-through' : 'text-gray-400'}>{o.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
