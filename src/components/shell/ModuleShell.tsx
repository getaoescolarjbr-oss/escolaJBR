import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { modulosVisiveis } from '../../config/moduleNav';

interface ModuleShellProps {
  activeModulo: string;
  titulo: string;
  subtitulo?: string;
  onNavigate: (modulo: string) => void;
  onVoltarInicio: () => void;
  children: ReactNode;
}

// Shell compartilhado (cabeçalho + menu lateral por módulo + área de conteúdo) que
// os próximos módulos administrativos (Secretaria, Cozinha, Biblioteca, Agendamento)
// devem reutilizar em vez de reimplementar o próprio header/sidebar. O menu só
// mostra os módulos permitidos ao papel do usuário logado (config/moduleNav.ts) —
// a checagem de UI é só conveniência, o bloqueio de verdade é a RLS no Postgres.
export function ModuleShell({ activeModulo, titulo, subtitulo, onNavigate, onVoltarInicio, children }: ModuleShellProps) {
  const { hasAnyRole } = useAuth();
  const modulos = modulosVisiveis(hasAnyRole);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-ms-dark rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl animate-in fade-in zoom-in duration-300 w-full">
      <div className="px-4 py-4 md:px-8 md:py-6 bg-ms-card border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onVoltarInicio}
            aria-label="Voltar ao início"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-ms-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-ms-main tracking-tight">{titulo}</h1>
            {subtitulo && <p className="text-xs md:text-sm text-ms-muted font-bold">{subtitulo}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <nav
          aria-label="Módulos"
          className="w-full md:w-64 bg-ms-header border-b md:border-b-0 md:border-r border-white/10 flex flex-row md:flex-col shadow-xl z-10 p-3 md:p-4 gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar"
        >
          {modulos.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={item.id === activeModulo ? 'page' : undefined}
              className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-xl font-bold transition-all shrink-0 whitespace-nowrap text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                item.id === activeModulo
                  ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-950/50'
                  : 'text-blue-100 hover:bg-white/15 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4 md:w-5 md:h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-ms-dark">{children}</div>
      </div>
    </div>
  );
}
