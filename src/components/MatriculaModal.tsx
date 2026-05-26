import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { UserPlus, Calendar, ShieldCheck, Loader2 } from 'lucide-react';

interface MatriculaModalProps {
  isOpen: boolean;
  onClose: () => void;
  alunoId: string;
  alunoNome: string;
  onUpdate: () => void;
}

export function MatriculaModal({ isOpen, onClose, alunoId, alunoNome, onUpdate }: MatriculaModalProps) {
  const [bimestreEntrada, setBimestreEntrada] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMatricula() {
      const { data } = await supabase.from('matricula_info').select('bimestre_entrada').eq('aluno_id', alunoId).maybeSingle();
      if (data) setBimestreEntrada(data.bimestre_entrada);
    }
    if (isOpen) fetchMatricula();
  }, [isOpen, alunoId]);

  const handleSave = async () => {
    setLoading(true);
    await supabase.from('matricula_info').upsert({
      aluno_id: alunoId,
      bimestre_entrada: bimestreEntrada
    }, { onConflict: 'aluno_id' });
    setLoading(false);
    onUpdate();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-ms-card rounded-2xl border border-ms-border w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
        <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-white" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Informação de Matrícula</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Aluno</p>
            <p className="text-white font-bold">{alunoNome}</p>
          </div>

          <div className="p-4 bg-ms-dark/20 rounded-xl border border-gray-800">
            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              <Calendar className="w-3 h-3" /> Bimestre de Entrada na Escola
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(b => (
                <button
                  key={b}
                  onClick={() => setBimestreEntrada(b)}
                  className={`py-3 rounded-lg text-xs font-black transition-all ${
                    bimestreEntrada === b ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {b}º
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-500 mt-4 leading-relaxed italic">
              * O sistema calculará a média proporcional automaticamente (Ex: Entrada no 2º Bimestre ➔ Meta de 18 pontos).
            </p>
          </div>
        </div>

        <div className="p-6 bg-gray-900/50 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleSave} 
            className="flex-1 py-3 bg-ms-blue text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-900/40 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Salvar Configuração</>}
          </button>
        </div>
      </div>
    </div>
  );
}
