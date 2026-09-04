import { useRef, useState } from 'react';
import {
  Bold,
  Combine,
  Grid3x3,
  PaintBucket,
  Split,
  Subscript,
  Superscript,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  X,
} from 'lucide-react';

type Alinhamento = 'left' | 'center' | 'right' | 'justify';
type PosicaoTabela = 'left' | 'center' | 'right';

type Celula = {
  texto: string;
  colspan: number;
  rowspan: number;
  oculta: boolean;
  align: Alinhamento;
  sombreado: boolean;
};

type Ponto = { r: number; c: number };

interface Props {
  onInserir: (marcador: string) => void;
  onFechar: () => void;
}

function gradeVazia(linhas: number, colunas: number): Celula[][] {
  return Array.from({ length: linhas }, () =>
    Array.from({ length: colunas }, () => ({ texto: '', colspan: 1, rowspan: 1, oculta: false, align: 'left', sombreado: false }))
  );
}

function normalizarRetangulo(a: Ponto, b: Ponto) {
  return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
}

export function TableInsertDialog({ onInserir, onFechar }: Props) {
  const [etapa, setEtapa] = useState<'tamanho' | 'edicao'>('tamanho');
  const [linhas, setLinhas] = useState(3);
  const [colunas, setColunas] = useState(3);
  const [grade, setGrade] = useState<Celula[][]>([]);
  const [posicaoTabela, setPosicaoTabela] = useState<PosicaoTabela>('left');
  const [ancora, setAncora] = useState<Ponto | null>(null);
  const [fimSelecao, setFimSelecao] = useState<Ponto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [celulaAtiva, setCelulaAtiva] = useState<Ponto | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function criarGrade() {
    const l = Math.min(Math.max(linhas, 1), 20);
    const c = Math.min(Math.max(colunas, 1), 12);
    setGrade(gradeVazia(l, c));
    setEtapa('edicao');
  }

  function editarCelula(r: number, c: number, patch: Partial<Celula>) {
    setGrade((g) => g.map((row, ri) => (ri === r ? row.map((cel, ci) => (ci === c ? { ...cel, ...patch } : cel)) : row)));
  }

  function selecionarCelula(r: number, c: number) {
    setErro(null);
    if (!ancora) {
      setAncora({ r, c });
      setFimSelecao({ r, c });
      return;
    }
    if (ancora.r === r && ancora.c === c) {
      setAncora(null);
      setFimSelecao(null);
      return;
    }
    setFimSelecao({ r, c });
  }

  const retangulo = ancora && fimSelecao ? normalizarRetangulo(ancora, fimSelecao) : null;
  const tamanhoSelecao = retangulo ? (retangulo.r2 - retangulo.r1 + 1) * (retangulo.c2 - retangulo.c1 + 1) : 0;

  function celulaNaSelecao(r: number, c: number) {
    return !!retangulo && r >= retangulo.r1 && r <= retangulo.r2 && c >= retangulo.c1 && c <= retangulo.c2;
  }

  function mesclarSelecao() {
    if (!retangulo || tamanhoSelecao < 2) return;
    const { r1, r2, c1, c2 } = retangulo;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cel = grade[r][c];
        if (cel.oculta || cel.colspan > 1 || cel.rowspan > 1) {
          setErro('Uma das células selecionadas já faz parte de outra mesclagem. Desfaça a mesclagem antes.');
          return;
        }
      }
    }
    setGrade((g) =>
      g.map((row, ri) =>
        row.map((cel, ci) => {
          if (ri === r1 && ci === c1) return { ...cel, colspan: c2 - c1 + 1, rowspan: r2 - r1 + 1, oculta: false };
          if (ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2) return { ...cel, texto: '', colspan: 1, rowspan: 1, oculta: true };
          return cel;
        })
      )
    );
    setAncora(null);
    setFimSelecao(null);
  }

  function desmesclar(r: number, c: number) {
    const cel = grade[r][c];
    const r2 = r + cel.rowspan - 1;
    const c2 = c + cel.colspan - 1;
    setGrade((g) =>
      g.map((row, ri) =>
        row.map((celula, ci) => {
          if (ri === r && ci === c) return { ...celula, colspan: 1, rowspan: 1 };
          if (ri >= r && ri <= r2 && ci >= c && ci <= c2) return { ...celula, oculta: false };
          return celula;
        })
      )
    );
  }

  // Formatação (negrito/sub/sobrescrito) envolve o texto SELECIONADO dentro do input da
  // célula ativa com a mesma marcação `<tag>` já usada no resto do editor (parseInline em
  // questionMarkup.tsx entende) — por isso o texto da célula mostra as tags "cruas" enquanto
  // edita, igual ao enunciado/alternativas.
  function formatarCelulaAtiva(tag: 'strong' | 'sub' | 'sup') {
    if (!celulaAtiva) return;
    const { r, c } = celulaAtiva;
    const el = inputRefs.current[`${r}-${c}`];
    if (!el) return;
    const texto = grade[r][c].texto;
    const start = el.selectionStart ?? texto.length;
    const end = el.selectionEnd ?? texto.length;
    const selecionado = texto.slice(start, end);
    const novoTexto = `${texto.slice(0, start)}<${tag}>${selecionado}</${tag}>${texto.slice(end)}`;
    editarCelula(r, c, { texto: novoTexto });
    const novoInicio = start + tag.length + 2;
    const novoFim = novoInicio + selecionado.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(novoInicio, novoFim);
    });
  }

  function definirAlinhamentoAtivo(align: Alinhamento) {
    if (!celulaAtiva) return;
    editarCelula(celulaAtiva.r, celulaAtiva.c, { align });
  }

  function alternarSombreadoAtivo() {
    if (!celulaAtiva) return;
    editarCelula(celulaAtiva.r, celulaAtiva.c, { sombreado: !grade[celulaAtiva.r][celulaAtiva.c].sombreado });
  }

  const cAtiva = celulaAtiva ? grade[celulaAtiva.r]?.[celulaAtiva.c] : null;

  function confirmarInsercao() {
    const matriz = grade.map((row) =>
      row.map((cel) => {
        if (cel.oculta) return null;
        const simples = cel.colspan === 1 && cel.rowspan === 1 && cel.align === 'left' && !cel.sombreado;
        if (simples) return cel.texto;
        return {
          text: cel.texto,
          ...(cel.colspan > 1 ? { colspan: cel.colspan } : {}),
          ...(cel.rowspan > 1 ? { rowspan: cel.rowspan } : {}),
          ...(cel.align !== 'left' ? { align: cel.align } : {}),
          ...(cel.sombreado ? { shade: true } : {}),
        };
      })
    );
    const dados = { rows: matriz, ...(posicaoTabela !== 'left' ? { align: posicaoTabela } : {}) };
    const marcador = `\n[[TABLE:${encodeURIComponent(JSON.stringify(dados))}]]\n`;
    onInserir(marcador);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-ms-main flex items-center gap-2">
            <Grid3x3 className="w-5 h-5" /> Inserir tabela
          </h3>
          <button onClick={onFechar} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        {etapa === 'tamanho' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ms-muted mb-1">Linhas</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={linhas}
                  onChange={(e) => setLinhas(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ms-muted mb-1">Colunas</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={colunas}
                  onChange={(e) => setColunas(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={criarGrade} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600">
                Criar grade
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ms-muted">
              Clique numa célula e depois em outra pra selecionar um retângulo, então mescle. Pra formatar, selecione o texto dentro
              da célula (clique no input primeiro) e use a barra abaixo.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ms-muted">Posição da tabela na página</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-gray-800 bg-ms-dark/40 p-1">
                <button
                  type="button"
                  title="Tabela à esquerda"
                  onClick={() => setPosicaoTabela('left')}
                  className={`rounded-lg p-1.5 hover:bg-ms-dark ${posicaoTabela === 'left' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
                >
                  <TextAlignStart className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Tabela centralizada"
                  onClick={() => setPosicaoTabela('center')}
                  className={`rounded-lg p-1.5 hover:bg-ms-dark ${posicaoTabela === 'center' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
                >
                  <TextAlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Tabela à direita"
                  onClick={() => setPosicaoTabela('right')}
                  className={`rounded-lg p-1.5 hover:bg-ms-dark ${posicaoTabela === 'right' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
                >
                  <TextAlignEnd className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-800 bg-ms-dark/40 p-1">
              <button
                type="button"
                title="Negrito"
                disabled={!celulaAtiva}
                onClick={() => formatarCelulaAtiva('strong')}
                className="rounded-lg p-1.5 text-ms-muted hover:bg-ms-dark hover:text-ms-main disabled:opacity-40"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Subscrito"
                disabled={!celulaAtiva}
                onClick={() => formatarCelulaAtiva('sub')}
                className="rounded-lg p-1.5 text-ms-muted hover:bg-ms-dark hover:text-ms-main disabled:opacity-40"
              >
                <Subscript className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Sobrescrito"
                disabled={!celulaAtiva}
                onClick={() => formatarCelulaAtiva('sup')}
                className="rounded-lg p-1.5 text-ms-muted hover:bg-ms-dark hover:text-ms-main disabled:opacity-40"
              >
                <Superscript className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-4 w-px bg-gray-800" />

              <button
                type="button"
                title="Alinhar à esquerda"
                disabled={!celulaAtiva}
                onClick={() => definirAlinhamentoAtivo('left')}
                className={`rounded-lg p-1.5 hover:bg-ms-dark disabled:opacity-40 ${cAtiva?.align === 'left' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
              >
                <TextAlignStart className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Centralizar"
                disabled={!celulaAtiva}
                onClick={() => definirAlinhamentoAtivo('center')}
                className={`rounded-lg p-1.5 hover:bg-ms-dark disabled:opacity-40 ${cAtiva?.align === 'center' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
              >
                <TextAlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Alinhar à direita"
                disabled={!celulaAtiva}
                onClick={() => definirAlinhamentoAtivo('right')}
                className={`rounded-lg p-1.5 hover:bg-ms-dark disabled:opacity-40 ${cAtiva?.align === 'right' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
              >
                <TextAlignEnd className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Justificar"
                disabled={!celulaAtiva}
                onClick={() => definirAlinhamentoAtivo('justify')}
                className={`rounded-lg p-1.5 hover:bg-ms-dark disabled:opacity-40 ${cAtiva?.align === 'justify' ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
              >
                <TextAlignJustify className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-4 w-px bg-gray-800" />

              <button
                type="button"
                title="Sombrear fundo (cinza)"
                disabled={!celulaAtiva}
                onClick={alternarSombreadoAtivo}
                className={`rounded-lg p-1.5 hover:bg-ms-dark disabled:opacity-40 ${cAtiva?.sombreado ? 'text-ms-blueText bg-ms-dark' : 'text-ms-muted'}`}
              >
                <PaintBucket className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="border-collapse">
                <tbody>
                  {grade.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cel, ci) => {
                        if (cel.oculta) return null;
                        const selecionada = celulaNaSelecao(ri, ci);
                        return (
                          <td
                            key={ci}
                            colSpan={cel.colspan}
                            rowSpan={cel.rowspan}
                            className={`border p-0 ${selecionada ? 'border-ms-blueText' : 'border-gray-800'}`}
                          >
                            <div
                              className={`relative min-w-[90px] ${selecionada ? 'bg-ms-blue/20' : cel.sombreado ? 'bg-gray-500/25' : ''}`}
                            >
                              <input
                                ref={(el) => {
                                  inputRefs.current[`${ri}-${ci}`] = el;
                                }}
                                value={cel.texto}
                                onFocus={() => setCelulaAtiva({ r: ri, c: ci })}
                                onChange={(e) => editarCelula(ri, ci, { texto: e.target.value })}
                                style={{ textAlign: cel.align }}
                                className="w-full px-2 py-1.5 bg-transparent text-ms-main text-xs outline-none"
                                placeholder={`L${ri + 1}C${ci + 1}`}
                              />
                              <button
                                type="button"
                                title={cel.colspan > 1 || cel.rowspan > 1 ? 'Desfazer mesclagem' : 'Selecionar célula'}
                                onClick={() => (cel.colspan > 1 || cel.rowspan > 1 ? desmesclar(ri, ci) : selecionarCelula(ri, ci))}
                                className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center text-[9px] ${
                                  selecionada ? 'bg-ms-blueText text-white' : 'bg-gray-800 text-ms-muted hover:bg-gray-700'
                                }`}
                              >
                                {cel.colspan > 1 || cel.rowspan > 1 ? <Split className="w-2.5 h-2.5" /> : ''}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {erro && <p className="text-xs text-red-400">{erro}</p>}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={mesclarSelecao}
                  disabled={tamanhoSelecao < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-ms-dark border border-gray-800 text-ms-main hover:bg-gray-800 disabled:opacity-40"
                >
                  <Combine className="w-3.5 h-3.5" /> Mesclar seleção {tamanhoSelecao >= 2 ? `(${tamanhoSelecao} células)` : ''}
                </button>
                {ancora && (
                  <button
                    onClick={() => {
                      setAncora(null);
                      setFimSelecao(null);
                    }}
                    className="text-xs text-ms-muted hover:text-ms-main"
                  >
                    Cancelar seleção
                  </button>
                )}
              </div>
              <button onClick={() => setEtapa('tamanho')} className="text-xs text-ms-muted hover:text-ms-main">
                ← Trocar tamanho
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
              <button onClick={onFechar} className="px-5 py-2.5 rounded-xl border border-gray-800 text-ms-muted font-bold text-sm">
                Cancelar
              </button>
              <button onClick={confirmarInsercao} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600">
                Inserir tabela
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
