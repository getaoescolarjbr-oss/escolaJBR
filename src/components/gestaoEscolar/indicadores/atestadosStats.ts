import { listarAusencias } from '../../../services/rhService';
import { listarProfessoresParaSelecao } from '../../../services/agendamentoService';
import type { AusenciaServidor, TipoAusencia } from '../../../types/rh';

// Mesmos rótulos de gestaoEscolar/rh/AusenciasTab.tsx.
export const ROTULOS_TIPO_AUSENCIA: Record<TipoAusencia, string> = {
  ATESTADO: 'Atestado médico',
  LICENCA: 'Licença',
  FERIAS: 'Férias',
  FALTA: 'Falta',
  OUTRO: 'Outro',
};

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface EstatisticasAtestados {
  registros: number;
  ativos: number; // mesmo critério do indicador do banco: ativo = true
  servidores: number; // servidores distintos com algum registro
  diasTotais: number; // soma da duração (data_inicio a data_fim, inclusive) de todos os registros
  duracaoMedia: number;
  maiorAfastamento: number;
  porTipo: { tipo: TipoAusencia; total: number }[];
  porMes: number[]; // registros iniciados em cada mês (0 = jan)
  porServidor: { professorId: string; nome: string; registros: number; dias: number }[]; // mais dias primeiro
  retornosPrevistos: { nome: string; dataFim: string }[]; // ativos, o retorno mais próximo primeiro
}

function dias(inicio: string, fim: string): number {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);
  return Math.round((Date.UTC(af, mf - 1, df) - Date.UTC(ai, mi - 1, di)) / 86400000) + 1;
}

export function calcularEstatisticas(lista: AusenciaServidor[], nomes: Map<string, string>): EstatisticasAtestados {
  const duracoes = lista.map((a) => dias(a.data_inicio, a.data_fim));
  const diasTotais = duracoes.reduce((a, b) => a + b, 0);

  const porTipo = new Map<TipoAusencia, number>();
  const porMes = new Array<number>(12).fill(0);
  const porServidor = new Map<string, { registros: number; dias: number }>();
  lista.forEach((a, i) => {
    porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
    porMes[Number(a.data_inicio.slice(5, 7)) - 1]++;
    const s = porServidor.get(a.professor_id) ?? { registros: 0, dias: 0 };
    s.registros++;
    s.dias += duracoes[i];
    porServidor.set(a.professor_id, s);
  });

  const nomeDe = (id: string) => nomes.get(id) ?? 'Servidor não encontrado';
  return {
    registros: lista.length,
    ativos: lista.filter((a) => a.ativo).length,
    servidores: porServidor.size,
    diasTotais,
    duracaoMedia: lista.length ? diasTotais / lista.length : 0,
    maiorAfastamento: Math.max(0, ...duracoes),
    porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
    porMes,
    porServidor: [...porServidor.entries()]
      .map(([professorId, s]) => ({ professorId, nome: nomeDe(professorId), ...s }))
      .sort((a, b) => b.dias - a.dias),
    retornosPrevistos: lista
      .filter((a) => a.ativo)
      .map((a) => ({ nome: nomeDe(a.professor_id), dataFim: a.data_fim }))
      .sort((a, b) => a.dataFim.localeCompare(b.dataFim)),
  };
}

export async function carregarEstatisticasAtestados(): Promise<EstatisticasAtestados> {
  const [lista, professores] = await Promise.all([listarAusencias(), listarProfessoresParaSelecao()]);
  return calcularEstatisticas(lista, new Map(professores.map((p) => [p.id, p.nome])));
}
