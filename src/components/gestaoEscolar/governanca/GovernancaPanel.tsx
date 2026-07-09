import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { OrgaosTab } from './OrgaosTab';
import { ReunioesTab } from './ReunioesTab';
import { ComunicadosTab } from './ComunicadosTab';

type Aba = 'orgaos' | 'reunioes' | 'comunicados';

// Governança colegiada (Colegiado Escolar, APM, Grêmio): composição, mandatos,
// reuniões e atas (via o motor da Fase 5a) + comunicação institucional (via avisos/
// push já existentes). Ver create_gestao_governanca_schema.sql.
//
// RBAC (confirmado no schema): GESTAO gerencia órgãos/membros/reuniões; COORDENACAO/
// SECRETARIA só apoiam em COMUNICAÇÃO. Por isso Órgãos/Reuniões ficam restritas a
// GESTAO aqui dentro (mesmo com o painel visível a COORDENACAO/SECRETARIA por causa
// da aba de Comunicação) — sem isso, a escrita falharia silenciosamente na RLS.
export function GovernancaPanel() {
  const { hasRole } = useAuth();
  const ehGestao = hasRole('GESTAO');
  const [aba, setAba] = useState<Aba>(ehGestao ? 'orgaos' : 'comunicados');

  const abas: { id: Aba; label: string }[] = [
    ...(ehGestao ? ([{ id: 'orgaos', label: 'Órgãos e Membros' }, { id: 'reunioes', label: 'Reuniões e Atas' }] as const) : []),
    { id: 'comunicados', label: 'Comunicação' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
              aba === a.id ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/30' : 'bg-ms-card text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'orgaos' && ehGestao && <OrgaosTab />}
      {aba === 'reunioes' && ehGestao && <ReunioesTab />}
      {aba === 'comunicados' && <ComunicadosTab />}
    </div>
  );
}
