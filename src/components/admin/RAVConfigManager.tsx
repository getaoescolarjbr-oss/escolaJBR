import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Save, Loader2, CheckCircle, HelpCircle, Calendar, Layers } from 'lucide-react';

interface RAVConfigManagerProps {
  theme: 'dark' | 'light';
}

export function RAVConfigManager({ theme }: RAVConfigManagerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'bimestral' | 'semestral'>('bimestral');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('landing_avisos')
          .select('*')
          .eq('titulo', 'RAV_CONFIG')
          .eq('cor_alerta', 'config')
          .maybeSingle();

        if (!error && data && data.mensagem) {
          const val = data.mensagem.trim() as 'bimestral' | 'semestral';
          setMode(val);
          localStorage.setItem('school-rav-mode', val);
        } else {
          // Fallback to local storage or default
          const cached = localStorage.getItem('school-rav-mode') as 'bimestral' | 'semestral';
          if (cached) {
            setMode(cached);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar configuração do RAV:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      // Sempre salva localmente (fallback garantido)
      localStorage.setItem('school-rav-mode', mode);

      // 1. Verifica se já existe um registro de configuração do RAV
      const { data: existing, error: selectError } = await supabase
        .from('landing_avisos')
        .select('id')
        .eq('titulo', 'RAV_CONFIG')
        .eq('cor_alerta', 'config')
        .maybeSingle();

      if (selectError) {
        console.error('[RAV] Erro ao verificar registro existente:', selectError);
        throw selectError;
      }

      if (existing?.id) {
        // 2a. Atualiza o registro existente
        const { error: updateError } = await supabase
          .from('landing_avisos')
          .update({ mensagem: mode })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[RAV] Erro no UPDATE:', updateError);
          throw updateError;
        }
      } else {
        // 2b. Cria novo registro de configuração
        const payload = {
          titulo: 'RAV_CONFIG',
          mensagem: mode,
          cor_alerta: 'config',
        };
        console.log('[RAV] Inserindo novo registro:', payload);

        const { error: insertError } = await supabase
          .from('landing_avisos')
          .insert([payload]);

        if (insertError) {
          console.error('[RAV] Erro no INSERT:', insertError);
          // Se for erro de RLS/permissão, mostra mensagem específica
          const msg = (insertError as any)?.message || JSON.stringify(insertError);
          throw new Error(`Erro ao inserir: ${msg}`);
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('[RAV] Falha ao salvar:', err);
      const detail = err?.message || err?.details || JSON.stringify(err);
      alert(`Erro ao salvar configuração do RAV:\n\n${detail}\n\nA configuração foi salva localmente e será usada até que a sincronização seja corrigida.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-ms-card rounded-3xl border border-ms-border overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-ms-border bg-ms-dark/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-ms-blue/20 flex items-center justify-center text-ms-blueText border border-ms-blueText/30 shadow-lg">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-ms-main tracking-tight">Parâmetros do RAV</h2>
            <p className="text-xs text-[#003366] font-bold uppercase tracking-wider">Configuração de Regras da Recuperação Letiva (Recuperar para Avançar)</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-ms-blueText mb-4" />
            <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest">Carregando parâmetros...</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            <div>
              <label className="block text-[11px] font-black text-ms-blueText uppercase tracking-widest mb-4">Escolha o Modelo de Recuperação Ativo</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option Bimestral */}
                <button
                  type="button"
                  onClick={() => setMode('bimestral')}
                  className={`p-6 rounded-3xl border-2 text-left transition-all relative flex flex-col gap-4 shadow-lg group ${
                    mode === 'bimestral'
                      ? 'bg-ms-blue/15 border-ms-blueText shadow-[0_0_20px_rgba(0,38,119,0.15)]'
                      : theme === 'light'
                        ? 'bg-white border-blue-100 hover:border-blue-300 text-blue-900'
                        : 'bg-ms-dark/50 border-ms-border hover:border-gray-700 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-3 rounded-2xl flex items-center justify-center ${
                      mode === 'bimestral' ? 'bg-ms-blue text-white shadow-md' : 'bg-gray-800/40 text-gray-500 group-hover:text-gray-300'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      mode === 'bimestral' ? 'border-ms-blueText bg-ms-blue' : 'border-gray-600'
                    }`}>
                      {mode === 'bimestral' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-base font-black tracking-tight ${
                      mode === 'bimestral' ? 'text-ms-blueText' : theme === 'light' ? 'text-blue-900' : 'text-white'
                    }`}>Recuperação Bimestral</h3>
                    <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">
                      O processo de recuperação ocorre ao final de **cada bimestre** de forma isolada. 
                      Alunos com média final inferior a **6.0** entram de recuperação no respectivo bimestre.
                    </p>
                  </div>
                </button>

                {/* Option Semestral */}
                <button
                  type="button"
                  onClick={() => setMode('semestral')}
                  className={`p-6 rounded-3xl border-2 text-left transition-all relative flex flex-col gap-4 shadow-lg group ${
                    mode === 'semestral'
                      ? 'bg-ms-blue/15 border-ms-blueText shadow-[0_0_20px_rgba(0,38,119,0.15)]'
                      : theme === 'light'
                        ? 'bg-white border-blue-100 hover:border-blue-300 text-blue-900'
                        : 'bg-ms-dark/50 border-ms-border hover:border-gray-700 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-3 rounded-2xl flex items-center justify-center ${
                      mode === 'semestral' ? 'bg-ms-blue text-white shadow-md' : 'bg-gray-800/40 text-gray-500 group-hover:text-gray-300'
                    }`}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      mode === 'semestral' ? 'border-ms-blueText bg-ms-blue' : 'border-gray-600'
                    }`}>
                      {mode === 'semestral' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-base font-black tracking-tight ${
                      mode === 'semestral' ? 'text-ms-blueText' : theme === 'light' ? 'text-blue-900' : 'text-white'
                    }`}>Recuperação Semestral</h3>
                    <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">
                      O processo de recuperação ocorre ao final de **cada semestre** (2º e 4º bimestres).
                      Alunos com média semestral inferior a **6.0** entram de RAV. O diário calcula e mostra a nota necessária no bimestre vigente para recuperar o semestre.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Explanatory Box */}
            <div className="bg-ms-dark/30 rounded-2xl border border-ms-border p-6 flex gap-4 text-xs text-gray-500 leading-relaxed shadow-inner">
              <HelpCircle className="w-6 h-6 text-[#d4af37] flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="text-gray-400 block mb-1">Como funciona a regra matemática?</strong>
                {mode === 'bimestral' ? (
                  <p>
                    No modelo **Bimestral**, o diário lista no bimestre ativo os alunos que não obtiveram 6,0 pontos de média bimestral consolidada. O professor registra a nota de recuperação e o sistema atualiza o respectivo bimestre.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      No modelo **Semestral**, avalia-se a média do semestre completo:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>1º Semestre (2º Bimestre):</strong> Média = <code className="bg-ms-dark px-1 py-0.5 rounded text-blue-400">(B1 + B2) / 2</code>. Nota necessária no bimestre vigente (B2) para fechar com média 6,0 = <code className="bg-ms-dark px-1 py-0.5 rounded text-ms-gold">12.0 - B1</code>.</li>
                      <li><strong>2º Semestre (4º Bimestre):</strong> Média = <code className="bg-ms-dark px-1 py-0.5 rounded text-blue-400">(B3 + B4) / 2</code>. Nota necessária no bimestre vigente (B4) para fechar com média 6,0 = <code className="bg-ms-dark px-1 py-0.5 rounded text-ms-gold">12.0 - B3</code>.</li>
                      <li><strong>Alerta Especial Anual (4º Bimestre):</strong> Para alunos cujo 1º semestre foi muito baixo, mesmo que atinjam a média 6,0 no 2º semestre, eles podem ser reprovados ou encaminhados para Exame Final. A ferramenta calcula de forma inteligente a nota exata necessária no B4 para aprovação anual direta (24 pontos consolidados) = <code className="bg-ms-dark px-1 py-0.5 rounded text-emerald-400">24.0 - (B1 + B2 + B3)</code>.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-ms-border/50">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3.5 bg-ms-blue hover:bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Salvar Parâmetros
                  </>
                )}
              </button>

              {success && (
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs animate-in fade-in zoom-in duration-200">
                  <CheckCircle className="w-4 h-4" /> Configuração salva com sucesso!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
