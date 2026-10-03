import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  apagarRubrica,
  atualizarRubrica,
  criarRubrica,
  listarRubricas,
  type CriterioRubrica,
  type DadosRubrica,
  type RubricaRedacao,
} from '../../../services/redacaoService';

// Modos de correção de redação (critérios e pesos). Os modelos do sistema (ENEM, UFMS, UFGD) não se
// editam: o professor duplica e ajusta os pesos, ou cria um modo do zero — é assim que entram novas
// bancas sem mexer no sistema. Qualquer modo serve para qualquer proposta (um tema da UFMS pode ser
// corrigido pelos critérios do ENEM e vice-versa).

const MAX_CRITERIOS = 10;
const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

interface Props {
  onClose: () => void;
  /** Chamado depois de criar/editar/apagar, para quem abriu recarregar a lista de modos. */
  onMudou?: () => void;
}

interface Rascunho extends DadosRubrica {
  id: string | null;
}

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Algo deu errado.';
}

const criterioNovo = (n: number): CriterioRubrica => ({ chave: `c${n}`, rotulo: '', max: 200, passo: 40, descritores: '' });

function paraRascunho(r: RubricaRedacao, copia: boolean): Rascunho {
  return {
    id: copia ? null : r.id,
    nome: copia ? `${r.nome} (cópia)` : r.nome,
    descricao: r.descricao,
    criterios: r.criterios.map((c) => ({ ...c })),
    instrucoes: r.instrucoes,
    linhas_min: r.linhas_min,
    linhas_max: r.linhas_max,
    aviso_linhas_min: r.aviso_linhas_min,
    ativa: r.ativa,
  };
}

/** Texto do primeiro problema do rascunho, ou null se está válido. */
function validar(r: Rascunho): string | null {
  if (!r.nome.trim()) return 'Dê um nome ao modo de correção.';
  if (r.criterios.length < 1) return 'Inclua ao menos um critério.';
  for (const [i, c] of r.criterios.entries()) {
    const n = i + 1;
    if (!c.rotulo.trim()) return `Critério ${n}: falta o nome.`;
    if (!Number.isInteger(c.max) || c.max < 1 || c.max > 1000) return `Critério ${n}: o peso (máximo) deve ser um número inteiro de 1 a 1000.`;
    if (!Number.isInteger(c.passo) || c.passo < 1 || c.passo > c.max || c.max % c.passo !== 0) {
      return `Critério ${n}: o passo deve dividir o máximo (ex.: máximo 200 com passo 40 permite 0, 40, 80, 120, 160, 200).`;
    }
  }
  if (r.linhas_min > r.linhas_max) return 'O mínimo de linhas não pode passar do máximo.';
  return null;
}

export function RubricasModal({ onClose, onMudou }: Props) {
  const [lista, setLista] = useState<RubricaRedacao[] | null>(null);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setLista(await listarRubricas());
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, [recarregar]);

  async function salvar() {
    if (!editando) return;
    const problema = validar(editando);
    if (problema) { setErro(problema); return; }
    setOcupado(true);
    setErro(null);
    try {
      const dados: DadosRubrica = {
        nome: editando.nome.trim(),
        descricao: editando.descricao?.trim() || null,
        criterios: editando.criterios.map((c, i) => ({ ...c, chave: `c${i + 1}`, rotulo: c.rotulo.trim(), descritores: c.descritores.trim() })),
        instrucoes: editando.instrucoes?.trim() || null,
        linhas_min: editando.linhas_min,
        linhas_max: editando.linhas_max,
        aviso_linhas_min: editando.aviso_linhas_min?.trim() || null,
        ativa: editando.ativa,
      };
      if (editando.id) await atualizarRubrica(editando.id, dados);
      else await criarRubrica(dados);
      setEditando(null);
      await recarregar();
      onMudou?.();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(r: RubricaRedacao) {
    if (!confirm(`Apagar o modo “${r.nome}”? Redações já confirmadas guardam uma cópia dos critérios usados e não mudam.`)) return;
    setOcupado(true);
    setErro(null);
    try {
      await apagarRubrica(r.id);
      await recarregar();
      onMudou?.();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function mudarCriterio(i: number, patch: Partial<CriterioRubrica>) {
    if (!editando) return;
    setEditando({ ...editando, criterios: editando.criterios.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  }

  const total = editando ? editando.criterios.reduce((s, c) => s + (Number.isFinite(c.max) ? c.max : 0), 0) : 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Critérios de correção de redação</h2>
            <p className="text-xs text-ms-muted mt-0.5">
              Escolha, em cada avaliação ou redação, por quais critérios e pesos corrigir. Qualquer modo serve para qualquer proposta.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-900 dark:text-red-300 font-medium">{erro}</p>
            </div>
          )}

          {!editando ? (
            <>
              <button
                onClick={() => { setErro(null); setEditando({ id: null, nome: '', descricao: null, criterios: [criterioNovo(1)], instrucoes: null, linhas_min: 8, linhas_max: 30, aviso_linhas_min: null, ativa: true }); }}
                className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" /> Novo modo de correção
              </button>

              {lista === null ? (
                <div className="flex items-center gap-2 text-ms-muted py-6 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>
              ) : (
                <ul className="space-y-2">
                  {lista.map((r) => (
                    <li key={r.id} className={`border border-gray-800 rounded-xl p-3 flex flex-wrap items-start gap-3 ${r.ativa ? '' : 'opacity-60'}`}>
                      <div className="flex-1 min-w-56">
                        <p className="text-sm font-bold text-ms-main">
                          {r.nome}
                          {r.sistema && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-gray-700 text-ms-muted font-normal">modelo do sistema</span>}
                          {!r.ativa && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-gray-700 text-ms-muted font-normal">desativado</span>}
                        </p>
                        {r.descricao && <p className="text-xs text-ms-muted">{r.descricao}</p>}
                        <p className="text-[11px] text-ms-muted mt-1">
                          {r.criterios.length} critério(s): {r.criterios.map((c) => `${c.rotulo} (${c.max})`).join(' · ')} — total {r.criterios.reduce((s, c) => s + c.max, 0)} pontos · {r.linhas_min} a {r.linhas_max} linhas
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setErro(null); setEditando(paraRascunho(r, true)); }} className="flex items-center gap-1 px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold text-ms-main hover:bg-gray-800">
                          <Copy className="w-3.5 h-3.5" /> Duplicar
                        </button>
                        {!r.sistema && (
                          <>
                            <button onClick={() => { setErro(null); setEditando(paraRascunho(r, false)); }} className="flex items-center gap-1 px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold text-ms-main hover:bg-gray-800">
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button onClick={() => void apagar(r)} disabled={ocupado} className="flex items-center gap-1 px-3 py-1.5 border border-red-900/60 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/40 disabled:opacity-40" aria-label={`Apagar ${r.nome}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-ms-main">{editando.id ? 'Editar modo de correção' : 'Novo modo de correção'}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ms-muted">Nome</label>
                  <input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className={inputClass} placeholder="Ex.: UFMS com pesos do Anexo IV" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ms-muted">Descrição (opcional)</label>
                  <input value={editando.descricao ?? ''} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-ms-muted">Mínimo de linhas</label>
                    <input type="number" min={0} max={100} value={editando.linhas_min} onChange={(e) => setEditando({ ...editando, linhas_min: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-ms-muted">Máximo de linhas</label>
                    <input type="number" min={1} max={100} value={editando.linhas_max} onChange={(e) => setEditando({ ...editando, linhas_max: Number(e.target.value) })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-ms-muted">Aviso se faltar linhas (opcional)</label>
                  <input value={editando.aviso_linhas_min ?? ''} onChange={(e) => setEditando({ ...editando, aviso_linhas_min: e.target.value })} className={inputClass} placeholder="Ex.: Menos de 15 linhas zera a redação." />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ms-muted">Critérios e pesos — total: <span className="text-ms-main">{total} pontos</span></p>
                  <button
                    onClick={() => setEditando({ ...editando, criterios: [...editando.criterios, criterioNovo(editando.criterios.length + 1)] })}
                    disabled={editando.criterios.length >= MAX_CRITERIOS}
                    className="flex items-center gap-1 text-xs text-ms-blue underline disabled:opacity-40 disabled:no-underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar critério
                  </button>
                </div>
                {editando.criterios.map((c, i) => (
                  <div key={i} className="border border-gray-800 rounded-xl p-3 space-y-2 bg-ms-dark/40">
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-48">
                        <label className="text-[11px] font-bold text-ms-muted">Critério {i + 1}</label>
                        <input value={c.rotulo} onChange={(e) => mudarCriterio(i, { rotulo: e.target.value })} className={inputClass} placeholder="Ex.: Coesão e coerência" />
                      </div>
                      <div className="w-28">
                        <label className="text-[11px] font-bold text-ms-muted">Peso (máx.)</label>
                        <input type="number" min={1} max={1000} value={c.max} onChange={(e) => mudarCriterio(i, { max: Number(e.target.value) })} className={inputClass} />
                      </div>
                      <div className="w-24">
                        <label className="text-[11px] font-bold text-ms-muted" title="As notas permitidas são múltiplos do passo, de 0 até o peso">Passo</label>
                        <input type="number" min={1} value={c.passo} onChange={(e) => mudarCriterio(i, { passo: Number(e.target.value) })} className={inputClass} />
                      </div>
                      <button
                        onClick={() => setEditando({ ...editando, criterios: editando.criterios.filter((_, k) => k !== i) })}
                        disabled={editando.criterios.length <= 1}
                        className="px-2 py-2 text-red-400 hover:bg-red-950/40 rounded-lg disabled:opacity-30"
                        aria-label={`Remover critério ${i + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-ms-muted">O que vale cada nota (orienta a IA e você)</label>
                      <textarea value={c.descritores} onChange={(e) => mudarCriterio(i, { descritores: e.target.value })} rows={2} className={inputClass} placeholder="Ex.: 200 = argumenta com repertório próprio; 120 = argumentos genéricos; 0 = sem argumentação." />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-ms-muted">Regras gerais (nota zero, eliminação, cópia etc.) — a IA considera ao dar alertas</label>
                <textarea value={editando.instrucoes ?? ''} onChange={(e) => setEditando({ ...editando, instrucoes: e.target.value })} rows={3} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ms-main">
                <input type="checkbox" checked={editando.ativa} onChange={(e) => setEditando({ ...editando, ativa: e.target.checked })} className="accent-ms-blue" />
                Disponível para escolher
              </label>

              <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
                <button onClick={() => { setEditando(null); setErro(null); }} disabled={ocupado} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800 disabled:opacity-40">Cancelar</button>
                <button onClick={() => void salvar()} disabled={ocupado} className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
