import { useState } from 'react';
import { Users, FileText, MessageSquare, GraduationCap, Globe } from 'lucide-react';
import type { Professor } from '../../types';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { AREAS_CONHECIMENTO, normalizarArea } from '../../utils/areasConhecimento';
import { ProfessoresAreaTab } from './ProfessoresAreaTab';
import { AvaliacoesAreaTab } from './AvaliacoesAreaTab';
import { GestaoMensagensPanel } from '../GestaoMensagensPanel';
import { StudentManager } from '../admin/StudentManager';
import { SiteManager } from '../admin/SiteManager';

interface Props {
  professor: Professor;
  theme: 'dark' | 'light';
}

type TabCoordenacao = 'professores' | 'avaliacoes' | 'mensagens' | 'alunos' | 'site';

export function CoordenacaoAreaPanel({ professor, theme }: Props) {
  const [areaSelecionada, setAreaSelecionada] = useState<AreaConhecimento>(() =>
    normalizarArea(professor?.area_conhecimento)
  );
  const [abaAtiva, setAbaAtiva] = useState<TabCoordenacao>('professores');

  const abas: { id: TabCoordenacao; label: string; icon: any }[] = [
    { id: 'professores', label: 'Professores da Área', icon: Users },
    { id: 'avaliacoes', label: 'Avaliações da Área', icon: FileText },
    { id: 'mensagens', label: 'Recados e Mensagens', icon: MessageSquare },
    { id: 'alunos', label: 'Gestão de Alunos', icon: GraduationCap },
    { id: 'site', label: 'Gerenciamento do Site', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* Header do Painel com Seletor de Área */}
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-ms-main">Coordenação de Área</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-900 dark:bg-ms-blue/20 dark:text-blue-300 border border-blue-300 dark:border-blue-800/80 rounded-full text-xs font-bold">
              {areaSelecionada}
            </span>
          </div>
          <p className="text-xs text-ms-muted mt-1">
            Gestão pedagógica, acompanhamento docente, elaboração de avaliações interdisciplinares e comunicação.
          </p>
        </div>

        {/* Seletor de Área */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-ms-muted">Área:</span>
          <select
            value={areaSelecionada}
            onChange={(e) => setAreaSelecionada(e.target.value as AreaConhecimento)}
            className="px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-xs font-bold text-ms-main outline-none focus:ring-2 focus:ring-ms-blue cursor-pointer"
          >
            {AREAS_CONHECIMENTO.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex flex-wrap gap-2">
        {abas.map((a) => {
          const Icon = a.icon;
          const ativa = abaAtiva === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAbaAtiva(a.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                ativa
                  ? 'bg-ms-blue text-white border-ms-blue shadow-md'
                  : 'bg-white dark:bg-ms-card text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas */}
      <div className="pt-2">
        {abaAtiva === 'professores' && <ProfessoresAreaTab area={areaSelecionada} theme={theme} />}
        {abaAtiva === 'avaliacoes' && <AvaliacoesAreaTab area={areaSelecionada} />}
        {abaAtiva === 'mensagens' && (
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-4">
            <GestaoMensagensPanel currentCoordinator={professor} theme={theme} />
          </div>
        )}
        {abaAtiva === 'alunos' && (
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-4">
            <StudentManager theme={theme} />
          </div>
        )}
        {abaAtiva === 'site' && (
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-4">
            <SiteManager theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}
