import { useState } from 'react';
import { Combine, Grid3x3, Split, X } from 'lucide-react';

type Celula = { texto: string; colspan: number; rowspan: number; oculta: boolean };

type Ponto = { r: number; c: number };

interface Props {
  onInserir: (marcador: string) => void;
  onFechar: () => void;
}

function gradeVazia(linhas: number, colunas: number): Celula[][] {
  return Array.from({ length: linhas }, () =>
    Array.from({ length: colunas }, () => ({ texto: '', colspan: 1, rowspan: 1, oculta: false }))
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
  const [ancora, setAncora] = useState<Ponto | null>(null);
  const [fimSelecao, setFimSelecao] = useState<Ponto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function criarGrade() {
    const l = Math.min(Math.max(linhas, 1), 20);
    const c = Math.min(Math.max(colunas, 1), 12);
    setGrade(gradeVazia(l, c));
    setEtapa('edicao');
  }

  function editarTexto(r: number, c: number, texto: string) {
    setGrade((g) => g.map((row, ri) => (ri === r ? row.map((cel, ci) => (ci === c ? { ...cel, texto } : cel)) : row)));
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

  function confirmarInsercao() {
    const matriz = grade.map((row) =>
      row.map((cel) => {
        if (cel.oculta) return null;
        if (cel.colspan > 1 || cel.rowspan > 1) return { text: cel.texto, colspan: cel.colspan, rowspan: cel.rowspan };
        return cel.texto;
      })
    );
    const marcador = `\n[[TABLE:${encodeURIComponent(JSON.stringify(matriz))}]]\n`;
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
              Clique numa célula e depois em outra pra selecionar um retângulo, então mescle. Digite o texto direto nas células.
            </p>

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
                            <div className={`relative min-w-[90px] ${selecionada ? 'bg-ms-blue/20' : ''}`}>
                              <input
                                value={cel.texto}
                                onChange={(e) => editarTexto(ri, ci, e.target.value)}
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
