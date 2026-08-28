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
          className="w-full flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl hover:border-ms-blueText/50 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.cor ?? '#2563eb' }} />
            <div>
              <p className="text-sm font-bold text-ms-main">{r.nome}</p>
              <p className="text-[10px] text-gray-500">{r.local || 'sem local definido'}</p>
            </div>
          </div>
          <CalendarClock className="w-4 h-4 text-gray-500" />
        </button>
      ))}

      <AgendaPublicaModal recurso={recursoAberto} onClose={() => setRecursoAberto(null)} />
    </div>
  );
}
