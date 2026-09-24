import { supabase } from '../../../lib/supabase';
import { arredondarNotaMS, getConfigPorTurma, pesoDoVisto } from '../../../utils/academicUtils';

// Nota por aluno × disciplina × bimestre, calculada com a MESMA regra de
// ExameFinalPanel/GradesPanel: soma das avaliações + nota de vistos (limitada ao valor
// configurado do professor), RAV substitui quando maior, arredondamento MS.
// Leitura pura; nada é gravado.

export const MEDIA_APROVACAO = 6;
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

interface AvaliacaoRow { id: string; turma_id: string; disciplina_id: string; bimestre_id: number; nome: string }
interface NotaRow { avaliacao_id: string; aluno_id: string; nota: number }
interface AtividadeRow { id: string; id_do_professor: string; turma_id: string; disciplina_id: string; bimestre_id: number }
interface VistoRow { aluno_id: string; atividade_id: string; valor: string }
interface ProfessorRow {
  id: string;
  config_visto_metodo: string;
  config_visto_valor_total: number;
  config_turmas?: Record<string, { config_visto_metodo: string; config_visto_valor_total: number }>;
}

// O Supabase limita cada resposta a 1000 linhas: pagina até acabar.
async function buscarTodos<T>(tabela: string, colunas: string): Promise<T[]> {
  const tamanho = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await supabase.from(tabela).select(colunas).order('id').range(de, de + tamanho - 1);
    if (error) throw error;
    const pagina = (data ?? []) as unknown as T[];
    linhas.push(...pagina);
    if (pagina.length < tamanho) break;
  }
  return linhas;
}

export async function carregarDadosNotas(): Promise<DadosNotas> {
  const [alunosBrutos, turmas, disciplinas, professores, avaliacoes, notasAval, atividades, vistos] = await Promise.all([
    buscarTodos<AlunoResumo & { status: string }>('alunos', 'id, nome, aluno_numero, turma_id, status'),
    buscarTodos<Rotulo>('turmas', 'id, nome'),
    buscarTodos<Rotulo>('disciplinas', 'id, nome'),
    buscarTodos<ProfessorRow>('professores', 'id, config_visto_metodo, config_visto_valor_total, config_turmas'),
    buscarTodos<AvaliacaoRow>('avaliacoes', 'id, turma_id, disciplina_id, bimestre_id, nome'),
    buscarTodos<NotaRow>('notas_avaliacoes', 'id, avaliacao_id, aluno_id, nota'),
    buscarTodos<AtividadeRow>('atividades_diárias', 'id, id_do_professor, turma_id, disciplina_id, bimestre_id'),
    buscarTodos<VistoRow>('vistos_v2', 'id, aluno_id, atividade_id, valor'),
  ]);

  const alunos = alunosBrutos
    .filter((a) => !STATUS_FORA_DA_TURMA.includes(a.status))
    .sort((a, b) => a.turma_id.localeCompare(b.turma_id) || a.aluno_numero - b.aluno_numero);

  const chave = (turma: string, disc: string, bim: number) => `${turma}|${disc}|${bim}`;
  const avalPorChave = new Map<string, AvaliacaoRow[]>();
  const ativPorChave = new Map<string, AtividadeRow[]>();
  const discPorTurma = new Map<string, Set<string>>();

  const registrar = <T,>(mapa: Map<string, T[]>, k: string, item: T) => {
    const lista = mapa.get(k);
    if (lista) lista.push(item); else mapa.set(k, [item]);
  };
  const marcarDisciplina = (turma: string, disc: string) => {
    const set = discPorTurma.get(turma);
    if (set) set.add(disc); else discPorTurma.set(turma, new Set([disc]));
  };

  // Só bimestres 1–4 (o exame final usa outro bimestre_id e tem tela própria).
  avaliacoes.filter((a) => a.bimestre_id >= 1 && a.bimestre_id <= 4).forEach((a) => {
    registrar(avalPorChave, chave(a.turma_id, a.disciplina_id, a.bimestre_id), a);
    marcarDisciplina(a.turma_id, a.disciplina_id);
  });
  atividades.filter((a) => a.bimestre_id >= 1 && a.bimestre_id <= 4).forEach((a) => {
    registrar(ativPorChave, chave(a.turma_id, a.disciplina_id, a.bimestre_id), a);
    marcarDisciplina(a.turma_id, a.disciplina_id);
  });

  const notaPorAval = new Map<string, number>();
  const avalComNota = new Set<string>();
  notasAval.forEach((n) => { notaPorAval.set(`${n.avaliacao_id}|${n.aluno_id}`, n.nota); avalComNota.add(n.avaliacao_id); });
  const vistoPorAtiv = new Map<string, string>();
  const ativComVisto = new Set<string>();
  vistos.forEach((v) => { vistoPorAtiv.set(`${v.atividade_id}|${v.aluno_id}`, v.valor); ativComVisto.add(v.atividade_id); });
  const professorPorId = new Map(professores.map((p) => [p.id, p]));

  const notas: DadosNotas['notas'] = {};
  for (const aluno of alunos) {
    const porDisciplina: Record<string, (number | null)[]> = {};
    for (const disc of discPorTurma.get(aluno.turma_id) ?? []) {
      const linha: (number | null)[] = [null, null, null, null];
      for (let bim = 1; bim <= 4; bim++) {
        const k = chave(aluno.turma_id, disc, bim);
        const avals = avalPorChave.get(k) ?? [];
        const ativs = ativPorChave.get(k) ?? [];
        // Bimestre "lançado" = alguma nota ou visto da turma naquela disciplina. Zero é
        // gravado como ausência de linha, então não dá para distinguir por aluno.
        const lancado = avals.some((a) => avalComNota.has(a.id)) || ativs.some((a) => ativComVisto.has(a.id));
        if (!lancado) continue;

        let soma = 0;
        let rav: number | undefined;
        for (const av of avals) {
          const n = notaPorAval.get(`${av.id}|${aluno.id}`);
          if (n === undefined) continue;
          if (av.nome === 'RAV') rav = n; else soma += n;
        }
        if (ativs.length > 0) {
          const prof = professorPorId.get(ativs[0].id_do_professor);
          const valorTotal = (prof ? getConfigPorTurma(prof, aluno.turma_id).config_visto_valor_total : 0) || 2.0;
          const pesos = ativs.reduce((acc, at) => {
            const valor = vistoPorAtiv.get(`${at.id}|${aluno.id}`);
            return valor === undefined ? acc : acc + pesoDoVisto(valor);
          }, 0);
          soma += Number(((pesos / ativs.length) * valorTotal).toFixed(2));
        }
        linha[bim - 1] = arredondarNotaMS(rav !== undefined && rav > soma ? rav : soma);
      }
      if (linha.some((v) => v !== null)) porDisciplina[disc] = linha;
    }
    notas[aluno.id] = porDisciplina;
  }

  return { alunos, turmas, disciplinas, notas };
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

// Situação parcial no ano: média das notas já lançadas de cada disciplina, considerando
// só os `bimestresEncerrados` primeiros. Bimestre em andamento fica de fora: a nota dele
// ainda está se formando e puxaria a média de todos para baixo.
export function resumoParcialAno(dados: DadosNotas, bimestresEncerrados: number): ResumoSituacao {
  return resumir(dados, (alunoId) =>
    Object.values(dados.notas[alunoId] ?? {}).flatMap((linha) => {
      const lancadas = linha.slice(0, bimestresEncerrados).filter((v): v is number => v !== null);
      return lancadas.length === 0 ? [] : [arredondarNotaMS(lancadas.reduce((a, b) => a + b, 0) / lancadas.length)];
    })
  );
}

// Situação em um bimestre (1–4) isolado.
export function resumoBimestre(dados: DadosNotas, bimestre: number): ResumoSituacao {
  return resumir(dados, (alunoId) =>
    Object.values(dados.notas[alunoId] ?? {}).map((linha) => linha[bimestre - 1]).filter((v): v is number => v !== null)
  );
}

// Situação parcial no ano, uma linha por turma (para o gráfico de barras por turma).
export function resumoParcialPorTurma(dados: DadosNotas, bimestresEncerrados: number): { turma: Rotulo; resumo: ResumoSituacao }[] {
  return dados.turmas.map((turma) => ({
    turma,
    resumo: resumoParcialAno({ ...dados, alunos: dados.alunos.filter((a) => a.turma_id === turma.id) }, bimestresEncerrados),
  }));
}

// ---- Situação por aluno / disciplina (mesma regra de resumoParcialAno) ----

// Média anual 6,0 em 4 bimestres = 24 pontos somados.
const PONTOS_ANO = MEDIA_APROVACAO * 4;

export interface DisciplinaSituacao {
  disciplinaId: string;
  nome: string;
  notas: (number | null)[]; // por bimestre (null = não lançado)
  media: number; // média das notas lançadas nos bimestres encerrados
  aprovada: boolean; // media >= média de aprovação
  faltaNaMedia: number; // quanto falta na média parcial para chegar em 6,0 (0 se já aprovada)
  restantes: number; // bimestres ainda não encerrados
  // Nota média que precisa tirar em cada bimestre restante para fechar o ano com média 6,0
  // (soma de 24 pontos). null quando não há bimestre restante (só resta o exame).
  precisaPorBimestre: number | null;
}

export function situacaoDoAluno(dados: DadosNotas, alunoId: string, bimestresEncerrados: number): { abaixo: DisciplinaSituacao[]; aprovadas: DisciplinaSituacao[] } {
  const nomes = new Map(dados.disciplinas.map((d) => [d.id, d.nome]));
  const restantes = 4 - bimestresEncerrados;
  const abaixo: DisciplinaSituacao[] = [];
  const aprovadas: DisciplinaSituacao[] = [];

  for (const [disciplinaId, notas] of Object.entries(dados.notas[alunoId] ?? {})) {
    const lancadas = notas.slice(0, bimestresEncerrados).filter((v): v is number => v !== null);
    if (lancadas.length === 0) continue; // sem nota em bimestre encerrado: não entra na conta do ano
    const soma = lancadas.reduce((a, b) => a + b, 0);
    const media = arredondarNotaMS(soma / lancadas.length);
    const aprovada = media >= MEDIA_APROVACAO;
    const item: DisciplinaSituacao = {
      disciplinaId,
      nome: nomes.get(disciplinaId) ?? 'Disciplina',
      notas,
      media,
      aprovada,
      faltaNaMedia: aprovada ? 0 : Number((MEDIA_APROVACAO - media).toFixed(1)),
      restantes,
      precisaPorBimestre: restantes > 0 ? Math.max(0, (PONTOS_ANO - soma) / restantes) : null,
    };
    (aprovada ? aprovadas : abaixo).push(item);
  }
  // Mais longe da média primeiro (abaixo) / melhores primeiro (aprovadas).
  abaixo.sort((a, b) => b.faltaNaMedia - a.faltaNaMedia || a.nome.localeCompare(b.nome, 'pt-BR'));
  aprovadas.sort((a, b) => b.media - a.media || a.nome.localeCompare(b.nome, 'pt-BR'));
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
