import { useEffect, useState } from 'react';
import { Loader2, CalendarClock } from 'lucide-react';
import type { Recurso } from '../../types/agendamento';
import { listarRecursos } from '../../services/agendamentoService';
import { AgendaPublicaModal } from '../AgendaPublicaModal';

// Mesmo componente usado na home pública (?home=1) — a disponibilidade em si não
// muda por estar logado, só o botão "Agendar" dentro dele passa a abrir o
// formulário de reserva de verdade (o componente já sabe checar sessão/papel).
export function DisponibilidadeTab() {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [recursoAberto, setRecursoAberto] = useState<Recurso | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      listarRecursos().then(setRecursos).finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {recursos.map((r) => (
        <button
          key={r.id}
          onClick={() => setRecursoAberto(r)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-ms-blue/50 dark:hover:border-ms-blueText/50 shadow-sm transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: r.cor ?? '#2563eb' }} />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-ms-main group-hover:text-ms-blue dark:group-hover:text-ms-blueText transition-colors">{r.nome}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{r.local || 'Sem local definido'}</p>
            </div>
          </div>
          <CalendarClock className="w-5 h-5 text-gray-400 group-hover:text-ms-blue dark:group-hover:text-ms-blueText transition-colors" />
        </button>
      ))}

      <AgendaPublicaModal recurso={recursoAberto} onClose={() => setRecursoAberto(null)} />
    </div>
  );
}
