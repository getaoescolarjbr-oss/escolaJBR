import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileBadge, Save, Loader2, Plus, Trash2 } from 'lucide-react';

export function AtaTemplateManager() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    const { data } = await supabase.from('atas_templates').select('*').order('created_at');
    if (data) setTemplates(data);
    setLoading(false);
  }

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    
    if (selectedTemplate.id === 'new') {
      const { data, error } = await supabase
        .from('atas_templates')
        .insert({
          titulo: selectedTemplate.titulo,
          conteudo: selectedTemplate.conteudo
        })
        .select()
        .single();
      
      if (data) {
        setTemplates(prev => [...prev, data]);
        setSelectedTemplate(data);
      }
    } else {
      const { error } = await supabase
        .from('atas_templates')
        .update({
          titulo: selectedTemplate.titulo,
          conteudo: selectedTemplate.conteudo
        })
        .eq('id', selectedTemplate.id);
      
      if (!error) {
        setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? selectedTemplate : t));
      }
    }
    
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return;
    
    await supabase.from('atas_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  return (
    <div className="bg-ms-card rounded-3xl shadow-xl border border-ms-border overflow-hidden">
      <div className="px-8 py-5 border-b border-ms-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBadge className="w-5 h-5 text-ms-blue" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Modelos de Atas</h3>
        </div>
        <button
          onClick={() => setSelectedTemplate({ id: 'new', titulo: 'Nova Ata', conteudo: 'Aos [DATA], reuniu-se a coordenação...' })}
          className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white font-bold rounded-xl text-sm shadow-lg shadow-ms-blue/30 hover:bg-ms-blue/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Criar Modelo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 h-[600px] divide-x divide-ms-border">
        {/* Lista de Templates */}
        <div className="p-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ms-blue" /></div>
          ) : templates.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">Nenhum modelo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex gap-2">
                  <button
                    onClick={() => setSelectedTemplate(t)}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                      selectedTemplate?.id === t.id 
                        ? 'bg-ms-blue/20 border-ms-blue text-white' 
                        : 'bg-transparent border-ms-border text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {t.titulo}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-3 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 flex flex-col bg-ms-dark/50">
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col p-6 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Título do Modelo</label>
                <input
                  type="text"
                  value={selectedTemplate.titulo}
                  onChange={e => setSelectedTemplate({...selectedTemplate, titulo: e.target.value})}
                  className="w-full bg-ms-card border border-ms-border rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-ms-blue"
                  placeholder="Ex: Ata nº 01"
                />
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2 mb-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Conteúdo da Ata</label>
                  <span className="text-[10px] font-bold text-ms-blue bg-ms-blue/10 px-3 py-1.5 rounded-xl border border-ms-blue/20">
                    Variáveis: {"{{NOME_ALUNO}}"} · {"{{DATA_ATA}}"} · {"{{NUMERO_ATA}}"} · {"{{ACORDADO}}"}
                  </span>
                </div>
                <textarea
                  value={selectedTemplate.conteudo}
                  onChange={e => setSelectedTemplate({...selectedTemplate, conteudo: e.target.value})}
                  className="w-full flex-1 bg-ms-card border border-ms-border rounded-xl p-4 text-white font-medium outline-none focus:border-ms-blue resize-none custom-scrollbar"
                  placeholder="Escreva o texto da ata aqui..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !selectedTemplate.titulo || !selectedTemplate.conteudo}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Modelo
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-medium">
              Selecione ou crie um modelo para editar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
