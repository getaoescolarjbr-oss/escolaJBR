import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Edit2, Trash2, Loader2, Save, X, Layers } from 'lucide-react';

export function TurmaManager({ theme }: { theme: 'dark' | 'light' }) {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<any>(null);
  const [formData, setFormData] = useState({ nome: '', nivel: 'Fundamental' });

  useEffect(() => {
    fetchTurmas();
  }, []);

  async function fetchTurmas() {
    setLoading(true);
    // 1. Tenta buscar da tabela oficial
    const { data: newTurmas, error: fetchError } = await supabase
      .from('turmas')
      .select('*')
      .order('nome');
    
    if (fetchError) {
      console.error('Erro detalhado ao buscar turmas (tabela oficial):', fetchError);
    }
    
    if (newTurmas && newTurmas.length > 0) {
      setTurmas(newTurmas);
    } else {
      // 2. Fallback para o legado para facilitar o primeiro cadastro
      const { data: legacyData } = await supabase
        .from('lista_para_vistos')
        .select('turma_id, turma_nome');
      
      if (legacyData) {
        const uniqueTurmas = Array.from(new Map(legacyData.map(item => [item.turma_id, { id: item.turma_id, nome: item.turma_nome, nivel: item.turma_nome.includes('Ano') ? 'Fundamental' : 'Médio' }])).values());
        setTurmas(uniqueTurmas);
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!formData.nome) return;

    try {
      if (editingTurma && isUUID(editingTurma.id)) {
        const { error } = await supabase
          .from('turmas')
          .update(formData)
          .eq('id', editingTurma.id);
        if (error) throw error;
      } else {
        // Se não tem ID ou o ID não é do banco novo, cria um novo
        const { error } = await supabase
          .from('turmas')
          .insert([formData]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingTurma(null);
      setFormData({ nome: '', nivel: 'Fundamental' });
      fetchTurmas();
    } catch (err: any) {
      console.error('Erro capturado no catch do TurmaManager:', err);
      alert('Erro ao salvar: ' + (err.message || 'Verifique o console (F12) para detalhes técnicos.'));
    }
  }

  // Função auxiliar para checar se o ID é do banco de dados (UUID)
  function isUUID(str: string) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  async function handleDelete(id: string) {
    if (confirm('Deseja excluir esta turma?')) {
      await supabase.from('turmas').delete().eq('id', id);
      fetchTurmas();
    }
  }

  const filteredTurmas = turmas.filter(t => 
    t.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fundamental = filteredTurmas.filter(t => t.nivel === 'Fundamental');
  const medio = filteredTurmas.filter(t => t.nivel === 'Médio' || t.nivel === 'M\u00E9dio');

  const renderTurmaTable = (list: any[], title: string) => (
    <div className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden shadow-xl mb-8">
      <div className="px-6 py-3 bg-[#003366] border-b border-blue-900 shadow-md">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-gray-800">
          {list.length === 0 ? (
            <tr>
              <td className="px-6 py-8 text-center text-gray-500 text-sm">Nenhuma turma cadastrada neste nível.</td>
            </tr>
          ) : list.map((t, idx) => (
            <tr key={t.id} className={idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'}>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-black text-[#003366] uppercase tracking-tight">{t.nome}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button 
                    onClick={() => {
                      setEditingTurma(t);
                      setFormData({ nome: t.nome, nivel: t.nivel || 'Fundamental' });
                      setIsModalOpen(true);
                    }}
                    className="p-2 hover:bg-ms-blue/20 text-ms-blue rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(t.id)}
                    className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar turma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingTurma(null);
            setFormData({ nome: '', nivel: 'Fundamental' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nova Turma
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-ms-blue mb-4" />
          <p className="text-[#003366] font-bold">Carregando turmas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {renderTurmaTable(fundamental, 'Ensino Fundamental')}
          {renderTurmaTable(medio, 'Ensino Médio')}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-ms-card w-full max-w-md rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-800 bg-gradient-to-r from-ms-blue/10 to-transparent flex justify-between items-center">
              <h3 className="text-xl font-black text-ms-main">{editingTurma ? 'Editar Turma' : 'Nova Turma'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nome da Turma</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  placeholder="Ex: 6º Ano A, 1ª Série B..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nível de Ensino</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setFormData({ ...formData, nivel: 'Fundamental' })}
                    className={`py-3 rounded-xl font-bold border transition-all ${formData.nivel === 'Fundamental' ? 'bg-ms-blue border-ms-blue text-white' : 'bg-ms-dark border-gray-800 text-gray-500'}`}
                  >
                    Fundamental
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, nivel: 'Médio' })}
                    className={`py-3 rounded-xl font-bold border transition-all ${formData.nivel === 'Médio' ? 'bg-ms-blue border-ms-blue text-white' : 'bg-ms-dark border-gray-800 text-gray-500'}`}
                  >
                    Médio
                  </button>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-800/30 border-t border-gray-800 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 font-bold text-gray-400">Cancelar</button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg"
              >
                <Save className="w-5 h-5" />
                Salvar Turma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
