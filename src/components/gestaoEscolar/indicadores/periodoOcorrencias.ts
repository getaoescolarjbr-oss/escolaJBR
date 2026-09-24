import { supabase } from '../../../lib/supabase';

// Períodos do filtro de ocorrências. Os bimestres seguem getBimestreFromDate()
// (utils/academicUtils.ts): 1º até 30/04, 2º até 16/07, 3º até 01/10, 4º daí em diante —
// contíguos, sem lacuna entre um e outro, e o 1º começa em 01/01 para não perder nada.
export type PeriodoOcorrencias = '30d' | 'b1' | 'b2' | 'b3' | 'b4' | 'total';

export const OPCOES_PERIODO: { id: PeriodoOcorrencias; rotulo: string }[] = [
  { id: '30d', rotulo: 'Últimos 30 dias' },
  { id: 'b1', rotulo: '1º Bimestre' },
  { id: 'b2', rotulo: '2º Bimestre' },
  { id: 'b3', rotulo: '3º Bimestre' },
  { id: 'b4', rotulo: '4º Bimestre' },
  { id: 'total', rotulo: 'Total (ano letivo)' },
];

const LIMITES: Record<Exclude<PeriodoOcorrencias, '30d'>, [string, string]> = {
  b1: ['2026-01-01', '2026-04-30'],
  b2: ['2026-05-01', '2026-07-16'],
  b3: ['2026-07-17', '2026-10-01'],
  b4: ['2026-10-02', '2026-12-31'],
  total: ['2026-01-01', '2026-12-31'],
};

export function rotuloPeriodo(periodo: PeriodoOcorrencias): string {
  return OPCOES_PERIODO.find((o) => o.id === periodo)?.rotulo ?? '';
}

export function intervaloPeriodo(periodo: PeriodoOcorrencias): { de: string; ate: string | null } {
  if (periodo === '30d') {
    // Mesmo recorte do indicador do banco (RPC): data >= hoje - 30.
    return { de: new Date(Date.now() - 30 * 86400000).toLocaleDateString('sv-SE'), ate: null };
  }
  const [de, ate] = LIMITES[periodo];
  return { de, ate };
}

// O Supabase devolve no máximo 1000 linhas por consulta, e o ano já passa disso:
// pagina até acabar (ordem estável: data desc, id).
export async function buscarOcorrenciasPeriodo<T>(colunas: string, periodo: PeriodoOcorrencias): Promise<T[]> {
  const { de, ate } = intervaloPeriodo(periodo);
  const tamanho = 1000;
  const linhas: T[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    let consulta = supabase.from('ocorrências').select(colunas).gte('data', de);
    if (ate) consulta = consulta.lte('data', ate);
    const { data, error } = await consulta.order('data', { ascending: false }).order('id').range(inicio, inicio + tamanho - 1);
    if (error) throw error;
    const pagina = (data ?? []) as unknown as T[];
    linhas.push(...pagina);
    if (pagina.length < tamanho) break;
  }
  return linhas;
}
