export const AREAS_CONHECIMENTO = [
  'Ciências da Natureza',
  'Ciências Humanas',
  'Matemática',
  'Linguagens',
] as const;

export type AreaConhecimento = typeof AREAS_CONHECIMENTO[number];

export const DISCIPLINAS_POR_AREA: Record<AreaConhecimento, string[]> = {
  'Ciências da Natureza': ['Física', 'Química', 'Biologia', 'Ciências', 'Práticas Experimentais'],
  'Ciências Humanas': ['História', 'Geografia', 'Filosofia', 'Sociologia', 'Estudos Sociais'],
  'Matemática': ['Matemática', 'Geometria', 'Educação Financeira', 'Raciocínio Lógico'],
  'Linguagens': ['Língua Portuguesa', 'Português', 'Língua Inglesa', 'Inglês', 'Arte', 'Educação Física', 'Redação', 'Literatura'],
};

export function normalizarArea(area?: string | null): AreaConhecimento {
  if (!area) return 'Ciências da Natureza';
  const a = area.toLowerCase();
  if (a.includes('natureza') || a.includes('ciência') || a.includes('biolog') || a.includes('físic') || a.includes('químic')) return 'Ciências da Natureza';
  if (a.includes('humana') || a.includes('histór') || a.includes('geograf') || a.includes('filosof') || a.includes('sociolog')) return 'Ciências Humanas';
  if (a.includes('matemát')) return 'Matemática';
  if (a.includes('linguag') || a.includes('portugu') || a.includes('ingl') || a.includes('arte') || a.includes('educação física')) return 'Linguagens';
  return 'Ciências da Natureza';
}

export function disciplinaPertenceAArea(disciplinaNome: string, area: AreaConhecimento): boolean {
  const lista = DISCIPLINAS_POR_AREA[area] || [];
  const dLower = disciplinaNome.toLowerCase();
  return lista.some((d) => dLower.includes(d.toLowerCase()) || d.toLowerCase().includes(dLower));
}
