import { useState } from 'react';
import { Loader2, BarChart3, TrendingUp, Users, Percent } from 'lucide-react';
import { SectionIcon } from '../ui/SectionIcon';
import type { RelatorioAgendamento } from '../../types/agendamento';
import { obterRelatorioAgendamento } from '../../services/agendamentoService';

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RelatoriosTab() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hoje());
  const [relatorio, setRelatorio] = useState<RelatorioAgendamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleConsultar() {
    setLoading(true);
    setErro(null);
    try {
      setRelatorio(await obterRelatorioAgendamento(inicio, fim));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <button onClick={handleConsultar} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Gerar relatório
        </button>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {relatorio && (
        <div className="space-y-6">
          <p className="text-[10px] text-gray-500">
            Taxa de ocupação calculada sobre {relatorio.periodo_dias_uteis} dia(s) útil(eis) no período, considerando
            ~6h40 disponíveis por dia (8 períodos de aula) — é uma referência aproximada, não uma grade horária real.
          </p>

          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Percent} cor="teal" /> Uso por recurso</p>
            {(relatorio.por_recurso ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sem reservas no período.</p>
            ) : (
              (relatorio.por_recurso ?? []).map((r) => (
                <div key={r.recurso_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ms-main font-bold">{r.nome}</span>
                    <span className="text-gray-400">{r.total_reservas} reserva(s) · {r.horas_reservadas}h · {r.taxa_ocupacao}% ocupação</span>
                  </div>
                  <div className="w-full h-2 bg-ms-dark rounded-full overflow-hidden">
                    <div className="h-full bg-ms-blue rounded-full" style={{ width: `${Math.min(r.taxa_ocupacao, 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={TrendingUp} cor="orange" /> Horários de pico</p>
            {(relatorio.horarios_pico ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados suficientes.</p>
            ) : (
              (relatorio.horarios_pico ?? []).map((h) => (
                <div key={h.hora_inicio} className="flex items-center justify-between text-sm">
                  <span className="text-ms-main">{h.hora_inicio.slice(0, 5)}</span>
                  <span className="text-gray-400">{h.total} reserva(s)</span>
                </div>
              ))
            )}
          </div>

          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Users} cor="blue" /> Histórico por professor</p>
            {(relatorio.por_professor ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sem reservas no período.</p>
            ) : (
              (relatorio.por_professor ?? []).map((p) => (
                <div key={p.professor_id} className="flex items-center justify-between text-sm">
                  <span className="text-ms-main">{p.nome}</span>
                  <span className="text-gray-400">{p.total_reservas} reserva(s)</span>
                </div>
              ))
            )}
          </div>

          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Users} cor="indigo" /> Histórico por turma</p>
            {(relatorio.por_turma ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sem reservas com turma associada no período.</p>
            ) : (
              (relatorio.por_turma ?? []).map((t) => (
                <div key={t.turma_id} className="flex items-center justify-between text-sm">
                  <span className="text-ms-main">{t.nome}</span>
                  <span className="text-gray-400">{t.total_reservas} reserva(s)</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
