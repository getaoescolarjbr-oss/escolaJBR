import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Recurso, BloqueioRecurso } from '../../types/agendamento';
import { listarRecursos, listarBloqueios, criarBloqueio, removerBloqueio } from '../../services/agendamentoService';

export function BloqueiosTab() {
  const { usuarioId } = useAuth();
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioRecurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ recurso_id: '', data_inicio: '', data_fim: '', motivo: '' });
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [listaRecursos, listaBloqueios] = await Promise.all([listarRecursos(), listarBloqueios()]);
      setRecursos(listaRecursos);
      setBloqueios(listaBloqueios);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!form.recurso_id || !form.data_inicio || !form.data_fim || !usuarioId) {
      setErro('Selecione o recurso e o período do bloqueio.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarBloqueio({
        recurso_id: form.recurso_id,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        motivo: form.motivo || null,
        criado_por: usuarioId,
      });
      setForm({ recurso_id: '', data_inicio: '', data_fim: '', motivo: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar bloqueio.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(id: string) {
    if (!confirm('Remover este bloqueio? O recurso volta a ficar disponível no período.')) return;
    await removerBloqueio(id);
    await carregar();
  }

  function nomeRecurso(id: string) {
    return recursos.find((r) => r.id === id)?.nome ?? '—';
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-3 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-ms-main">Bloquear horário/período</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 -mt-1 leading-relaxed">
          Vale para qualquer motivo (manutenção, evento, feriado letivo, reforma etc.) — o recurso fica indisponível
          para reserva no período, e liberado automaticamente ao remover o bloqueio abaixo.
        </p>
        <select
          value={form.recurso_id}
          onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
          className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm font-medium"
        >
          <option value="">Selecione um recurso...</option>
          {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            className="px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
          />
          <input
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            className="px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
          />
        </div>
        <input
          placeholder="Motivo (ex.: manutenção do piso, evento, feriado letivo)"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
        />
        {erro && <p className="text-xs text-red-500 font-medium">{erro}</p>}
        <button
          onClick={handleCriar}
          disabled={salvando}
          className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Bloquear período
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : bloqueios.length === 0 ? (
          <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">Nenhum bloqueio registrado no momento.</p>
          </div>
        ) : (
          bloqueios.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-all">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-ms-main">{nomeRecurso(b.recurso_id)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {new Date(b.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(b.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {b.motivo ? ` — ${b.motivo}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleRemover(b.id)}
                className="p-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 rounded-xl transition-all"
                title="Remover bloqueio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
