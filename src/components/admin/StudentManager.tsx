import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student, Turma, MatriculaStatus } from '../../types';
import { Search, Plus, Edit2, Trash2, Loader2, Save, X, UserPlus, Filter, Calendar, AlertCircle, Camera } from 'lucide-react';
import { autoUpdateExpiredAbsences } from '../../utils/studentUtils';

export function StudentManager({ theme }: { theme: 'dark' | 'light' }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [targetTurma, setTargetTurma] = useState<string>('');
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Partial<Student>>({
    nome: '',
    status: 'Ativo',
    atestado_inicio: '',
    atestado_fim: '',
    cid_codigo: '',
    cid_descricao: ''
  });

  useEffect(() => {
    fetchTurmas();
  }, []);

  useEffect(() => {
    if (selectedTurma) {
      fetchStudents();
    } else {
      setStudents([]);
      setLoading(false);
    }
  }, [selectedTurma]);

  async function fetchTurmas() {
    const { data } = await supabase.from('turmas').select('*').order('nome');
    if (data) {
      setTurmas(data);
      if (data.length > 0 && !selectedTurma) {
        setSelectedTurma(data[0].id);
      }
    }
  }

  async function fetchStudents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('turma_id', selectedTurma)
      .order('aluno_numero');
    
    if (data) {
      setStudents(data);
      autoUpdateExpiredAbsences(data, (updated) => {
        setStudents(updated);
      });
    }
    setLoading(false);
  }

  // Comprime a imagem via Canvas antes do upload (max 400x400, JPEG 80%)
  function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao comprimir imagem'));
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
      img.src = url;
    });
  }

  async function uploadFoto(file: File, studentId: string): Promise<string | null> {
    const compressed = await compressImage(file);
    const path = `alunos/${studentId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('fotos-alunos')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('fotos-alunos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setFotoPreview(preview);
  }

  async function handleSave() {
    if (!formData.nome || !selectedTurma) {
      alert('Por favor, preencha o nome do aluno e selecione uma turma.');
      return;
    }

    try {
      setActionLoading(true);
      let error;

      if (editingStudent) {
        if (formData.status === 'Atestado' || formData.status === 'Suspenso' || formData.status === 'Aluno Suspenso' || formData.status === 'Licença Maternidade') {
          if (!formData.atestado_inicio) {
            alert('Por favor, preencha a data de início.');
            setActionLoading(false);
            return;
          }
          const { error: updateError } = await supabase
            .from('alunos')
            .update({
              nome: formData.nome,
              status: formData.status,
              atestado_inicio: formData.atestado_inicio,
              atestado_fim: formData.atestado_fim || null,
              cid_codigo: formData.cid_codigo || null,
              cid_descricao: formData.cid_descricao || null
            })
            .eq('id', editingStudent.id);
          error = updateError;
        } else if (formData.status === 'Transferido') {
          if (!formData.atestado_inicio) {
            alert('Por favor, preencha a data da transferência.');
            setActionLoading(false);
            return;
          }
          const { error: updateError } = await supabase
            .from('alunos')
            .update({
              nome: formData.nome,
              status: 'Transferido',
              atestado_inicio: formData.atestado_inicio,
              atestado_fim: null,
              cid_codigo: formData.cid_codigo || null,
              cid_descricao: formData.cid_descricao || null
            })
            .eq('id', editingStudent.id);
          error = updateError;
        } else if (formData.status === 'Remanejado') {
          if (!formData.atestado_inicio) {
            alert('Por favor, preencha a data do remanejamento.');
            setActionLoading(false);
            return;
          }
          if (!targetTurma) {
            alert('Por favor, selecione a turma de destino para o remanejamento.');
            setActionLoading(false);
            return;
          }

          // 1. Mark original student as Remanejado in current class
          const { error: originalError } = await supabase
            .from('alunos')
            .update({
              nome: formData.nome,
              status: 'Remanejado',
              atestado_inicio: formData.atestado_inicio,
              atestado_fim: null,
              cid_codigo: formData.cid_codigo || null,
              cid_descricao: formData.cid_descricao || null
            })
            .eq('id', editingStudent.id);
          
          if (originalError) throw originalError;

          // 2. Fetch all students in the target class to determine next call number (aluno_numero)
          const { data: targetStudents, error: fetchError } = await supabase
            .from('alunos')
            .select('aluno_numero')
            .eq('turma_id', targetTurma);
          
          if (fetchError) throw fetchError;
          
          const nextNumber = targetStudents && targetStudents.length > 0 
            ? Math.max(...targetStudents.map(ts => ts.aluno_numero || 0)) + 1 
            : 1;

          // 3. Insert new student in the target class
          const { error: insertError } = await supabase
            .from('alunos')
            .insert([{
              nome: formData.nome,
              turma_id: targetTurma,
              aluno_numero: nextNumber,
              status: 'Ativo',
              cid_codigo: formData.cid_codigo || null,
              cid_descricao: formData.cid_descricao || null
            }]);
          
          if (insertError) throw insertError;
        } else {
          // Ativo / Cancelada
          const { error: updateError } = await supabase
            .from('alunos')
            .update({
              nome: formData.nome,
              status: formData.status,
              atestado_inicio: null,
              atestado_fim: null,
              cid_codigo: formData.cid_codigo || null,
              cid_descricao: formData.cid_descricao || null
            })
            .eq('id', editingStudent.id);
          error = updateError;
        }
      } else {
        // Calculate next call number
        const nextNumber = students.length > 0 
          ? Math.max(...students.map(s => s.aluno_numero || 0)) + 1 
          : 1;

        const { error: insertError } = await supabase
          .from('alunos')
          .insert([{
            nome: formData.nome,
            turma_id: selectedTurma,
            aluno_numero: nextNumber,
            status: 'Ativo',
            cid_codigo: formData.cid_codigo || null,
            cid_descricao: formData.cid_descricao || null
          }]);
        error = insertError;
      }

      if (error) throw error;

      // Upload de foto se selecionada
      if (fotoInputRef.current?.files?.[0]) {
        setIsUploadingFoto(true);
        try {
          // Para novo aluno, precisamos buscar o ID recém-criado
          if (!editingStudent) {
            const { data: newStudent } = await supabase
              .from('alunos')
              .select('id')
              .eq('turma_id', selectedTurma)
              .eq('nome', formData.nome)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (newStudent) {
              const fotoUrl = await uploadFoto(fotoInputRef.current.files[0], newStudent.id);
              if (fotoUrl) {
                await supabase.from('alunos').update({ foto_url: fotoUrl }).eq('id', newStudent.id);
              }
            }
          } else {
            const fotoUrl = await uploadFoto(fotoInputRef.current.files[0], editingStudent.id);
            if (fotoUrl) {
              await supabase.from('alunos').update({ foto_url: fotoUrl }).eq('id', editingStudent.id);
            }
          }
        } catch (fotoErr: any) {
          console.warn('Foto não enviada:', fotoErr.message);
        } finally {
          setIsUploadingFoto(false);
        }
      }

      setIsModalOpen(false);
      setEditingStudent(null);
      setFormData({ nome: '', status: 'Ativo', atestado_inicio: '', atestado_fim: '', cid_codigo: '', cid_descricao: '' });
      setTargetTurma('');
      setFotoPreview(null);
      await fetchStudents();
    } catch (err: any) {
      alert('Erro ao salvar aluno: ' + err.message);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Deseja realmente excluir o aluno ${s.nome}? Todos os registros vinculados serão perdidos.`)) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('alunos')
        .delete()
        .eq('id', s.id);

      if (error) throw error;
      await fetchStudents();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredStudents = students.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={selectedTurma}
              onChange={(e) => setSelectedTurma(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all appearance-none"
            >
              <option value="">Selecionar Turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
            />
          </div>
        </div>

        <button 
          onClick={() => {
            setEditingStudent(null);
            setFormData({ nome: '', status: 'Ativo', atestado_inicio: '', atestado_fim: '', cid_codigo: '', cid_descricao: '' });
            setTargetTurma('');
            setFotoPreview(null);
            setIsModalOpen(true);
          }}
          disabled={!selectedTurma}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserPlus className="w-5 h-5" />
          Novo Aluno
        </button>
      </div>

      {/* Student List */}
      <div className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-[#003366] border-b border-blue-900 shadow-lg">
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider w-20">Nº</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Nome do Aluno</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue mb-4" />
                  <p className="text-[#003366] font-black uppercase text-[10px] tracking-widest">Carregando lista de alunos...</p>
                </td>
              </tr>
            ) : !selectedTurma ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-800 mx-auto mb-4 opacity-20" />
                  <p className="text-[#003366] font-black uppercase text-xs tracking-widest">Selecione uma turma para visualizar os alunos.</p>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                  Nenhum aluno encontrado nesta turma.
                </td>
              </tr>
            ) : filteredStudents.map((s, idx) => (
              <tr key={s.id} className={idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'}>
                <td className="px-6 py-4">
                  <span className="text-sm font-black text-ms-gold">
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ms-blue/10 flex items-center justify-center text-[10px] font-black text-ms-blue border border-ms-blue/20">
                      {s.nome.charAt(0)}
                    </div>
                    <p className="text-sm font-black text-[#003366] uppercase tracking-tight">{s.nome}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase border w-fit ${
                      s.status === 'Ativo' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      s.status === 'Transferido' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                      s.status === 'Remanejado' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      s.status === 'Atestado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      s.status === 'Suspenso' || s.status === 'Aluno Suspenso' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      s.status === 'Licença Maternidade' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {s.status}
                    </span>
                    {(s.status === 'Atestado' || s.status === 'Suspenso' || s.status === 'Aluno Suspenso' || s.status === 'Licença Maternidade') && s.atestado_inicio && (
                      <span className="text-[9px] text-gray-505 italic font-bold mt-1">
                        {new Date(s.atestado_inicio + 'T12:00:00').toLocaleDateString()} até {s.atestado_fim ? new Date(s.atestado_fim + 'T12:00:00').toLocaleDateString() : 'indeterminado'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingStudent(s);
                        setFormData({ ...s });
                        setTargetTurma('');
                        setFotoPreview(s.foto_url || null);
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-ms-blue/20 text-ms-blue rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(s)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-ms-card w-full max-w-lg rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-ms-blue/10 to-transparent">
              <h3 className="text-xl font-black text-ms-main">{editingStudent ? 'Editar Aluno' : 'Novo Aluno'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Foto do Aluno */}
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Foto do aluno"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-ms-blue/40 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-ms-blue/10 border-2 border-dashed border-ms-blue/30 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-ms-blue/40" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-ms-blue hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-ms-card transition-all"
                    title="Selecionar foto"
                  >
                    {isUploadingFoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFotoChange}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-ms-main uppercase tracking-wider">Foto do Aluno</p>
                  <p className="text-[10px] text-gray-500 mt-1">JPG, PNG ou WEBP. Será comprimida automaticamente.</p>
                  {fotoPreview && (
                    <button
                      type="button"
                      onClick={() => { setFotoPreview(null); if (fotoInputRef.current) fotoInputRef.current.value = ''; }}
                      className="mt-2 text-[10px] text-red-400 hover:text-red-300 font-bold uppercase"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                  placeholder="Nome do aluno"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Código CID (Opcional)</label>
                  <input
                    type="text"
                    value={formData.cid_codigo || ''}
                    onChange={(e) => setFormData({ ...formData, cid_codigo: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all uppercase font-bold"
                    placeholder="Ex: F84.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Descrição do CID</label>
                  <input
                    type="text"
                    value={formData.cid_descricao || ''}
                    onChange={(e) => setFormData({ ...formData, cid_descricao: e.target.value })}
                    className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                    placeholder="Ex: Autismo"
                  />
                </div>
              </div>

              {editingStudent && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Status da Matrícula</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as MatriculaStatus })}
                      className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Transferido">Transferido</option>
                      <option value="Remanejado">Remanejado</option>
                      <option value="Atestado">Atestado Médico</option>
                      <option value="Suspenso">Aluno Suspenso</option>
                      <option value="Licença Maternidade">Licença Maternidade</option>
                      <option value="Cancelada">Matrícula Cancelada</option>
                    </select>
                  </div>

                  {(formData.status === 'Atestado' || formData.status === 'Suspenso' || formData.status === 'Aluno Suspenso' || formData.status === 'Licença Maternidade') && (
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">Início</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="date"
                            value={formData.atestado_inicio || ''}
                            onChange={(e) => setFormData({ ...formData, atestado_inicio: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">Fim</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="date"
                            value={formData.atestado_fim || ''}
                            onChange={(e) => setFormData({ ...formData, atestado_fim: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.status === 'Transferido' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">Data da Transferência</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="date"
                          value={formData.atestado_inicio || ''}
                          onChange={(e) => setFormData({ ...formData, atestado_inicio: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                        />
                      </div>
                    </div>
                  )}

                  {formData.status === 'Remanejado' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">Data do Remanejamento</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="date"
                            value={formData.atestado_inicio || ''}
                            onChange={(e) => setFormData({ ...formData, atestado_inicio: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-white text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-1">Turma de Destino</label>
                        <select
                          value={targetTurma}
                          onChange={(e) => setTargetTurma(e.target.value)}
                          className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-ms-blue appearance-none cursor-pointer"
                        >
                          <option value="">Selecionar Turma...</option>
                          {turmas.filter(t => t.id !== selectedTurma).map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                disabled={actionLoading}
                className="flex items-center gap-2 px-8 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editingStudent ? 'Salvar Alterações' : 'Adicionar Aluno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
