import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, Check, Keyboard, Loader2, RotateCcw, Save, X } from 'lucide-react';
import type { CartaoGeom } from '../../utils/cartaoResposta';
import { aspectoParaEnquadrar, calcularGeometria } from '../../utils/cartaoResposta';
import { lerCartao, lerQrCode, type LeituraCartao } from '../../lib/omr';
import type { FolhaIdentificada, LinhaGabarito, ResultadoCorrecaoOmr } from '../../types/correcaoOmr';
import type { ItemPendenteCorrecao } from '../../types/avaliacoes';
import {
  anularItemProva,
  corrigirPorOmr,
  identificarFolha,
  obterGabaritoVersao,
  lancarNotasNoBoletim,
} from '../../services/correcaoOmrService';
import { corrigirItemDissertativo, listarItensPendentesCorrecao } from '../../services/avaliacoesService';
import { CorrecaoManualPainel } from './CorrecaoManualPainel';
import { bipe } from './bipe';

// ====================================================================================
// MODO CORREÇÃO — a tela que o professor abre no celular com a pilha de cartões na mão.
//
// O ciclo é: aponta a câmera -> lê o QR -> confirma o aluno na tela -> lê as bolhas ->
// grava -> próximo. Sem toque na tela entre um cartão e outro, porque a mão que
// seguraria o celular é a mesma que vira a folha.
//
// Duas decisões que sustentam o resto:
//
// 1. Nada é enviado antes de dois quadros seguidos concordarem. Um quadro isolado pega
//    a folha em movimento e lê a linha deslocada; exigir concordância custa ~200ms e
//    elimina a classe inteira desse erro.
//
// 2. O envio só acontece com o aluno JÁ mostrado na tela. Gravar nota no aluno errado é
//    o pior defeito possível aqui — pior que não ler —, porque ninguém percebe.
// ====================================================================================

/**
 * Largura de processamento. Cartão em 2+ colunas é bem mais largo em mm (até ~186mm)
 * que um cartão de 1 coluna (~60-70mm) — na mesma resolução de captura, isso significa
 * menos pixels por milímetro em CADA bolha, e é exatamente o cenário em que a leitura
 * some/erra. 1600px é o valor pareado com o pedido de captura mais alta abaixo (ver
 * getUserMedia): sem subir a captura, aumentar isto sozinho não ajuda, porque o
 * downscale já era quase nulo (1200 vs os 1280 pedidos antes).
 */
const LARGURA_PROC = 1600;

/** Intervalo entre processamentos. ~6 leituras/s é mais que suficiente para folha parada. */
const INTERVALO_MS = 160;

type Fase = 'PROCURANDO_QR' | 'LENDO_CARTAO' | 'CONFIRMAR_BRANCO' | 'ENVIANDO' | 'PRONTO';

interface Props {
  /** Quando informado, avisa se o cartão lido é de outra prova. */
  provaEsperadaId?: string;
  onFechar: () => void;
  /** Chamado a cada cartão gravado, para a lista de progresso se atualizar. */
  onCorrigido?: (r: ResultadoCorrecaoOmr) => void;
}

export function ModoCorrecaoPage({ provaEsperadaId, onFechar, onCorrigido }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [camAtiva, setCamAtiva] = useState(false);
  const [erroCam, setErroCam] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>('PROCURANDO_QR');
  const [folha, setFolha] = useState<FolhaIdentificada | null>(null);
  const [gabarito, setGabarito] = useState<LinhaGabarito[] | null>(null);
  const [leitura, setLeitura] = useState<LeituraCartao | null>(null);
  const [resultado, setResultado] = useState<ResultadoCorrecaoOmr | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  // Questões anuladas manualmente pelo professor nesta folha (ex.: bolha certa, mas sem
  // resolução no papel — ele desconsidera o ponto mesmo assim). Só clicável depois que o
  // cartão já foi gravado (fase PRONTO): antes disso não existe item na tabela pra anular.
  const [anulando, setAnulando] = useState<string | null>(null);
  const [anuladas, setAnuladas] = useState<Set<string>>(new Set());
  // Questões dissertativas/redação deste aluno, nesta prova — o professor digita a nota
  // aqui mesmo, na hora, em vez de deixar pendente pra um passo de correção separado.
  const [pendentesDissert, setPendentesDissert] = useState<ItemPendenteCorrecao[]>([]);
  const [notasDissert, setNotasDissert] = useState<Record<string, string>>({});
  const [salvandoDissertId, setSalvandoDissertId] = useState<string | null>(null);
  // Status do lançamento automático pros professores selecionados, depois de gravar o
  // cartão — separado de `erro` porque não é um erro de LEITURA, é do passo seguinte.
  const [avisoLancamento, setAvisoLancamento] = useState<string | null>(null);
  // Proporção do cartão desta versão, para a moldura da tela ter a MESMA forma da folha.
  // Sem isto a moldura fica 4:3 deitada, o cartão sai em pé, e o professor acaba virando
  // o celular — que é a posição em que a orientação é mais difícil de resolver.
  const [aspectoCartao, setAspectoCartao] = useState<number | null>(null);

  // Refs, não estado: o laço de processamento lê isto a cada quadro e re-render a 6Hz
  // para atualizar variável de controle jogaria fora quadros por nada.
  const geomRef = useRef<CartaoGeom | null>(null);
  const folhaRef = useRef<FolhaIdentificada | null>(null);
  const faseRef = useRef<Fase>('PROCURANDO_QR');
  const ultimaLeituraRef = useRef<string | null>(null);
  const ocupadoRef = useRef(false);
  const cacheGeomRef = useRef<Map<string, { geom: CartaoGeom; gabarito: LinhaGabarito[] }>>(new Map());

  const mudarFase = useCallback((f: Fase) => {
    faseRef.current = f;
    setFase(f);
  }, []);

  const reiniciar = useCallback(() => {
    folhaRef.current = null;
    geomRef.current = null;
    ultimaLeituraRef.current = null;
    setFolha(null);
    setGabarito(null);
    setLeitura(null);
    setResultado(null);
    setErro(null);
    setManual(false);
    setAspectoCartao(null);
    setAnuladas(new Set());
    setPendentesDissert([]);
    setNotasDissert({});
    setAvisoLancamento(null);
    mudarFase('PROCURANDO_QR');
  }, [mudarFase]);

  // ---- Câmera -----------------------------------------------------------------
  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let cancelado = false;

    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            // 1920x1080: câmeras traseiras de celular suportam isso tranquilamente, e sem
            // subir o pedido aqui o LARGURA_PROC acima não tem o que aproveitar — o
            // navegador já entregava perto de 1280px, então processar em 1200/1600 não
            // ganhava nada de verdade.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelado) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = fluxo;
          await videoRef.current.play();
          setCamAtiva(true);
        }
      } catch (e) {
        setErroCam(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Permissão de câmera negada. Libere a câmera para este site nas configurações do navegador.'
            : 'Não foi possível abrir a câmera. Use a correção manual pelo código do cartão.'
        );
      }
    })();

    return () => {
      cancelado = true;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ---- Laço de leitura --------------------------------------------------------
  const processarQuadro = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || ocupadoRef.current) return;
    if (faseRef.current === 'ENVIANDO' || faseRef.current === 'PRONTO' || faseRef.current === 'CONFIRMAR_BRANCO') return;

    ocupadoRef.current = true;
    // Marca se chegamos a enviar: no erro isso decide entre "mostra o resultado da
    // tentativa" e "volta a procurar QR". Ler faseRef aqui não serve — o compilador a
    // estreita pela guarda acima e não enxerga as trocas de fase do meio do caminho.
    let tentouEnviar = false;
    try {
      const escala = LARGURA_PROC / video.videoWidth;
      canvas.width = LARGURA_PROC;
      canvas.height = Math.round(video.videoHeight * escala);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // O QR é lido em TODO quadro, não só na fase de procura. Ele serve a duas coisas
      // além de identificar: dá a âncora de orientação (sem ela o cartão deitado não
      // pode ser lido com segurança) e denuncia a troca de folha no meio da leitura.
      const qr = await lerQrCode(img);

      if (faseRef.current === 'PROCURANDO_QR' || (qr && qr.valor !== folhaRef.current?.codigo)) {
        if (!qr) return;

        let identificada: FolhaIdentificada;
        try {
          identificada = await identificarFolha(qr.valor);
        } catch (eIdent) {
          // Anexa o texto CRU lido do QR à mensagem — sem isso, "código não encontrado"
          // não diz se a câmera leu o código certo (e ele não existe mesmo) ou leu
          // algo errado (aí o problema é a leitura do QR, não o cadastro).
          // O erro do supabase.rpc() é um objeto PostgrestError (tem `.message`, mas não
          // é instanceof Error) — String(objeto) dá "[object Object]", não o texto.
          const msg =
            eIdent instanceof Error
              ? eIdent.message
              : typeof eIdent === 'object' && eIdent && 'message' in eIdent
                ? String((eIdent as { message: unknown }).message)
                : String(eIdent);
          throw new Error(`${msg} (QR lido: "${qr.valor}")`);
        }
        const chave = `${identificada.prova_id}:${identificada.versao}`;

        let cache = cacheGeomRef.current.get(chave);
        if (!cache) {
          const gab = await obterGabaritoVersao(identificada.prova_id, identificada.versao);
          cache = {
            gabarito: gab,
            geom: calcularGeometria(
              gab.map((g) => ({ numeroNaProva: g.numero_na_prova, qtdAlternativas: g.qtd_alternativas }))
            ),
          };
          cacheGeomRef.current.set(chave, cache);
        }

        folhaRef.current = identificada;
        geomRef.current = cache.geom;
        // Folha nova: a leitura anterior não vale mais como confirmação.
        ultimaLeituraRef.current = null;
        setFolha(identificada);
        setGabarito(cache.gabarito);
        setAspectoCartao(aspectoParaEnquadrar(cache.geom));
        setLeitura(null);
        setErro(null);
        setAnuladas(new Set());
        void bipe('identificado');
        mudarFase('LENDO_CARTAO');
        return;
      }

      // LENDO_CARTAO
      const geom = geomRef.current;
      const alvo = folhaRef.current;
      if (!geom || !alvo) return;

      const lida = lerCartao(img, geom, qr?.centro);
      if (!lida) return;
      setLeitura(lida);

      const assinatura = lida.marcacoes.join('|');
      if (ultimaLeituraRef.current !== assinatura) {
        // Primeiro quadro com este resultado: guarda e espera o próximo confirmar.
        ultimaLeituraRef.current = assinatura;
        return;
      }

      // Folha inteiramente em branco é a assinatura de um erro de leitura, não de um
      // aluno que não respondeu nada — e gravar zero em silêncio é o pior desfecho aqui.
      // O caso legítimo existe, então não é bloqueio: é um toque a mais.
      if (lida.marcacoes.every((m) => m === '')) {
        mudarFase('CONFIRMAR_BRANCO');
        return;
      }

      mudarFase('ENVIANDO');
      tentouEnviar = true;
      const r = await corrigirPorOmr(alvo.codigo, lida.marcacoes, 'CAMERA');
      await posGravar(alvo, r);
      mudarFase('PRONTO');
    } catch (e) {
      console.error('Erro no processamento da câmera:', e);
      setErro(extrairMensagemErro(e));
      void bipe('erro');
      // Sem envio, volta a procurar QR: insistir no mesmo cartão com o mesmo erro só
      // repete o erro. Com envio, para em PRONTO para o professor ler a mensagem.
      mudarFase(tentouEnviar ? 'PRONTO' : 'PROCURANDO_QR');
    } finally {
      ocupadoRef.current = false;
    }
  }, [mudarFase, onCorrigido]);

  useEffect(() => {
    if (!camAtiva) return;
    const id = setInterval(() => { void processarQuadro(); }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [camAtiva, processarQuadro]);

  /**
   * Roda depois de gravar o cartão com sucesso (câmera ou botão "Gravar"): mostra o
   * resultado, busca as questões dissertativas/redação deste aluno (se houver, pra
   * digitar a nota delas aqui mesmo) e já lança a nota pros professores selecionados —
   * sem confirmação, porque aqui é sempre o valor recém-corrigido substituindo o que
   * havia antes, que é exatamente o resultado esperado de corrigir de novo.
   */
  async function posGravar(alvo: FolhaIdentificada, r: ResultadoCorrecaoOmr) {
    setResultado(r);
    onCorrigido?.(r);
    void bipe('sucesso');
    setAvisoLancamento(null);

    try {
      const itens = await listarItensPendentesCorrecao(alvo.prova_id);
      setPendentesDissert(itens.filter((i) => i.aluno_id === alvo.aluno_id));
    } catch {
      setPendentesDissert([]);
    }

    try {
      await lancarNotasNoBoletim(alvo.prova_id, true);
      setAvisoLancamento('Nota lançada para os professores selecionados.');
    } catch (eLancar) {
      // "sem nota"/"não lança no boletim" são configuração normal da prova, não erro —
      // não vale assustar o professor com isso a cada cartão gravado.
      const msg = extrairMensagemErro(eLancar);
      if (!/sem nota|não lança no boletim/i.test(msg)) {
        setAvisoLancamento(`Não foi possível lançar a nota no boletim: ${msg}`);
      }
    }
  }

  async function enviarLeituraAtual() {
    const alvo = folhaRef.current;
    const lida = leitura;
    if (!alvo || !lida) return;
    mudarFase('ENVIANDO');
    try {
      const r = await corrigirPorOmr(alvo.codigo, lida.marcacoes, 'CAMERA');
      await posGravar(alvo, r);
    } catch (e) {
      console.error('Erro ao enviar leitura:', e);
      setErro(extrairMensagemErro(e));
      void bipe('erro');
    } finally {
      mudarFase('PRONTO');
    }
  }

  async function alternarAnulacao(questionId: string) {
    const alvo = folhaRef.current;
    if (!alvo || fase !== 'PRONTO' || !resultado) return;
    const anularAgora = !anuladas.has(questionId);
    setAnulando(questionId);
    try {
      const r = await anularItemProva(alvo.prova_id, alvo.aluno_id, questionId, anularAgora);
      setAnuladas((atual) => {
        const novo = new Set(atual);
        if (r.anulada_manual) novo.add(questionId); else novo.delete(questionId);
        return novo;
      });
      setResultado((atual) => (atual ? { ...atual, nota: r.nota } : atual));
    } catch (e) {
      console.error('Erro ao alternar anulação:', e);
      setErro(extrairMensagemErro(e));
    } finally {
      setAnulando(null);
    }
  }

  async function salvarNotaDissert(item: ItemPendenteCorrecao) {
    const alvo = folhaRef.current;
    if (!alvo) return;
    const bruto = (notasDissert[item.item_id] ?? '').replace(',', '.').trim();
    const valorMax = Number(item.valor) || 0;
    const valor = Number(bruto);
    if (bruto === '' || !Number.isFinite(valor) || valor < 0 || valor > valorMax) {
      setErro(`Informe uma nota entre 0 e ${valorMax.toFixed(2)} para a questão ${item.ordem}.`);
      return;
    }
    setSalvandoDissertId(item.item_id);
    try {
      await corrigirItemDissertativo(item.item_id, valor, null);
      setPendentesDissert((atual) =>
        atual.map((i) => (i.item_id === item.item_id ? { ...i, corrigido: true, valor_obtido: valor } : i))
      );
      // A nota da prova mudou — reconsulta a folha pra atualizar o total mostrado, e
      // relança pros professores selecionados com o valor novo.
      const atualizada = await identificarFolha(alvo.codigo);
      setResultado((atual) => (atual ? { ...atual, nota: atualizada.nota } : atual));
      try {
        await lancarNotasNoBoletim(alvo.prova_id, true);
        setAvisoLancamento('Nota lançada para os professores selecionados.');
      } catch {
        // Silencioso aqui: já avisamos uma vez em posGravar; não repetir a cada questão
        // dissertativa salva evita empilhar avisos pra um problema já sinalizado.
      }
    } catch (e) {
      console.error('Erro ao salvar nota da questão aberta:', e);
      setErro(extrairMensagemErro(e));
    } finally {
      setSalvandoDissertId(null);
    }
  }

  const provaDiferente =
    !!provaEsperadaId && !!folha && folha.prova_id !== provaEsperadaId;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-ms-card border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-ms-main">
          <Camera className="w-5 h-5" />
          <span className="font-bold text-sm">Modo correção</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManual((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 text-ms-muted hover:text-ms-main text-xs font-bold"
          >
            <Keyboard className="w-3.5 h-3.5" />
            {manual ? 'Voltar à câmera' : 'Digitar'}
          </button>
          <button onClick={onFechar} className="text-ms-muted hover:text-ms-main"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {erroCam && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-ms-dark">
            <div className="max-w-sm text-center space-y-3">
              <CameraOff className="w-10 h-10 text-ms-muted mx-auto" />
              <p className="text-sm text-ms-muted">{erroCam}</p>
            </div>
          </div>
        )}

        {/* Moldura: dá ao professor uma referência de enquadramento. A leitura não
            depende dela — quem define a área é a homografia das quatro marcas. */}
        {!erroCam && !manual && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            <div
              className={`rounded-2xl border-4 transition-colors ${
                fase === 'PRONTO' ? 'border-green-400'
                  : fase === 'CONFIRMAR_BRANCO' ? 'border-amber-500'
                  : fase === 'LENDO_CARTAO' ? 'border-amber-300'
                  : 'border-white/40'
              }`}
              style={{
                // A moldura toma a forma da folha desta versão — cartão de 10 questões é
                // uma coluna em pé, o de 45 são três colunas quase quadradas. Enquanto o
                // QR não foi lido ainda não se sabe qual é, e 3:4 é o palpite melhor que
                // 4:3, porque a folha é impressa em A4 retrato.
                aspectRatio: aspectoCartao ? String(aspectoCartao) : '3 / 4',
                width: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          </div>
        )}

        {manual && (
          <div className="absolute inset-0 bg-ms-dark overflow-y-auto">
            <CorrecaoManualPainel
              onCorrigido={(r) => {
                setResultado(r);
                onCorrigido?.(r);
                void bipe('sucesso');
                lancarNotasNoBoletim(r.prova_id, true)
                  .then(() => setAvisoLancamento('Nota lançada para os professores selecionados.'))
                  .catch((e) => {
                    const msg = extrairMensagemErro(e);
                    if (!/sem nota|não lança no boletim/i.test(msg)) {
                      setAvisoLancamento(`Não foi possível lançar a nota no boletim: ${msg}`);
                    }
                  });
              }}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 bg-ms-card border-t border-gray-800 px-4 py-3 space-y-2 max-h-[45vh] overflow-y-auto">
        {erro && (
          <div className="flex items-start gap-2 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-300 font-medium">{erro}</p>
            </div>
            <button
              onClick={reiniciar}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-800 text-red-200 text-[11px] font-bold shrink-0 hover:bg-red-900/50"
              title="Limpar a tela e voltar a procurar o QR Code"
            >
              <RotateCcw className="w-3 h-3" /> Atualizar
            </button>
          </div>
        )}

        {avisoLancamento && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 border ${
            avisoLancamento.startsWith('Não foi possível')
              ? 'bg-amber-950/50 border-amber-900'
              : 'bg-green-950/40 border-green-900'
          }`}>
            <p className={`text-xs font-medium ${avisoLancamento.startsWith('Não foi possível') ? 'text-amber-200' : 'text-green-200'}`}>
              {avisoLancamento}
            </p>
          </div>
        )}

        {provaDiferente && (
          <div className="flex items-start gap-2 bg-amber-950/50 border border-amber-900 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200 font-medium">
              Este cartão é de outra prova ({folha?.titulo}). A correção vale para a prova do
              próprio cartão — confira se não misturou as pilhas.
            </p>
          </div>
        )}

        {!folha && !manual && (
          <p className="text-sm text-ms-muted text-center py-2">
            {camAtiva ? 'Aponte a câmera para o QR Code do cartão.' : 'Iniciando a câmera...'}
          </p>
        )}

        {folha && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ms-main truncate">{folha.aluno_nome}</p>
                <p className="text-xs text-ms-muted">
                  {folha.serie_nome ? `${folha.serie_nome} — ` : ''}Turma {folha.turma_nome ?? '—'}
                  {folha.numero_chamada != null ? ` · Nº ${folha.numero_chamada}` : ''} · Versão {folha.versao}
                </p>
              </div>
              {folha.ja_corrigido && !resultado && (
                <span className="text-[10px] font-bold text-amber-300 border border-amber-800 rounded-full px-2 py-0.5 shrink-0">
                  já corrigido
                </span>
              )}
            </div>

            {fase === 'LENDO_CARTAO' && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-amber-300 font-medium">
                  {leitura ? 'Segure firme para confirmar a leitura...' : 'Enquadre o cartão inteiro, com os quatro cantos pretos visíveis.'}
                </p>
                {leitura && (
                  <button
                    onClick={() => void enviarLeituraAtual()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold shrink-0 hover:bg-blue-600"
                    title="Gravar agora esta leitura, sem esperar dois quadros seguidos concordarem"
                  >
                    <Save className="w-3.5 h-3.5" /> Gravar
                  </button>
                )}
              </div>
            )}
            {fase === 'CONFIRMAR_BRANCO' && (
              <div className="flex items-center justify-between gap-3 bg-amber-950/50 border border-amber-900 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-200 font-medium">
                  Nenhuma marcação foi detectada. Confira se a folha está bem enquadrada e iluminada —
                  ou confirme, se o aluno entregou o cartão em branco mesmo.
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { ultimaLeituraRef.current = null; mudarFase('LENDO_CARTAO'); }}
                    className="px-3 py-1.5 rounded-lg border border-gray-700 text-ms-main text-xs font-bold"
                  >
                    Ler de novo
                  </button>
                  <button
                    onClick={() => void enviarLeituraAtual()}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold"
                  >
                    Está em branco
                  </button>
                </div>
              </div>
            )}
            {fase === 'ENVIANDO' && (
              <p className="flex items-center gap-1.5 text-xs text-ms-muted"><Loader2 className="w-3 h-3 animate-spin" /> Gravando...</p>
            )}

            {leitura && gabarito && (
              <GradeLeitura
                leitura={leitura}
                gabarito={gabarito}
                anuladas={anuladas}
                anulando={anulando}
                onClicar={fase === 'PRONTO' && resultado ? alternarAnulacao : undefined}
              />
            )}

            {fase === 'PRONTO' && resultado && (
              <p className="text-[11px] text-ms-muted">
                Toque numa questão para anular o ponto dela (ex.: marcou a bolha certa mas não
                mostrou a resolução no papel). Toque de novo para desfazer.
              </p>
            )}

            {resultado && (
              <div className="flex items-center justify-between gap-3 bg-ms-dark border border-gray-800 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] text-ms-muted truncate">
                    <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    {resultado.acertos}/{resultado.total_linhas} acertos
                    {resultado.em_branco > 0 ? ` · ${resultado.em_branco} em branco` : ''}
                    {resultado.anuladas > 0 ? ` · ${resultado.anuladas} anulada(s)` : ''}
                    {anuladas.size > 0 ? ` · ${anuladas.size} anulada(s) manualmente` : ''}
                  </p>
                  {resultado.modo_nota !== 'SEM_NOTA' && resultado.nota != null && (
                    <p
                      className="text-3xl font-black leading-tight tracking-tight"
                      style={{ color: corPorPorcentagem((Number(resultado.nota) / Number(resultado.valor_total)) * 100) }}
                    >
                      {Number(resultado.nota).toFixed(2)}
                      <span className="text-sm font-medium text-ms-muted"> / {Number(resultado.valor_total).toFixed(2)}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={reiniciar}
                  className="px-4 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 shrink-0"
                >
                  Próximo
                </button>
              </div>
            )}

            {resultado && pendentesDissert.length > 0 && (
              <div className="space-y-2 bg-ms-dark border border-gray-800 rounded-lg p-2.5">
                <p className="text-[11px] font-bold text-ms-muted">
                  Questão(ões) aberta(s) desta prova — digite a nota agora, sem precisar corrigir depois:
                </p>
                {pendentesDissert.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-2">
                    <span className="text-xs text-ms-main shrink-0 w-14">
                      Q{item.ordem} / {Number(item.valor).toFixed(2)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={Number(item.valor)}
                      placeholder="Nota"
                      value={notasDissert[item.item_id] ?? (item.valor_obtido != null ? String(item.valor_obtido) : '')}
                      onChange={(e) => setNotasDissert((prev) => ({ ...prev, [item.item_id]: e.target.value }))}
                      className="w-20 px-2 py-1 bg-ms-card border border-gray-700 rounded text-ms-main text-xs outline-none focus:ring-2 focus:ring-ms-blue"
                    />
                    <button
                      onClick={() => void salvarNotaDissert(item)}
                      disabled={salvandoDissertId === item.item_id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ms-blue text-white text-[11px] font-bold hover:bg-blue-600 disabled:opacity-40 shrink-0"
                    >
                      {salvandoDissertId === item.item_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                    </button>
                    {item.corrigido && salvandoDissertId !== item.item_id && (
                      <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * As letras lidas, em grade. Verde/vermelho vêm do gabarito da versão, que o professor
 * já tem direito de ver — é o retorno imediato que permite perceber, ainda com a folha
 * na mão, que uma linha saiu em branco por marcação fraca.
 *
 * Clicável só depois de PRONTO (onClicar vem undefined antes disso): antes de gravar o
 * cartão não existe item na tabela pra anular. Uma anulada fica riscada e cinza, mesmo
 * que a bolha marcada estivesse certa — é exatamente o que a anulação sinaliza.
 */
function GradeLeitura({
  leitura,
  gabarito,
  anuladas,
  anulando,
  onClicar,
}: {
  leitura: LeituraCartao;
  gabarito: LinhaGabarito[];
  anuladas: Set<string>;
  anulando: string | null;
  onClicar?: (questionId: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
      {leitura.marcacoes.map((marca, i) => {
        const linha = gabarito[i];
        const duvidosa = leitura.linhasDuvidosas.includes(i + 1);
        const vazia = marca === '' || marca === '*';
        const certa = !vazia && linha?.bolha_correta === marca;
        const anulada = !!linha && anuladas.has(linha.question_id);

        const cor = anulada
          ? 'bg-gray-900 text-gray-500 border-gray-700 line-through opacity-60'
          : vazia
          ? 'bg-gray-800 text-gray-500 border-gray-700'
          : certa
            ? 'bg-green-900/60 text-green-200 border-green-700'
            : 'bg-red-900/50 text-red-200 border-red-800';

        const clicavel = !!onClicar && !!linha;

        return (
          <button
            key={i}
            type="button"
            disabled={!clicavel || anulando === linha?.question_id}
            onClick={() => linha && onClicar?.(linha.question_id)}
            title={
              clicavel
                ? `Questão ${linha?.numero_na_prova ?? i + 1}${anulada ? ' — anulada, toque para desfazer' : ' — toque para anular'}`
                : `Questão ${linha?.numero_na_prova ?? i + 1}${duvidosa ? ' — leitura duvidosa' : ''}`
            }
            className={`flex flex-col items-center justify-center rounded border text-[10px] leading-none py-1 ${cor} ${
              duvidosa && !anulada ? 'ring-1 ring-amber-400' : ''
            } ${clicavel ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
          >
            <span className="opacity-60">{linha?.numero_na_prova ?? i + 1}</span>
            <span className="font-bold text-xs">
              {anulando === linha?.question_id ? '···' : marca === '' ? '–' : marca}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cor da nota conforme o % de acerto: vermelho (0%) -> verde (60%, considerado a nota
 * de corte) -> azul (100%). Interpolação linear em RGB entre os dois trechos, em vez de
 * uma classe Tailwind fixa, porque o ponto de virada (60%) não é 0/50/100 — não cai em
 * nenhuma escala pronta.
 */
function corPorPorcentagem(pct: number): string {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const VERMELHO = [220, 38, 38];
  const VERDE = [34, 197, 94];
  const AZUL = [37, 99, 235];
  const [a, b, t] = p <= 60 ? [VERMELHO, VERDE, p / 60] : [VERDE, AZUL, (p - 60) / 40];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function extrairMensagemErro(e: unknown): string {
  if (!e) return 'Erro desconhecido.';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const err = e as { message?: unknown; details?: unknown; hint?: unknown; error?: unknown; error_description?: unknown };
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err.details === 'string' && err.details) return err.details;
    if (typeof err.error_description === 'string' && err.error_description) return err.error_description;
    if (typeof err.error === 'string' && err.error) return err.error;
    if (typeof err.hint === 'string' && err.hint) return err.hint;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
