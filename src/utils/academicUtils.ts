/**
 * Utilitários Acadêmicos para o Portal JBR
 * Implementa as regras de arredondamento, proporcionalidade e gradientes de cores.
 */

export const BIMESTRES = [1, 2, 3, 4];

/**
 * Regra de Arredondamento JBR:
 * ,3 e ,8 aproximam para cima (0.5 e 1.0 respectivamente)
 * Menos que ,3 ou ,8 aproximam para baixo (0.0 e 0.5 respectivamente)
 */
export function arredondarNotaMS(nota: number): number {
  const inteiro = Math.floor(nota);
  const decimal = nota - inteiro;

  if (decimal >= 0.8) {
    return inteiro + 1.0;
  } else if (decimal >= 0.3) {
    return inteiro + 0.5;
  } else {
    return inteiro;
  }
}

/**
 * Calcula a pontuação necessária para aprovação baseada no bimestre de entrada.
 * Base: 6 pontos por bimestre.
 */
export function calcularMetaProporcional(bimestreEntrada: number): number {
  const bimestresRestantes = 4 - bimestreEntrada + 1;
  return bimestresRestantes * 6;
}

/**
 * Verifica se o aluno foi aprovado considerando a aproximação final (23.5 -> 24)
 */
export function estaAprovado(totalPontos: number, meta: number): boolean {
  // Caso especial: 23.5 pontos em uma meta de 24 é aprovado
  if (meta === 24 && totalPontos >= 23.5) return true;
  
  // Proporcional: Se faltar apenas 0.5 para a meta, aprova por aproximação
  if (totalPontos >= (meta - 0.5)) return true;

  return totalPontos >= meta;
}

/**
 * Retorna a cor do gradiente baseada na média (0 a 10)
 * 0-3: Vermelho
 * 3.1-5.9: Vermelho -> Amarelo
 * 6-10: Verde Claro -> Verde Escuro
 */
export function getCorGradiente(media: number, theme: 'light' | 'dark' = 'dark'): string {
  if (theme === 'light') {
    if (media <= 3.0) return '#dc2626'; // Vermelho mais forte (Red-600)
    if (media < 6.0) return '#d97706';  // Âmbar mais escuro (Amber-600)
    if (media < 8.0) return '#16a34a';  // Verde médio/escuro legível no branco (Green-600)
    return '#15803d'; // Verde floresta (Green-700)
  } else {
    if (media <= 3.0) return '#ef4444'; // Red-500
    if (media < 6.0) return '#f59e0b';  // Amber-500
    if (media < 8.0) return '#4ade80';  // Green-400 (Mais legível no escuro do que Green-300)
    return '#22c55e'; // Green-500 (Muito legível no escuro)
  }
}

/**
 * Calcula a nota dos vistos baseada na nota total do bimestre e participação
 */
export function calcularNotaVistos(vistosRealizados: number, totalAtividades: number, valorBimestre: number): number {
  if (totalAtividades === 0) return 0;
  const nota = (vistosRealizados / totalAtividades) * valorBimestre;
  return arredondarNotaMS(nota);
}

/**
 * Funções específicas para o Exame Final (SED-MS)
 */

export function calcularMediaAnual(notasBimestres: number[]): number {
  const soma = notasBimestres.reduce((acc, curr) => acc + curr, 0);
  return arredondarNotaMS(soma / 4);
}

export function calcularFrequenciaAnual(presencas: number, totalAulas: number): number {
  if (totalAulas === 0) return 100;
  return Math.round((presencas / totalAulas) * 100);
}

export function calcularNotaNecessariaExame(ma: number): number {
  // MF = (MA x 3 + EF x 2) / 5
  // Para MF = 5.0 (após exame): 25 = MA * 3 + EF * 2 -> EF = (25 - MA * 3) / 2
  const notaNecessaria = (25 - ma * 3) / 2;
  return notaNecessaria < 0 ? 0 : arredondarNotaMS(notaNecessaria);
}

export function calcularMediaFinalPosExame(ma: number, ef: number): number {
  const mf = (ma * 3 + ef * 2) / 5;
  return arredondarNotaMS(mf);
}

/**
 * Determina o bimestre letivo vigente com base na data atual (calendário de 2026).
 */
export function getCurrentBimestre(): number {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  // Converter para data comparável em 2026
  const currentDate = new Date(2026, month, day);

  // Intervalos de 2026:
  // 1º Bimestre: 03/02/2026 a 30/04/2026
  // 2º Bimestre: 04/05/2026 a 16/07/2026
  // 3º Bimestre: 03/08/2026 a 01/10/2026
  // 4º Bimestre: 02/10/2026 a 31/12/2026
  const b1End = new Date(2026, 3, 30);   // Apr 30
  const b2End = new Date(2026, 6, 16);   // Jul 16
  const b3End = new Date(2026, 9, 1);    // Oct 1

  if (currentDate <= b1End) {
    return 1;
  } else if (currentDate <= b2End) {
    return 2;
  } else if (currentDate <= b3End) {
    return 3;
  } else {
    return 4;
  }
}

