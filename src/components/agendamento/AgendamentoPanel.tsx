import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { RecursosTab } from './RecursosTab';
import { BloqueiosTab } from './BloqueiosTab';
import { MinhasReservasTab } from './MinhasReservasTab';
import { DisponibilidadeTab } from './DisponibilidadeTab';
import { AprovacaoTab } from './AprovacaoTab';
import { RelatoriosTab } from './RelatoriosTab';
import { SeriesTab } from './SeriesTab';
import { DashboardDiaTab } from './DashboardDiaTab';
import { CamposPersonalizadosTab } from './CamposPersonalizadosTab';
import { ImportacaoCSVTab } from './ImportacaoCSVTab';
import { AgendaTurmaTab } from './AgendaTurmaTab';

type Aba =
  | 'minhas-reservas'
  | 'agenda-turma'
  | 'disponibilidade'
  | 'aprovacao'
  | 'recursos'
  | 'bloqueios'
  | 'series'
  | 'dashboard-dia'
  | 'relatorios'
  | 'importacao'
  | 'campos-personalizados';

// Módulo completo: fluxo de reserva (Etapa 4), aprovação/notificações/tempo real
// (Etapa 5), CRUD de recursos/bloqueios (Etapa 2) e relatórios (Etapa 6).
export function AgendamentoPanel() {
  const { hasAnyRole } = useAuth();
  const ehStaff = hasAnyRole(['COORDENACAO', 'GESTAO', 'PCPI']);

  // Link direto vindo da home pública (?modulo=agendamento&recurso=<id>), já
  // autenticado — abre direto em "Minhas Reservas" com o formulário pré-preenchido.
  const recursoDaUrl = new URLSearchParams(window.location.search).get('recurso');

  const [aba, setAba] = useState<Aba>('minhas-reservas');

  const abas: { id: Aba; label: string; somenteStaff?: boolean }[] = [
    { id: 'minhas-reservas', label: 'Minhas Reservas' },
    { id: 'agenda-turma', label: 'Agenda da Turma' },
    { id: 'disponibilidade', label: 'Disponibilidade' },
    { id: 'aprovacao', label: 'Aprovação', somenteStaff: true },
    { id: 'recursos', label: 'Recursos', somenteStaff: true },
    { id: 'bloqueios', label: 'Bloqueios/Liberação', somenteStaff: true },
    { id: 'series', label: 'Aulas Fixas', somenteStaff: true },
    { id: 'dashboard-dia', label: 'Agendamentos do Dia', somenteStaff: true },
    { id: 'relatorios', label: 'Relatórios', somenteStaff: true },
    { id: 'importacao', label: 'Importar CSV', somenteStaff: true },
    { id: 'campos-personalizados', label: 'Campos Personalizados', somenteStaff: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {abas
          .filter((a) => !a.somenteStaff || ehStaff)
          .map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? 'page' : undefined}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                aba === a.id
                  ? 'bg-ms-blue text-white shadow-md shadow-blue-900/20'
                  : 'bg-white dark:bg-ms-card text-ms-blue dark:text-gray-300 hover:bg-ms-blue/10 hover:text-ms-blue border border-ms-blue/30 dark:border-gray-700 shadow-sm'
              }`}
            >
              {a.label}
            </button>
          ))}
      </div>

      {aba === 'minhas-reservas' && <MinhasReservasTab recursoIdInicial={recursoDaUrl} />}
      {aba === 'agenda-turma' && <AgendaTurmaTab />}
      {aba === 'disponibilidade' && <DisponibilidadeTab />}
      {aba === 'aprovacao' && ehStaff && <AprovacaoTab />}
      {aba === 'recursos' && ehStaff && <RecursosTab />}
      {aba === 'bloqueios' && ehStaff && <BloqueiosTab />}
      {aba === 'series' && ehStaff && <SeriesTab />}
      {aba === 'dashboard-dia' && ehStaff && <DashboardDiaTab />}
      {aba === 'relatorios' && ehStaff && <RelatoriosTab />}
      {aba === 'importacao' && ehStaff && <ImportacaoCSVTab />}
      {aba === 'campos-personalizados' && ehStaff && <CamposPersonalizadosTab />}
    </div>
  );
}
