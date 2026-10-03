import type { ChaveCompetencia } from '../services/redacaoService';

// Rubricas da correção de redação. Os DESCRITORES (o texto que a IA recebe) ficam na função
// redacao-ia; aqui só o que a tela precisa: de qual banca é a redação e como se chamam os 5 critérios.

export type ChaveRubrica = 'ENEM' | 'UFMS' | 'UFGD';

export const RUBRICAS: Record<ChaveRubrica, { nome: string; rotulos: Record<ChaveCompetencia, string> }> = {
  ENEM: {
    nome: 'ENEM',
    rotulos: {
      c1: 'C1 — Norma padrão da língua',
      c2: 'C2 — Tema e tipo textual',
      c3: 'C3 — Argumentos e projeto de texto',
      c4: 'C4 — Coesão',
      c5: 'C5 — Proposta de intervenção',
    },
  },
  UFMS: {
    nome: 'UFMS (PASSE/vestibular)',
    rotulos: {
      c1: 'Adequação temática',
      c2: 'Organização e progressão textual',
      c3: 'Estrutura do texto dissertativo-argumentativo',
      c4: 'Coesão e coerência',
      c5: 'Norma padrão',
    },
  },
  UFGD: {
    nome: 'UFGD (vestibular)',
    rotulos: {
      c1: 'Adequação ao tema e ao gênero',
      c2: 'Organização textual',
      c3: 'Argumentação e uso das informações',
      c4: 'Coesão e coerência',
      c5: 'Norma padrão',
    },
  },
};

/** Banca da questão (questions.banca) -> rubrica. Banca desconhecida usa a do ENEM, a mais geral. */
export function rubricaDaBanca(banca?: string | null): ChaveRubrica {
  const b = (banca ?? '').trim().toUpperCase();
  if (b === 'UFMS') return 'UFMS';
  if (b === 'UFGD') return 'UFGD';
  return 'ENEM';
}

// criterios_correcao gravado pela importação das propostas: texto-resumo, não uma rubrica do professor.
// Se o professor escrever critérios próprios na questão, esses vão para a IA no lugar da rubrica da banca.
const PREFIXOS_PADRAO = ['Critérios ENEM', 'Critérios próprios', 'Critérios UFMS', 'Critérios UFGD'];

export function criteriosCustomizados(criterios: string | null | undefined): string | undefined {
  const c = (criterios ?? '').trim();
  if (!c || PREFIXOS_PADRAO.some((p) => c.startsWith(p))) return undefined;
  return c;
}
