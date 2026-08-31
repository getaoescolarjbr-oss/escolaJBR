import { useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { SettingsModal } from './SettingsModal';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  professor: Professor | null;
  onLogout: () => void;
  onUpdateProfessor: (updated: Professor) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isAdmin?: boolean;
  contexto?: string;
  onNavegarView?: (view: string) => void;
  viewAtual?: string;
  podeAcessarCoordenacaoArea?: boolean;
}

export function Header({
  professor,
  onLogout,
  onUpdateProfessor,
  theme,
  onToggleTheme,
  isAdmin,
  contexto,
  onNavegarView,
  viewAtual,
  podeAcessarCoordenacaoArea,
}: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const estaNaCoordenacaoArea = viewAtual === 'coordenacao-area';

  return (
    <>
    <header className="bg-ms-header border-b border-white/10 shadow-lg sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo area */}
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.location.href = '/?home=1'}
              title="Voltar à página inicial"
            >
              <img src="/logo.png.png" alt="Logo" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-white hidden sm:block">
                  {isAdmin
                    ? 'Portal do Administrador'
                    : estaNaCoordenacaoArea
                    ? 'Coordenação de Área'
                    : professor?.cargo?.toLowerCase() === 'coordenador'
                    ? 'Portal do Coordenador'
                    : professor?.cargo?.toLowerCase() === 'diretor'
                    ? 'Portal do Diretor'
                    : professor?.cargo?.toLowerCase() === 'vice-diretor'
                    ? 'Portal do Vice-Diretor'
                    : professor?.cargo?.toLowerCase() === 'administrador' || professor?.cargo?.toLowerCase() === 'admin'
                    ? 'Portal do Administrador'
                    : professor?.cargo?.toLowerCase()?.startsWith('administrativo')
                    ? 'Portal do Servidor'
                    : 'Portal do Professor'}
                </h1>
                <p className="text-xs text-blue-200 hidden sm:block">Sistema de Gestão Escolar</p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3 sm:gap-4">
              {podeAcessarCoordenacaoArea && onNavegarView && (
                <button
                  onClick={() => onNavegarView(estaNaCoordenacaoArea ? 'dashboard' : 'coordenacao-area')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm border ${
                    estaNaCoordenacaoArea
                      ? 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                      : 'bg-ms-blue text-white border-blue-500 hover:bg-blue-600 shadow-blue-900/30'
                  }`}
                  title={estaNaCoordenacaoArea ? 'Voltar para suas turmas e diários' : 'Acessar a Coordenação de Área'}
                >
                  <span>{estaNaCoordenacaoArea ? '← Ver Minhas Turmas' : 'Coordenação de Área'}</span>
                </button>
              )}

              {(professor || isAdmin) && (
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold text-white">
                    {professor ? professor.nome : 'Administrador JBR'}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-blue-200">
                      {contexto || (professor ? professor.cargo : 'Administrador')}
                    </span>
                    {professor?.area_conhecimento && (
                      <span className="text-[10px] bg-ms-blue/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium mt-0.5 border border-blue-800">
                        {professor.area_conhecimento}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <NotificationBell />

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-blue-200 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  title="Configurações"
                >
                  <Settings className="w-5 h-5" />
                </button>
  
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        professor={professor}
        onUpdate={onUpdateProfessor}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </>
  );
}
