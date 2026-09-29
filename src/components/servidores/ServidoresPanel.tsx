import { useState } from 'react';
import { Users, Link as LinkIcon } from 'lucide-react';
import { ProfessorManager } from '../admin/ProfessorManager';
import { AllocationManager } from '../admin/AllocationManager';

// Ponto único para tudo que é feito com um servidor: cadastro, atestado/substituto e
// transferência definitiva ficam dentro do ProfessorManager (uma aba); alocação de turmas
// (quem dá aula em qual turma/disciplina) é a outra. Reaproveita os mesmos componentes que
// já existiam no Painel Admin — só ganham uma porta de entrada que GESTAO e SECRETARIA
// acessam igualmente, sem depender do Painel Admin (que continua só GESTAO, para o resto:
// turmas, disciplinas, alunos, ocorrências, horários, calendário, parâmetros RAV).
export function ServidoresPanel({ theme }: { theme: 'dark' | 'light' }) {
  const [aba, setAba] = useState<'cadastro' | 'alocacoes'>('cadastro');

  const abas = [
    { id: 'cadastro' as const, label: 'Servidores', icon: Users },
    { id: 'alocacoes' as const, label: 'Alocação de Turmas', icon: LinkIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap bg-ms-card/30 p-2 rounded-xl border border-gray-800/40 w-fit">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
              aba === a.id ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'cadastro' && <ProfessorManager theme={theme} />}
      {aba === 'alocacoes' && <AllocationManager />}
    </div>
  );
}
