import type { LucideIcon } from 'lucide-react';
import { Users, ShieldCheck, ShieldAlert, Settings, UserCog, FolderClock, ChefHat, CalendarClock, BookOpen, LayoutDashboard, Presentation, UserCheck, Library } from 'lucide-react';
import type { Papel } from '../types/rbac';

export interface ModuloNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  // null = qualquer usuário autenticado vê este módulo (ex.: Minha Conta).
  roles: Papel[] | null;
}

// Lista central dos módulos da Fundação. Módulos futuros (Secretaria, Cozinha,
// Biblioteca, Agendamento, Gestão) só precisam adicionar uma entrada aqui — o
// module-switcher do Dashboard e o ModuleShell já leem desta mesma lista, filtrada
// pelo papel do usuário logado.
export const MODULOS_NAV: ModuloNavItem[] = [
  { id: 'pessoas', label: 'Cadastro de Pessoas', icon: Users, roles: ['GESTAO', 'SECRETARIA'] },
  { id: 'secretaria', label: 'Secretaria', icon: FolderClock, roles: ['GESTAO', 'SECRETARIA'] },
  { id: 'cozinha', label: 'Cozinha', icon: ChefHat, roles: ['GESTAO', 'NUTRICAO'] },
  // Etapa 4: fluxo de reserva completo — PROFESSOR já reserva para si mesmo; PCPI gerencia.
  { id: 'agendamento', label: 'Agendamento', icon: CalendarClock, roles: ['PROFESSOR', 'COORDENACAO', 'GESTAO', 'PCPI'] },
  // Fase 2: acervo. Papel ALUNO entra no menu a partir da Fase 4 (home do aluno).
  // COORDENACAO entrou na Fase 7: tem poder de moderação (denúncias/resenhas) desde
  // a Fase 1, mas só ganhou uma aba pra usar isso agora (ver ModeracaoTab). PROFESSOR
  // entrou depois pra poder reservar livros para si mesmo (autoatendimento) — dentro
  // do módulo, App.tsx decide entre o painel do bibliotecário e a tela de
  // autoatendimento conforme o papel (ver ProfessorBibliotecaTab).
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen, roles: ['BIBLIOTECA', 'COORDENACAO', 'GESTAO', 'PROFESSOR'] },
  // v1: consulta + montagem de prova (reaproveita as ~12k questões já organizadas no
  // aprova-prime-51-main, ver create_banco_questoes_schema.sql). Escrita é GESTAO-only.
  { id: 'banco-questoes', label: 'Avaliações', icon: Library, roles: ['PROFESSOR', 'COORDENACAO'] },
  // Fase 1: painel de indicadores (só leitura, só GESTAO). A partir dos sub-módulos
  // administrativos (Almoxarifado etc.) o módulo abriu pra todo servidor — a aba de
  // Indicadores continua restrita a GESTAO dentro do próprio painel
  // (GestaoEscolarPanel), cada sub-módulo filtra o que mostra por papel também.
  { id: 'gestao', label: 'Gestão Escolar', icon: LayoutDashboard, roles: ['GESTAO', 'SECRETARIA', 'PROFESSOR', 'COORDENACAO', 'NUTRICAO', 'BIBLIOTECA', 'INSPETOR'] },
  // Reaproveita o CoordinatorDashboard existente como está — só ganhou uma porta de
  // entrada via card (antes era a landing forçada de qualquer cargo Coordenador/
  // Diretor/Vice-Diretor). Ver App.tsx: view === 'coordenacao'.
  { id: 'coordenacao', label: 'Visão Coordenação Geral', icon: Presentation, roles: ['GESTAO', 'COORDENACAO'] },
  // Coordenação de Área (PCA) — gestão pedagógica da área de conhecimento.
  { id: 'coordenacao-area', label: 'Coordenação de Área', icon: Presentation, roles: ['GESTAO', 'COORDENACAO', 'COORDENACAO_AREA'] },
  // Mesmo padrão: reaproveita o InspetorDashboard existente como está, só ganhou
  // porta de entrada via card (antes era a landing forçada de quem tinha cargo
  // Portaria/Inspetor/Auxiliar de Secretaria/Secretário(a)/Administrativo*).
  { id: 'inspetoria', label: 'Portaria / Inspetoria', icon: UserCheck, roles: ['GESTAO', 'INSPETOR'] },
  { id: 'usuarios', label: 'Usuários e Funções', icon: ShieldCheck, roles: ['GESTAO'] },
  { id: 'lgpd', label: 'LGPD', icon: ShieldAlert, roles: ['GESTAO', 'SECRETARIA'] },
  { id: 'admin', label: 'Painel Admin', icon: Settings, roles: ['GESTAO'] },
  { id: 'perfil', label: 'Minha Conta', icon: UserCog, roles: null },
];

// GESTAO enxerga todos os módulos, presentes e futuros — não precisa lembrar de
// incluir 'GESTAO' no roles de cada módulo novo. Qualquer outro papel continua
// filtrado normalmente pelo roles declarado de cada item.
export function modulosVisiveis(hasAnyRole: (papeis: Papel[]) => boolean): ModuloNavItem[] {
  if (hasAnyRole(['GESTAO'])) return MODULOS_NAV;
  return MODULOS_NAV.filter((item) => item.roles === null || hasAnyRole(item.roles));
}
