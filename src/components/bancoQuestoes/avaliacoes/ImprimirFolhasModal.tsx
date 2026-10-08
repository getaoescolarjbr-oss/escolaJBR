import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Loader2, Printer, RefreshCw, UserPlus, X } from 'lucide-react';
import { ehQuestaoRedacao, type Question } from '../../../types/bancoQuestoes';
import type { Avaliacao } from '../../../types/avaliacoes';
import type { AlocacaoProva } from '../../../types/correcaoOmr';
import { PROVA_LAYOUT_CSS, PROVA_QUESTOES_CSS, printProva } from '../../../utils/printProva';
import { CARTAO_CSS, calcularGeometria } from '../../../utils/cartaoResposta';
import { FOLHA_REDACAO_CSS } from '../../../utils/folhaRedacao';
import { aplicarVersao, itensCartaoDaVersao } from '../../../utils/versaoProva';
import { adicionarAlunosNovos, gerarVersoes, listarAlocacoes } from '../../../services/correcaoOmrService';
import { definirMostrarPontuacao, obterMostrarPontuacao, obterQuestoesCompletasDaAvaliacao } from '../../../services/avaliacoesService';
import { QuestaoImpressa } from '../QuestaoImpressa';
import { CartaoRespostaFolha } from './CartaoRespostaFolha';
import { FolhaRedacaoJBR } from './FolhaRedacaoJBR';

// ImpressÃ£o em lote: uma prova personalizada por aluno, cada uma com o cartÃ£o-resposta
// que carrega o QR daquele aluno.
//
// Por que por aluno e nÃ£o uma cÃ³pia genÃ©rica: o QR Ã© o que dispensa o professor de
// dizer ao aplicativo quem Ã© o dono da folha. Sem ele, corrigir 120 cartÃµes viraria 120
// buscas na lista de alunos â€” que Ã© exatamente o trabalho que este mÃ³dulo existe para
// eliminar.

// SÃ³ o que a impressÃ£o em lote acrescenta ao CSS de prova que jÃ¡ existe.
const CSS_LOTE = `
  ${CARTAO_CSS}
  ${FOLHA_REDACAO_CSS}

  .pagina-folha-redacao { padding: 0; min-height: 0; }

  /* O corpo do documento de impressão tem uma borda azul (printProva) que, com várias páginas, vira um risco vertical
     em cada margem de cada folha. Na folha de redação e no cartão isso atrapalha a leitura da câmera; a borda fica transparente
     (e não some) para a largura útil, e com ela as marcas, continuarem exatamente onde estavam. */
  body { border-color: transparent !important; }

  /* Quebras de pÃ¡gina: entre alunos e entre pÃ¡ginas do mesmo aluno */
  .bloco-aluno + .bloco-aluno { break-before: page; page-break-before: always; }
  .bloco-aluno .pagina + .pagina { break-before: page; page-break-before: always; }
  .pagina + .pagina { break-before: page; page-break-before: always; }

  /* Garantia estrutural (nÃ£o depende de eu acertar a estimativa de altura): quando o
     modo de separaÃ§Ã£o nÃ£o Ã© "contÃ­nuo", cada aluno tem que comeÃ§ar numa pÃ¡gina ÃMPAR
     (frente de folha nova, seja em frente-e-verso real ou em "2 pÃ¡ginas por folha").
     break-before: right Ã© regra nativa do motor de impressÃ£o â€” se a estimativa de
     rascunho falhar e o aluno anterior sobrar com pÃ¡gina Ã­mpar, o navegador insere UMA
     pÃ¡gina em branco por conta prÃ³pria pra corrigir, sem que isso jogue o aluno
     seguinte pra dentro da folha de outro aluno. Sem isto, um erro de estimativa num
     aluno desalinhava a sequÃªncia de TODOS os alunos depois dele. */
  .bloco-aluno + .bloco-aluno:not([data-separador="CONTINUO"]) {
    break-before: right;
    page-break-before: right;
  }

  .cartao-omr-folha { break-inside: avoid; }

  .bloco-aluno {
    width: 100%;
    box-sizing: border-box;
  }

  .pagina {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* Garante que as imagens na prova com QR Code respeitem exatamente os mesmos limites da prova sem QR Code */
  .pagina .questao-img,
  .pagina .qm-img {
    max-width: 100% !important;
    max-height: 65mm !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
  .pagina .questoes-coluna:not(.duas-colunas) .questao-img,
  .pagina .questoes-coluna:not(.duas-colunas) .qm-img {
    max-height: 85mm !important;
  }

  /* O cartÃ£o no fim da prova: nÃ£o pode partir ao meio nem se separar do que veio antes
     sem necessidade. Sem o avoid, uma metade das bolhas cairia na pÃ¡gina seguinte e a
     folha ficaria impossÃ­vel de ler pela cÃ¢mera â€” as quatro marcas de referÃªncia
     precisam estar todas na mesma pÃ¡gina. */
  .cartao-ao-fim {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 6mm;
    padding-top: 4mm;
    border-top: 1px dashed #999;
  }

  /* Mesma ideia de .cartao-ao-fim, espelhada: cartÃ£o antes da primeira questÃ£o. */
  .cartao-ao-inicio {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 6mm;
    padding-bottom: 4mm;
    border-bottom: 1px dashed #999;
  }

  /* Verso de rascunho / separador de folha fÃ­sica para frente-e-verso ou 2 pÃ¡ginas por folha */
  .pagina-rascunho {
    box-sizing: border-box;
    padding: 10mm 8mm;
    min-height: 260mm;
    display: flex;
    flex-direction: column;
  }
  .pagina-rascunho-box {
    flex: 1;
    border: 1.5px dashed #a0aec0;
    border-radius: 8px;
    padding: 8mm;
    display: flex;
    flex-direction: column;
    min-height: 240mm;
  }
  .pagina-rascunho-header {
    text-align: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4mm;
    margin-bottom: 8mm;
  }
  .pagina-rascunho-titulo {
    display: block;
    font-size: 12pt;
    font-weight: 800;
    color: #002677;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .pagina-rascunho-sub {
    display: block;
    font-size: 8.5pt;
    color: #718096;
    margin-top: 3px;
  }
  .pagina-em-branco {
    min-height: 260mm;
  }
`;

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

type Conteudo = 'PROVA_E_CARTAO' | 'SO_CARTAO' | 'SO_PROVA' | 'SO_REDACAO';

const CONTEUDO_LABEL: Record<Conteudo, string> = {
  PROVA_E_CARTAO: 'Prova + cartÃ£o-resposta',
  SO_CARTAO: 'SÃ³ o cartÃ£o-resposta',
  SO_PROVA: 'SÃ³ a prova',
  SO_REDACAO: 'SÃ³ a folha de redaÃ§Ã£o',
};

type PosicaoCartao = 'INICIO' | 'FIM' | 'SEPARADO';

const POSICAO_CARTAO_LABEL: Record<PosicaoCartao, string> = {
  INICIO: 'Antes das questÃµes',
  FIM: 'Depois das questÃµes, na sobra da pÃ¡gina',
  SEPARADO: 'Em folha separada',
};

type ModoSeparador = 'RASCUNHO_VERSO' | 'SEMPRE_RASCUNHO' | 'PAGINA_BRANCA' | 'CONTINUO';

const MODO_SEPARADOR_LABEL: Record<ModoSeparador, string> = {
  RASCUNHO_VERSO: 'Folha de rascunho no verso (PadrÃ£o - se pÃ¡ginas Ã­mpares)',
  SEMPRE_RASCUNHO: 'Sempre incluir rascunho (folha prÃ³pria se pÃ¡ginas pares)',
  PAGINA_BRANCA: 'PÃ¡gina em branco no verso (se pÃ¡ginas Ã­mpares)',
  CONTINUO: 'ContÃ­nuo (sem verso/rascunho)',
};

function estimarPaginasProva(
  questoes: Question[],
  conteudo: Conteudo,
  posicaoCartao: PosicaoCartao,
  colunas: 1 | 2
): number {
  if (conteudo === 'SO_CARTAO') return 1;
  if (conteudo === 'SO_REDACAO') return 0;

  const ALTURA_UTIL_MM = 270;
  let alturaTotalMm = 35; // cabeÃ§alho

  if (conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'INICIO') {
    alturaTotalMm += 90; // cartÃ£o OMR antes das questÃµes
  }

  let alturaQuestoesMm = 0;
  for (const q of questoes) {
    let altQ = 22;
    if (q.statement && q.statement.length > 200) altQ += Math.ceil((q.statement.length - 200) / 100) * 8;
    if (q.image_url || (q.statement && q.statement.includes('[[IMG:'))) altQ += 60;
    if (q.alternatives && q.alternatives.some((a) => a.image_url || (a.text && a.text.includes('[[IMG:')))) altQ += 30;
    alturaQuestoesMm += altQ;
  }

  if (colunas === 2) {
    alturaTotalMm += Math.ceil(alturaQuestoesMm / 1.85);
  } else {
    alturaTotalMm += alturaQuestoesMm;
  }

  if (conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'FIM') {
    alturaTotalMm += 90;
  }

  let paginas = Math.max(1, Math.ceil(alturaTotalMm / ALTURA_UTIL_MM));

  if (conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'SEPARADO') {
    paginas += 1;
  }

  return paginas;
}

export function ImprimirFolhasModal({ avaliacao, onClose }: Props) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoProva[] | null>(null);
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Alunos que entraram agora por "Adicionar alunos novos" â€” filtra a lista pra baixo,
  // pra imprimir sÃ³ a folha deles sem reimprimir a turma inteira.
  const [alunosNovosIds, setAlunosNovosIds] = useState<Set<string>>(new Set());
  const [somenteNovos, setSomenteNovos] = useState(false);

  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [versaoFiltro, setVersaoFiltro] = useState('');
  const [alunoFiltro, setAlunoFiltro] = useState('');
  const [conteudo, setConteudo] = useState<Conteudo>('PROVA_E_CARTAO');
  const [colunas, setColunas] = useState<1 | 2>(2);
  // Folha de redaÃ§Ã£o (30 linhas) impressa Ã  parte para cada questÃ£o de redaÃ§Ã£o da prova.
  const [folhaRedacao, setFolhaRedacao] = useState(avaliacao.folha_redacao ?? true);
  const [mostrarPontuacao, setMostrarPontuacao] = useState<boolean>(avaliacao.mostrar_pontuacao ?? true);
  // AvaliaÃ§Ãµes de Ã¡rea/geral vÃªm de uma listagem sem essa coluna: lÃª o valor salvo na prova.
  useEffect(() => {
    obterMostrarPontuacao(avaliacao.id).then(setMostrarPontuacao).catch(() => {});
  }, [avaliacao.id]);
  function alternarPontuacao(mostrar: boolean) {
    setMostrarPontuacao(mostrar);
    // Grava na avaliaÃ§Ã£o para valer nas prÃ³ximas impressÃµes; sem permissÃ£o, vale sÃ³ para esta.
    definirMostrarPontuacao(avaliacao.id, mostrar).catch(() => {});
  }
  const [modoSeparador, setModoSeparador] = useState<ModoSeparador>('RASCUNHO_VERSO');
  // Vem da configuraÃ§Ã£o da avaliaÃ§Ã£o, mas Ã© ajustÃ¡vel aqui: reimprimir de outro jeito nÃ£o
  // deveria obrigar o professor a voltar e editar a avaliaÃ§Ã£o inteira. cartao_separado Ã©
  // sÃ³ booleano no banco (folha prÃ³pria ou nÃ£o); "antes das questÃµes" Ã© uma opÃ§Ã£o sÃ³
  // deste diÃ¡logo, por isso o estado local Ã© de trÃªs valores e nÃ£o dois.
  const [posicaoCartao, setPosicaoCartao] = useState<PosicaoCartao>(
    avaliacao.cartao_separado ? 'SEPARADO' : (avaliacao.cartao_posicao ?? 'FIM')
  );

  const previewRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [{ questoes: qs, valoresPorQuestao }, alocs] = await Promise.all([
        obterQuestoesCompletasDaAvaliacao(avaliacao.id),
        listarAlocacoes(avaliacao.id),
      ]);
      setQuestoes(qs);
      setValores(valoresPorQuestao);
      setAlocacoes(alocs);

      // Os QR ficam prontos antes de renderizar: geraÃ§Ã£o Ã© assÃ­ncrona e um <img> com
      // src vazio no momento do window.print() sai como folha sem QR â€” que Ã© uma folha
      // impossÃ­vel de corrigir pela cÃ¢mera.
      const mapa: Record<string, string> = {};
      await Promise.all(
        alocs.map(async (a) => {
          mapa[a.codigo] = await QRCode.toDataURL(a.codigo, {
            margin: 0,
            width: 320,
            errorCorrectionLevel: 'M',
          });
        })
      );
      setQrs(mapa);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [avaliacao.id]);

  // carregar() comeÃ§a com setCarregando(true), o que a regra set-state-in-effect
  // sinaliza. Aqui Ã© intencional e Ã© o mesmo carregar() reusado pelo botÃ£o "sortear de
  // novo": separar as duas versÃµes â€” uma para o efeito, outra para o clique â€” sÃ³
  // duplicaria o corpo da funÃ§Ã£o para calar a regra.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const questoesPorId = useMemo(() => new Map(questoes.map((q) => [q.id, q])), [questoes]);

  const turmas = useMemo(
    () => Array.from(new Set((alocacoes ?? []).map((a) => a.turma_nome).filter((t): t is string => !!t))).sort(),
    [alocacoes]
  );
  const versoes = useMemo(
    () => Array.from(new Set((alocacoes ?? []).map((a) => a.rotulo))).sort(),
    [alocacoes]
  );
  // "Uma versÃ£o por aluno" gera um rÃ³tulo pra cada um â€” listar/filtrar por versÃ£o individual
  // nÃ£o ajuda ninguÃ©m aqui (o professor procura aluno, nÃ£o cÃ³digo interno de versÃ£o), sÃ³
  // polui a tela com dezenas de opÃ§Ãµes/selos. Detecta pelo padrÃ£o: toda versÃ£o tem 1 aluno sÃ³.
  const versaoPorAluno =
    versoes.length > 1 && versoes.every((v) => (alocacoes ?? []).filter((a) => a.rotulo === v).length === 1);

  const discrepanciaQuestoes = useMemo(() => {
    if (!alocacoes || alocacoes.length === 0 || questoes.length === 0) return null;
    const qtdVersao = alocacoes[0].ordem_questoes?.length ?? 0;
    if (qtdVersao !== questoes.length) {
      return { totalProva: questoes.length, totalVersao: qtdVersao };
    }
    return null;
  }, [alocacoes, questoes]);

  const alunosDisponiveis = useMemo(() => {
    const filtrados = (alocacoes ?? []).filter(
      (a) => (!turmaFiltro || a.turma_nome === turmaFiltro) && (!versaoFiltro || a.rotulo === versaoFiltro)
    );
    return [...filtrados].sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, 'pt-BR'));
  }, [alocacoes, turmaFiltro, versaoFiltro]);

  const selecionadas = useMemo(
    () => (alocacoes ?? []).filter(
      (a) =>
        (!turmaFiltro || a.turma_nome === turmaFiltro) &&
        (!versaoFiltro || a.rotulo === versaoFiltro) &&
        (!alunoFiltro || a.aluno_id === alunoFiltro) &&
        (!somenteNovos || alunosNovosIds.has(a.aluno_id))
    ),
    [alocacoes, turmaFiltro, versaoFiltro, alunoFiltro, somenteNovos, alunosNovosIds]
  );

  async function handleGerarVersoes() {
    if (!confirm(
      'Sortear as versÃµes de novo troca a versÃ£o e o cÃ³digo de QR de cada aluno. ' +
      'Folhas jÃ¡ impressas deixam de valer. Continuar?'
    )) return;

    setGerando(true);
    setErro(null);
    try {
      await gerarVersoes(avaliacao.id);
      setAlunosNovosIds(new Set());
      setSomenteNovos(false);
      await carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  /**
   * Aluno matriculado depois do sorteio original: aloca sÃ³ ele numa versÃ£o jÃ¡ existente,
   * sem mexer nas folhas de quem jÃ¡ tinha alocaÃ§Ã£o (e, com isso, sem invalidar o que jÃ¡
   * foi impresso). Ao final, filtra a lista pra mostrar/imprimir sÃ³ quem entrou agora.
   */
  async function handleAdicionarAlunosNovos() {
    setAdicionando(true);
    setErro(null);
    try {
      const novos = await adicionarAlunosNovos(avaliacao.id);
      if (novos.length === 0) {
        setErro('NÃ£o hÃ¡ aluno novo nas turmas desta prova â€” todo mundo jÃ¡ tem folha.');
        return;
      }
      setAlunosNovosIds(new Set(novos.map((n) => n.aluno_id)));
      setSomenteNovos(true);
      setTurmaFiltro('');
      setVersaoFiltro('');
      await carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setAdicionando(false);
    }
  }

  const dataFormatada = avaliacao.data_aplicacao
    ? new Date(avaliacao.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  // Cada .pagina precisa ser irmÃ£ direta das outras â€” nÃ£o dÃ¡ pra embrulhar os blocos de
  // um aluno num <div> por aluno, porque isso quebra o combinador ".pagina + .pagina" do
  // CSS_LOTE bem na fronteira entre um aluno e o prÃ³ximo, que Ã© justamente onde a quebra
  // de pÃ¡gina Ã© mais crÃ­tica (bug relatado: prova de um aluno emendando com a folha do
  // seguinte). Por isso flatMap em vez de map: o retorno de cada aluno jÃ¡ Ã© achatado no
  // array final, todos no mesmo nÃ­vel.
  function renderFolhas(lista: AlocacaoProva[]) {
    return lista.map((aloc) => {
      const daVersao = aplicarVersao(questoesPorId, aloc.ordem_questoes, aloc.mapa_alternativas);
      const itens = itensCartaoDaVersao(daVersao);
      const geom = calcularGeometria(itens);
      const qr = qrs[aloc.codigo];

      // Quem decide Ã© o professor, e sÃ³ ele. Antes havia um teto de questÃµes que forÃ§ava
      // pÃ¡gina prÃ³pria por conta prÃ³pria: era necessÃ¡rio quando o cartÃ£o saÃ­a ANTES das
      // questÃµes (um cartÃ£o alto empurrava a prova inteira para baixo), mas com ele no
      // fim isso deixou de existir â€” se nÃ£o couber na sobra da pÃ¡gina, o
      // break-inside: avoid o leva inteiro para a folha seguinte, que Ã© a mesma coisa que
      // o teto fazia, sÃ³ que sem contrariar a escolha em provas que caberiam.
      const cartaoEmFolhaPropria =
        conteudo === 'SO_CARTAO' || (conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'SEPARADO');

      const cartao = itens.length === 0 || !qr ? null : (
        <CartaoRespostaFolha
          aluno={{
            nome: aloc.aluno_nome,
            numeroChamada: aloc.numero_chamada,
            codigoSgde: aloc.codigo_sgde,
            turma: aloc.turma_nome,
            serie: aloc.serie_nome,
          }}
          versao={aloc.rotulo}
          qrDataUrl={qr}
          titulo={avaliacao.titulo}
          disciplina={avaliacao.disciplina}
          dataAplicacao={dataFormatada}
          itens={itens}
          geom={geom}
        />
      );

      const blocos = [];

      if (conteudo === 'PROVA_E_CARTAO' || conteudo === 'SO_PROVA') {
        blocos.push(
          <div className="pagina pagina-conteudo" key={`p-${aloc.codigo}`}>
            <div className="prova-header">
              <img src={`${window.location.origin}/logo.png.png`} alt="" className="prova-logo" />
              <div className="prova-header-info">
                <div className="prova-escola">E.E. JosÃ© Barbosa Rodrigues</div>
                <div className="prova-titulo">{avaliacao.titulo}</div>
                {avaliacao.disciplina && <div className="prova-meta">Disciplina: {avaliacao.disciplina}</div>}
                <div className="prova-aluno">
                  <span>Nome: <strong>{aloc.aluno_nome}</strong></span>
                  <span>Turma: {aloc.turma_nome ?? 'â€”'}</span>
                  {aloc.numero_chamada != null && <span>NÂº {aloc.numero_chamada}</span>}
                  <span>Data: {dataFormatada}</span>
                  {/* Mesmo cuidado do cartÃ£o-resposta: versÃ£o colada ao SGDE em vez de um
                      rÃ³tulo "VersÃ£o: X" isolado, que convida o aluno a procurar outro com a
                      mesma letra na sala. */}
                  <span>SGDE: {aloc.codigo_sgde ?? 'â€”'}-{aloc.rotulo}</span>
                </div>
              </div>
              <div className="prova-nota-box"><span className="prova-nota-label">Nota</span></div>
            </div>

            {avaliacao.instrucoes && <div className="prova-instrucoes">{avaliacao.instrucoes}</div>}

            {/* CartÃ£o ANTES das questÃµes, a pedido: fica logo abaixo do cabeÃ§alho/
                instruÃ§Ãµes, separado por um traÃ§o, e a prova comeÃ§a depois dele. */}
            {conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'INICIO' && (
              <div className="cartao-ao-inicio">{cartao}</div>
            )}

            <div className={`questoes-coluna${colunas === 2 ? ' duas-colunas' : ''}`}>
              {daVersao.map((q, i) => (
                <QuestaoImpressa key={q.id} questao={q} indice={i} valor={mostrarPontuacao ? valores[q.id] ?? 0 : undefined} semLinhasResposta={folhaRedacao} />
              ))}
            </div>

            {/* CartÃ£o junto: DEPOIS da Ãºltima questÃ£o, fluindo na sobra da pÃ¡gina. Ficava
                antes das questÃµes, e o resultado no papel era a folha terminando vazia com
                o cartÃ£o sozinho na pÃ¡gina seguinte â€” desperdÃ­cio que o professor via na
                pilha impressa. SÃ³ aparece aqui no modo "depois das questÃµes". */}
            {conteudo === 'PROVA_E_CARTAO' && posicaoCartao === 'FIM' && (
              <div className="cartao-ao-fim">{cartao}</div>
            )}
          </div>
        );
      }

      if (cartaoEmFolhaPropria && cartao) {
        blocos.push(<div className="pagina pagina-cartao" key={`c-${aloc.codigo}`}>{cartao}</div>);
      }

      // Separador para garantir inÃ­cio em nova folha fÃ­sica (frente-e-verso e 2 pÃ¡g/folha).
      // Se a prova jÃ¡ possui pÃ¡ginas pares (ex: 2 pÃ¡ginas):
      // ela jÃ¡ preenche frente-e-verso perfeitamente! Adicionar um rascunho a tornaria 3 pÃ¡ginas
      // (Ã­mpar), fazendo a primeira pÃ¡gina do prÃ³ximo aluno sair ao lado do rascunho na mesma folha.
      // Uma folha de redaÃ§Ã£o (pÃ¡gina prÃ³pria) para cada questÃ£o de redaÃ§Ã£o desta versÃ£o.
      const redacoes =
        folhaRedacao && (conteudo === 'PROVA_E_CARTAO' || conteudo === 'SO_REDACAO') && qr
          ? daVersao
              .map((q, i) => ({ q, i }))
              .filter(({ q }) => ehQuestaoRedacao(q))
          : [];
      for (const { q, i } of redacoes) {
        blocos.push(
          <div className="pagina pagina-folha-redacao" key={`fr-${aloc.codigo}-${q.id}`}>
            <FolhaRedacaoJBR
              aluno={{
                nome: aloc.aluno_nome,
                numeroChamada: aloc.numero_chamada,
                codigoSgde: aloc.codigo_sgde,
                turma: aloc.turma_nome,
                serie: aloc.serie_nome,
              }}
              versao={aloc.rotulo}
              qrDataUrl={qr}
              titulo={avaliacao.titulo}
              tema={q.topico}
              dataAplicacao={dataFormatada}
              numeroQuestao={redacoes.length > 1 ? i + 1 : undefined}
            />
          </div>
        );
      }

      const pagsCalculadas = estimarPaginasProva(daVersao, conteudo, posicaoCartao, colunas) + redacoes.length;
      const ehPar = pagsCalculadas % 2 === 0;

      if (conteudo === 'PROVA_E_CARTAO' || conteudo === 'SO_PROVA') {
        const incluirRascunho =
          modoSeparador === 'SEMPRE_RASCUNHO' ||
          (modoSeparador === 'RASCUNHO_VERSO' && !ehPar);

        const incluirBranca = modoSeparador === 'PAGINA_BRANCA' && !ehPar;

        if (incluirRascunho) {
          blocos.push(
            <div className="pagina pagina-rascunho" key={`r-${aloc.codigo}`}>
              <div className="pagina-rascunho-box">
                <div className="pagina-rascunho-header">
                  <span className="pagina-rascunho-titulo">EspaÃ§o para Rascunho / CÃ¡lculos</span>
                  <span className="pagina-rascunho-sub">
                    Aluno: <strong>{aloc.aluno_nome}</strong> &nbsp;Â·&nbsp; Turma: {aloc.turma_nome ?? 'â€”'} &nbsp;Â·&nbsp; VersÃ£o: {aloc.rotulo}
                  </span>
                </div>
              </div>
            </div>
          );
        } else if (incluirBranca) {
          blocos.push(<div className="pagina pagina-em-branco" key={`b-${aloc.codigo}`} />);
        }

        // Se o usuÃ¡rio quer sempre rascunho mas a prova tem pÃ¡ginas pares:
        // adiciona 1 pÃ¡gina em branco para totalizar 4 pÃ¡ginas e nÃ£o quebrar o alinhamento
        if (modoSeparador === 'SEMPRE_RASCUNHO' && ehPar) {
          blocos.push(<div className="pagina pagina-em-branco" key={`b2-${aloc.codigo}`} />);
        }
      }

      return (
        <div
          className="bloco-aluno"
          key={aloc.codigo}
          data-aluno={aloc.codigo}
          data-separador={modoSeparador}
        >
          {blocos}
        </div>
      );
    });
  }

  const semVersoes = alocacoes !== null && alocacoes.length === 0;
  const temRedacao = questoes.some((q) => ehQuestaoRedacao(q));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Imprimir folhas â€” {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted mt-0.5">
              Uma prova por aluno, com QR Code para a correÃ§Ã£o pela cÃ¢mera.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div className="flex items-start gap-2 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-900 dark:text-red-300 font-medium">{erro}</p>
            </div>
          )}

          {discrepanciaQuestoes && (
            <div className="flex items-start gap-3 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-amber-900 dark:text-amber-200 font-bold">
                  AtenÃ§Ã£o: A prova possui {discrepanciaQuestoes.totalProva} questÃµes, mas o sorteio gravado tem {discrepanciaQuestoes.totalVersao} questÃµes.
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-300/90 leading-relaxed">
                  QuestÃµes foram adicionadas ou editadas apÃ³s o sorteio das versÃµes. O sistema jÃ¡ incluiu todas as {discrepanciaQuestoes.totalProva} questÃµes nesta impressÃ£o para que nenhuma falte na prova, mas para sincronizar o gabarito oficial com perfeiÃ§Ã£o, clique no botÃ£o <strong>Sortear de novo</strong> abaixo.
                </p>
              </div>
            </div>
          )}

          {carregando ? (
            <div className="flex items-center gap-2 text-ms-muted py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando folhas...
            </div>
          ) : semVersoes ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-sm text-ms-muted max-w-md mx-auto">
                As versÃµes desta prova ainda nÃ£o foram sorteadas. O sorteio define a ordem das
                questÃµes de cada versÃ£o e distribui os alunos das turmas selecionadas â€” Ã© ele que
                cria o QR Code de cada folha.
              </p>
              <button
                onClick={handleGerarVersoes}
                disabled={gerando}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sortear {avaliacao.qtd_versoes} versÃ£o(Ãµes) e distribuir os alunos
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                <Campo label="Turma">
                  <select value={turmaFiltro} onChange={(e) => { setTurmaFiltro(e.target.value); setAlunoFiltro(''); }} className={SELECT_CLS}>
                    <option value="">Todas</option>
                    {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo label="VersÃ£o">
                  {versaoPorAluno ? (
                    // Uma por aluno: listar/filtrar por rÃ³tulo individual nÃ£o ajuda em nada
                    // (ninguÃ©m procura pelo cÃ³digo interno da versÃ£o) â€” sÃ³ informa o modo.
                    <div className={`${SELECT_CLS} flex items-center text-ms-muted`}>
                      Uma por aluno ({versoes.length})
                    </div>
                  ) : (
                    <select value={versaoFiltro} onChange={(e) => { setVersaoFiltro(e.target.value); setAlunoFiltro(''); }} className={SELECT_CLS}>
                      <option value="">Todas</option>
                      {versoes.map((v) => <option key={v} value={v}>VersÃ£o {v}</option>)}
                    </select>
                  )}
                </Campo>
                <Campo label="Aluno individual">
                  <select value={alunoFiltro} onChange={(e) => setAlunoFiltro(e.target.value)} className={SELECT_CLS}>
                    <option value="">Todos ({alunosDisponiveis.length})</option>
                    {alunosDisponiveis.map((a) => (
                      <option key={a.aluno_id} value={a.aluno_id}>
                        {a.aluno_nome} {a.numero_chamada != null ? `(NÂº ${a.numero_chamada})` : ''} - {a.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Imprimir">
                  <select value={conteudo} onChange={(e) => setConteudo(e.target.value as Conteudo)} className={SELECT_CLS}>
                    {(Object.keys(CONTEUDO_LABEL) as Conteudo[]).map((c) => (
                      <option key={c} value={c}>{CONTEUDO_LABEL[c]}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Colunas">
                  <select value={colunas} onChange={(e) => setColunas(Number(e.target.value) as 1 | 2)} className={SELECT_CLS}>
                    <option value={2}>2 colunas (PadrÃ£o)</option>
                    <option value={1}>1 coluna</option>
                  </select>
                </Campo>
                <Campo label="CartÃ£o-resposta">
                  <select
                    value={posicaoCartao}
                    onChange={(e) => setPosicaoCartao(e.target.value as PosicaoCartao)}
                    className={SELECT_CLS}
                  >
                    {(Object.keys(POSICAO_CARTAO_LABEL) as PosicaoCartao[]).map((p) => (
                      <option key={p} value={p}>{POSICAO_CARTAO_LABEL[p]}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="PontuaÃ§Ã£o das questÃµes">
                  <select
                    value={mostrarPontuacao ? 'SIM' : 'NAO'}
                    onChange={(e) => alternarPontuacao(e.target.value === 'SIM')}
                    className={SELECT_CLS}
                    title='Mostra ou oculta o "(x,xx pt)" ao lado do nÃºmero de cada questÃ£o'
                  >
                    <option value="SIM">Mostrar</option>
                    <option value="NAO">Ocultar</option>
                  </select>
                </Campo>
                {temRedacao && (
                  <Campo label="Folha de redaÃ§Ã£o">
                    <select
                      value={folhaRedacao ? 'SIM' : 'NAO'}
                      onChange={(e) => setFolhaRedacao(e.target.value === 'SIM')}
                      className={SELECT_CLS}
                      title="Imprime a folha de 30 linhas com QR Code, nome do aluno e marcas para leitura pela cÃ¢mera"
                    >
                      <option value="SIM">Incluir (30 linhas, com QR)</option>
                      <option value="NAO">NÃ£o (linhas na prÃ³pria prova)</option>
                    </select>
                  </Campo>
                )}
                <Campo label="Separar provas (Frente/Verso / 2 pÃ¡g)">
                  <select
                    value={modoSeparador}
                    onChange={(e) => setModoSeparador(e.target.value as ModoSeparador)}
                    className={SELECT_CLS}
                    title="Garante que a prÃ³xima prova inicie sempre em uma folha fÃ­sica limpa"
                  >
                    {(Object.keys(MODO_SEPARADOR_LABEL) as ModoSeparador[]).map((s) => (
                      <option key={s} value={s}>{MODO_SEPARADOR_LABEL[s]}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-ms-dark border border-gray-800 text-ms-main font-bold">
                  {selecionadas.length} folha(s)
                </span>
                {!versaoPorAluno &&
                  versoes.map((v) => (
                    <span key={v} className="px-2.5 py-1 rounded-full bg-ms-dark border border-gray-800 text-ms-muted">
                      VersÃ£o {v}: {(alocacoes ?? []).filter((a) => a.rotulo === v).length} aluno(s)
                    </span>
                  ))}
                {alunosNovosIds.size > 0 && (
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ms-dark border border-gray-800 text-ms-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={somenteNovos}
                      onChange={(e) => setSomenteNovos(e.target.checked)}
                      className="accent-ms-blue"
                    />
                    SÃ³ os {alunosNovosIds.size} aluno(s) novo(s)
                  </label>
                )}
                <button
                  onClick={handleAdicionarAlunosNovos}
                  disabled={adicionando || gerando}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-800 text-ms-muted hover:text-ms-main disabled:opacity-40"
                  title="Aluno matriculado depois do sorteio: gera a folha sÃ³ dele, sem trocar o QR de quem jÃ¡ tem folha impressa."
                >
                  {adicionando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                  Adicionar alunos novos
                </button>
                <button
                  onClick={handleGerarVersoes}
                  disabled={gerando || adicionando}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-800 text-ms-muted hover:text-ms-main disabled:opacity-40"
                >
                  {gerando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Sortear de novo
                </button>
              </div>

              {posicaoCartao === 'FIM' && (
                <p className="text-xs text-ms-muted">
                  O cartÃ£o sai logo depois da Ãºltima questÃ£o, aproveitando a sobra da pÃ¡gina. Se nÃ£o
                  couber, vai inteiro para a folha seguinte â€” nunca partido, porque a cÃ¢mera precisa
                  das quatro marcas dos cantos na mesma pÃ¡gina.
                </p>
              )}

              {(alocacoes ?? []).some((a) => a.ja_corrigido) && (
                <p className="text-xs text-amber-400 font-medium">
                  Alguns cartÃµes desta prova jÃ¡ foram corrigidos â€” resortear as versÃµes estÃ¡
                  bloqueado no banco para nÃ£o invalidar o que jÃ¡ foi lido.
                </p>
              )}

              <div className="border border-gray-800 rounded-xl bg-white overflow-x-auto">
                <style>{PROVA_LAYOUT_CSS}</style>
                <style>{PROVA_QUESTOES_CSS}</style>
                <style>{CSS_LOTE}</style>
                <div
                  ref={previewRef}
                  className="p-4"
                  style={{ color: '#1a1a2e', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11pt' }}
                >
                  {renderFolhas(selecionadas)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800">
            Fechar
          </button>
          <button
            onClick={() => printProva(previewRef.current, `${avaliacao.titulo} â€” folhas`, CSS_LOTE)}
            disabled={carregando || selecionadas.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            Imprimir {selecionadas.length} folha(s)
          </button>
        </div>
      </div>
    </div>
  );
}

const SELECT_CLS =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-ms-muted">{label}</label>
      {children}
    </div>
  );
}

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'NÃ£o foi possÃ­vel carregar as folhas.';
}
