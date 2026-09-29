import { supabase } from '../lib/supabase';
import { getBimestreFromDate } from './academicUtils';

// Aluno que saiu definitivamente da turma (Transferido/Remanejado/Cancelada): os campos de
// lançamento (visto, chamada, notas, ocorrência, média) ficam inativos a partir do bimestre em
// que a saída aconteceu — inclusive o próprio bimestre da saída, mesmo que já tenha alguma nota
// lançada antes dela, para não confundir o professor com um aluno que já não está mais na turma.
// Bimestres anteriores à saída continuam editáveis normalmente (histórico legítimo).
export function isStudentInativoNoBimestre(
  student: { status?: string; atestado_inicio?: string | null },
  bimestreId: number
): boolean {
  if (student.status !== 'Transferido' && student.status !== 'Remanejado' && student.status !== 'Cancelada') {
    return false;
  }
  const exitBim = getBimestreFromDate(student.atestado_inicio);
  return exitBim !== null && bimestreId >= exitBim;
}

/**
 * Checks if a student is currently absent on a specific date (e.g. class date).
 */
export function isStudentAbsentOnDate(
  student: { status?: string; atestado_inicio?: string; atestado_fim?: string },
  dateStr: string
): boolean {
  const status = student.status;
  if (
    status !== 'Atestado' &&
    status !== 'Suspenso' &&
    status !== 'Aluno Suspenso' &&
    status !== 'Licença Maternidade'
  ) {
    return false;
  }
  if (!student.atestado_inicio) return true; // Fallback if no start date is defined
  if (student.atestado_fim) {
    return dateStr >= student.atestado_inicio && dateStr <= student.atestado_fim;
  }
  return dateStr >= student.atestado_inicio;
}

/**
 * Scans the list of students and updates the database to 'Ativo' for any student
 * whose temporary absence (Atestado, Suspenso, Aluno Suspenso, Licença Maternidade) has expired.
 */
export async function autoUpdateExpiredAbsences(
  students: any[],
  onUpdateLocal?: (updatedStudents: any[]) => void
): Promise<void> {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const expiredStudents = students.filter(s => {
    const isAbsence =
      s.status === 'Atestado' ||
      s.status === 'Suspenso' ||
      s.status === 'Aluno Suspenso' ||
      s.status === 'Licença Maternidade';
    return isAbsence && s.atestado_fim && todayStr > s.atestado_fim;
  });

  if (expiredStudents.length === 0) return;

  const expiredIds = expiredStudents.map(s => s.id);
  try {
    const { error } = await supabase
      .from('alunos')
      .update({
        status: 'Ativo',
        atestado_inicio: null,
        atestado_fim: null
      })
      .in('id', expiredIds);

    if (!error && onUpdateLocal) {
      const updated = students.map(s => {
        if (expiredIds.includes(s.id)) {
          return {
            ...s,
            status: 'Ativo',
            atestado_inicio: null,
            atestado_fim: null
          };
        }
        return s;
      });
      onUpdateLocal(updated);
    }
  } catch (err) {
    console.error('Error auto-updating expired absences:', err);
  }
}
