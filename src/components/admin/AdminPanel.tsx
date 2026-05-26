import React, { useState } from 'react';
import { Users, BookOpen, Layers, Link as LinkIcon, ArrowLeft, GraduationCap, AlertTriangle, Calendar, CalendarDays, Settings } from 'lucide-react';
import { ProfessorManager } from './ProfessorManager';
import { AllocationManager } from './AllocationManager';
import { TurmaManager } from './TurmaManager';
import { DisciplinaManager } from './DisciplinaManager';
import { StudentManager } from './StudentManager';
import { TiposOcorrenciaManager } from './TiposOcorrenciaManager';
import { HorarioManager } from './HorarioManager';
import { CalendarioEditor } from '../CalendarioEditor';
import { RAVConfigManager } from './RAVConfigManager';

interface AdminPanelProps {
  onBack: () => void;
  theme: 'dark' | 'light';
}

export function AdminPanel({ onBack, theme }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'professores' | 'alocacoes' | 'turmas' | 'disciplinas' | 'alunos' | 'ocorrencias' | 'horarios' | 'calendario' | 'config_rav'>('professores');

  const menuItems = [
    { id: 'professores', label: 'Servidores', icon: Users },
    { id: 'alocacoes', label: 'Alocações', icon: LinkIcon },
    { id: 'horarios', label: 'Horários', icon: Calendar },
    { id: 'turmas', label: 'Turmas', icon: Layers },
    { id: 'disciplinas', label: 'Disciplinas', icon: BookOpen },
    { id: 'alunos',       label: 'Alunos',      icon: GraduationCap },
    { id: 'ocorrencias',  label: 'Ocorrências', icon: AlertTriangle },
    { id: 'calendario',   label: 'Calendário',  icon: CalendarDays },
    { id: 'config_rav',   label: 'Parâmetros RAV', icon: Settings },
  ];

  return (
    <div className={`flex flex-col h-[calc(100vh-120px)] bg-ms-dark rounded-3xl overflow-hidden border border-gray-800 shadow-2xl animate-in fade-in zoom-in duration-300 w-full`}>
      {/* Header Admin */}
      <div className="px-8 py-6 bg-ms-card border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-[#003366] font-bold">Gestão de acessos e alocações acadêmicas</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-ms-header border-r border-ms-border flex flex-col shadow-xl z-10 p-4 gap-2 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                activeTab === item.id 
                  ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-10">
          {activeTab === 'professores' && <ProfessorManager theme={theme} />}
          {activeTab === 'alocacoes' && <AllocationManager />}
          {activeTab === 'horarios' && <HorarioManager theme={theme} />}
          {activeTab === 'turmas' && <TurmaManager theme={theme} />}
          {activeTab === 'disciplinas' && <DisciplinaManager theme={theme} />}
          {activeTab === 'alunos' && <StudentManager theme={theme} />}
          {activeTab === 'ocorrencias' && <TiposOcorrenciaManager theme={theme} />}
          {activeTab === 'config_rav' && <RAVConfigManager theme={theme} />}
          {activeTab === 'calendario' && (
            <div className="-m-4 md:-m-10">
              <CalendarioEditor
                isOpen={true}
                onClose={() => setActiveTab('professores')}
                professorNome="Administrador"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
