import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImagemIcone, Loader2, X, Check, RotateCcw, Crop, Trash2 } from 'lucide-react';
import {
  carregarImagem, detectarBordas, melhorarPagina, paraJpeg, quadPadrao, recortarPagina,
  type ModoScan, type Ponto, type Quad,
} from '../../lib/scanDocumento';
import { montarPdf } from '../../lib/pdfSimples';

interface Pagina { jpeg: Blob; url: string; largura: number; altura: number }

interface Props {
  nomeArquivo: string;              // sem extensão
  arquivoInicial?: File | null;     // foto escolhida fora do scanner (já entra no recorte)
  onConcluir: (pdf: File) => void;
  onFechar: () => void;
}

const ROTULO_MODO: Record<ModoScan, string> = { pb: 'Preto e branco', cor: 'Colorido', original: 'Original' };
const esperar = () => new Promise((r) => setTimeout(r, 30)); // deixa o "Processando..." aparecer antes do trabalho pesado

// Escâner de documento: câmera do celular (ou foto da galeria) -> acha as bordas do papel
// -> corrige a perspectiva -> melhora o contraste -> junta as páginas num PDF A4.
export function ScannerDocumento({ nomeArquivo, arquivoInicial, onConcluir, onFechar }: Props) {
  const [etapa, setEtapa] = useState<'inicio' | 'ajustar' | 'revisar'>('inicio');
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [origem, setOrigem] = useState<HTMLCanvasElement | null>(null);
  const [origemUrl, setOrigemUrl] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [recortada, setRecortada] = useState<HTMLCanvasElement | null>(null);
  const [modo, setModo] = useState<ModoScan>('pb');
  const [resultado, setResultado] = useState<HTMLCanvasElement | null>(null);
  const [resultadoUrl, setResultadoUrl] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const [exibicao, setExibicao] = useState({ w: 1, h: 1 });
  const arrastando = useRef<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.addEventListener('resize', medirImagem);
    return () => window.removeEventListener('resize', medirImagem);
  }, []);

  async function abrirFoto(arquivo: File) {
    setErro(null);
    setProcessando('Abrindo a foto...');
    try {
      await esperar();
      const c = await carregarImagem(arquivo);
      const q = detectarBordas(c);
      const blob = await paraJpeg(c, 0.7);
      setOrigem(c);
      setQuad(q);
      setOrigemUrl((antiga) => { if (antiga) URL.revokeObjectURL(antiga); return URL.createObjectURL(blob); });
      setEtapa('ajustar');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a foto.');
    } finally {
      setProcessando(null);
    }
  }

  useEffect(() => {
    if (arquivoInicial) { const t = setTimeout(() => abrirFoto(arquivoInicial), 0); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function medirImagem() {
    const el = imgRef.current;
    if (el) setExibicao({ w: el.clientWidth, h: el.clientHeight });
  }

  function moverCanto(e: React.PointerEvent<SVGSVGElement>) {
    if (arrastando.current === null || !origem || !quad) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * origem.width;
    const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) * origem.height;
    const novo = [...quad] as Quad;
    novo[arrastando.current] = { x, y };
    setQuad(novo);
  }

  async function confirmarRecorte() {
    if (!origem || !quad) return;
    setProcessando('Ajustando a página...');
    try {
      await esperar();
      const c = recortarPagina(origem, quad);
      setRecortada(c);
      await aplicarModo(c, modo);
      setEtapa('revisar');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao processar a página.');
    } finally {
      setProcessando(null);
    }
  }

  async function aplicarModo(base: HTMLCanvasElement, m: ModoScan) {
    const c = melhorarPagina(base, m);
    const blob = await paraJpeg(c, 0.6);
    setResultado(c);
    setResultadoUrl((antiga) => { if (antiga) URL.revokeObjectURL(antiga); return URL.createObjectURL(blob); });
  }

  async function trocarModo(m: ModoScan) {
    if (!recortada || m === modo) return;
    setModo(m);
    setProcessando('Melhorando a imagem...');
    await esperar();
    try { await aplicarModo(recortada, m); } finally { setProcessando(null); }
  }

  async function usarPagina() {
    if (!resultado) return;
    setProcessando('Salvando a página...');
    try {
      await esperar();
      const jpeg = await paraJpeg(resultado, 0.85);
      setPaginas((p) => [...p, { jpeg, url: URL.createObjectURL(jpeg), largura: resultado.width, altura: resultado.height }]);
      setOrigem(null); setRecortada(null); setResultado(null); setQuad(null);
      setEtapa('inicio');
    } finally {
      setProcessando(null);
    }
  }

  async function concluir() {
    setProcessando('Montando o PDF...');
    try {
      await esperar();
      const itens = await Promise.all(paginas.map(async (p) => ({ jpeg: new Uint8Array(await p.jpeg.arrayBuffer()), largura: p.largura, altura: p.altura })));
      onConcluir(new File([montarPdf(itens)], `${nomeArquivo}.pdf`, { type: 'application/pdf' }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao montar o PDF.');
      setProcessando(null);
    }
  }

  function fechar() {
    if (paginas.length > 0 && !confirm('Descartar as páginas escaneadas?')) return;
    onFechar();
  }

  const pontosSvg = quad ? quad.map((p: Ponto) => `${(p.x / (origem?.width ?? 1)) * exibicao.w},${(p.y / (origem?.height ?? 1)) * exibicao.h}`) : [];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-sm font-bold">Escanear documento{paginas.length > 0 ? ` · ${paginas.length} página${paginas.length > 1 ? 's' : ''}` : ''}</p>
        <button onClick={fechar} className="p-2 rounded-lg hover:bg-white/10" aria-label="Fechar"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4">
        {erro && <p className="text-sm text-red-300 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2 max-w-md">{erro}</p>}

        {etapa === 'inicio' && (
          <div className="w-full max-w-md space-y-4">
            <p className="text-sm text-gray-300">
              {paginas.length === 0
                ? 'Coloque o documento sobre uma superfície escura, com boa luz, e fotografe a folha inteira.'
                : 'Página salva. Escaneie a próxima (ex.: verso) ou conclua.'}
            </p>
            <button onClick={() => cameraRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-4 bg-ms-blue rounded-xl font-bold hover:bg-blue-600">
              <Camera className="w-5 h-5" /> Abrir câmera
            </button>
            <button onClick={() => galeriaRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20">
              <ImagemIcone className="w-5 h-5" /> Escolher foto da galeria
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) abrirFoto(f); }} />
            <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) abrirFoto(f); }} />

            {paginas.length > 0 && (
              <>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {paginas.map((p, i) => (
                    <div key={p.url} className="relative shrink-0">
                      <img src={p.url} alt={`Página ${i + 1}`} className="h-28 rounded-lg border border-white/20 bg-white" />
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 rounded px-1">{i + 1}</span>
                      <button onClick={() => setPaginas((l) => l.filter((_, k) => k !== i))} className="absolute top-1 right-1 p-1 bg-black/70 rounded-full" aria-label="Remover página"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={concluir} className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 rounded-xl font-bold hover:bg-green-500">
                  <Check className="w-5 h-5" /> Concluir ({paginas.length} página{paginas.length > 1 ? 's' : ''})
                </button>
              </>
            )}
          </div>
        )}

        {etapa === 'ajustar' && origemUrl && quad && origem && (
          <div className="w-full max-w-2xl space-y-3">
            <p className="text-sm text-gray-300">Arraste os 4 cantos até as pontas da folha.</p>
            <div className="relative mx-auto w-fit">
              <img ref={imgRef} src={origemUrl} alt="Foto" onLoad={medirImagem} className="block max-h-[60vh] max-w-full select-none" draggable={false} />
              <svg
                className="absolute inset-0 touch-none" width={exibicao.w} height={exibicao.h}
                onPointerMove={moverCanto} onPointerUp={() => { arrastando.current = null; }} onPointerCancel={() => { arrastando.current = null; }}
              >
                <polygon points={pontosSvg.join(' ')} fill="rgba(37,99,235,0.15)" stroke="#3b82f6" strokeWidth={2} />
                {pontosSvg.map((pt, i) => {
                  const [x, y] = pt.split(',').map(Number);
                  return <circle key={i} cx={x} cy={y} r={16} fill="rgba(59,130,246,0.55)" stroke="#fff" strokeWidth={2}
                    onPointerDown={(e) => { arrastando.current = i; (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); }} />;
                })}
              </svg>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setQuad(detectarBordas(origem))} className="flex items-center gap-1 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"><Crop className="w-4 h-4" /> Detectar bordas</button>
              <button onClick={() => setQuad(quadPadrao(origem.width, origem.height))} className="px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20">Página inteira</button>
              <button onClick={() => setEtapa('inicio')} className="flex items-center gap-1 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"><RotateCcw className="w-4 h-4" /> Outra foto</button>
              <button onClick={confirmarRecorte} className="flex items-center gap-1 px-5 py-2 bg-ms-blue rounded-lg text-sm font-bold hover:bg-blue-600"><Check className="w-4 h-4" /> Continuar</button>
            </div>
          </div>
        )}

        {etapa === 'revisar' && resultadoUrl && (
          <div className="w-full max-w-2xl space-y-3">
            <div className="flex justify-center gap-2">
              {(Object.keys(ROTULO_MODO) as ModoScan[]).map((m) => (
                <button key={m} onClick={() => trocarModo(m)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${modo === m ? 'bg-ms-blue' : 'bg-white/10 hover:bg-white/20'}`}>{ROTULO_MODO[m]}</button>
              ))}
            </div>
            <img src={resultadoUrl} alt="Página escaneada" className="mx-auto max-h-[62vh] max-w-full bg-white rounded shadow-lg" />
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setEtapa('ajustar')} className="flex items-center gap-1 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20"><Crop className="w-4 h-4" /> Refazer recorte</button>
              <button onClick={usarPagina} className="flex items-center gap-1 px-5 py-2 bg-green-600 rounded-lg text-sm font-bold hover:bg-green-500"><Check className="w-4 h-4" /> Usar esta página</button>
            </div>
          </div>
        )}
      </div>

      {processando && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">{processando}</p>
        </div>
      )}
    </div>
  );
}
