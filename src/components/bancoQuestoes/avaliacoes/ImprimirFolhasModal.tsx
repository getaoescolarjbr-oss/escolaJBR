import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Loader2, Printer, RefreshCw, X } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { Avaliacao } from '../../../types/avaliacoes';
import type { AlocacaoProva } from '../../../types/correcaoOmr';
import { PROVA_QUESTOES_CSS, printProva } from '../../../utils/printProva';
import { CARTAO_CSS, calcularGeometria } from '../../../utils/cartaoResposta';
import { aplicarVersao, itensCartaoDaVersao } from '../../../utils/versaoProva';
import { gerarVersoes, listarAlocacoes } from '../../../services/correcaoOmrService';
import { obterQuestoesCompletasDaAvaliacao } from '../../../services/avaliacoesService';
import { QuestaoImpressa } from '../QuestaoImpressa';
import { CartaoRespostaFolha } from './CartaoRespostaFolha';

// Impressão em lote: uma prova personalizada por aluno, cada uma com o cartão-resposta
// que carrega o QR daquele aluno.
//
// Por que por aluno e não uma cópia genérica: o QR é o que dispensa o professor de
// dizer ao aplicativo quem é o dono da folha. Sem ele, corrigir 120 cartões viraria 120
// buscas na lista de alunos — que é exatamente o trabalho que este módulo existe para
// eliminar.

// Só o que a impressão em lote acrescenta ao CSS de prova que já existe.
const CSS_LOTE = `
  ${CARTAO_CSS}

  /* Cada bloco começa numa folha nova, menos o primeiro — assim não sobra uma página
     em branco no fim da pilha. */
  .pagina + .pagina { break-before: page; page-break-before: always; }

  .cartao-omr-folha { break-inside: avoid; }
`;

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

type Conteudo = 'PROVA_E_CARTAO' | 'SO_CARTAO' | 'SO_PROVA';

const CONTEUDO_LABEL: Record<Conteudo, string> = {
  PROVA_E_CARTAO: 'Prova + cartão-resposta',
  SO_CARTAO: 'Só o cartão-resposta',
  SO_PROVA: 'Só a prova',
};

export function ImprimirFolhasModal({ avaliacao, onClose }: Props) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoProva[] | null>(null);
  const [questoes, setQuestoes] = useState<Question[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [versaoFiltro, setVersaoFiltro] = useState('');
  const [conteudo, setConteudo] = useState<Conteudo>('PROVA_E_CARTAO');
  const [colunas, setColunas] = useState<1 | 2>(2);

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

      // Os QR ficam prontos antes de renderizar: geração é assíncrona e um <img> com
      // src vazio no momento do window.print() sai como folha sem QR — que é uma folha
      // impossível de corrigir pela câmera.
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

  // carregar() começa com setCarregando(true), o que a regra set-state-in-effect
  // sinaliza. Aqui é intencional e é o mesmo carregar() reusado pelo botão "sortear de
  // novo": separar as duas versões — uma para o efeito, outra para o clique — só
  // duplicaria o corpo da função para calar a regra.
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

  const selecionadas = useMemo(
    () => (alocacoes ?? []).filter(
      (a) => (!turmaFiltro || a.turma_nome === turmaFiltro) && (!versaoFiltro || a.rotulo === versaoFiltro)
    ),
    [alocacoes, turmaFiltro, versaoFiltro]
  );

  async function handleGerarVersoes() {
    if (!confirm(
      'Sortear as versões de novo troca a versão e o código de QR de cada aluno. ' +
      'Folhas já impressas deixam de valer. Continuar?'
    )) return;

    setGerando(true);
    setErro(null);
    try {
      await gerarVersoes(avaliacao.id);
      await carregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  const dataFormatada = avaliacao.data_aplicacao
    ? new Date(avaliacao.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  function renderFolhas(lista: AlocacaoProva[]) {
    return lista.map((aloc) => {
      const daVersao = aplicarVersao(questoesPorId, aloc.ordem_questoes, aloc.mapa_alternativas);
      const itens = itensCartaoDaVersao(daVersao);
      const geom = calcularGeometria(itens);
      const qr = qrs[aloc.codigo];

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

      if (conteudo !== 'SO_CARTAO') {
        blocos.push(
          <div className="pagina" key={`p-${aloc.codigo}`}>
            <div className="prova-header">
              <img src={`${window.location.origin}/logo.png.png`} alt="" className="prova-logo" />
              <div className="prova-header-info">
                <div className="prova-escola">E.E. José Barbosa Rodrigues</div>
                <div className="prova-titulo">{avaliacao.titulo}</div>
                {avaliacao.disciplina && <div className="prova-meta">Disciplina: {avaliacao.disciplina}</div>}
                <div className="prova-aluno">
                  <span>Nome: <strong>{aloc.aluno_nome}</strong></span>
                  <span>Turma: {aloc.turma_nome ?? '—'}</span>
                  {aloc.numero_chamada != null && <span>Nº {aloc.numero_chamada}</span>}
                  <span>Data: {dataFormatada}</span>
                  <span>Versão: <strong>{aloc.rotulo}</strong></span>
                </div>
              </div>
              <div className="prova-nota-box"><span className="prova-nota-label">Nota</span></div>
            </div>

            {avaliacao.instrucoes && <div className="prova-instrucoes">{avaliacao.instrucoes}</div>}

            {/* Cartão embutido: sai antes das questões para não acabar sozinho no fim de
                uma página, longe da prova a que pertence. */}
            {conteudo === 'PROVA_E_CARTAO' && !avaliacao.cartao_separado && cartao}

            <div className={`questoes-coluna${colunas === 2 ? ' duas-colunas' : ''}`}>
              {daVersao.map((q, i) => (
                <QuestaoImpressa key={q.id} questao={q} indice={i} valor={valores[q.id] ?? 0} />
              ))}
            </div>
          </div>
        );
      }

      const cartaoEmFolhaPropria =
        conteudo === 'SO_CARTAO' || (conteudo === 'PROVA_E_CARTAO' && avaliacao.cartao_separado);

      if (cartaoEmFolhaPropria && cartao) {
        blocos.push(<div className="pagina" key={`c-${aloc.codigo}`}>{cartao}</div>);
      }

      return <div key={aloc.codigo}>{blocos}</div>;
    });
  }

  const semVersoes = alocacoes !== null && alocacoes.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Imprimir folhas — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted mt-0.5">
              Uma prova por aluno, com QR Code para a correção pela câmera.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300 font-medium">{erro}</p>
            </div>
          )}

          {carregando ? (
            <div className="flex items-center gap-2 text-ms-muted py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando folhas...
            </div>
          ) : semVersoes ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-sm text-ms-muted max-w-md mx-auto">
                As versões desta prova ainda não foram sorteadas. O sorteio define a ordem das
                questões de cada versão e distribui os alunos das turmas selecionadas — é ele que
                cria o QR Code de cada folha.
              </p>
              <button
                onClick={handleGerarVersoes}
                disabled={gerando}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sortear {avaliacao.qtd_versoes} versão(ões) e distribuir os alunos
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Campo label="Turma">
                  <select value={turmaFiltro} onChange={(e) => setTurmaFiltro(e.target.value)} className={SELECT_CLS}>
                    <option value="">Todas</option>
                    {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Campo>
                <Campo label="Versão">
                  <select value={versaoFiltro} onChange={(e) => setVersaoFiltro(e.target.value)} className={SELECT_CLS}>
                    <option value="">Todas</option>
                    {versoes.map((v) => <option key={v} value={v}>Versão {v}</option>)}
                  </select>
                </Campo>
                <Campo label="Imprimir">
                  <select value={conteudo} onChange={(e) => setConteudo(e.target.value as Conteudo)} className={SELECT_CLS}>
                    {(Object.keys(CONTEUDO_LABEL) as Conteudo[]).map((c) => (
                      <option key={c} value={c}>{CONTEUDO_LABEL[c]}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Colunas da prova">
                  <select value={colunas} onChange={(e) => setColunas(Number(e.target.value) as 1 | 2)} className={SELECT_CLS}>
                    <option value={1}>1 coluna</option>
                    <option value={2}>2 colunas</option>
                  </select>
                </Campo>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-ms-dark border border-gray-800 text-ms-main font-bold">
                  {selecionadas.length} folha(s)
                </span>
                {versoes.map((v) => (
                  <span key={v} className="px-2.5 py-1 rounded-full bg-ms-dark border border-gray-800 text-ms-muted">
                    Versão {v}: {(alocacoes ?? []).filter((a) => a.rotulo === v).length} aluno(s)
                  </span>
                ))}
                <button
                  onClick={handleGerarVersoes}
                  disabled={gerando}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-800 text-ms-muted hover:text-ms-main disabled:opacity-40"
                >
                  {gerando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Sortear de novo
                </button>
              </div>

              {(alocacoes ?? []).some((a) => a.ja_corrigido) && (
                <p className="text-xs text-amber-400 font-medium">
                  Alguns cartões desta prova já foram corrigidos — resortear as versões está
                  bloqueado no banco para não invalidar o que já foi lido.
                </p>
              )}

              <div className="border border-gray-800 rounded-xl bg-white overflow-x-auto">
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
            onClick={() => printProva(previewRef.current, `${avaliacao.titulo} — folhas`, CSS_LOTE)}
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
  return 'Não foi possível carregar as folhas.';
}
