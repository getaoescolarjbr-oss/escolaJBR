import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Pencil, X } from 'lucide-react';
import type { Avaliacao } from '../../../types/avaliacoes';
import { arquivoParaImagem, recortarCaixaRedacao, recorteParaJpeg } from '../../../lib/recorteFolhaRedacao';
import {
  enviarImagemRedacao,
  listarRedacoes,
  prepararRedacao,
  prepararRedacaoAluno,
  salvarRedacao,
  transcreverRedacao,
  type RedacaoDaLista,
  type StatusRedacao,
} from '../../../services/redacaoService';
import { RedacaoRevisao } from './RedacaoRevisao';
import { RelatorioRedacoes } from './RelatorioRedacoes';
import { RubricasModal } from './RubricasModal';

// Correção de redação de uma prova impressa: o professor fotografa/envia as folhas (a leitura do QR
// identifica o aluno e as 4 marcas endireitam a foto), o portal recorta SÓ a caixa de texto, a IA
// transcreve, e o professor confere o texto, gera a prévia por competência e confirma a nota dele.

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
  /** Chamado ao fechar depois de ter confirmado alguma nota, para a lista de avaliações recarregar. */
  onCorrigido: () => void;
}

type Etapa = 'lendo' | 'identificando' | 'enviando' | 'transcrevendo' | 'pronto' | 'erro';

interface Processamento {
  id: number;
  arquivo: string;
  etapa: Etapa;
  detalhe?: string;
}

const ROTULO_ETAPA: Record<Etapa, string> = {
  lendo: 'Lendo a folha…',
  identificando: 'Identificando o aluno…',
  enviando: 'Enviando o recorte…',
  transcrevendo: 'Transcrevendo a letra…',
  pronto: 'Pronto para revisar',
  erro: 'Não deu',
};

const ROTULO_STATUS: Record<StatusRedacao | 'SEM' | 'DIGITADA_PELO_ALUNO', { texto: string; classe: string }> = {
  DIGITADA_PELO_ALUNO: { texto: 'Digitada pelo aluno', classe: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900' },
  SEM: { texto: 'Sem folha', classe: 'bg-ms-dark text-ms-muted border-gray-800' },
  ENVIADA: { texto: 'Enviada', classe: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  TRANSCRITA: { texto: 'Transcrita', classe: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  COM_PREVIA: { texto: 'Com prévia da IA', classe: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  REVISADA: { texto: 'Nota confirmada', classe: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
};

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => falha(new Error('Falha ao preparar a imagem'));
    r.readAsDataURL(blob);
  });
}

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Algo deu errado.';
}

export function CorrigirRedacaoModal({ avaliacao, onClose, onCorrigido }: Props) {
  const [lista, setLista] = useState<RedacaoDaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [processos, setProcessos] = useState<Processamento[]>([]);
  const [questaoId, setQuestaoId] = useState('');
  const [ocupadoAluno, setOcupadoAluno] = useState<string | null>(null);
  const [houveNota, setHouveNota] = useState(false);
  const [gerenciando, setGerenciando] = useState(false);
  const [relatorio, setRelatorio] = useState(false);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async () => {
    try {
      setLista(await listarRedacoes(avaliacao.id));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [avaliacao.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, [recarregar]);

  const questoes = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of lista ?? []) m.set(r.question_id, r.tema);
    return [...m.entries()].map(([id, tema]) => ({ id, tema }));
  }, [lista]);

  function marcar(id: number, patch: Partial<Processamento>) {
    setProcessos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function processarArquivo(arquivo: File) {
    const id = ++seq.current;
    setProcessos((ps) => [{ id, arquivo: arquivo.name, etapa: 'lendo' }, ...ps]);
    try {
      const img = await arquivoParaImagem(arquivo);
      const rec = await recortarCaixaRedacao(img);
      if (!rec.ok) throw new Error(rec.motivo);

      marcar(id, { etapa: 'identificando' });
      const prep = await prepararRedacao(rec.dados.codigo, questaoId || undefined);
      if (prep.precisa_escolher_questao) {
        throw new Error('Esta prova tem mais de uma redação. Escolha a questão no seletor acima e envie de novo.');
      }
      if (prep.prova_id !== avaliacao.id) throw new Error('Esta folha é de outra prova.');

      marcar(id, { etapa: 'enviando', detalhe: prep.aluno_nome });
      const jpeg = await recorteParaJpeg(rec.dados.recorte);
      const caminho = await enviarImagemRedacao(prep.prova_id, prep.aluno_id, prep.envio_id, jpeg);
      await salvarRedacao(prep.envio_id, { imagemPath: caminho });

      marcar(id, { etapa: 'transcrevendo' });
      const tr = await transcreverRedacao(await blobParaBase64(jpeg));
      await salvarRedacao(prep.envio_id, { linhas: tr.linhas, textoFinal: tr.linhas.map((l) => l.texto).join('\n') });
      marcar(id, { etapa: 'pronto' });
    } catch (e) {
      marcar(id, { etapa: 'erro', detalhe: mensagemErro(e) });
    }
  }

  async function aoEscolherArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arquivos = [...files];
    if (inputRef.current) inputRef.current.value = '';
    for (const a of arquivos) await processarArquivo(a); // um de cada vez: respeita o limite da IA
    await recarregar();
  }

  // Aluno sem folha escaneada: abre o registro dele (texto digitado online, ou em branco para o
  // professor digitar/colar). Não depende de folha sorteada nem de QR.
  async function abrirManual(r: RedacaoDaLista) {
    setOcupadoAluno(r.aluno_id);
    setErro(null);
    try {
      const prep = await prepararRedacaoAluno(avaliacao.id, r.aluno_id, r.question_id);
      if (prep.precisa_escolher_questao) throw new Error('Escolha a questão de redação.');
      await recarregar();
      setAbertoId(prep.envio_id);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupadoAluno(null);
    }
  }

  const visiveis = (lista ?? []).filter((r) => !questaoId || r.question_id === questaoId);
  const emAndamento = processos.some((p) => !['pronto', 'erro'].includes(p.etapa));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Corrigir redações — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted mt-0.5">
              Fotografe a folha de cada aluno; a IA transcreve e sugere a nota, e você decide.
            </p>
          </div>
          <button onClick={() => { onClose(); if (houveNota) onCorrigido(); }} className="text-ms-muted hover:text-ms-main" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {relatorio ? (
            <RelatorioRedacoes provaId={avaliacao.id} titulo={avaliacao.titulo} onVoltar={() => setRelatorio(false)} />
          ) : abertoId ? (
            <RedacaoRevisao
              envioId={abertoId}
              onVoltar={() => { setAbertoId(null); void recarregar(); }}
              onConfirmada={() => { setHouveNota(true); void recarregar(); }}
            />
          ) : (
            <div className="p-6 space-y-5">
              {erro && (
                <div className="flex items-start gap-2 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-900 dark:text-red-300 font-medium">{erro}</p>
                </div>
              )}

              <div className="border border-gray-800 rounded-xl p-4 space-y-3 bg-ms-dark/40">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => inputRef.current?.click()}
                    disabled={emAndamento}
                    className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
                  >
                    {emAndamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Fotografar ou enviar folhas
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => void aoEscolherArquivos(e.target.files)}
                  />
                  {questoes.length > 1 && (
                    <select
                      value={questaoId}
                      onChange={(e) => setQuestaoId(e.target.value)}
                      className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm"
                      aria-label="Questão de redação"
                    >
                      <option value="">Todas as redações</option>
                      {questoes.map((q, i) => <option key={q.id} value={q.id}>Redação {i + 1}{q.tema ? ` — ${q.tema.slice(0, 50)}` : ''}</option>)}
                    </select>
                  )}
                  <button onClick={() => setGerenciando(true)} className="text-xs text-ms-blue underline">Critérios de correção</button>
                  <button onClick={() => setRelatorio(true)} className="text-xs text-ms-blue underline">Relatório da turma</button>
                  <span className="text-xs text-ms-muted">
                    Enquadre a folha inteira (QR e os 4 quadrados pretos dos cantos visíveis). Pode escolher várias fotos de uma vez.
                  </span>
                </div>
                <p className="text-[11px] text-ms-muted">
                  Só o recorte das 30 linhas é enviado à IA: sem nome, turma nem QR.
                </p>

                {processos.length > 0 && (
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {processos.map((p) => (
                      <li key={p.id} className="flex items-start gap-2 text-xs">
                        {p.etapa === 'erro' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          : p.etapa === 'pronto' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            : <Loader2 className="w-3.5 h-3.5 animate-spin text-ms-muted mt-0.5 shrink-0" />}
                        <span className="text-ms-main">
                          <strong>{p.detalhe && p.etapa !== 'erro' ? p.detalhe : p.arquivo}</strong>
                          {' — '}
                          <span className={p.etapa === 'erro' ? 'text-red-400' : 'text-ms-muted'}>
                            {p.etapa === 'erro' ? p.detalhe : ROTULO_ETAPA[p.etapa]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {lista === null ? (
                <div className="flex items-center gap-2 text-ms-muted py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>
              ) : visiveis.length === 0 ? (
                <p className="text-sm text-ms-muted text-center py-6">
                  Nenhum aluno encontrado para esta prova. Confira as turmas da avaliação.
                </p>
              ) : (
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-ms-dark text-ms-muted text-xs">
                      <tr>
                        <th className="text-left px-3 py-2 w-12">Nº</th>
                        <th className="text-left px-3 py-2">Aluno</th>
                        <th className="text-left px-3 py-2 hidden sm:table-cell">Turma</th>
                        <th className="text-left px-3 py-2">Situação</th>
                        <th className="text-right px-3 py-2">Nota</th>
                        <th className="px-3 py-2 w-36" />
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((r) => {
                        const st = ROTULO_STATUS[r.status ?? (r.tem_texto_digitado ? 'DIGITADA_PELO_ALUNO' : 'SEM')];
                        return (
                          <tr key={`${r.aluno_id}-${r.question_id}`} className="border-t border-gray-800">
                            <td className="px-3 py-2 text-ms-muted">{r.numero_chamada ?? '—'}</td>
                            <td className="px-3 py-2 text-ms-main font-medium">{r.aluno_nome}</td>
                            <td className="px-3 py-2 text-ms-muted hidden sm:table-cell">{r.turma_nome ?? '—'}</td>
                            <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.classe}`}>{st.texto}</span></td>
                            <td className="px-3 py-2 text-right text-ms-main">{r.nota_total != null ? `${r.nota_total}/${r.nota_maxima ?? 1000}` : '—'}</td>
                            <td className="px-3 py-2 text-right">
                              {r.envio_id ? (
                                <button onClick={() => setAbertoId(r.envio_id)} className="px-3 py-1 rounded-lg border border-gray-800 text-xs font-bold text-ms-main hover:bg-gray-800">
                                  {r.status === 'REVISADA' ? 'Ver / ajustar' : 'Revisar'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => void abrirManual(r)}
                                  disabled={ocupadoAluno === r.aluno_id}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-800 text-xs text-ms-muted hover:text-ms-main disabled:opacity-40"
                                  title={r.tem_texto_digitado ? 'Revisar a redação que o aluno digitou' : 'Digitar ou colar o texto, sem foto'}
                                >
                                  {ocupadoAluno === r.aluno_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />} {r.tem_texto_digitado ? 'Revisar' : 'Digitar'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {gerenciando && <RubricasModal onClose={() => setGerenciando(false)} />}
    </div>
  );
}
