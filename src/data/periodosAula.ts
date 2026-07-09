// Mesmo mapeamento tempo → horário de relógio usado em HorarioManager.tsx, extraído
// para cá para ser reaproveitado pelo módulo de Agendamento (seletor rápido de
// período) sem duplicar a constante nem criar uma tabela de grade horária nova.
export interface PeriodoAula {
  label: string;
  inicio: string;
  fim: string;
}

export const PERIODOS_AULA: PeriodoAula[] = [
  { label: '1º Tempo', inicio: '07:30', fim: '08:20' },
  { label: '2º Tempo', inicio: '08:20', fim: '09:10' },
  { label: '3º Tempo', inicio: '09:25', fim: '10:15' },
  { label: '4º Tempo', inicio: '10:15', fim: '11:05' },
  { label: '5º Tempo', inicio: '11:05', fim: '11:55' },
  { label: '6º Tempo', inicio: '13:10', fim: '14:00' },
  { label: '7º Tempo', inicio: '14:00', fim: '14:50' },
  { label: '8º Tempo', inicio: '14:50', fim: '15:40' },
];
