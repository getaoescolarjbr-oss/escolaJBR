import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Newspaper, Calendar, AlertCircle, Plus, Trash2, Edit2, 
  Save, X, Image as ImageIcon, CheckCircle, Loader2, Globe
} from 'lucide-react';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

interface SiteManagerProps {
  theme: 'dark' | 'light';
}

type Tab = 'noticias' | 'eventos' | 'avisos';

export function SiteManager({ theme }: SiteManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('noticias');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isInstagramType, setIsInstagramType] = useState(false);
  const [instagramFeedUrl, setInstagramFeedUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let table = '';
      let orderBy = 'created_at';
      if (activeTab === 'noticias') {
        table = 'landing_noticias';
        orderBy = 'data_publicacao';

        try {
          const { data: configData } = await supabase
            .from('landing_avisos')
            .select('*')
            .eq('titulo', 'INSTAGRAM_FEED_CONFIG')
            .eq('cor_alerta', 'config')
            .maybeSingle();
          if (configData) {
            setInstagramFeedUrl(configData.mensagem || '');
          }
        } catch (err) {
          console.error('Erro ao buscar link do feed do Instagram:', err);
        }
      } else if (activeTab === 'eventos') {
        table = 'landing_eventos';
        orderBy = 'data_evento';
      } else {
        table = 'landing_avisos';
      }

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending: activeTab === 'eventos' });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let table = activeTab === 'noticias' ? 'landing_noticias' : 
                  activeTab === 'eventos' ? 'landing_eventos' : 'landing_avisos';
      
      let dataToSave = { ...formData };
      if (activeTab === 'noticias') {
        dataToSave.categoria = isInstagramType ? 'INSTAGRAM' : (formData.categoria === 'INSTAGRAM' ? 'NOTÍCIA' : (formData.categoria || 'NOTÍCIA'));
        if (!dataToSave.data_publicacao) {
          dataToSave.data_publicacao = new Date().toISOString();
        }
      }
      
      if (editingId) {
        const { error } = await supabase
          .from(table)
          .update(dataToSave)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(table)
          .insert([dataToSave]);
        if (error) throw error;
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData({});
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar dados. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const saveInstagramFeedConfig = async () => {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      // Check if config already exists
      const { data: existing } = await supabase
        .from('landing_avisos')
        .select('*')
        .eq('titulo', 'INSTAGRAM_FEED_CONFIG')
        .eq('cor_alerta', 'config')
        .maybeSingle();

      let finalUrl = instagramFeedUrl.trim();
      
      // Auto-extract feed ID from widget code or dashboard URL
      const feedIdMatch = finalUrl.match(/feed-id="([^"]+)"/) || finalUrl.match(/behold\.so\/feeds\/([^\/]+)/) || finalUrl.match(/behold\.so\/v1\/feeds\/([^\/]+)/);
      if (feedIdMatch && feedIdMatch[1]) {
        finalUrl = `https://feeds.behold.so/${feedIdMatch[1]}`;
        setInstagramFeedUrl(finalUrl); // Update the input to show the clean URL
      }

      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from('landing_avisos')
          .update({ mensagem: finalUrl })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new row
        const { error } = await supabase
          .from('landing_avisos')
          .insert([{
            titulo: 'INSTAGRAM_FEED_CONFIG',
            mensagem: finalUrl,
            cor_alerta: 'config'
          }]);
        if (error) throw error;
      }
      alert('Configuração de automação salva com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar configuração do Instagram:', err);
      alert('Erro ao salvar configuração.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    setLoading(true);
    try {
      let table = activeTab === 'noticias' ? 'landing_noticias' : 
                  activeTab === 'eventos' ? 'landing_eventos' : 'landing_avisos';
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Erro ao deletar:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    setIsInstagramType(item.categoria === 'INSTAGRAM');
    setIsAdding(true);
  };

  const displayedItems = activeTab === 'avisos' 
    ? items.filter(item => item.cor_alerta !== 'config') 
    : items;

  return (
    <div className="bg-ms-card rounded-3xl border border-ms-border overflow-hidden shadow-2xl">
      <div className="px-8 py-6 border-b border-ms-border bg-ms-dark/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-ms-blue/20 flex items-center justify-center text-ms-blueText border border-ms-blueText/30 shadow-lg">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-ms-main tracking-tight">Gerenciamento do Site</h2>
              <p className="text-xs text-[#003366] font-bold uppercase tracking-wider">Conteúdo da Landing Page Institucional</p>
            </div>
          </div>

          <div className="flex items-center bg-ms-dark p-1 rounded-2xl border border-ms-border">
            <button 
              onClick={() => setActiveTab('noticias')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'noticias' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-white'}`}
            >
              <Newspaper className="w-4 h-4" /> Notícias
            </button>
            <button 
              onClick={() => setActiveTab('eventos')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'eventos' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-white'}`}
            >
              <Calendar className="w-4 h-4" /> Eventos
            </button>
            <button 
              onClick={() => setActiveTab('avisos')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'avisos' ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-white'}`}
            >
              <AlertCircle className="w-4 h-4" /> Avisos
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {!isAdding ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => { 
                  setIsAdding(true); 
                  setFormData({}); 
                  setEditingId(null); 
                  setIsInstagramType(false);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-900/40"
              >
                <Plus className="w-4 h-4" /> Novo {activeTab === 'noticias' ? 'Post' : activeTab === 'eventos' ? 'Evento' : 'Aviso'}
              </button>
            </div>

            {activeTab === 'noticias' && (
              <div className="bg-ms-dark/30 rounded-3xl border border-ms-border p-6 md:p-8 mb-8 shadow-inner transition-all hover:border-[#E1306C]/40">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center mb-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white border border-white/10 shadow-lg flex-shrink-0">
                      <InstagramIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-ms-main tracking-tight flex items-center gap-2">
                        Integração com Instagram
                        <span className="bg-[#E1306C]/10 text-[#E1306C] text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-[#E1306C]/20">Automação</span>
                      </h3>
                      <p className="text-xs text-gray-500 font-medium max-w-xl">
                        Economize tempo importando as postagens da conta da escola <strong className="text-gray-400">@jbrautoria</strong> de forma 100% segura, gratuita e sem necessidade de senhas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <InstagramIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="url"
                      value={instagramFeedUrl}
                      onChange={(e) => setInstagramFeedUrl(e.target.value)}
                      placeholder="Cole a URL do feed JSON do Behold.so aqui..."
                      className="w-full pl-12 pr-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveInstagramFeedConfig}
                    disabled={savingConfig}
                    className="px-8 py-3.5 bg-gradient-to-r from-[#dc2743] to-[#bc1888] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[#dc2743]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Salvar Configuração
                      </>
                    )}
                  </button>
                </div>

                <details className="group mt-6 border border-ms-border/50 rounded-2xl bg-ms-dark/20 overflow-hidden transition-all">
                  <summary className="px-6 py-3.5 flex items-center justify-between cursor-pointer text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white select-none">
                    <span>Como obter o link do feed gratuito em 2 minutos?</span>
                    <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="px-6 pb-6 pt-2 text-xs text-gray-500 space-y-3 leading-relaxed border-t border-ms-border/30">
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>
                        Acesse o site <a href="https://behold.so" target="_blank" rel="noopener noreferrer" className="text-ms-blueText hover:underline">behold.so</a> e crie uma conta gratuita.
                      </li>
                      <li>
                        Siga os passos rápidos na plataforma deles para conectar a conta pública do Instagram da escola (<strong className="text-gray-400">@jbrautoria</strong>).
                      </li>
                      <li>
                        Uma vez conectado, o Behold gerará um feed público. Copie a **URL do Feed JSON** (ela é parecida com: <code className="bg-ms-dark px-1.5 py-0.5 rounded text-gray-400">https://api.behold.so/v1/feeds/...</code>).
                      </li>
                      <li>
                        Cole a URL copiada no campo acima e clique em **Salvar Configuração**.
                      </li>
                    </ol>
                    <p className="pt-2 text-[10px] text-gray-400 italic">
                      💡 <strong>Como funciona?</strong> Sempre que os visitantes carregarem a página inicial da escola, o próprio site consultará as postagens mais recentes de forma segura e atualizará o banco de dados da escola automaticamente em segundo plano!
                    </p>
                  </div>
                </details>
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-ms-blueText mb-4" />
                <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Carregando conteúdo...</p>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="py-20 text-center bg-ms-dark/30 rounded-3xl border-2 border-dashed border-ms-border">
                <Globe className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-bold italic">Nenhum item cadastrado nesta categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedItems.map((item) => (
                  <div key={item.id} className="bg-ms-dark/40 rounded-3xl border border-ms-border overflow-hidden group hover:border-ms-blueText/50 transition-all shadow-lg">
                    {activeTab === 'noticias' && (
                      <div className="h-40 bg-ms-dark flex items-center justify-center overflow-hidden border-b border-ms-border relative">
                        {item.imagem_url ? (
                          <img src={item.imagem_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-gray-700" />
                        )}
                        <div className="absolute top-3 left-3 bg-ms-blue text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                          {item.categoria || 'NOTÍCIA'}
                        </div>
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-ms-main font-bold text-lg line-clamp-2 leading-tight">{item.titulo}</h3>
                      </div>
                      
                      {activeTab === 'eventos' && (
                        <div className="flex items-center gap-2 mb-4 text-ms-gold text-xs font-black uppercase">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(item.data_evento).toLocaleDateString('pt-BR')}
                        </div>
                      )}

                      <p className="text-gray-500 text-sm line-clamp-3 mb-6 font-medium">
                        {activeTab === 'avisos' ? item.mensagem : item.subtitulo || item.descricao}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-4 border-t border-ms-border/50">
                        <button 
                          onClick={() => startEdit(item)}
                          className="p-2.5 text-gray-400 hover:text-white hover:bg-ms-dark rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2.5 text-gray-400 hover:text-ms-gold hover:bg-ms-gold/10 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="bg-ms-dark/30 rounded-3xl border border-ms-border p-8 shadow-inner">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-ms-main flex items-center gap-3">
                {editingId ? <Edit2 className="w-6 h-6 text-ms-blueText" /> : <Plus className="w-6 h-6 text-ms-blueText" />}
                {editingId ? 'Editar' : 'Novo'} {activeTab === 'noticias' ? (isInstagramType ? 'Post do Instagram' : 'Post de Notícia') : activeTab === 'eventos' ? 'Evento' : 'Aviso'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="p-2 text-gray-500 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                {activeTab === 'noticias' && (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Tipo de Publicação</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setIsInstagramType(false)}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 ${!isInstagramType ? 'bg-ms-blue/20 border-ms-blueText text-ms-blueText shadow-lg' : 'bg-ms-dark border-ms-border text-gray-500 hover:text-white'}`}
                      >
                        <Newspaper className="w-4 h-4" /> Notícia Interna
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInstagramType(true)}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 ${isInstagramType ? 'bg-[#E1306C]/20 border-[#E1306C] text-[#E1306C] shadow-lg shadow-[#E1306C]/10' : 'bg-ms-dark border-ms-border text-gray-500 hover:text-white'}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                        Instagram
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">
                    {activeTab === 'noticias' && isInstagramType ? 'Título / Assunto (Post do Instagram)' : 'Título'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.titulo || ''}
                    onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                    className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                    placeholder={activeTab === 'noticias' && isInstagramType ? 'Ex: Visita ao Laboratório de Ciências...' : 'Título chamativo...'}
                  />
                </div>

                {activeTab === 'noticias' && (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">
                      {isInstagramType ? 'Legenda do Post (Instagram)' : 'Subtítulo (Resumo)'}
                    </label>
                    <textarea 
                      rows={4}
                      value={formData.subtitulo || ''}
                      onChange={(e) => setFormData({...formData, subtitulo: e.target.value})}
                      className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                      placeholder={isInstagramType ? 'Digite a legenda que aparecerá no card do Instagram...' : 'Breve descrição da notícia...'}
                    />
                  </div>
                )}

                {activeTab === 'eventos' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Data do Evento</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.data_evento ? new Date(formData.data_evento).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setFormData({...formData, data_evento: e.target.value})}
                        className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Tipo de Evento</label>
                      <select 
                        value={formData.tipo || 'Evento'}
                        onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                        className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="Evento">📅 Evento Geral</option>
                        <option value="Prazo">⏳ Prazo/Vencimento</option>
                        <option value="Aviso">📢 Aviso Importante</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'avisos' && (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Cor do Alerta</label>
                    <div className="flex gap-4">
                      {['blue', 'yellow', 'green'].map(color => (
                        <button 
                          key={color}
                          type="button"
                          onClick={() => setFormData({...formData, cor_alerta: color})}
                          className={`flex-1 py-3 rounded-xl border-2 transition-all font-black uppercase text-[10px] tracking-widest ${formData.cor_alerta === color ? `bg-${color}-500/20 border-${color}-500 text-${color}-500 shadow-lg` : 'bg-ms-dark border-ms-border text-gray-500'}`}
                        >
                          {color === 'blue' ? 'Informativo' : color === 'yellow' ? 'Atenção' : 'Sucesso'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {activeTab === 'noticias' && isInstagramType ? (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Link da Postagem no Instagram (URL)</label>
                    <div className="relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                      <input 
                        type="url" 
                        required
                        value={formData.conteudo || ''}
                        onChange={(e) => setFormData({...formData, conteudo: e.target.value})}
                        className="w-full pl-12 pr-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                        placeholder="https://www.instagram.com/p/C_abc123/"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#003366] font-bold">
                      ℹ️ Cole o link completo da publicação (ex: https://www.instagram.com/p/...) para que o botão redirecione o usuário.
                    </p>
                  </div>
                ) : (
                  (activeTab === 'noticias' || activeTab === 'eventos') && (
                    <div>
                      <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">
                        {activeTab === 'noticias' ? 'Conteúdo Detalhado' : 'Descrição'}
                      </label>
                      <textarea 
                        rows={activeTab === 'noticias' ? 10 : 5}
                        required={activeTab === 'noticias'}
                        value={activeTab === 'noticias' ? formData.conteudo || '' : formData.descricao || ''}
                        onChange={(e) => setFormData({...formData, [activeTab === 'noticias' ? 'conteudo' : 'descricao']: e.target.value})}
                        className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                        placeholder="Escreva aqui..."
                      />
                    </div>
                  )
                )}

                {activeTab === 'noticias' && (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">
                      {isInstagramType ? 'URL da Imagem do Post (Instagram)' : 'URL da Imagem'}
                    </label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="url" 
                        value={formData.imagem_url || ''}
                        onChange={(e) => setFormData({...formData, imagem_url: e.target.value})}
                        className="w-full pl-12 pr-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                    </div>
                    {isInstagramType && (
                      <p className="mt-2 text-[11px] text-gray-500 leading-normal">
                        💡 <strong>Opcional:</strong> Se não tiver o link direto da imagem, pode deixar em branco. O card exibirá um belíssimo fallback com degradê oficial do Instagram!
                      </p>
                    )}
                  </div>
                )}

                {activeTab === 'avisos' && (
                  <div>
                    <label className="block text-[10px] font-black text-ms-blueText uppercase tracking-widest mb-2">Mensagem do Alerta</label>
                    <textarea 
                      rows={5}
                      required
                      value={formData.mensagem || ''}
                      onChange={(e) => setFormData({...formData, mensagem: e.target.value})}
                      className="w-full px-5 py-3.5 bg-ms-dark border border-ms-border rounded-2xl text-ms-main font-bold outline-none focus:ring-4 focus:ring-ms-blue/20 transition-all"
                      placeholder="Conteúdo do aviso..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-ms-border/50">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-8 py-3.5 bg-ms-dark border border-ms-border text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-ms-dark/80 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-10 py-3.5 bg-ms-blue text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
