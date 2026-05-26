import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Save, AlertTriangle, Loader2 } from 'lucide-react';

interface TiposOcorrenciaManagerProps {
  theme: 'dark' | 'light';
}

interface TipoOcorrencia {
  id: string;
  descricao: string;
  ativo: boolean;
  criado_em: string;
}

export function TiposOcorrenciaManager({ theme }: TiposOcorrenciaManagerProps) {
  const [tipos, setTipos] = useState<TipoOcorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTipos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tipos_ocorrencia')
      .select('*')
      .order('criado_em', { ascending: true });
    if (!error && data) setTipos(data);
    setLoading(false);
  };

  useEffect(() => { fetchTipos(); }, []);

  const handleAdd = async () => {
    if (!novaDescricao.trim()) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('tipos_ocorrencia')
      .insert({ descricao: novaDescricao.trim() });
    if (!error) {
      setNovaDescricao('');
      await fetchTipos();
    }
    setIsSaving(false);
  };

  const handleToggleAtivo = async (tipo: TipoOcorrencia) => {
    await supabase
      .from('tipos_ocorrencia')
      .update({ ativo: !tipo.ativo })
      .eq('id', tipo.id);
    setTipos(prev => prev.map(t => t.id === tipo.id ? { ...t, ativo: !t.ativo } : t));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este tipo de ocorrência?')) return;
    setDeletingId(id);
    await supabase.from('tipos_ocorrencia').delete().eq('id', id);
    setTipos(prev => prev.filter(t => t.id !== id));
    setDeletingId(null);
  };

  const card = theme === 'light' ? 'bg-white border-blue-100' : 'bg-[#0a0f1e] border-gray-800';
  const text = theme === 'light' ? 'text-blue-900' : 'text-white';
  const sub  = theme === 'light' ? 'text-blue-700/60' : 'text-blue-300';
  const inp  = theme === 'light'
    ? 'bg-blue-50/50 border-blue-200 text-blue-900 placeholder:text-blue-400/60'
    : 'bg-[#001a4d]/50 border-blue-900/40 text-white placeholder:text-blue-400/40';

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-2xl font-black ${text} tracking-tight`}>Tipos de Ocorrência</h2>
        <p className={`text-sm mt-1 font-medium ${sub}`}>
          Registros rápidos disponíveis para os professores ao lançar ocorrências
        </p>
      </div>

      {/* Formulário de adição */}
      <div className={`rounded-2xl border p-6 shadow-xl ${card}`}>
        <h3 className={`text-sm font-black uppercase tracking-widest mb-4 ${sub}`}>
          <Plus className="w-4 h-4 inline mr-1" /> Novo Tipo Rápido
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={novaDescricao}
            onChange={e => setNovaDescricao(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Ex: Desrespeitou o professor"
            className={`flex-1 border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 transition-all ${inp}`}
          />
          <button
            onClick={handleAdd}
            disabled={isSaving || !novaDescricao.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 active:scale-95 shadow-md shadow-red-900/30"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Adicionar
          </button>
        </div>
      </div>

      {/* Lista de tipos */}
      <div className={`rounded-2xl border shadow-xl overflow-hidden ${card}`}>
        <div className="bg-gradient-to-r from-red-700 to-red-900 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-white" />
          <h3 className="text-white font-black uppercase tracking-wider text-sm">
            Tipos Cadastrados ({tipos.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        ) : tipos.length === 0 ? (
          <p className={`text-center py-10 text-sm font-medium ${sub}`}>
            Nenhum tipo cadastrado ainda.
          </p>
        ) : (
          <div className="divide-y divide-gray-800/30">
            {tipos.map(tipo => (
              <div key={tipo.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Toggle ativo */}
                  <button
                    onClick={() => handleToggleAtivo(tipo)}
                    title={tipo.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                    className={`w-10 h-5 rounded-full transition-all flex-shrink-0 relative ${
                      tipo.ativo ? 'bg-red-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      tipo.ativo ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                  <span className={`text-sm font-medium truncate ${tipo.ativo ? text : 'text-gray-500 line-through'}`}>
                    {tipo.descricao}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(tipo.id)}
                  disabled={deletingId === tipo.id}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 disabled:opacity-40"
                >
                  {deletingId === tipo.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
