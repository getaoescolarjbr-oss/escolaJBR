import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { signInWithPassword, registerFirstAccess, resetPassword } from '../services/authService';
import { AlunoAuth } from './AlunoAuth';

interface LoginProps {
  onLogin: () => void;
  onBack?: () => void;
  // 'aluno' abre já no modo BiblioClube (atalho "Biblioteca" da home pública).
  modoInicial?: 'servidor' | 'aluno';
}

type ViewState = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export function Login({ onLogin, onBack, modoInicial = 'servidor' }: LoginProps) {
  const [modoAluno, setModoAluno] = useState(modoInicial === 'aluno');
  const [view, setView] = useState<ViewState>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (view === 'LOGIN') {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
        onLogin();
      }
      
      else if (view === 'REGISTER') {
        // 1. Verifica se o professor existe na base da escola.
        //
        // Por RPC, e não por SELECT direto: a consulta acontece antes de existir sessão,
        // entao ler `professores` aqui exigia deixar a tabela legivel sem login — e isso
        // entregava os 67 e-mails da escola a quem pedisse. A RPC responde so sim ou nao
        // (ver fechar_exposicao_anon.sql).
        const { data: ehProfessor, error: profError } = await supabase
          .rpc('rpc_email_de_professor_existe', { p_email: email });
        if (profError) throw profError;

        const isAdminEmail = email === 'gestaoescolarjbr@gmail.com';

        if (!ehProfessor && !isAdminEmail) {
          throw new Error("E-mail não encontrado na base de professores da escola.");
        }

        // 2. Cria o usuário no auth
        const { data: authData, error: authError } = await registerFirstAccess(email, password);

        if (authError) throw authError;

        if (authData.user) {
          if (ehProfessor) {
            // Vincula pelo e-mail: sem o SELECT anterior nao ha mais o id em maos. A
            // policy "Permitir auto-vinculacao no primeiro acesso" ja restringe a linha
            // ao e-mail do proprio token, entao o filtro aqui e conveniencia, nao a
            // barreira.
            const { error: updateError } = await supabase
              .from('professores')
              .update({ user_id: authData.user.id })
              .eq('email', email);

            if (updateError) throw updateError;
          }
          
          setSuccess("Cadastro realizado com sucesso! Você já pode fazer o login.");
          setView('LOGIN');
          setPassword('');
        }
      } 
      
      else if (view === 'FORGOT_PASSWORD') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccess("Instruções de recuperação enviadas para o seu e-mail.");
        setView('LOGIN');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  if (modoAluno) {
    return <AlunoAuth onLogin={onLogin} onVoltar={() => setModoAluno(false)} onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Botão Voltar para o Site - Agora no topo esquerdo */}
      {onBack && (
        <button 
          type="button" 
          onClick={onBack} 
          className="absolute top-8 left-8 z-50 text-[#003366] hover:text-[#002677] flex items-center gap-2 transition-all font-black text-sm bg-white px-4 py-2 rounded-xl border border-[#003366]/20 shadow-sm hover:shadow-md active:scale-95"
        >
          &larr; Voltar para o Site
        </button>
      )}

      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ms-blue/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ms-blue/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Header do Card - Cor alterada para #003366 */}
          <div className="bg-[#003366] border-b border-white/10 px-8 py-10 text-center">
            <img src="/logo.png.png" alt="Logo" className="mx-auto w-32 h-auto object-contain mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Portal do Servidor</h2>
            <p className="text-blue-100/60 mt-2 text-sm">
              {view === 'LOGIN' ? "Faça login com seu e-mail institucional" : 
               view === 'REGISTER' ? "Primeiro Acesso: Crie sua senha" : 
               "Recuperação de Senha"}
            </p>
          </div>

          {/* Formulário */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#003366] uppercase tracking-widest mb-2">
                  E-mail Institucional
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="professor@escola.edu.br"
                  className="w-full px-4 py-3 bg-[#F0F2F5] border border-[#003366]/30 text-[#003366] rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none transition-all placeholder:text-gray-400 font-medium"
                />
              </div>

              {(view === 'LOGIN' || view === 'REGISTER') && (
                <div>
                  <label className="block text-xs font-bold text-[#003366] uppercase tracking-widest mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 bg-[#F0F2F5] border border-[#003366]/30 text-[#003366] rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#003366] transition-colors"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-950/20 border border-green-900/50 rounded-lg text-sm text-green-400">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ms-blue hover:bg-blue-700 text-white font-bold uppercase tracking-widest py-4 px-4 rounded-lg transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Aguarde...
                  </>
                ) : (
                  view === 'LOGIN' ? 'Entrar no Sistema' : 
                  view === 'REGISTER' ? 'Cadastrar e Entrar' : 
                  'Enviar Recuperação'
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 text-center text-sm">
          {view === 'LOGIN' ? (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => { setView('FORGOT_PASSWORD'); setError(null); setSuccess(null); }} className="text-blue-600 hover:text-blue-800 transition-colors font-medium">
                Esqueceu a senha?
              </button>
              <button type="button" onClick={() => { setView('REGISTER'); setError(null); setSuccess(null); }} className="text-gray-600 hover:text-gray-800 transition-colors">
                Primeiro acesso? <span className="font-bold text-ms-blueText underline decoration-ms-blue/30 underline-offset-4">Cadastre sua senha</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setView('LOGIN'); setError(null); setSuccess(null); }} className="text-gray-600 hover:text-blue-900 flex items-center justify-center gap-2 transition-colors font-bold">
              &larr; Voltar para o Login
            </button>
          )}
          <button type="button" onClick={() => setModoAluno(true)} className="text-gray-500 hover:text-gray-700 transition-colors text-xs">
            É aluno da escola? <span className="font-bold text-ms-blueText underline decoration-ms-blue/30 underline-offset-4">Entrar no BiblioClube</span>
          </button>
        </div>
      </div>
    </div>
  );
}
