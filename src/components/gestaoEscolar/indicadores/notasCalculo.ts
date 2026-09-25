import { estaAprovado } from '../../../utils/academicUtils';

// Cálculo puro da situação dos alunos (sem acesso ao banco): testável isoladamente.
// O carregamento das notas fica em notasService.ts.

export const MEDIA_APROVACAO = 6;
// Aprovação por pontos (regra que o sistema já usa, ver estaAprovado em utils/academicUtils.ts):
// 4 bimestres x 6 = 24 pontos, e 23,5 já aprova. Vale por disciplina, somando os bimestres.
export const META_PONTOS = 24;
export const PONTOS_APROVACAO = 23.5;
export const STATUS_FORA_DA_TURMA = ['Transferido', 'Remanejado', 'Cancelada'];

export interface AlunoResumo { id: string; nome: string; aluno_numero: number; turma_id: string }
export interface Rotulo { id: string; nome: string }

export interface DadosNotas {
  alunos: AlunoResumo[];
  turmas: Rotulo[];
  disciplinas: Rotulo[];
  // notas[alunoId][disciplinaId][0..3] = nota do bimestre; null = bimestre ainda não lançado.
  notas: Record<string, Record<string, (number | null)[]>>;
}

export interface ResumoSituacao {
  total: number;
  acimaDaMedia: number; // todas as disciplinas com nota ≥ média
  abaixoDaMedia: number; // ao menos uma disciplina abaixo
  semNotas: number;
}

function classificar(valoresPorDisciplina: number[]): 'acima' | 'abaixo' | 'sem' {
  if (valoresPorDisciplina.length === 0) return 'sem';
  return valoresPorDisciplina.every((v) => v >= MEDIA_APROVACAO) ? 'acima' : 'abaixo';
}

function resumir(dados: DadosNotas, valoresDoAluno: (alunoId: string) => number[]): ResumoSituacao {
  const r: ResumoSituacao = { total: dados.alunos.length, acimaDaMedia: 0, abaixoDaMedia: 0, semNotas: 0 };
  for (const aluno of dados.alunos) {
    const c = classificar(valoresDoAluno(aluno.id));
    if (c === 'acima') r.acimaDaMedia++; else if (c === 'abaixo') r.abaixoDaMedia++; else r.semNotas++;
  }
  return r;
}

// Pontos acumulados numa disciplina (soma dos bimestres já lançados); null = nada lançado.
function somaDaDisciplina(linha: (number | null)[]): number | null {
  const lancadas = linha.filter((v): v is number => v !== null);
  return lancadas.length === 0 ? null : lancadas.reduce((a, b) => a + b, 0);
}

// Situação no ano antes do exame: o aluno só conta como aprovado quando TODAS as disciplinas já
// somaram 23,5 pontos (ou mais) nos bimestres. Quem ainda não chegou fica em "faltam aprovar".
export function resumoParcialAno(dados: DadosNotas): ResumoSituacao {
  const r: ResumoSituacao = { total: dados.alunos.length, acimaDaMedia: 0, abaixoDaMedia: 0, semNotas: 0 };
  for (const aluno of dados.alunos) {
    const somas = Object.values(dados.notas[aluno.id] ?? {}).map(somaDaDisciplina).filter((v): v is number => v !== null);
    if (somas.length === 0) r.semNotas++;
    else if (somas.every((v) => estaAprovado(v, META_PONTOS))) r.acimaDaMedia++;
    else r.abaixoDaMedia++;
  }
  return r;
}

// Situação em um bimestre (1–4) isolado.
export function resumoBimestre(dados: DadosNotas, bimestre: number): ResumoSituacao {
  return resumir(dados, (alunoId) =>
    Object.values(dados.notas[alunoId] ?? {}).map((linha) => linha[bimestre - 1]).filter((v): v is number => v !== null)
  );
}

// Situação no ano, uma linha por turma (para o gráfico de barras por turma).
export function resumoParcialPorTurma(dados: DadosNotas): { turma: Rotulo; resumo: ResumoSituacao }[] {
  return dados.turmas.map((turma) => ({
    turma,
    resumo: resumoParcialAno({ ...dados, alunos: dados.alunos.filter((a) => a.turma_id === turma.id) }),
  }));
}

// ---- Situação por aluno / disciplina (mesma regra de resumoParcialAno) ----

export interface DisciplinaSituacao {
  disciplinaId: string;
  nome: string;
  notas: (number | null)[]; // por bimestre (null = não lançado)
  soma: number; // pontos acumulados nos bimestres lançados
  aprovada: boolean; // soma >= 23,5
  faltaPontos: number; // quanto falta para 23,5 (0 se já aprovada)
  restantes: number; // bimestres ainda não encerrados
  // Pontos a somar, em média, em cada bimestre que ainda falta (null quando não resta bimestre).
  extraPorBimestre: number | null;
  // Dá para chegar em 23,5 só com os bimestres que faltam (máx. 10 em cada)?
  alcancavel: boolean;
}

export function situacaoDoAluno(dados: DadosNotas, alunoId: string, bimestresEncerrados: number): { abaixo: DisciplinaSituacao[]; aprovadas: DisciplinaSituacao[] } {
  const nomes = new Map(dados.disciplinas.map((d) => [d.id, d.nome]));
  const restantes = 4 - bimestresEncerrados;
  const abaixo: DisciplinaSituacao[] = [];
  const aprovadas: DisciplinaSituacao[] = [];

  for (const [disciplinaId, notas] of Object.entries(dados.notas[alunoId] ?? {})) {
    const soma = somaDaDisciplina(notas);
    if (soma === null) continue;
    const aprovada = estaAprovado(soma, META_PONTOS);
    const faltaPontos = aprovada ? 0 : Number((PONTOS_APROVACAO - soma).toFixed(1));
    // O que ainda dá para ganhar: até 10 em cada bimestre não encerrado (descontando o que já tem lançado).
    let capacidade = 0;
    for (let i = bimestresEncerrados; i < 4; i++) capacidade += 10 - (notas[i] ?? 0);
    const item: DisciplinaSituacao = {
      disciplinaId,
      nome: nomes.get(disciplinaId) ?? 'Disciplina',
      notas,
      soma,
      aprovada,
      faltaPontos,
      restantes,
      extraPorBimestre: restantes > 0 ? faltaPontos / restantes : null,
      alcancavel: faltaPontos <= capacidade,
    };
    (aprovada ? aprovadas : abaixo).push(item);
  }
  // Mais longe da meta primeiro (abaixo) / com mais pontos primeiro (aprovadas).
  abaixo.sort((a, b) => b.faltaPontos - a.faltaPontos || a.nome.localeCompare(b.nome, 'pt-BR'));
  aprovadas.sort((a, b) => b.soma - a.soma || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { abaixo, aprovadas };
}

export interface AlunoSituacao {
  aluno: AlunoResumo;
  situacao: 'abaixo' | 'acima' | 'sem';
  disciplinasAbaixo: number;
  disciplinasAprovadas: number;
}

// Alunos de uma turma: os que faltam aprovar primeiro (mais disciplinas abaixo no topo),
// depois os já aprovados, por fim os sem nota.
export function alunosDaTurma(dados: DadosNotas, turmaId: string, bimestresEncerrados: number): AlunoSituacao[] {
  const ordem = { abaixo: 0, acima: 1, sem: 2 };
  return dados.alunos
    .filter((a) => a.turma_id === turmaId)
    .map((aluno) => {
      const { abaixo, aprovadas } = situacaoDoAluno(dados, aluno.id, bimestresEncerrados);
      const situacao: AlunoSituacao['situacao'] = abaixo.length > 0 ? 'abaixo' : aprovadas.length > 0 ? 'acima' : 'sem';
      return { aluno, situacao, disciplinasAbaixo: abaixo.length, disciplinasAprovadas: aprovadas.length };
    })
    .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.disciplinasAbaixo - a.disciplinasAbaixo || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
}
