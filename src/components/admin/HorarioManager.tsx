import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Professor, Turma } from '../../types';
import { Loader2, Search, Calendar, User, Save, Check, X, Trash2, Plus, Printer } from 'lucide-react';

const TIMES = [
  { label: '1º Tempo', time: '7:30 - 8:20' },
  { label: '2º Tempo', time: '8:20 - 9:10' },
  { label: '3º Tempo', time: '9:25 - 10:15' },
  { label: '4º Tempo', time: '10:15 - 11:05' },
  { label: '5º Tempo', time: '11:05 - 11:55' },
  { label: '6º Tempo', time: '13:10 - 14:00' },
  { label: '7º Tempo', time: '14:00 - 14:50' },
  { label: '8º Tempo', time: '14:50 - 15:40' },
];

const DAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
];

const getTurmaColor = (turmaName: string) => {
    if (!turmaName) return { bg: 'bg-blue-500/10', text: 'text-blue-700' };
    
    const colors = [
        { bg: 'bg-blue-500/20', text: 'text-blue-800' },
        { bg: 'bg-emerald-500/20', text: 'text-emerald-800' },
        { bg: 'bg-purple-500/20', text: 'text-purple-800' },
        { bg: 'bg-orange-500/20', text: 'text-orange-800' },
        { bg: 'bg-pink-500/20', text: 'text-pink-800' },
        { bg: 'bg-teal-500/20', text: 'text-teal-800' },
        { bg: 'bg-indigo-500/20', text: 'text-indigo-800' },
        { bg: 'bg-rose-500/20', text: 'text-rose-800' }
    ];
    let hash = 0;
    for (let i = 0; i < turmaName.length; i++) {
        hash = turmaName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export function HorarioManager({ theme }: { theme: 'dark' | 'light' }) {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedProf, setSelectedProf] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  
  const [editingCell, setEditingCell] = useState<{profId: string, dia: number, tempo: number} | null>(null);
  const [editForm, setEditForm] = useState<{turma_id: string, disciplina_nome: string}>({ turma_id: '', disciplina_nome: '' });
  const [savingCell, setSavingCell] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchHorarios();
  }, [selectedProf]);

  async function fetchInitialData() {
    try {
      const [profRes, turmaRes] = await Promise.all([
        supabase.from('professores').select('*').order('nome'),
        supabase.from('turmas').select('*').order('nome')
      ]);
      if (profRes.data) setProfessors(profRes.data);
      if (turmaRes.data) setTurmas(turmaRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHorarios() {
    setLoadingHorarios(true);
    try {
      const query = supabase.from('horarios').select(`*, turmas(nome)`);
      if (selectedProf) {
          query.eq('professor_id', selectedProf);
      }
      const { data, error } = await query;
        
      if (error) {
          if (error.code === '42P01') {
             console.error('Tabela horarios não existe no banco de dados.');
          }
          throw error;
      }
      setHorarios(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHorarios(false);
    }
  }

  const handleEditClick = (profId: string, dia: number, tempo: number) => {
     const cellData = horarios.find(h => h.dia_semana === dia && h.tempo === tempo && h.professor_id === profId);
     if (cellData) {
         setEditForm({ turma_id: cellData.turma_id, disciplina_nome: cellData.disciplina_nome });
     } else {
         setEditForm({ turma_id: '', disciplina_nome: '' });
     }
     setEditingCell({ profId, dia, tempo });
  };

  const handleSaveCell = async () => {
     if (!editingCell) return;
     if (!editForm.turma_id || !editForm.disciplina_nome) {
         handleDeleteCell(editingCell.profId, editingCell.dia, editingCell.tempo);
         return;
     }

     setSavingCell(true);
     try {
         const existing = horarios.find(h => h.dia_semana === editingCell.dia && h.tempo === editingCell.tempo && h.professor_id === editingCell.profId);
         if (existing) {
             await supabase.from('horarios').update({
                 turma_id: editForm.turma_id,
                 disciplina_nome: editForm.disciplina_nome
             }).eq('id', existing.id);
         } else {
             await supabase.from('horarios').insert({
                 professor_id: editingCell.profId,
                 turma_id: editForm.turma_id,
                 dia_semana: editingCell.dia,
                 tempo: editingCell.tempo,
                 disciplina_nome: editForm.disciplina_nome
             });
         }
         await fetchHorarios();
         setEditingCell(null);
     } catch (error) {
         console.error(error);
         alert('Erro ao salvar horário');
     } finally {
         setSavingCell(false);
     }
  };

  const handleDeleteCell = async (profId: string, dia: number, tempo: number) => {
     setSavingCell(true);
     try {
         const existing = horarios.find(h => h.dia_semana === dia && h.tempo === tempo && h.professor_id === profId);
         if (existing) {
             await supabase.from('horarios').delete().eq('id', existing.id);
         }
         await fetchHorarios();
         setEditingCell(null);
     } catch (error) {
         console.error(error);
         alert('Erro ao remover horário');
     } finally {
         setSavingCell(false);
     }
  };

  const filteredProfessors = professors.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const profsToDisplay = selectedProf 
    ? professors.filter(p => p.id === selectedProf)
    : filteredProfessors;

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-ms-blue mb-4" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando gerenciador de horários...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card rounded-2xl p-6 border border-ms-border shadow-xl">
        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-ms-blue" />
            Selecione o Professor
        </h3>
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar professor por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-ms-blue placeholder-gray-500 outline-none focus:border-ms-blue focus:ring-1 focus:ring-ms-blue transition-all"
              />
            </div>
            <select
               className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-ms-blue outline-none focus:border-ms-blue focus:ring-1 focus:ring-ms-blue w-full md:w-auto"
               value={selectedProf || ''}
               onChange={(e) => setSelectedProf(e.target.value || null)}
            >
               <option value="">Todos os Professores (A-Z)</option>
               {professors.map(p => (
                   <option key={p.id} value={p.id}>{p.nome}</option>
               ))}
            </select>
            <button 
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl hover:bg-ms-blue/90 font-black transition-colors print:hidden shadow-md hover:shadow-lg w-full md:w-auto"
            >
                <Printer className="w-5 h-5" /> IMPRIMIR TODOS
            </button>
        </div>
      </div>

      {loadingHorarios && profsToDisplay.length > 1 ? (
          <div className="py-20 flex justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-ms-blue" />
          </div>
      ) : (
          <div className="space-y-10">
              {profsToDisplay.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-xl shadow-xl border border-gray-300">
                      <p className="text-gray-500 font-medium">Nenhum professor encontrado com esse filtro.</p>
                  </div>
              )}
              {profsToDisplay.map(prof => (
                <div key={prof.id} className="bg-white rounded-xl shadow-xl border border-gray-300 relative pb-10 break-inside-avoid print:shadow-none print:border-b-2 print:border-black print:mb-10">
                    <div className="p-6 text-center border-b border-gray-300 relative flex items-center justify-center bg-[#f8fafc] print:bg-transparent">
                       <h2 className="text-3xl text-black font-normal print:font-bold">{prof.nome}</h2>
                    </div>
            
            {loadingHorarios ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-ms-blue" />
                </div>
            ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[65vh] w-full">
                    <table className="w-full min-w-[800px] border-collapse bg-white">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="border-b border-r border-black p-4 w-[120px] bg-[#f8fafc]"></th>
                                {DAYS.map(d => (
                                    <th key={d.id} className="border-b border-black p-4 text-xl font-normal text-black text-center min-w-[150px] bg-[#f8fafc]">
                                        {d.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {TIMES.map((t, tIdx) => (
                                <tr key={tIdx}>
                                    <td className="border-b border-r border-black p-2 text-center bg-[#f8fafc] whitespace-nowrap sticky left-0 z-10">
                                        <div className="text-sm font-normal text-black">{t.label}</div>
                                        <div className="text-xs text-black">{t.time}</div>
                                    </td>
                                    {DAYS.map(d => {
                                        const cell = horarios.find(h => h.dia_semana === d.id && h.tempo === (tIdx + 1) && h.professor_id === prof.id);
                                        const isEditing = editingCell?.profId === prof.id && editingCell?.dia === d.id && editingCell?.tempo === (tIdx + 1);
                                        const colorTheme = cell?.turmas?.nome ? getTurmaColor(cell.turmas.nome) : null;

                                        return (
                                            <td 
                                                key={d.id} 
                                                className={`border-b border-l border-black p-1 h-20 relative group ${!isEditing ? 'cursor-pointer hover:bg-blue-50/50 bg-blue-50/20' : 'bg-white'}`}
                                                onClick={() => !isEditing && handleEditClick(prof.id, d.id, tIdx + 1)}
                                            >
                                                {isEditing ? (
                                                    <div className="absolute inset-0 bg-white z-10 p-2 flex flex-col gap-1 border-2 border-blue-500 shadow-xl">
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            placeholder="Ex: Matemática - RA"
                                                            value={editForm.disciplina_nome}
                                                            onChange={e => setEditForm(prev => ({...prev, disciplina_nome: e.target.value}))}
                                                            className="w-full text-xs p-1 border border-gray-300 rounded text-black bg-white"
                                                        />
                                                        <select 
                                                            value={editForm.turma_id}
                                                            onChange={e => setEditForm(prev => ({...prev, turma_id: e.target.value}))}
                                                            className="w-full text-xs p-1 border border-gray-300 rounded text-black bg-white"
                                                        >
                                                            <option value="">[Vazio]</option>
                                                            {turmas.map(turma => (
                                                                <option key={turma.id} value={turma.id}>{turma.nome}</option>
                                                            ))}
                                                        </select>
                                                        <div className="flex gap-1 justify-end mt-auto">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setEditingCell(null); }}
                                                                className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleSaveCell(); }}
                                                                disabled={savingCell}
                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50"
                                                            >
                                                                {savingCell ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : cell ? (
                                                    <div className="flex flex-col items-center justify-center h-full text-center p-1">
                                                        <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center p-2 border shadow-sm transition-all hover:scale-[1.02] ${colorTheme?.bg} border-black/5`}>
                                                            <div className={`text-[11px] font-semibold w-full break-words px-1 ${colorTheme?.text}`} style={{lineHeight: '1.2'}}>{cell.disciplina_nome}</div>
                                                            <div className={`text-sm font-black mt-1 ${colorTheme?.text}`}>{cell.turmas?.nome}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="hidden group-hover:flex items-center justify-center h-full opacity-30 text-blue-500">
                                                        <Plus className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
