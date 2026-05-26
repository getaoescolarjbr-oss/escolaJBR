import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Edit2, Trash2, Loader2, Save, X, BookOpen } from 'lucide-react';

export function DisciplinaManager({ theme }: { theme: 'dark' | 'light' }) {
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisc, setEditingDisc] = useState<any>(null);
  const [formData, setFormData] = useState({ nome: '' });

  useEffect(() => {
    fetchDisciplinas();
  }, []);

  async function fetchDisciplinas() {
    setLoading(true);
    // 1. Tenta buscar da tabela oficial
    const { data: newDiscs } = await supabase
      .from('disciplinas')
      .select('*')
      .order('nome');
    
    if (newDiscs && newDiscs.length > 0) {
      setDisciplinas(newDiscs);
    } else {
      // 2. Se a oficial estiver vazia, busca do legado para facilitar o cadastro
      const { data: legacyData } = await supabase
        .from('lista_para_vistos')
        .select('disciplina_id, disciplina_nome');
      
      if (legacyData) {
        const uniqueDiscs = Array.from(new Map(legacyData.map(item => [item.disciplina_id, { id: item.disciplina_id, nome: item.disciplina_nome }])).values());
        setDisciplinas(uniqueDiscs);
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!formData.nome) return;

    if (editingDisc) {
      await supabase
        .from('disciplinas')
        .update(formData)
        .eq('id', editingDisc.id);
    } else {
      await supabase
        .from('disciplinas')
        .insert([formData]);
    }

    setIsModalOpen(false);
    setEditingDisc(null);
    setFormData({ nome: '' });
    fetchDisciplinas();
  }

  async function handleDelete(id: string) {
    if (confirm('Deseja excluir esta disciplina? Isso pode afetar os vínculos existentes.')) {
      await supabase.from('disciplinas').delete().eq('id', id);
      fetchDisciplinas();
    }
  }

  const filteredDisciplinas = disciplinas.filter(d => 
    d.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar disciplina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingDisc(null);
            setFormData({ nome: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nova Disciplina
        </button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-[#003366] border-b border-blue-900 shadow-lg">
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Nome da Disciplina</th>
              <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-6 py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue mb-4" />
                  <p className="text-[#003366] font-bold">Carregando disciplinas...</p>
                </td>
              </tr>
            ) : filteredDisciplinas.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-10 text-center text-gray-500">
                  Nenhuma disciplina encontrada.
                </td>
              </tr>
            ) : filteredDisciplinas.map((d, idx) => (
              <tr key={d.id} className={idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-black text-[#003366] uppercase tracking-tight">{d.nome}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingDisc(d);
                        setFormData({ nome: d.nome });
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-ms-blue/20 text-ms-blue rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(d.id)}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-ms-card w-full max-w-md rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-800 bg-gradient-to-r from-ms-blue/10 to-transparent flex justify-between items-center">
              <h3 className="text-xl font-black text-ms-main">{editingDisc ? 'Editar Disciplina' : 'Nova Disciplina'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nome da Disciplina</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ nome: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  placeholder="Ex: Matemática, Português, Física..."
                />
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-800/30 border-t border-gray-800 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 font-bold text-gray-400">Cancelar</button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg"
              >
                <Save className="w-5 h-5" />
                Salvar Disciplina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
