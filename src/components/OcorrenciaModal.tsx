import { useState, useEffect } from 'react';
import { X, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OcorrenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  alunoId: string;
  alunoNome: string;
  professorId: string;
  turmaId: string;
  disciplinaId: string;
  onSuccess: () => void;
}

export function OcorrenciaModal({
  isOpen,
  onClose,
  alunoId,
  alunoNome,
  professorId,
  turmaId,
  disciplinaId,
  onSuccess
}: OcorrenciaModalProps) {
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [tipos, setTipos] = useState<{ id: string; descricao: string }[]>([]);

  // Carrega os tipos de ocorrência ativos
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('tipos_ocorrencia')
      .select('id, descricao')
      .eq('ativo', true)
      .order('criado_em', { ascending: true })
      .then(({ data }) => { if (data) setTipos(data); });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!descricao.trim()) return;
    setLoading(true);

    const { error } = await supabase.from('ocorrências').insert({
      aluno_id: alunoId,
      id_do_professor: professorId,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      descricao: descricao.trim(),
      data_registro: new Date().toISOString()
    });

    setLoading(false);
    if (!error) {
      setDescricao('');
      onSuccess();
      onClose();
    } else {
      console.error('Error saving ocorrencia:', error);
      alert(`Erro ao salvar ocorrência: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ms-card rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800">
        <div className="flex items-center justify-between p-5 border-b border-red-700 bg-red-600">
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold uppercase tracking-tight">Registrar Ocorrência</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-1">Aluno</p>
            <p className="text-lg font-semibold text-blue-900">{alunoNome}</p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-blue-900 uppercase tracking-widest mb-2">
              Descrição do Problema
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
              className="w-full px-4 py-3 bg-white border border-gray-300 text-[#003366] placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none resize-none h-32 transition-all font-medium"
              placeholder="Descreva o que ocorreu durante a aula..."
              required
            />
          </div>
        </div>
        
        <div className="bg-blue-700 p-5 border-t border-blue-600 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-400 bg-transparent border border-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !descricao.trim()}
            className="px-5 py-2.5 bg-ms-red text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 active:scale-95"
          >
            {loading ? 'Salvando...' : 'Salvar Ocorrência'}
          </button>
        </div>
      </div>
    </div>
  );
}
