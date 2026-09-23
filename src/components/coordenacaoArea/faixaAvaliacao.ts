import { FileSpreadsheet, FileText, Layers, Link2, User } from 'lucide-react';

// O mínimo para identificar o tipo — serve para AvaliacaoArea e para Avaliacao.
interface TipoDaAvaliacao {
  eh_prova_geral?: boolean;
  somente_nota?: boolean;
  tipo: string;
  lancar_no_boletim?: boolean;
  area_conhecimento?: string | null;
}

export interface FaixaAvaliacao {
  rotulo: string;
  /** Fundo sólido da faixa (texto branco). */
  cor: string;
  Icone: typeof Layers;
}

// Faixa colorida no topo do cartão: identifica o tipo de avaliação de relance.
// Usada na Coordenação de Área e em "Minhas Avaliações" do professor, com as mesmas cores
// dos botões de grupo (geral = roxo, área = verde, individual = âmbar).
export function faixaDoTipo(av: TipoDaAvaliacao): FaixaAvaliacao {
  if (av.eh_prova_geral) {
    if (av.somente_nota) return { rotulo: 'Avaliação Geral · só nota (digitada)', cor: 'bg-indigo-700', Icone: FileSpreadsheet };
    if (av.tipo === 'AVALIACAO') return { rotulo: 'Avaliação Geral · com nota', cor: 'bg-violet-700', Icone: Layers };
    return av.lancar_no_boletim
      ? { rotulo: 'Avaliação Geral · pública com nota', cor: 'bg-purple-700', Icone: Link2 }
      : { rotulo: 'Avaliação Geral · pública sem nota', cor: 'bg-slate-600', Icone: Link2 };
  }
  return {
    rotulo: `Avaliação da Área · ${av.area_conhecimento}${av.tipo === 'SIMULADO' ? ' · sem nota' : ''}`,
    cor: 'bg-emerald-700',
    Icone: FileText,
  };
}

export function faixaIndividual(disciplina: string | null, semNota: boolean): FaixaAvaliacao {
  return {
    rotulo: `Avaliação Individual${disciplina ? ` · ${disciplina}` : ''}${semNota ? ' · sem nota' : ''}`,
    cor: 'bg-amber-700',
    Icone: User,
  };
}
