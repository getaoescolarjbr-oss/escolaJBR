import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Professor, AtestadoServidor } from '../../types';
import { Search, Plus, Edit2, Trash2, Loader2, Save, X, Stethoscope, AlertCircle, Cake, BadgeCheck } from 'lucide-react';
import { AtestadoModal } from './AtestadoModal';

export function ProfessorManager({ theme }: { theme: 'dark' | 'light' }) {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [customCargos, setCustomCargos] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [atestadoTarget, setAtestadoTarget] = useState<Professor | null>(null);
  const [atestadosAtivos, setAtestadosAtivos] = useState<Map<string, AtestadoServidor>>(new Map());
  const [customStatus, setCustomStatus] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<Professor>>({
    nome: '',
    email: '',
    cargo: 'Professor',
    area_conhecimento: '',
    habilitar_chamada_interna: true,
    data_nascimento: '',
    publicar_aniversario: true,
    status_servidor: 'Efetivo(a)'
  });

  useEffect(() => {
    fetchProfessors();
  }, []);

  async function fetchProfessors() {
    setLoading(true);
    const { data, error } = await supabase
      .from('professores')
      .select('*')
      .order('nome');
    
    if (data) setProfessors(data);

    // Buscar atestados ativos
    await fetchAtestadosAtivos();
    setLoading(false);
  }

  async function fetchAtestadosAtivos() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('atestados_servidores')
      .select('*')
      .eq('ativo', true)
      .lte('data_inicio', today)
      .gte('data_fim', today);

    if (data) {
      const map = new Map<string, AtestadoServidor>();
      data.forEach((a: AtestadoServidor) => map.set(a.professor_id, a));
      setAtestadosAtivos(map);
    }
  }

  const handleAddCategory = () => {
    const newCat = prompt('Digite o nome da nova categoria de servidor (ex: Secretário, Vice-Diretor, Auxiliar):');
    if (newCat && newCat.trim()) {
      const trimmed = newCat.trim();
      const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      if (!customCargos.includes(formatted)) {
        setCustomCargos(prev => [...prev, formatted]);
      }
      setFormData(prev => ({ ...prev, cargo: formatted }));
    }
  };

  const defaultStatus = ['Efetivo(a)', 'Convocado(a)', 'Contratado(a)'];
  const availableStatus = Array.from(new Set([...defaultStatus, ...customStatus, ...professors.map(p => p.status_servidor).filter(Boolean) as string[]]));

  const handleAddStatus = () => {
    const newSt = prompt('Digite o novo status do servidor (ex: Cedido(a), Designado(a)):');
    if (newSt && newSt.trim()) {
      const formatted = newSt.trim().charAt(0).toUpperCase() + newSt.trim().slice(1);
      if (!customStatus.includes(formatted)) {
        setCustomStatus(prev => [...prev, formatted]);
      }
      setFormData(prev => ({ ...prev, status_servidor: formatted }));
    }
  };

  const getStatusColor = (status?: string) => {
    if (status === 'Efetivo(a)') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (status === 'Convocado(a)') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (status === 'Contratado(a)') return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  };

  const defaultCargos = [
    'Professor',
    'Coordenador',
    'Diretor',
    'Vice-Diretor',
    'Inspetor',
    'Portaria',
    'Auxiliar de Secretaria',
    'Secretário(a)',
    'Administrativo (Secretaria)',
    'Administrativo (Biblioteca)',
    'Administrativo (Inspetor(a))',
    'Administrativo (Limpeza)',
    'Administrativo (Cozinha)',
    'Administrativo (Manutenção)',
  ];

  const availableCargos = Array.from(new Set([...defaultCargos, ...customCargos, ...professors.map(p => p.cargo).filter(Boolean)]));
  const uniqueCargos = Array.from(new Set(professors.map(p => p.cargo).filter(Boolean)));
  const categories = ['Todos', ...Array.from(new Set([...defaultCargos, ...customCargos, ...uniqueCargos]))];

  async function handleSave() {
    if (!formData.nome || !formData.email) {
      alert('Por favor, preencha o nome e o e-mail do servidor.');
      return;
    }

    try {
      setLoading(true);
      let error;

      if (editingProfessor) {
        const { error: updateError } = await supabase
          .from('professores')
          .update(formData)
          .eq('id', editingProfessor.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('professores')
          .insert([formData]);
        error = insertError;
      }

      if (error) throw error;

      alert('Servidor salvo com sucesso!');
      setIsModalOpen(false);
      setEditingProfessor(null);
      setFormData({ nome: '', email: '', cargo: 'Professor', area_conhecimento: '', habilitar_chamada_interna: true, data_nascimento: '', publicar_aniversario: true, status_servidor: 'Efetivo(a)' });
      setSearchTerm('');
      await fetchProfessors();
    } catch (err: any) {
      alert('Erro ao salvar servidor: ' + err.message);
      console.error(err);
      setLoading(false);
    }
  }

  async function handleDelete(p: Professor) {
    const confirmMsg = p.email 
      ? `Deseja excluir o servidor ${p.nome} (${p.email})?`
      : `Deseja excluir o servidor ${p.nome} (SEM E-MAIL CADASTRADO)?`;
      
    if (!confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('professores')
        .delete()
        .eq('id', p.id);

      if (error) {
        if (error.code === '23503') {
          throw new Error('Este servidor ainda tem turmas ou registros vinculados a ele. Você precisa remover todos os vínculos na aba "Alocações" antes de conseguir excluí-lo definitivamente.');
        }
        throw error;
      }

      alert('Servidor excluído com sucesso!');
      await fetchProfessors();
    } catch (err: any) {
      alert('Não foi possível excluir: ' + err.message);
      console.error(err);
      setLoading(false);
    }
  }

  const filteredProfessors = professors.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.cargo === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar servidor por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingProfessor(null);
            setFormData({ nome: '', email: '', cargo: 'Professor', area_conhecimento: '', habilitar_chamada_interna: true });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-5 h-5" />
          Novo Servidor
        </button>
      </div>

      {/* Filtro por Categoria (Cargo) */}
      <div className="flex items-center gap-2 flex-wrap bg-ms-card/30 p-4 rounded-xl border border-gray-800/40">
        <span className={`text-xs font-black uppercase tracking-wider mr-2 ${theme === 'light' ? 'text-blue-800' : 'text-gray-400'}`}>Filtrar por Categoria:</span>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedCategory === cat
                  ? 'bg-ms-blue text-white border-ms-blue shadow-lg shadow-blue-900/20'
                  : theme === 'light'
                  ? 'bg-white text-blue-900 border-blue-100 hover:border-blue-300'
                  : 'bg-ms-card text-gray-300 border-gray-800 hover:border-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda de atestado ativo */}
      {atestadosAtivos.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-bold text-amber-300">
            {atestadosAtivos.size} servidor(es) com atestado ativo hoje. Identificados com o badge laranja na tabela.
          </p>
        </div>
      )}

      <div className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-[#003366] border-b border-blue-900 shadow-lg">
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Servidor (a)</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Cargo / Vínculo</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Área de Conhecimento</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Contato</th>
              <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue mb-4" />
                  <p className="text-gray-500 font-medium">Carregando lista de servidores...</p>
                </td>
              </tr>
            ) : filteredProfessors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <p className="text-gray-500 font-medium">Nenhum servidor encontrado para este filtro.</p>
                </td>
              </tr>
            ) : (
              filteredProfessors.map((p, idx) => {
                const atestadoAtivo = atestadosAtivos.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`${idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'} ${atestadoAtivo ? 'border-l-4 border-l-amber-400' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black border ${atestadoAtivo ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' : 'bg-ms-blue/10 text-ms-blue border-ms-blue/20'}`}>
                          {p.nome.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-[#003366] uppercase">{p.nome}</p>
                            {atestadoAtivo && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-400/15 text-amber-400 border border-amber-400/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                                <Stethoscope className="w-2.5 h-2.5" />
                                Atestado até {new Date(atestadoAtivo.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          {p.user_id ? (
                            <p className={`text-[10px] font-mono font-bold ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`}>
                              {p.user_id}
                            </p>
                          ) : (
                            <p className={`text-[10px] font-mono font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-500'}`}>
                              Não vinculado
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="px-3 py-1 bg-blue-500/10 text-ms-blue rounded-full text-[10px] font-black uppercase border border-ms-blue/20 w-fit">
                          {p.cargo}
                        </span>
                        {p.status_servidor && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border w-fit flex items-center gap-1 ${getStatusColor(p.status_servidor)}`}>
                            <BadgeCheck className="w-2.5 h-2.5" />
                            {p.status_servidor}
                          </span>
                        )}
                        {p.data_nascimento && (
                          <span className="text-[9px] text-gray-500 font-bold flex items-center gap-1">
                            <Cake className="w-2.5 h-2.5 text-pink-400" />
                            {new Date(p.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {p.area_conhecimento ? (
                        <span className="text-xs font-bold text-ms-main">
                          {p.area_conhecimento}
                        </span>
                      ) : (
                        <span className={`text-xs italic ${theme === 'light' ? 'text-blue-600/60' : 'text-gray-500'}`}>Não definida</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm font-medium ${theme === 'light' ? 'text-blue-800' : 'text-gray-400'}`}>{p.email || '-'}</p>
                      <p className="text-xs text-[#003366] font-bold">{p.telefone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botão Atestado */}
                        <button
                          onClick={() => setAtestadoTarget(p)}
                          className={`p-2 rounded-lg transition-all ${atestadoAtivo ? 'bg-amber-400/20 text-amber-400 hover:bg-amber-400/30' : 'hover:bg-amber-400/10 text-amber-500'}`}
                          title="Gerenciar atestado médico"
                        >
                          <Stethoscope className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingProfessor(p);
                            setFormData(p);
                            setIsModalOpen(true);
                          }}
                          className="p-2 hover:bg-ms-blue/20 text-ms-blue rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p)}
                          className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Editar/Criar Servidor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ms-card w-full max-w-lg rounded-3xl border border-gray-800 shadow-2xl overflow-hidden scale-in animate-in duration-300 max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-ms-blue/10 to-transparent">
              <h3 className="text-xl font-black text-ms-main">{editingProfessor ? 'Editar Servidor' : 'Novo Servidor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  placeholder="Nome do servidor"
                />
              </div>
  
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">E-mail Institucional</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  placeholder="exemplo@gmail.com"
                />
              </div>
  
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-black text-[#003366] uppercase tracking-wider">Cargo</label>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="text-[10px] font-black text-ms-blue hover:underline uppercase tracking-wider"
                    >
                      + Nova
                    </button>
                  </div>
                  <select
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  >
                    {availableCargos.map((cargo) => (
                      <option key={cargo} value={cargo}>{cargo}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Área de Conhecimento</label>
                  <select
                    value={formData.area_conhecimento || ''}
                    onChange={(e) => setFormData({ ...formData, area_conhecimento: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  >
                    <option value="">Não Definida</option>
                    <option value="Matemática">Matemática</option>
                    <option value="Ciências da Natureza">Ciências da Natureza</option>
                    <option value="Linguagens">Linguagens</option>
                    <option value="Humanas">Humanas</option>
                    <option value="Educação Especial">Educação Especial</option>
                    <option value="Educação Profissional">Educação Profissional</option>
                  </select>
                </div>
              </div>

              {/* Status do Servidor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-black text-[#003366] uppercase tracking-wider">Status / Vínculo</label>
                  <button
                    type="button"
                    onClick={handleAddStatus}
                    className="text-[10px] font-black text-ms-blue hover:underline uppercase tracking-wider"
                  >
                    + Novo Status
                  </button>
                </div>
                <select
                  value={formData.status_servidor || 'Efetivo(a)'}
                  onChange={(e) => setFormData({ ...formData, status_servidor: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                >
                  {availableStatus.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Data de Nascimento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.data_nascimento || ''}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1">Publicar Aniversário</label>
                  <div className="flex items-center h-[50px]">
                    <button
                      onClick={() => setFormData({ ...formData, publicar_aniversario: !formData.publicar_aniversario })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.publicar_aniversario !== false ? 'bg-pink-500' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.publicar_aniversario !== false ? 'translate-x-6' : ''}`}></div>
                    </button>
                    <span className="ml-3 flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                      {formData.publicar_aniversario !== false && <Cake className="w-3.5 h-3.5 text-pink-400" />}
                      {formData.publicar_aniversario !== false ? 'Publicar' : 'Não publicar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chamada Interna */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1">Chamada Interna</label>
                <div className="flex items-center h-[50px]">
                  <button 
                    onClick={() => setFormData({ ...formData, habilitar_chamada_interna: !formData.habilitar_chamada_interna })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.habilitar_chamada_interna ? 'bg-ms-blue' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.habilitar_chamada_interna ? 'translate-x-6' : ''}`}></div>
                  </button>
                  <span className="ml-3 text-xs text-gray-500 font-bold">{formData.habilitar_chamada_interna ? 'Ativado' : 'Desativado'}</span>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-800/30 border-t border-gray-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:bg-gray-800 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/30"
              >
                <Save className="w-5 h-5" />
                Salvar Servidor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Atestado */}
      {atestadoTarget && (
        <AtestadoModal
          professor={atestadoTarget}
          allProfessors={professors}
          onClose={() => setAtestadoTarget(null)}
          onUpdate={() => fetchAtestadosAtivos()}
        />
      )}
    </div>
  );
}
