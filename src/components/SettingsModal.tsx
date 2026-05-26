import { useState, useEffect } from 'react';
import { X, ToggleLeft, ToggleRight, Loader2, BookOpen, Calculator, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  professor: Professor | null;
  onUpdate: (updated: Professor) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function SettingsModal({ isOpen, onClose, professor, onUpdate, theme, onToggleTheme }: SettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('global');

  useEffect(() => {
    if (isOpen && professor) {
      supabase.from('lista_para_vistos')
        .select('turma_id, turma_nome')
        .eq('professor_id', professor.id)
        .then(({ data }) => {
          if (data) {
             const uniqueTurmas = Array.from(new Map(data.map(item => [item.turma_id, item])).values());
             setTurmas(uniqueTurmas.map(t => ({ id: t.turma_id, nome: t.turma_nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
          }
        });
    }
  }, [isOpen, professor]);

  if (!isOpen || !professor) return null;

  const handleUpdateConfig = async (rawUpdates: Partial<Professor>) => {
    setLoading(true);
    
    let updates: Partial<Professor> = { ...rawUpdates };
    
    if (selectedTurmaId !== 'global') {
      const hasMethod = 'config_visto_metodo' in rawUpdates;
      const hasValor = 'config_visto_valor_total' in rawUpdates;
      
      if (hasMethod || hasValor) {
        const currentTurmasConfig = professor.config_turmas || {};
        const currentTurmaConfig = currentTurmasConfig[selectedTurmaId] || {
          config_visto_metodo: professor.config_visto_metodo,
          config_visto_valor_total: professor.config_visto_valor_total
        };
        
        delete updates.config_visto_metodo;
        delete updates.config_visto_valor_total;
        
        updates.config_turmas = {
          ...currentTurmasConfig,
          [selectedTurmaId]: {
            ...currentTurmaConfig,
            ...(hasMethod ? { config_visto_metodo: rawUpdates.config_visto_metodo as any } : {}),
            ...(hasValor ? { config_visto_valor_total: rawUpdates.config_visto_valor_total as any } : {})
          }
        };
      }
    }

    // Atualiza localmente no localStorage primeiro para garantia total
    const configKey = `portal-config-${professor.user_id}`;
    const currentConfig = {
      config_visto_metodo: professor.config_visto_metodo,
      config_visto_valor_total: professor.config_visto_valor_total,
      bimestre_atual: professor.bimestre_atual,
      theme,
      ...updates
    };
    localStorage.setItem(configKey, JSON.stringify(currentConfig));

    const { error } = await supabase
      .from('professores')
      .update(updates)
      .eq('user_id', professor.user_id);

    if (!error) {
      onUpdate({ ...professor, ...updates });
    } else {
      console.error('Error updating config', error);
      // Mesmo com erro no banco, atualizamos a interface para o professor não perder o trabalho
      onUpdate({ ...professor, ...updates });
    }
    setLoading(false);
  };

  const currentMetodo = selectedTurmaId === 'global'
    ? professor.config_visto_metodo
    : (professor.config_turmas?.[selectedTurmaId]?.config_visto_metodo || professor.config_visto_metodo);

  const currentValor = selectedTurmaId === 'global'
    ? professor.config_visto_valor_total
    : (professor.config_turmas?.[selectedTurmaId]?.config_visto_valor_total || professor.config_visto_valor_total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`${theme === 'light' ? 'bg-white' : 'bg-ms-card'} rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border ${theme === 'light' ? 'border-blue-100' : 'border-ms-border'} animate-in fade-in zoom-in duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${theme === 'light' ? 'border-blue-100' : 'border-gray-800'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-blue-900' : 'text-white'} uppercase tracking-tight`}>Configurações Acadêmicas</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ms-muted hover:text-ms-main hover:bg-ms-dark/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Seletor de Turma Global/Individual */}
          <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-900/40 border-gray-800'}`}>
            <label className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-3 ${theme === 'light' ? 'text-blue-800 font-extrabold' : 'text-blue-200'}`}>
               Aplicar Configurações De Visto Em:
            </label>
            <select 
              value={selectedTurmaId}
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-all ${
                theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-ms-dark border-gray-700 text-white'
              }`}
            >
              <option value="global">Todas as Turmas (Padrão)</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>

          {/* Seção 1: Bimestre e Notas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-900/40 border-gray-800'}`}>
              <label className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-3 ${theme === 'light' ? 'text-blue-800 font-extrabold' : 'text-blue-200'}`}>
                <CalendarDays className="w-3 h-3" /> Bimestre Atual
              </label>
              <select 
                value={professor.bimestre_atual}
                onChange={(e) => handleUpdateConfig({ bimestre_atual: parseInt(e.target.value) })}
                className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-all ${
                  theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-ms-dark border-gray-700 text-white'
                }`}
              >
                <option value={1}>1º Bimestre</option>
                <option value={2}>2º Bimestre</option>
                <option value={3}>3º Bimestre</option>
                <option value={4}>4º Bimestre</option>
              </select>
            </div>

            <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-900/40 border-gray-800'}`}>
              <label className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mb-3 ${theme === 'light' ? 'text-blue-800 font-extrabold' : 'text-blue-200'}`}>
                <Calculator className="w-3 h-3" /> Valor Total Vistos
              </label>
              <input 
                type="number"
                step="0.5"
                value={currentValor}
                onChange={(e) => handleUpdateConfig({ config_visto_valor_total: parseFloat(e.target.value) })}
                className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-all ${
                  theme === 'light' ? 'bg-white border-blue-200 text-blue-900' : 'bg-ms-dark border-gray-700 text-white'
                }`}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-blue-800 font-extrabold' : 'text-blue-200'}`}>Método de Lançamento de Vistos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'gradual', label: 'Gradual (0 / 0,5 / 1,0)', desc: 'Para atividades parciais' },
                { id: 'simbolico', label: 'Simbólico (+ / -)', desc: '+ feito, - não realizado' },
                { id: 'aberto', label: 'Campo Aberto (0-10)', desc: 'Notas numéricas diretas' },
                { id: 'ponto', label: 'Ponto (.)', desc: '. feito, vazio não realizado' },
              ].map((metodo) => (
                <button
                  key={metodo.id}
                  onClick={() => handleUpdateConfig({ config_visto_metodo: metodo.id as any })}
                  className={`p-4 rounded-xl border text-left transition-all group ${
                    currentMetodo === metodo.id 
                      ? (theme === 'light' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-blue-600/20 border-blue-500 shadow-lg')
                      : (theme === 'light' ? 'bg-white border-blue-100 hover:border-blue-300' : 'bg-gray-900/40 border-gray-800 hover:border-gray-700')
                  }`}
                >
                  <span className={`text-xs font-bold block mb-1 ${
                    currentMetodo === metodo.id 
                      ? (theme === 'light' ? 'text-white' : 'text-blue-400') 
                      : (theme === 'light' ? 'text-blue-900' : 'text-white')
                  }`}>
                    {metodo.label}
                  </span>
                  <span className={`text-[10px] leading-tight block ${
                    currentMetodo === metodo.id 
                      ? (theme === 'light' ? 'text-blue-100' : 'text-blue-300/60') 
                      : (theme === 'light' ? 'text-blue-600 font-semibold' : 'text-blue-200')
                  }`}>
                    {metodo.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-4 pt-4 border-t ${theme === 'light' ? 'border-blue-100' : 'border-gray-800'}`}>
             <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Chamada Interna</h4>
                  <p className={`text-[10px] ${theme === 'light' ? 'text-blue-600 font-medium' : 'text-blue-200'}`}>Ativa o diário de presença/falta</p>
                </div>
                <button
                  onClick={() => handleUpdateConfig({ habilitar_chamada_interna: !professor.habilitar_chamada_interna })}
                  disabled={loading}
                  className="transition-transform active:scale-95 disabled:opacity-50"
                >
                  {professor.habilitar_chamada_interna ? (
                    <ToggleRight className="w-10 h-10 text-ms-blue" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-700" />
                  )}
                </button>
             </div>

             <div className={`flex items-center justify-between border-t ${theme === 'light' ? 'border-blue-100' : 'border-gray-800'} pt-4`}>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Tema do Portal</h4>
                  <p className={`text-[10px] ${theme === 'light' ? 'text-blue-600 font-medium' : 'text-blue-200'}`}>Alternar modo claro/escuro</p>
                </div>
                <button
                  onClick={onToggleTheme}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-blue-600 text-blue-900'
                  }`}
                >
                  {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                </button>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-5 border-t ${theme === 'light' ? 'bg-blue-50/70 border-blue-100' : 'bg-gray-900/50 border-gray-800'}`}>
          <button
            onClick={onClose}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmar e Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
