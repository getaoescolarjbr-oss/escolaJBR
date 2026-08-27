import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { QuestoesTab } from './QuestoesTab';
import { CategoriasTab } from './admin/CategoriasTab';
import { GerenciarTab } from './admin/GerenciarTab';

type Aba = 'consultar' | 'gerenciar' | 'categorias';

// Consulta/montagem de prova para PROFESSOR/COORDENACAO/GESTAO. Criar e editar questões
// é liberado para PROFESSOR e GESTAO (ver permitir_professor_editar_questoes.sql).
// Categorias/taxonomia e exclusão de disciplina inteira continuam restritas a GESTAO.
export function BancoQuestoesPanel() {
  const { hasAnyRole } = useAuth();
  const isGestao = hasAnyRole(['GESTAO']);
  const podeGerenciarQuestoes = hasAnyRole(['GESTAO', 'PROFESSOR']);
  const [aba, setAba] = useState<Aba>('consultar');

  const abas: { id: Aba; label: string }[] = [
    { id: 'consultar', label: 'Consultar' },
    ...(podeGerenciarQuestoes ? [{ id: 'gerenciar' as const, label: 'Gerenciar Questões' }] : []),
    ...(isGestao ? [{ id: 'categorias' as const, label: 'Categorias' }] : []),
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

      {aba === 'consultar' && <QuestoesTab />}
      {aba === 'gerenciar' && podeGerenciarQuestoes && <GerenciarTab />}
      {aba === 'categorias' && isGestao && <CategoriasTab />}
    </div>
  );
}
