import { useEffect, useState } from 'react';
import { Loader2, Plus, Wrench } from 'lucide-react';
import type { Recurso, TipoRecurso } from '../../types/agendamento';
import { listarRecursos, criarRecurso, atualizarRecurso } from '../../services/agendamentoService';

const ROTULOS_TIPO: Record<TipoRecurso, string> = {
  LABORATORIO: 'Laboratório',
  SALA: 'Sala',
  QUADRA: 'Quadra',
  EQUIPAMENTO: 'Equipamento',
  OUTRO: 'Outro',
};

export function RecursosTab() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '', tipo: 'SALA' as TipoRecurso, descricao: '', capacidade: '', local: '', cor: '#2563eb', requer_aprovacao: false,
  });

  async function carregar() {
    setLoading(true);
    try {
      setRecursos(await listarRecursos());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!form.nome) {
      setErro('Informe o nome do recurso.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarRecurso({
        nome: form.nome,
        tipo: form.tipo,
        descricao: form.descricao || null,
        capacidade: form.capacidade ? Number(form.capacidade) : null,
        local: form.local || null,
        icone: null,
        cor: form.cor,
        ordem: recursos.length,
        requer_aprovacao: form.requer_aprovacao,
        ativo: true,
        em_manutencao: false,
      });
      setForm({ nome: '', tipo: 'SALA', descricao: '', capacidade: '', local: '', cor: '#2563eb', requer_aprovacao: false });
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar recurso.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggle(r: Recurso, campo: 'ativo' | 'em_manutencao' | 'requer_aprovacao') {
    await atualizarRecurso(r.id, { [campo]: !r[campo] });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <button
        onClick={() => setMostrarForm(!mostrarForm)}
        className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all"
      >
        <Plus className="w-4 h-4" /> Novo Recurso
      </button>

      {mostrarForm && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoRecurso })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <input placeholder="Local (ex.: Bloco A)" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <input type="number" placeholder="Capacidade" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-12 px-2 bg-ms-dark border border-gray-800 rounded-xl" />
          </div>
          <input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <label className="flex items-center gap-2 text-sm text-ms-main">
            <input type="checkbox" checked={form.requer_aprovacao} onChange={(e) => setForm({ ...form, requer_aprovacao: e.target.checked })} />
            Reserva requer aprovação da Coordenação/Gestão
          </label>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : (
          recursos.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.cor ?? '#2563eb' }} />
                <div>
                  <p className="text-sm font-bold text-ms-main">
                    {r.nome}
                    {r.requer_aprovacao && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase font-black">Requer aprovação</span>}
                  </p>
                  <p className="text-[10px] text-gray-500">{ROTULOS_TIPO[r.tipo]} · {r.local || 'sem local'} {r.capacidade ? `· capacidade ${r.capacidade}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(r, 'em_manutencao')}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-bold ${r.em_manutencao ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                >
                  <Wrench className="w-3.5 h-3.5" /> {r.em_manutencao ? 'Em manutenção' : 'Operacional'}
                </button>
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={r.ativo} onChange={() => handleToggle(r, 'ativo')} /> Ativo
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
