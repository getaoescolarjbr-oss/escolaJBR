import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CameraOff, Check, Keyboard, Loader2, X } from 'lucide-react';
import type { CartaoGeom } from '../../utils/cartaoResposta';
import { calcularGeometria } from '../../utils/cartaoResposta';
import { lerCartao, lerQrCode, type LeituraCartao } from '../../lib/omr';
import type { FolhaIdentificada, LinhaGabarito, ResultadoCorrecaoOmr } from '../../types/correcaoOmr';
import {
  corrigirPorOmr,
  identificarFolha,
  obterGabaritoVersao,
} from '../../services/correcaoOmrService';
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

/** Largura de processamento. Acima disto o ganho de acerto não paga a queda de quadros. */
const LARGURA_PROC = 900;

/** Intervalo entre processamentos. ~6 leituras/s é mais que suficiente para folha parada. */
const INTERVALO_MS = 160;

type Fase = 'PROCURANDO_QR' | 'LENDO_CARTAO' | 'ENVIANDO' | 'PRONTO';

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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
    if (faseRef.current === 'ENVIANDO' || faseRef.current === 'PRONTO') return;

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

      if (faseRef.current === 'PROCURANDO_QR') {
        const codigo = await lerQrCode(img);
        if (!codigo) return;

        const identificada = await identificarFolha(codigo);
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
        setFolha(identificada);
        setGabarito(cache.gabarito);
        setErro(null);
        void bipe('identificado');
        mudarFase('LENDO_CARTAO');
        return;
      }

      // LENDO_CARTAO
      const geom = geomRef.current;
      const alvo = folhaRef.current;
      if (!geom || !alvo) return;

      const lida = lerCartao(img, geom);
      if (!lida) return;
      setLeitura(lida);

      const assinatura = lida.marcacoes.join('|');
      if (ultimaLeituraRef.current !== assinatura) {
        // Primeiro quadro com este resultado: guarda e espera o próximo confirmar.
        ultimaLeituraRef.current = assinatura;
        return;
      }

      mudarFase('ENVIANDO');
      tentouEnviar = true;
      const r = await corrigirPorOmr(alvo.codigo, lida.marcacoes, 'CAMERA');
      setResultado(r);
      onCorrigido?.(r);
      void bipe('sucesso');
      mudarFase('PRONTO');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
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
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className={`w-full max-w-2xl aspect-[4/3] rounded-2xl border-4 transition-colors ${
              fase === 'PRONTO' ? 'border-green-400'
                : fase === 'LENDO_CARTAO' ? 'border-amber-300'
                : 'border-white/40'
            }`} />
          </div>
        )}

        {manual && (
          <div className="absolute inset-0 bg-ms-dark overflow-y-auto">
            <CorrecaoManualPainel
              onCorrigido={(r) => { setResultado(r); onCorrigido?.(r); void bipe('sucesso'); }}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 bg-ms-card border-t border-gray-800 px-4 py-3 space-y-2 max-h-[45vh] overflow-y-auto">
        {erro && (
          <div className="flex items-start gap-2 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 font-medium">{erro}</p>
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
              <p className="text-xs text-amber-300 font-medium">
                {leitura ? 'Segure firme para confirmar a leitura...' : 'Enquadre o cartão inteiro, com os quatro cantos pretos visíveis.'}
              </p>
            )}
            {fase === 'ENVIANDO' && (
              <p className="flex items-center gap-1.5 text-xs text-ms-muted"><Loader2 className="w-3 h-3 animate-spin" /> Gravando...</p>
            )}

            {leitura && gabarito && <GradeLeitura leitura={leitura} gabarito={gabarito} />}

            {resultado && (
              <div className="flex items-center justify-between gap-3 bg-green-950/40 border border-green-900 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  <p className="text-xs text-green-200 font-bold truncate">
                    {resultado.acertos}/{resultado.total_linhas} acertos
                    {resultado.modo_nota !== 'SEM_NOTA' && resultado.nota != null
                      ? ` · nota ${Number(resultado.nota).toFixed(2)} de ${Number(resultado.valor_total).toFixed(2)}`
                      : ''}
                    {resultado.em_branco > 0 ? ` · ${resultado.em_branco} em branco` : ''}
                    {resultado.anuladas > 0 ? ` · ${resultado.anuladas} anulada(s)` : ''}
                  </p>
                </div>
                <button
                  onClick={reiniciar}
                  className="px-4 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 shrink-0"
                >
                  Próximo
                </button>
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
 */
function GradeLeitura({ leitura, gabarito }: { leitura: LeituraCartao; gabarito: LinhaGabarito[] }) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
      {leitura.marcacoes.map((marca, i) => {
        const linha = gabarito[i];
        const duvidosa = leitura.linhasDuvidosas.includes(i + 1);
        const vazia = marca === '' || marca === '*';
        const certa = !vazia && linha?.bolha_correta === marca;

        const cor = vazia
          ? 'bg-gray-800 text-gray-500 border-gray-700'
          : certa
            ? 'bg-green-900/60 text-green-200 border-green-700'
            : 'bg-red-900/50 text-red-200 border-red-800';

        return (
          <div
            key={i}
            title={`Questão ${linha?.numero_na_prova ?? i + 1}${duvidosa ? ' — leitura duvidosa' : ''}`}
            className={`flex flex-col items-center justify-center rounded border text-[10px] leading-none py-1 ${cor} ${
              duvidosa ? 'ring-1 ring-amber-400' : ''
            }`}
          >
            <span className="opacity-60">{linha?.numero_na_prova ?? i + 1}</span>
            <span className="font-bold text-xs">{marca === '' ? '–' : marca}</span>
          </div>
        );
      })}
    </div>
  );
}
