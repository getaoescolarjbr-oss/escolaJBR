import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Recurso, CampoPersonalizado, TipoCampoPersonalizado } from '../../types/agendamento';
import { listarRecursos, listarCamposPersonalizados, criarCampoPersonalizado, atualizarCampoPersonalizado } from '../../services/agendamentoService';

const ROTULOS_TIPO: Record<TipoCampoPersonalizado, string> = {
  TEXTO: 'Texto', NUMERO: 'Número', DATA: 'Data', BOOLEANO: 'Sim/Não', SELECAO: 'Seleção (opções)',
};

export function CamposPersonalizadosTab() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [campos, setCampos] = useState<CampoPersonalizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ recurso_id: '', nome: '', tipo: 'TEXTO' as TipoCampoPersonalizado, opcoes: '', obrigatorio: false });

  async function carregar() {
    setLoading(true);
    try {
      const [listaRecursos, listaCampos] = await Promise.all([listarRecursos(), listarCamposPersonalizados()]);
      setRecursos(listaRecursos);
      setCampos(listaCampos);
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
      setErro('Informe o nome do campo.');
      return;
    }
    setErro(null);
    try {
      await criarCampoPersonalizado({
        recurso_id: form.recurso_id || null,
        nome: form.nome,
        tipo: form.tipo,
        opcoes: form.tipo === 'SELECAO' ? form.opcoes.split(',').map((o) => o.trim()).filter(Boolean) : null,
        obrigatorio: form.obrigatorio,
        ordem: campos.length,
        ativo: true,
      });
      setForm({ recurso_id: '', nome: '', tipo: 'TEXTO', opcoes: '', obrigatorio: false });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar campo personalizado.');
    }
  }

  async function handleToggleAtivo(campo: CampoPersonalizado) {
    await atualizarCampoPersonalizado(campo.id, { ativo: !campo.ativo });
    await carregar();
  }

  function nomeRecurso(id: string | null) {
    if (!id) return 'Todas as agendas';
    return recursos.find((r) => r.id === id)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-xs text-gray-500">Campos extras que aparecem no formulário de reserva — gerais (todas as agendas) ou específicos de um recurso.</p>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo campo personalizado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={form.recurso_id} onChange={(e) => setForm({ ...form, recurso_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Todas as agendas</option>
            {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCampoPersonalizado })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <input placeholder="Nome do campo (ex.: Nº de participantes)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        {form.tipo === 'SELECAO' && (
          <input placeholder="Opções separadas por vírgula" value={form.opcoes} onChange={(e) => setForm({ ...form, opcoes: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        )}
        <label className="flex items-center gap-2 text-sm text-ms-main">
          <input type="checkbox" checked={form.obrigatorio} onChange={(e) => setForm({ ...form, obrigatorio: e.target.checked })} />
          Obrigatório
        </label>
        <button onClick={handleCriar} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Criar campo
        </button>
      </div>

      <div className="space-y-2">
        {campos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum campo personalizado cadastrado.</p>
        ) : (
          campos.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">
                  {c.nome}
                  {c.obrigatorio && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-black">Obrigatório</span>}
                </p>
                <p className="text-[10px] text-gray-500">{ROTULOS_TIPO[c.tipo]} · {nomeRecurso(c.recurso_id)}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={c.ativo} onChange={() => handleToggleAtivo(c)} /> Ativo
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
