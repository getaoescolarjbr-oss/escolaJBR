// Contagem de dias letivos cumpridos/faltantes a partir do calendário (calendarData +
// ajustes em calendario_eventos). Só conta dias marcados como "letivo" (bimestres) ou
// "exame_final" (exame) — fim de semana e feriado não entram porque não têm essa marca.
//
// Os intervalos dos bimestres são os mesmos de getCurrentBimestre() em utils/academicUtils.ts.

export interface PeriodoLetivo {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  categoria: 'letivo' | 'exame_final';
}

export const PERIODOS_LETIVOS: PeriodoLetivo[] = [
  { id: 'b1', nome: '1º Bimestre', inicio: '2026-02-03', fim: '2026-04-30', categoria: 'letivo' },
  { id: 'b2', nome: '2º Bimestre', inicio: '2026-05-04', fim: '2026-07-16', categoria: 'letivo' },
  { id: 'b3', nome: '3º Bimestre', inicio: '2026-08-03', fim: '2026-10-01', categoria: 'letivo' },
  { id: 'b4', nome: '4º Bimestre', inicio: '2026-10-02', fim: '2026-12-31', categoria: 'letivo' },
  { id: 'exame', nome: 'Exame Final', inicio: '2026-01-01', fim: '2026-12-31', categoria: 'exame_final' },
];

export interface ContagemDias {
  total: number;
  cumpridos: number;
  faltam: number;
}

export interface ContagemPeriodo extends ContagemDias {
  periodo: PeriodoLetivo;
}

export interface ResumoDiasLetivos {
  geral: ContagemDias;
  periodos: ContagemPeriodo[];
}

// Data local no formato YYYY-MM-DD (toISOString usaria UTC e viraria o dia à noite).
export function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE');
}

export function contarDiasLetivos(calendario: Record<string, { categoria: string }>, hoje: string): ResumoDiasLetivos {
  const periodos: ContagemPeriodo[] = PERIODOS_LETIVOS.map((periodo) => ({ periodo, total: 0, cumpridos: 0, faltam: 0 }));

  for (const [data, dia] of Object.entries(calendario)) {
    // categoria pode vir com cor customizada ("letivo:#7cb342").
    const categoria = dia.categoria.split(':')[0];
    for (const p of periodos) {
      if (p.periodo.categoria !== categoria || data < p.periodo.inicio || data > p.periodo.fim) continue;
      p.total++;
      if (data <= hoje) p.cumpridos++;
    }
  }
  periodos.forEach((p) => { p.faltam = p.total - p.cumpridos; });

  // "Geral" = só os bimestres; o exame aparece separado.
  const geral = periodos
    .filter((p) => p.periodo.categoria === 'letivo')
    .reduce((acc, p) => ({ total: acc.total + p.total, cumpridos: acc.cumpridos + p.cumpridos, faltam: acc.faltam + p.faltam }), { total: 0, cumpridos: 0, faltam: 0 });

  return { geral, periodos };
}

export interface DiaLetivo {
  data: string;
  descricao: string;
  cumprido: boolean;
}

// Datas que compõem a contagem dos períodos dados (mesmo critério de contarDiasLetivos).
export function listarDias(calendario: Record<string, { categoria: string; descricao?: string }>, periodos: PeriodoLetivo[], hoje: string): DiaLetivo[] {
  const dias: DiaLetivo[] = [];
  for (const [data, dia] of Object.entries(calendario)) {
    const categoria = dia.categoria.split(':')[0];
    if (periodos.some((p) => p.categoria === categoria && data >= p.inicio && data <= p.fim)) {
      dias.push({ data, descricao: dia.descricao ?? '', cumprido: data <= hoje });
    }
  }
  return dias.sort((a, b) => a.data.localeCompare(b.data));
}
