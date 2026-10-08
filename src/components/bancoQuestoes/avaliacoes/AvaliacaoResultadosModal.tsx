import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, FileSpreadsheet, Loader2, Printer, Table as TableIcon, Users, X } from 'lucide-react';
import type { Avaliacao, QuestaoInfoRelatorio, RelatorioAvaliacaoCompleto, ResultadoAlunoDetalhado } from '../../../types/avaliacoes';
import type { Question } from '../../../types/bancoQuestoes';
import { obterQuestoesCompletasDaAvaliacao, obterResultadosDetalhadosAvaliacao, obterVersoesRelatorio } from '../../../services/avaliacoesService';
import { QuestionCard } from '../QuestionCard';
import {
  SEM_VERSOES,
  abrirImpressao,
  blocosMatriz,
  calcularEstatisticasQuestoes,
  gabaritoTexto,
  htmlAcertos,
  htmlMatriz,
  htmlVisaoGeral,
  identificacaoAluno,
  ordenarAlunos,
  type DadosImpressao,
  type EstatisticaQuestao,
  type VersoesRelatorio,
} from '../../../utils/relatorioResultados';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

const SEM_TURMA = 'Sem turma';

// O SheetJS pesa ~1 MB: só é baixado quando o usuário clica em "Exportar XLSX", em vez
// de ir junto com o Banco de Questões inteiro.
type XLSXLib = typeof import('xlsx-js-style');
async function carregarXlsx(): Promise<XLSXLib> {
  const mod = await import('xlsx-js-style');
  // Pacote CommonJS: conforme o bundler, a API vem no próprio módulo ou em `default`.
  return ('utils' in mod ? mod : (mod as unknown as { default: XLSXLib }).default) as XLSXLib;
}

function corBarra(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function sanitizarNomeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 28) || 'Turma';
  let candidato = base;
  let sufixo = 1;
  while (usados.has(candidato.toLowerCase())) {
    sufixo++;
    candidato = `${base} (${sufixo})`.slice(0, 31);
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

const ESTILO_HEADER = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '002677' } }, alignment: { horizontal: 'center', vertical: 'center' } };
const ESTILO_ACERTO = { font: { bold: true, color: { rgb: '006100' } }, fill: { fgColor: { rgb: 'C6EFCE' } }, alignment: { horizontal: 'center' } };
const ESTILO_ERRO = { font: { bold: true, color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center' } };

interface OpcoesPlanilha {
  mostrarNomes: boolean;
  versoes: VersoesRelatorio;
}

function criarPlanilhaAlunos(XLSX: XLSXLib, alunosGrupo: ResultadoAlunoDetalhado[], questoes: QuestaoInfoRelatorio[], isPonderada: boolean, op: OpcoesPlanilha) {
  const areasTri = new Set<string>();
  if (isPonderada) {
    alunosGrupo.forEach((al) => {
      if (al.nota_tri_areas) Object.keys(al.nota_tri_areas).forEach((a) => areasTri.add(a));
    });
  }
  const areasTriArray = Array.from(areasTri).sort();
  const temVersoes = op.versoes.versoes.length > 0;

  // Sem nomes (relatório para o mural): a identificação é o SGDE; sem SGDE, o nº de chamada.
  const header = [
    ...(op.mostrarNomes ? ['Aluno'] : []),
    'Turma',
    op.mostrarNomes ? 'SGDE' : 'Código SGDE',
    ...(temVersoes ? ['Versão'] : []),
    'Status', 'Total Acertos', '% Acertos', 'Nota',
  ];
  if (isPonderada) {
    header.push('TRI Geral');
    areasTriArray.forEach((area) => header.push(`TRI ${area}`));
  }
  const primeiraColQuestao = header.length;
  // A letra de cada aluno é a bolha da folha DELE; o gabarito vem por versão no cabeçalho e na aba "Gabarito por versão".
  header.push(
    ...questoes.map((q) => `Q${String(q.ordem).padStart(2, '0')} (Gab: ${gabaritoTexto(q.question_id, q.correct_letter, op.versoes)})`),
    'Data de Envio'
  );

  const linhas: (string | number)[][] = [header];
  const estilos: { r: number; c: number; s: Record<string, unknown> }[] = [];

  ordenarAlunos(alunosGrupo, op.mostrarNomes).forEach((al, idx) => {
    const linha: (string | number)[] = [
      ...(op.mostrarNomes ? [al.aluno_nome] : []),
      al.turma_nome ?? '',
      op.mostrarNomes ? al.codigo_sgde ?? '' : identificacaoAluno(al, false),
      ...(temVersoes ? [op.versoes.versaoDoAluno[al.aluno_id] ?? ''] : []),
      al.finalizado_em ? 'Enviada' : 'Pendente',
      al.finalizado_em ? `${al.total_acertos} / ${al.total_questoes}` : '—',
      al.finalizado_em ? `${((al.total_acertos / (al.total_questoes || 1)) * 100).toFixed(1)}%` : '—',
      al.finalizado_em ? Number((al.nota ?? 0).toFixed(2)) : '',
    ];

    if (isPonderada) {
      linha.push(al.finalizado_em && al.nota_tri != null ? Number(al.nota_tri.toFixed(2)) : '');
      areasTriArray.forEach((area) => {
        linha.push(al.finalizado_em && al.nota_tri_areas?.[area] != null ? Number(al.nota_tri_areas[area].toFixed(2)) : '');
      });
    }

    questoes.forEach((q, qi) => {
      const resp = al.finalizado_em ? al.respostas[q.question_id] : null;
      if (al.finalizado_em && resp?.letra_marcada) {
        linha.push(resp.letra_marcada);
        estilos.push({ r: idx + 1, c: primeiraColQuestao + qi, s: resp.correta ? ESTILO_ACERTO : ESTILO_ERRO });
      } else {
        linha.push(al.finalizado_em ? 'Em branco' : '—');
      }
    });

    linha.push(al.finalizado_em ? new Date(al.finalizado_em).toLocaleString('pt-BR') : '');
    linhas.push(linha);
  });

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ESTILO_HEADER;
  }
  estilos.forEach(({ r, c, s }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  });
  const colSizes = [
    ...(op.mostrarNomes ? [{ wch: 32 }] : []),
    { wch: 12 }, { wch: 14 }, ...(temVersoes ? [{ wch: 8 }] : []), { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
  ];
  if (isPonderada) {
    colSizes.push({ wch: 12 });
    areasTriArray.forEach(() => colSizes.push({ wch: 12 }));
  }
  colSizes.push(...questoes.map(() => ({ wch: temVersoes ? 22 : 14 })), { wch: 18 });
  ws['!cols'] = colSizes;
  return ws;
}

function criarPlanilhaQuestoes(XLSX: XLSXLib, estat: EstatisticaQuestao[], versoes: VersoesRelatorio) {
  const header = ['Questão', 'Gabarito', 'Valor', 'Alunos que Responderam', 'Total de Acertos', 'Total de Erros', 'Taxa de Acerto'];
  const linhas: (string | number)[][] = [header];
  const estilos: { r: number; c: number; s: Record<string, unknown> }[] = [];

  estat.forEach((q, idx) => {
    linhas.push([
      `Questão ${q.ordem}`,
      gabaritoTexto(q.question_id, q.correct_letter, versoes),
      q.valor,
      q.totalRespostas,
      q.totalAcertos,
      q.totalErros,
      `${q.pctAcerto.toFixed(1)}%`,
    ]);
    estilos.push({
      r: idx + 1,
      c: 6,
      s: q.pctAcerto >= 70 ? ESTILO_ACERTO : q.pctAcerto >= 40
        ? { font: { bold: true, color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center' } }
        : ESTILO_ERRO,
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ESTILO_HEADER;
  }
  estilos.forEach(({ r, c, s }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  });
  ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  return ws;
}

/** Uma linha por (versão, questão): número na folha e bolha correta daquela versão. */
function criarPlanilhaGabaritos(XLSX: XLSXLib, questoes: QuestaoInfoRelatorio[], versoes: VersoesRelatorio) {
  const header = ['Versão', 'Nº na folha', 'Questão (ordem da avaliação)', 'Bolha correta'];
  const linhas: (string | number)[][] = [header];
  const ordemBase = new Map(questoes.map((q) => [q.question_id, q.ordem]));
  for (const v of versoes.versoes) {
    for (const l of v.linhas) linhas.push([v.rotulo, l.numero_na_prova, ordemBase.get(l.question_id) ?? '', l.bolha_correta ?? '—']);
  }
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ESTILO_HEADER;
  }
  ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 14 }];
  return ws;
}

export function AvaliacaoResultadosModal({ avaliacao, onClose }: Props) {
  const [relatorio, setRelatorio] = useState<RelatorioAvaliacaoCompleto | null>(null);
  const [versoes, setVersoes] = useState<VersoesRelatorio>(SEM_VERSOES);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'turmas' | 'matriz'>('geral');
  const [erro, setErro] = useState<string | null>(null);
  // Sem nomes o relatório identifica o aluno pelo código SGDE: serve para afixar no mural.
  const [mostrarNomes, setMostrarNomes] = useState(true);
  const [menuImprimir, setMenuImprimir] = useState(false);
  const [questaoAberta, setQuestaoAberta] = useState<{ id: string; numero: number } | null>(null);
  const [questoesCompletas, setQuestoesCompletas] = useState<Map<string, Question> | null>(null);
  const [erroQuestao, setErroQuestao] = useState<string | null>(null);

  useEffect(() => {
    obterResultadosDetalhadosAvaliacao(avaliacao.id)
      // Numa prova ponderada, `nota` passa a ser a ponderada aqui na entrada. O relatório
      // usa a nota em seis lugares (duas médias, a tabela, o XLSX, o CSV e a impressão);
      // converter num só ponto é o que impede um deles de continuar mostrando a nota
      // bruta e contradizer o boletim.
      .then((r) => setRelatorio(
        avaliacao.modo_nota !== 'PONDERADA'
          ? r
          : {
              ...r,
              alunos: r.alunos.map((al) => ({
                ...al,
                nota_bruta: al.nota,
                nota: al.finalizado_em ? (al.nota_ponderada ?? 0) : null,
              })),
            }
      ))
      .catch((e) => {
        const msg = e?.message || (e instanceof Error ? e.message : 'Não foi possível carregar os resultados.');
        setErro(msg);
      });
    // Gabarito por versão (prova embaralhada). Se falhar ou não houver versões, o relatório usa o gabarito do banco.
    obterVersoesRelatorio(avaliacao.id).then(setVersoes).catch(() => setVersoes(SEM_VERSOES));
  }, [avaliacao.id, avaliacao.modo_nota]);

  const questoes = useMemo(() => relatorio?.questoes ?? [], [relatorio]);
  const alunos = useMemo(() => relatorio?.alunos ?? [], [relatorio]);
  const enviadas = useMemo(() => alunos.filter((r) => r.finalizado_em), [alunos]);
  const temVersoes = versoes.versoes.length > 0;

  // Agrupa os alunos por turma (mantém as turmas separadas no relatório em vez de
  // misturá-las quando o simulado/avaliação tem mais de uma turma vinculada).
  const turmasOrdenadas = useMemo(() => {
    const nomes = new Set(alunos.map((a) => a.turma_nome || SEM_TURMA));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [alunos]);

  const areasTriArray = useMemo(() => {
    const areas = new Set<string>();
    if (avaliacao.modo_nota === 'PONDERADA') {
      alunos.forEach((al) => {
        if (al.nota_tri_areas) Object.keys(al.nota_tri_areas).forEach((a) => areas.add(a));
      });
    }
    return Array.from(areas).sort();
  }, [alunos, avaliacao.modo_nota]);

  const alunosPorTurma = useMemo(() => {
    const mapa = new Map<string, ResultadoAlunoDetalhado[]>();
    for (const turma of turmasOrdenadas) mapa.set(turma, []);
    for (const al of alunos) mapa.get(al.turma_nome || SEM_TURMA)?.push(al);
    for (const [turma, lista] of mapa) mapa.set(turma, ordenarAlunos(lista, mostrarNomes));
    return mapa;
  }, [alunos, turmasOrdenadas, mostrarNomes]);

  const estatisticasPorTurma = useMemo(() => {
    const mapa = new Map<string, { mediaAcertos: number; mediaNota: number; enviadas: number; total: number; porQuestao: EstatisticaQuestao[] }>();
    for (const [turma, lista] of alunosPorTurma) {
      const env = lista.filter((a) => a.finalizado_em);
      const mediaAcertos = env.length > 0 ? env.reduce((s, a) => s + (a.total_acertos ?? 0), 0) / env.length : 0;
      const mediaNota = env.length > 0 ? env.reduce((s, a) => s + (a.nota ?? 0), 0) / env.length : 0;
      mapa.set(turma, { mediaAcertos, mediaNota, enviadas: env.length, total: lista.length, porQuestao: calcularEstatisticasQuestoes(lista, questoes) });
    }
    return mapa;
  }, [alunosPorTurma, questoes]);

  const estatisticasGeral = useMemo(() => calcularEstatisticasQuestoes(alunos, questoes), [alunos, questoes]);

  const estatisticas = useMemo(() => {
    if (enviadas.length === 0) return null;
    const mediaNota = enviadas.reduce((soma, r) => soma + (r.nota ?? 0), 0) / enviadas.length;
    const mediaAcertos = enviadas.reduce((soma, r) => soma + (r.total_acertos ?? 0), 0) / enviadas.length;
    return { mediaNota, mediaAcertos };
  }, [enviadas]);

  // ---- ver a questão ao clicar no gráfico/tabela ------------------------------------------------
  async function abrirQuestao(id: string, numero: number) {
    setQuestaoAberta({ id, numero });
    setErroQuestao(null);
    if (questoesCompletas) return;
    try {
      const { questoes: qs } = await obterQuestoesCompletasDaAvaliacao(avaliacao.id);
      setQuestoesCompletas(new Map(qs.map((q) => [q.id, q])));
    } catch (e) {
      setErroQuestao(e instanceof Error ? e.message : 'Não foi possível carregar a questão.');
    }
  }

  // ---- impressão: documento próprio (o PDF não depende do CSS da tela) --------------------------
  function imprimir(escopo: 'todas' | string) {
    setMenuImprimir(false);
    const turmas = escopo === 'todas' ? turmasOrdenadas : [escopo];
    const d: DadosImpressao = {
      totalQuestoes: questoes.length,
      mostrarNomes,
      ponderada: avaliacao.modo_nota === 'PONDERADA',
      areasTri: areasTriArray,
      versoes,
      questoes,
    };
    const resumo = (t: string) => {
      const e = estatisticasPorTurma.get(t);
      return { turma: t, enviadas: e?.enviadas ?? 0, total: e?.total ?? 0, mediaAcertos: e?.mediaAcertos ?? 0, mediaNota: e?.mediaNota ?? 0 };
    };

    let corpo: string;
    const nomeAba = abaAtiva === 'geral' ? 'Visão geral' : abaAtiva === 'turmas' ? 'Acertos por questão' : 'Matriz de respostas';
    if (abaAtiva === 'geral') {
      corpo = turmas.map((t) => htmlVisaoGeral(t, alunosPorTurma.get(t) ?? [], resumo(t), d)).join('');
    } else if (abaAtiva === 'turmas') {
      corpo = turmas.map((t) => {
        const e = estatisticasPorTurma.get(t);
        return e ? htmlAcertos(t, `${e.enviadas}/${e.total} enviaram · média ${e.mediaAcertos.toFixed(1)}/${questoes.length}`, e.porQuestao, d) : '';
      }).join('');
      if (escopo === 'todas' && turmas.length > 1) corpo += htmlAcertos('Geral — todas as turmas', `${enviadas.length}/${alunos.length} enviaram`, estatisticasGeral, d);
    } else {
      corpo = turmas.map((t) => htmlMatriz(t, alunosPorTurma.get(t) ?? [], d)).join('');
    }

    const alunosEscopo = escopo === 'todas' ? alunos : (alunosPorTurma.get(escopo) ?? []);
    const enviadasEscopo = alunosEscopo.filter((a) => a.finalizado_em);
    const mediaAc = enviadasEscopo.length ? enviadasEscopo.reduce((s, a) => s + (a.total_acertos ?? 0), 0) / enviadasEscopo.length : null;
    const mediaNota = enviadasEscopo.length ? enviadasEscopo.reduce((s, a) => s + (a.nota ?? 0), 0) / enviadasEscopo.length : null;
    abrirImpressao({
      titulo: `Resultados — ${avaliacao.titulo}${escopo === 'todas' ? '' : ` — ${escopo}`}`,
      subtitulo: [
        nomeAba,
        avaliacao.tipo === 'SIMULADO' ? 'Simulado' : avaliacao.disciplina ?? null,
        avaliacao.modo_nota === 'PONDERADA'
          ? `Nota ponderada — referencial: melhor ${avaliacao.ponderada_escopo === 'TURMA' ? 'de cada turma' : 'da avaliação'}`
          : avaliacao.modo_nota === 'SEM_NOTA' ? 'Sem nota de boletim' : null,
        mostrarNomes ? null : 'Alunos identificados pelo código SGDE',
      ].filter(Boolean).join(' · '),
      info: [
        { label: 'Total de Alunos', value: `${alunosEscopo.length}` },
        { label: 'Turmas', value: `${turmas.length}` },
        { label: 'Enviaram', value: `${enviadasEscopo.length} (${alunosEscopo.length > 0 ? ((enviadasEscopo.length / alunosEscopo.length) * 100).toFixed(0) : 0}%)` },
        ...(mediaAc != null && mediaNota != null ? [
          { label: 'Média de Acertos', value: `${mediaAc.toFixed(1)} / ${questoes.length}` },
          { label: 'Média da Nota', value: mediaNota.toFixed(2) },
        ] : []),
      ],
      corpo,
    });
  }

  async function exportarXlsx() {
    if (!relatorio || alunos.length === 0) return;

    let XLSX: XLSXLib;
    try {
      XLSX = await carregarXlsx();
    } catch (e) {
      console.error('Falha ao carregar o exportador de planilhas:', e);
      window.alert('Não foi possível carregar o exportador de planilhas. Verifique a conexão e tente novamente.');
      return;
    }

    const livro = XLSX.utils.book_new();
    const abasUsadas = new Set<string>();
    const op: OpcoesPlanilha = { mostrarNomes, versoes };

    // Uma planilha de respostas + uma de estatísticas por questão para CADA turma,
    // para que turmas diferentes não fiquem misturadas na mesma tabela.
    for (const turma of turmasOrdenadas) {
      const alunosTurma = alunosPorTurma.get(turma) ?? [];
      const estatTurma = estatisticasPorTurma.get(turma)?.porQuestao ?? [];

      const nomeAbaAlunos = sanitizarNomeAba(`Resp. ${turma}`, abasUsadas);
      XLSX.utils.book_append_sheet(livro, criarPlanilhaAlunos(XLSX, alunosTurma, questoes, avaliacao.modo_nota === 'PONDERADA', op), nomeAbaAlunos);

      const nomeAbaQuestoes = sanitizarNomeAba(`Acertos ${turma}`, abasUsadas);
      XLSX.utils.book_append_sheet(livro, criarPlanilhaQuestoes(XLSX, estatTurma, versoes), nomeAbaQuestoes);
    }

    // Relatório geral com o total de acertos de cada questão somando todas as turmas.
    const nomeAbaGeral = sanitizarNomeAba('Acertos Geral', abasUsadas);
    XLSX.utils.book_append_sheet(livro, criarPlanilhaQuestoes(XLSX, estatisticasGeral, versoes), nomeAbaGeral);

    if (temVersoes) {
      XLSX.utils.book_append_sheet(livro, criarPlanilhaGabaritos(XLSX, questoes, versoes), sanitizarNomeAba('Gabarito por versão', abasUsadas));
    }

    const safeTitle = avaliacao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    XLSX.writeFile(livro, `relatorio-acertos-${safeTitle}.xlsx`);
  }

  // Cabeçalho da primeira coluna e conteúdo de cada aluno, conforme o relatório mostre nomes ou só o código.
  const rotuloColunaAluno = mostrarNomes ? 'Aluno' : 'Código SGDE';

  function botaoQuestao(id: string, numero: number) {
    return (
      <button
        type="button"
        onClick={() => void abrirQuestao(id, numero)}
        className={`font-bold text-ms-blueText hover:underline`}
        title="Ver a questão"
      >
        Q{numero}
      </button>
    );
  }

  function graficoQuestoes(dados: EstatisticaQuestao[]) {
    return (
      <div className="space-y-1">
        {dados.map((q) => (
          <button
            type="button"
            key={q.question_id}
            onClick={() => void abrirQuestao(q.question_id, q.ordem)}
            className="w-full flex items-center gap-2 text-xs text-left rounded hover:bg-ms-dark/60 px-1 py-0.5"
            title={`Ver a questão ${q.ordem}${temVersoes ? ` · Gabarito: ${gabaritoTexto(q.question_id, q.correct_letter, versoes)}` : ''}`}
          >
            <span className="w-16 shrink-0 text-ms-blueText font-bold">Q{q.ordem}{temVersoes ? '' : ` (${q.correct_letter})`}</span>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full ${corBarra(q.pctAcerto)} transition-all`}
                style={{ width: `${Math.max(q.pctAcerto, q.totalRespostas > 0 ? 3 : 0)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-ms-main font-bold text-right">
              {q.totalAcertos}/{q.totalRespostas} ({q.pctAcerto.toFixed(0)}%)
            </span>
          </button>
        ))}
      </div>
    );
  }

  function tabelaQuestoes(dados: EstatisticaQuestao[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-ms-card">
            <tr className="border-b border-gray-800 text-ms-muted">
              <th className="py-2 px-3">Questão</th>
              <th className="py-2 px-2 text-center">Gabarito{temVersoes ? ' (por versão)' : ''}</th>
              <th className="py-2 px-2 text-center">Responderam</th>
              <th className="py-2 px-2 text-center">Acertos</th>
              <th className="py-2 px-2 text-center">Erros</th>
              <th className="py-2 px-2 text-center">% Acerto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {dados.map((q) => (
              <tr key={q.question_id}>
                <td className="py-2 px-3">
                  <button type="button" onClick={() => void abrirQuestao(q.question_id, q.ordem)} className="font-bold text-ms-blueText hover:underline" title="Ver a questão">
                    Questão {q.ordem}
                  </button>
                </td>
                <td className="py-2 px-2 text-center text-emerald-400 font-bold">{gabaritoTexto(q.question_id, q.correct_letter, versoes)}</td>
                <td className="py-2 px-2 text-center text-ms-muted">{q.totalRespostas}</td>
                <td className="py-2 px-2 text-center text-emerald-400 font-bold">{q.totalAcertos}</td>
                <td className="py-2 px-2 text-center text-red-400 font-bold">{q.totalErros}</td>
                <td className="py-2 px-2 text-center font-bold text-ms-main">{q.pctAcerto.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const questaoSelecionada = questaoAberta ? questoesCompletas?.get(questaoAberta.id) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-4 border-b border-gray-800 no-print">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Resultados — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.tipo === 'SIMULADO' ? 'Simulado Público' : avaliacao.disciplina ?? 'Avaliação'} · {questoes.length} questão(ões)
              {turmasOrdenadas.length > 0 ? ` · ${turmasOrdenadas.length} turma(s)` : ''}
              {temVersoes ? ` · ${versoes.versoes.length} versões` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {relatorio && alunos.length > 0 && (
              <>
                <label
                  className="flex items-center gap-1.5 text-xs font-bold text-ms-main cursor-pointer select-none"
                  title="Desmarque para gerar o relatório sem os nomes (alunos identificados pelo código SGDE), por exemplo para o mural"
                >
                  <input type="checkbox" checked={mostrarNomes} onChange={(e) => setMostrarNomes(e.target.checked)} className="accent-ms-blue" />
                  Mostrar nomes
                </label>
                <div className="relative">
                  <button
                    onClick={() => setMenuImprimir((v) => !v)}
                    title="Exportar PDF (imprimir): todas as turmas ou uma turma só"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-700 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800 hover:border-gray-600"
                  >
                    <Printer className="w-3.5 h-3.5" /> PDF <ChevronDown className="w-3 h-3" />
                  </button>
                  {menuImprimir && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuImprimir(false)} />
                      <div className="absolute right-0 mt-1 z-20 min-w-[230px] bg-ms-card border border-gray-700 rounded-xl shadow-xl py-1">
                        <p className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-ms-muted">Imprimir esta aba</p>
                        {turmasOrdenadas.length > 1 && (
                          <button onClick={() => imprimir('todas')} className="w-full text-left px-3 py-2 text-xs font-bold text-ms-main hover:bg-gray-800">
                            Todas as turmas (uma por página)
                          </button>
                        )}
                        {turmasOrdenadas.map((t) => (
                          <button key={t} onClick={() => imprimir(t)} className="w-full text-left px-3 py-2 text-xs font-bold text-ms-main hover:bg-gray-800">
                            Só {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={exportarXlsx}
                  title="Exportar Relatório Completo em XLSX (Excel) — com abas separadas por turma"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar XLSX (Excel)
                </button>
              </>
            )}
            <button onClick={onClose} className="text-ms-muted hover:text-ms-main ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!relatorio && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 my-12" />}

          {relatorio && (
            <div className="space-y-4">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Total de Alunos</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">{alunos.length}</p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Turmas</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">{turmasOrdenadas.length}</p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Enviados</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {enviadas.length} <span className="text-xs text-ms-muted font-normal">({alunos.length > 0 ? ((enviadas.length / alunos.length) * 100).toFixed(0) : 0}%)</span>
                  </p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Média de Acertos</p>
                  <p className="text-xl font-bold text-blue-400 mt-0.5">
                    {estatisticas ? estatisticas.mediaAcertos.toFixed(1) : '—'} <span className="text-xs text-ms-muted font-normal">/ {questoes.length}</span>
                  </p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Média Geral</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">
                    {estatisticas ? estatisticas.mediaNota.toFixed(2) : '—'}
                  </p>
                </div>
              </div>

              {/* Seletor de Abas */}
              <div className="flex items-center gap-2 border-b border-gray-800 pt-2 overflow-x-auto">
                {([
                  ['geral', 'Visão Geral por Turma', Users],
                  ['turmas', 'Acertos por Questão', BarChart3],
                  ['matriz', 'Matriz de Respostas', TableIcon],
                ] as const).map(([chave, rotulo, Icone]) => (
                  <button
                    key={chave}
                    onClick={() => setAbaAtiva(chave)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                      abaAtiva === chave ? 'border-blue-400 text-blue-400' : 'border-transparent text-ms-muted hover:text-ms-main'
                    }`}
                  >
                    <Icone className="w-3.5 h-3.5" /> {rotulo}
                  </button>
                ))}
              </div>

              {alunos.length === 0 ? (
                <p className="text-center text-ms-muted py-8">Nenhum aluno vinculado a esta avaliação.</p>
              ) : abaAtiva === 'geral' ? (
                /* Tabela Geral, agrupada por turma */
                <div className="space-y-6">
                  {turmasOrdenadas.map((turma) => {
                    const alunosTurma = alunosPorTurma.get(turma) ?? [];
                    const est = estatisticasPorTurma.get(turma);
                    return (
                      <div key={turma}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-ms-main flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                            <span className="text-xs font-normal text-ms-muted">({alunosTurma.length} aluno(s))</span>
                          </h3>
                          {est && (
                            <span className="text-xs text-ms-muted">
                              Média: <span className="font-bold text-ms-main">{est.mediaAcertos.toFixed(1)}/{questoes.length}</span> acertos · Nota média: <span className="font-bold text-ms-main">{est.mediaNota.toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto border border-gray-800 rounded-xl">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-ms-card">
                              <tr className="border-b border-gray-800 text-xs text-ms-muted">
                                <th className="py-2.5 px-3">{rotuloColunaAluno}</th>
                                {mostrarNomes && <th className="py-2.5 px-3 text-center">SGDE</th>}
                                {temVersoes && <th className="py-2.5 px-3 text-center">Versão</th>}
                                <th className="py-2.5 px-3 text-center">Acertos</th>
                                <th className="py-2.5 px-3 text-center">Nota</th>
                                {avaliacao.modo_nota === 'PONDERADA' && (
                                  <>
                                    <th className="py-2.5 px-3 text-center text-[10px] uppercase tracking-wider text-purple-400" title="Escore Padronizado simulando TRI ENEM / UFMS">TRI Geral</th>
                                    {areasTriArray.map((area) => (
                                      <th key={area} className="py-2.5 px-3 text-center text-[10px] uppercase tracking-wider text-purple-400" title={`TRI - ${area}`}>TRI {area}</th>
                                    ))}
                                  </>
                                )}
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                              {alunosTurma.map((al) => (
                                <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                                  <td className="py-2.5 px-3 font-bold text-ms-main">{identificacaoAluno(al, mostrarNomes)}</td>
                                  {mostrarNomes && <td className="py-2.5 px-3 text-center text-xs text-ms-muted">{al.codigo_sgde ?? '—'}</td>}
                                  {temVersoes && <td className="py-2.5 px-3 text-center text-xs text-ms-muted">{versoes.versaoDoAluno[al.aluno_id] ?? '—'}</td>}
                                  <td className="py-2.5 px-3 text-center font-bold">
                                    {al.finalizado_em ? (
                                      <span className="text-blue-400">{al.total_acertos} / {al.total_questoes}</span>
                                    ) : (
                                      <span className="text-ms-muted">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-ms-main">
                                    {al.finalizado_em ? (al.nota ?? 0).toFixed(2) : '—'}
                                  </td>
                                  {avaliacao.modo_nota === 'PONDERADA' && (
                                    <>
                                      <td className="py-2.5 px-3 text-center font-bold text-purple-400">
                                        {al.finalizado_em && al.nota_tri != null ? al.nota_tri.toFixed(2) : '—'}
                                      </td>
                                      {areasTriArray.map((area) => (
                                        <td key={area} className="py-2.5 px-3 text-center font-bold text-purple-400/80">
                                          {al.finalizado_em && al.nota_tri_areas?.[area] != null ? al.nota_tri_areas[area].toFixed(2) : '—'}
                                        </td>
                                      ))}
                                    </>
                                  )}
                                  <td className="py-2.5 px-3 text-center">
                                    {al.finalizado_em ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-400">
                                        Enviada
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal text-ms-muted bg-gray-800">
                                        Pendente
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : abaAtiva === 'turmas' ? (
                /* Relatório de acertos por questão — por turma + geral, com gráfico */
                <div className="space-y-8">
                  <p className="text-[11px] text-ms-muted">Clique no número da questão ou na barra para ver o enunciado.</p>
                  {turmasOrdenadas.map((turma) => {
                    const est = estatisticasPorTurma.get(turma);
                    if (!est) return null;
                    return (
                      <div key={turma}>
                        <h3 className="text-sm font-bold text-ms-main flex items-center gap-2 mb-2">
                          <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                          <span className="text-xs font-normal text-ms-muted">
                            ({est.enviadas}/{est.total} enviaram · média {est.mediaAcertos.toFixed(1)}/{questoes.length})
                          </span>
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {tabelaQuestoes(est.porQuestao)}
                          {graficoQuestoes(est.porQuestao)}
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-4 border-t border-gray-800">
                    <h3 className="text-sm font-bold text-ms-main flex items-center gap-2 mb-2">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Geral — Todas as Turmas
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {tabelaQuestoes(estatisticasGeral)}
                      {graficoQuestoes(estatisticasGeral)}
                    </div>
                  </div>
                </div>
              ) : (
                /* Matriz de respostas, por turma e, dentro dela, por versão (cada versão com a própria numeração e gabarito) */
                <div className="space-y-6">
                  {temVersoes && (
                    <p className="text-[11px] text-ms-muted">
                      A prova tem versões embaralhadas: cada bloco usa o número da questão e as letras da folha da própria versão. A linha verde é o gabarito dessa versão.
                    </p>
                  )}
                  {turmasOrdenadas.map((turma) => {
                    const blocos = blocosMatriz(alunosPorTurma.get(turma) ?? [], questoes, versoes);
                    return (
                      <div key={turma} className="space-y-3">
                        <h3 className="text-sm font-bold text-ms-main flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                        </h3>
                        {blocos.map((bloco) => (
                          <div key={bloco.rotulo ?? 'sem-versao'}>
                            {(temVersoes || bloco.rotulo) && (
                              <p className="text-xs font-bold text-ms-muted mb-1">
                                {bloco.rotulo ? `Versão ${bloco.rotulo}` : 'Sem versão (sem folha)'} · {bloco.alunos.length} aluno(s)
                              </p>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-ms-card">
                                  <tr className="border-b border-gray-800 text-ms-muted">
                                    <th className="py-2.5 px-3 sticky left-0 bg-ms-card z-10 font-bold min-w-[180px]">{rotuloColunaAluno}</th>
                                    <th className="py-2.5 px-2 text-center">Acertos</th>
                                    {bloco.colunas.map((c) => (
                                      <th key={c.question_id} className="py-2.5 px-2 text-center min-w-[40px]">
                                        {botaoQuestao(c.question_id, c.numero)}
                                      </th>
                                    ))}
                                  </tr>
                                  <tr className="border-b border-gray-800 bg-emerald-950/30">
                                    <th className="py-1.5 px-3 sticky left-0 bg-ms-card z-10 text-emerald-400 font-bold">Gabarito{bloco.rotulo ? ` ${bloco.rotulo}` : ''}</th>
                                    <th />
                                    {bloco.colunas.map((c) => (
                                      <th key={c.question_id} className="py-1.5 px-2 text-center text-emerald-400 font-black">{c.gabarito}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/60">
                                  {bloco.alunos.map((al) => (
                                    <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                                      <td className="py-2 px-3 font-bold text-ms-main sticky left-0 bg-ms-card truncate max-w-[220px]">
                                        {identificacaoAluno(al, mostrarNomes)}
                                      </td>
                                      <td className="py-2 px-2 text-center font-bold text-blue-400">
                                        {al.finalizado_em ? `${al.total_acertos}/${al.total_questoes}` : '—'}
                                      </td>
                                      {bloco.colunas.map((c) => {
                                        if (!al.finalizado_em) {
                                          return <td key={c.question_id} className="py-2 px-2 text-center text-gray-600">—</td>;
                                        }
                                        const resp = al.respostas[c.question_id];
                                        const letra = resp?.letra_marcada;
                                        if (!letra) {
                                          return <td key={c.question_id} className="py-2 px-2 text-center text-ms-muted font-mono text-[11px]">-</td>;
                                        }
                                        return (
                                          <td key={c.question_id} className="py-2 px-2 text-center">
                                            <span
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs ${
                                                resp.correta
                                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                                                  : 'bg-red-100 dark:bg-red-500/20 text-red-900 dark:text-red-300 border border-red-300 dark:border-red-500/40'
                                              }`}
                                              title={`Marcou: ${letra} · Gabarito: ${c.gabarito}`}
                                            >
                                              {letra}
                                            </span>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Questão aberta pelo gráfico/tabela */}
      {questaoAberta && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setQuestaoAberta(null)}>
          <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-ms-main">Questão {questaoAberta.numero}</h3>
              <button onClick={() => setQuestaoAberta(null)} className="text-ms-muted hover:text-ms-main" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {erroQuestao ? (
                <p className="text-sm text-red-400 font-bold">{erroQuestao}</p>
              ) : questaoSelecionada ? (
                <QuestionCard question={questaoSelecionada} />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400 my-8" />
              )}
              {temVersoes && questaoSelecionada && (
                <p className="text-[11px] text-ms-muted mt-3">
                  Gabarito por versão (bolha da folha): {gabaritoTexto(questaoSelecionada.id, undefined, versoes)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
