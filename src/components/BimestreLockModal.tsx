import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Unlock, Loader2, Save, X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface BimestreLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onUpdate?: () => void;
}

export function BimestreLockModal({ isOpen, onClose, theme, onUpdate }: BimestreLockModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockedBimestres, setLockedBimestres] = useState<number[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLockConfig();
    }
  }, [isOpen]);

  async function loadLockConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_avisos')
        .select('*')
        .eq('titulo', 'BIMESTRES_BLOQUEADOS')
        .eq('cor_alerta', 'config')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        if (data.mensagem) {
          try {
            const parsed = JSON.parse(data.mensagem);
            if (Array.isArray(parsed)) {
              setLockedBimestres(parsed.map(Number));
            }
          } catch {
            setLockedBimestres([]);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar configuração de bimestres bloqueados:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleLock = (b: number) => {
    setLockedBimestres(prev =>
      prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const serialized = JSON.stringify(lockedBimestres);

      if (configId) {
        const { error } = await supabase
          .from('landing_avisos')
          .update({ mensagem: serialized })
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('landing_avisos')
          .insert([{
            titulo: 'BIMESTRES_BLOQUEADOS',
            mensagem: serialized,
            cor_alerta: 'config'
          }]);
        if (error) throw error;
      }

      if (onUpdate) onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar travamento de bimestres:', err);
      alert('Erro ao salvar configuração: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-md rounded-[2.5rem] border shadow-2xl overflow-hidden scale-in animate-in duration-300 ${
        theme === 'light' ? 'bg-white border-blue-100' : 'bg-ms-card border-ms-border'
      }`}>
        {/* Header */}
        <div className="px-8 py-6 border-b border-ms-border flex items-center justify-between bg-gradient-to-r from-red-650/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
              <Lock className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>
                Bloqueio de Bimestres
              </h3>
              <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-widest">
                Encerramento de Lançamentos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="bg-red-500/5 border border-red-500/25 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-red-400">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <strong className="text-red-500 block mb-1">Atenção Coordenação</strong>
              Bimestres bloqueados não permitirão que os **professores** criem, alterem ou excluam notas, vistos ou diários de classe. Somente a coordenação poderá editá-los.
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-2" />
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Buscando configurações...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(b => {
                const isLocked = lockedBimestres.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => handleToggleLock(b)}
                    className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${
                      isLocked
                        ? 'bg-red-500/10 border-red-500/50 hover:bg-red-500/15'
                        : theme === 'light'
                          ? 'bg-white border-blue-100 hover:border-blue-300 text-blue-900'
                          : 'bg-ms-dark/30 border-ms-border hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                        isLocked
                          ? 'bg-red-500 border-red-650 text-white shadow-lg shadow-red-950/20'
                          : 'bg-gray-800/40 border-gray-700/50 text-gray-500 group-hover:text-gray-300'
                      }`}>
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </div>
                      <span className={`text-sm font-black ${isLocked ? 'text-red-500' : 'text-ms-main'}`}>
                        {b}º Bimestre
                      </span>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border ${
                      isLocked
                        ? 'bg-red-500/10 border-red-500/20 text-red-500'
                        : 'bg-green-500/10 border-green-500/20 text-green-500'
                    }`}>
                      {isLocked ? 'Bloqueado' : 'Aberto'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-900/30 border-t border-ms-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-900/40 hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar Bloqueios</>}
          </button>
        </div>
      </div>
    </div>
  );
}
