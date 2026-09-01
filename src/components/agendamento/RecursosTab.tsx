import { useEffect, useState } from 'react';
import { Loader2, Plus, Wrench, Pencil, X, Check } from 'lucide-react';
import type { Recurso, TipoRecurso } from '../../types/agendamento';
import { listarRecursos, criarRecurso, atualizarRecurso } from '../../services/agendamentoService';

const ROTULOS_TIPO: Record<TipoRecurso, string> = {
  LABORATORIO: 'Laboratório',
  SALA: 'Sala',
  QUADRA: 'Quadra',
  EQUIPAMENTO: 'Equipamento',
  OUTRO: 'Outro',
};

type FormState = {
  nome: string;
  tipo: TipoRecurso;
  descricao: string;
  capacidade: string;
  local: string;
  cor: string;
  requer_aprovacao: boolean;
};

const FORM_VAZIO: FormState = {
  nome: '', tipo: 'SALA', descricao: '', capacidade: '', local: '', cor: '#2563eb', requer_aprovacao: false,
};

function recursoParaForm(r: Recurso): FormState {
  return {
    nome: r.nome,
    tipo: r.tipo,
    descricao: r.descricao ?? '',
    capacidade: r.capacidade != null ? String(r.capacidade) : '',
    local: r.local ?? '',
    cor: r.cor ?? '#2563eb',
    requer_aprovacao: r.requer_aprovacao,
  };
}

export function RecursosTab() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  // Edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(FORM_VAZIO);
  const [erroEdit, setErroEdit] = useState<string | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

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
    if (!form.nome) { setErro('Informe o nome do recurso.'); return; }
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
      setForm(FORM_VAZIO);
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar recurso.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(r: Recurso) {
    setEditandoId(r.id);
    setEditForm(recursoParaForm(r));
    setErroEdit(null);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setErroEdit(null);
  }

  async function handleSalvarEdicao() {
    if (!editForm.nome) { setErroEdit('Informe o nome do recurso.'); return; }
    setSalvandoEdit(true);
    setErroEdit(null);
    try {
      await atualizarRecurso(editandoId!, {
        nome: editForm.nome,
        tipo: editForm.tipo,
        descricao: editForm.descricao || null,
        capacidade: editForm.capacidade ? Number(editForm.capacidade) : null,
        local: editForm.local || null,
        cor: editForm.cor,
        requer_aprovacao: editForm.requer_aprovacao,
      });
      setEditandoId(null);
      await carregar();
    } catch (err) {
      setErroEdit(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setSalvandoEdit(false);
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

      {/* Formulário de criação */}
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

      {/* Lista de recursos */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : (
          recursos.map((r) => (
            <div key={r.id} className="bg-ms-card border border-gray-800 rounded-xl overflow-hidden">
              {/* Linha principal */}
              <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.cor ?? '#2563eb' }} />
                  <div>
                    <p className="text-sm font-bold text-ms-main">
                      {r.nome}
                      {r.requer_aprovacao && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase font-black">
                          Requer aprovação
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {ROTULOS_TIPO[r.tipo]} · {r.local || 'sem local'} {r.capacidade ? `· capacidade ${r.capacidade}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggle(r, 'em_manutencao')}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-bold ${r.em_manutencao ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                  >
                    <Wrench className="w-3.5 h-3.5" /> {r.em_manutencao ? 'Em manutenção' : 'Operacional'}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={r.ativo} onChange={() => handleToggle(r, 'ativo')} /> Ativo
                  </label>
                  <button
                    onClick={() => editandoId === r.id ? cancelarEdicao() : abrirEdicao(r)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-bold transition-all ${
                      editandoId === r.id
                        ? 'bg-gray-700 text-gray-300 border-gray-600'
                        : 'bg-ms-blue/10 text-ms-blue border-ms-blue/30 hover:bg-ms-blue/20'
                    }`}
                  >
                    {editandoId === r.id
                      ? <><X className="w-3.5 h-3.5" /> Cancelar</>
                      : <><Pencil className="w-3.5 h-3.5" /> Editar</>
                    }
                  </button>
                </div>
              </div>

              {/* Formulário de edição inline */}
              {editandoId === r.id && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-3 bg-ms-dark/60">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Editar recurso</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      placeholder="Nome"
                      value={editForm.nome}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className="px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-sm"
                    />
                    <select
                      value={editForm.tipo}
                      onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value as TipoRecurso })}
                      className="px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-sm"
                    >
                      {Object.entries(ROTULOS_TIPO).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    <input
                      placeholder="Local (ex.: Bloco A)"
                      value={editForm.local}
                      onChange={(e) => setEditForm({ ...editForm, local: e.target.value })}
                      className="px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Capacidade"
                      value={editForm.capacidade}
                      onChange={(e) => setEditForm({ ...editForm, capacidade: e.target.value })}
                      className="px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editForm.cor}
                        onChange={(e) => setEditForm({ ...editForm, cor: e.target.value })}
                        className="h-12 w-16 px-2 bg-ms-dark border border-gray-700 rounded-xl cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">Cor do recurso</span>
                    </div>
                  </div>
                  <input
                    placeholder="Descrição"
                    value={editForm.descricao}
                    onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm text-ms-main">
                    <input
                      type="checkbox"
                      checked={editForm.requer_aprovacao}
                      onChange={(e) => setEditForm({ ...editForm, requer_aprovacao: e.target.checked })}
                    />
                    Reserva requer aprovação da Coordenação/Gestão
                  </label>
                  {erroEdit && <p className="text-xs text-red-400">{erroEdit}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSalvarEdicao}
                      disabled={salvandoEdit}
                      className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      {salvandoEdit
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Check className="w-4 h-4" /> Salvar alterações</>
                      }
                    </button>
                    <button
                      onClick={cancelarEdicao}
                      className="px-5 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-700 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

