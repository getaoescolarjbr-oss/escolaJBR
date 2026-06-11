import { useState, useEffect } from 'react';
import { X, AlertTriangle, Zap, Users, CheckSquare, Square, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ListaParaVistos } from '../types';

interface OcorrenciaLoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  alunos: ListaParaVistos[];
  professorId: string;
  turmaId: string;
  disciplinaId: string;
  onSuccess: () => void;
}

export function OcorrenciaLoteModal({
  isOpen,
  onClose,
  alunos,
  professorId,
  turmaId,
  disciplinaId,
  onSuccess
}: OcorrenciaLoteModalProps) {
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [tipos, setTipos] = useState<{ id: string; descricao: string }[]>([]);
  const [selectedAlunoIds, setSelectedAlunoIds] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Filtra apenas alunos ativos (não transferidos, remanejados, cancelados)
  const alunosAtivos = alunos.filter(
    a => !a.status || a.status === 'Ativo' || a.status === 'Atestado' || a.status === 'Suspenso' || a.status === 'Aluno Suspenso' || a.status === 'Licença Maternidade'
  );

  // Carrega os tipos de ocorrência ativos
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('tipos_ocorrencia')
      .select('id, descricao')
      .eq('ativo', true)
      .order('criado_em', { ascending: true })
      .then(({ data }) => { if (data) setTipos(data); });
    // Limpa seleção ao abrir
    setSelectedAlunoIds(new Set());
    setDescricao('');
    setSavedCount(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleAluno = (alunoId: string) => {
    setSelectedAlunoIds(prev => {
      const next = new Set(prev);
      if (next.has(alunoId)) {
        next.delete(alunoId);
      } else {
        next.add(alunoId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAlunoIds.size === alunosAtivos.length) {
      setSelectedAlunoIds(new Set());
    } else {
      setSelectedAlunoIds(new Set(alunosAtivos.map(a => String(a.aluno_id))));
    }
  };

  const handleSave = async () => {
    if (!descricao.trim() || selectedAlunoIds.size === 0) return;
    setLoading(true);

    const inserts = Array.from(selectedAlunoIds).map(alunoId => ({
      aluno_id: alunoId,
      id_do_professor: professorId,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      descricao: descricao.trim(),
      data_registro: new Date().toISOString()
    }));

    const { error } = await supabase.from('ocorrências').insert(inserts);

    setLoading(false);
    if (!error) {
      setSavedCount(inserts.length);
      setTimeout(() => {
        setDescricao('');
        setSelectedAlunoIds(new Set());
        setSavedCount(null);
        onSuccess();
        onClose();
      }, 1800);
    } else {
      console.error('Error saving ocorrencias em lote:', error);
      alert(`Erro ao salvar ocorrências: ${error.message}`);
    }
  };

  const allSelected = alunosAtivos.length > 0 && selectedAlunoIds.size === alunosAtivos.length;
  const someSelected = selectedAlunoIds.size > 0 && selectedAlunoIds.size < alunosAtivos.length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ms-card rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red-700 bg-gradient-to-r from-red-700 to-red-600 flex-shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/10 rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Ocorrência em Lote</h2>
              <p className="text-[10px] text-red-200 font-bold uppercase tracking-widest mt-0.5">
                Registrar a mesma ocorrência para múltiplos alunos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-full transition-colors hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Descrição */}
          <div>
            <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-2">
              Descrição da Ocorrência
            </label>

            {/* Atalhos rápidos */}
            {tipos.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Registros Rápidos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tipos.map(tipo => (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => setDescricao(tipo.descricao)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        descricao === tipo.descricao
                          ? 'bg-red-600 text-white border-red-500 shadow-md'
                          : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {tipo.descricao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 text-[#003366] placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none resize-none h-24 transition-all font-medium"
              placeholder="Descreva o que ocorreu durante a aula..."
              required
            />
          </div>

          {/* Seleção de Alunos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-black text-blue-900 uppercase tracking-widest">
                Selecionar Alunos ({selectedAlunoIds.size} selecionado{selectedAlunoIds.size !== 1 ? 's' : ''})
              </label>
              <button
                type="button"
                onClick={toggleAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                  allSelected
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                {allSelected ? <CheckSquare size={12} /> : someSelected ? <CheckSquare size={12} className="opacity-50" /> : <Square size={12} />}
                {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {alunosAtivos.map(aluno => {
                const id = String(aluno.aluno_id);
                const isSelected = selectedAlunoIds.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleAluno(id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-red-600/10 border-red-500/40 shadow-sm ring-1 ring-red-500/30'
                        : 'bg-white border-gray-200 hover:border-red-300 hover:bg-red-50/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                      isSelected ? 'bg-red-600 border-red-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {aluno.aluno_numero && (
                        <span className="text-[10px] font-black text-amber-600 flex-shrink-0">
                          {aluno.aluno_numero}.
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#003366] truncate">
                        {aluno.aluno_nome}
                      </span>
                      {aluno.status && aluno.status !== 'Ativo' && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase bg-blue-500/20 text-blue-600 border border-blue-500/30 flex-shrink-0">
                          {aluno.status}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {alunosAtivos.length === 0 && (
                <p className="text-xs text-gray-400 italic py-4 col-span-2 text-center">
                  Nenhum aluno ativo encontrado nesta turma.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-blue-700 p-5 border-t border-blue-600 flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            {savedCount !== null && (
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest animate-pulse">
                ✓ {savedCount} ocorrência{savedCount !== 1 ? 's' : ''} registrada{savedCount !== 1 ? 's' : ''} com sucesso!
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-300 bg-transparent border border-gray-600 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !descricao.trim() || selectedAlunoIds.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-black uppercase tracking-wider hover:bg-red-500 transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                <><AlertTriangle className="w-4 h-4" /> Registrar para {selectedAlunoIds.size} Aluno{selectedAlunoIds.size !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
