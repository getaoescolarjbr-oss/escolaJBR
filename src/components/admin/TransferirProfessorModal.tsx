import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, Undo2 } from 'lucide-react';
import type { Professor } from '../../types';
import { supabase } from '../../lib/supabase';
import { ModalShell } from '../gestaoEscolar/indicadores/ModalShell';
import {
  ROTULOS_CONFLITO,
  ROTULOS_CONTAGEM,
  desfazerTransferencia,
  executarTransferencia,
  listarTransferencias,
  simularTransferencia,
} from '../../services/transferenciaProfessorService';
import type { RegistroTransferencia, ResultadoTransferencia } from '../../services/transferenciaProfessorService';

const CONFIRMACAO = 'TRANSFERIR';
const campo = 'w-full bg-ms-dark border border-gray-700 text-ms-main text-sm rounded-lg px-3 py-2';

interface TransferirProfessorModalProps {
  origem: Professor;
  todos: Professor[];
  onClose: () => void;
}

// Saída definitiva de um professor: turmas, diário, avaliações e horários passam a outro professor.
// Fluxo: escolher o destino → SIMULAR (só conta, não altera) → confirmar digitando TRANSFERIR.
// Tudo pode ser desfeito depois pelo histórico abaixo.
// Uma alocação do professor de origem = um par turma + disciplina (é o que se escolhe transferir).
interface AlocacaoOrigem { id: string; turmaId: string; turma: string; disciplina: string | null }

export function TransferirProfessorModal({ origem, todos, onClose }: TransferirProfessorModalProps) {
  const [destinoId, setDestinoId] = useState('');
  const [incluirOcorrencias, setIncluirOcorrencias] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [simulacao, setSimulacao] = useState<ResultadoTransferencia | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feita, setFeita] = useState<ResultadoTransferencia | null>(null);
  const [historico, setHistorico] = useState<RegistroTransferencia[]>([]);
  const [alocOrigem, setAlocOrigem] = useState<AlocacaoOrigem[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const candidatos = useMemo(
    () => todos.filter((p) => p.id !== origem.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [todos, origem.id]
  );

  const carregarHistorico = useCallback(async () => {
    try {
      setHistorico(await listarTransferencias(origem.id));
    } catch {
      /* histórico é complementar; a tela funciona sem ele */
    }
  }, [origem.id]);

  // Turmas E disciplinas que ainda são do professor de origem agora: permite escolher só algumas
  // (quando as aulas dele foram/vão ser divididas entre professores — inclusive duas disciplinas
  // da mesma turma indo para professores diferentes).
  const carregarTurmasOrigem = useCallback(async () => {
    const { data } = await supabase
      .from('alocacoes_v2')
      .select('id, turma_id, turmas(nome), disciplinas(nome)')
      .eq('professor_id', origem.id)
      .eq('is_espelho', false);
    const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
    const lista: AlocacaoOrigem[] = (data ?? [])
      .map((a: { id: string; turma_id: string; turmas: { nome: string } | { nome: string }[] | null; disciplinas: { nome: string } | { nome: string }[] | null }) => ({
        id: a.id, turmaId: a.turma_id, turma: um(a.turmas)?.nome ?? 'Turma', disciplina: um(a.disciplinas)?.nome ?? null,
      }))
      .sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR', { numeric: true }) || (a.disciplina ?? '').localeCompare(b.disciplina ?? '', 'pt-BR'));
    setAlocOrigem(lista);
    setSelecionadas(new Set(lista.map((x) => x.id)));
  }, [origem.id]);

  useEffect(() => {
    const t = setTimeout(carregarHistorico, 0);
    const t2 = setTimeout(carregarTurmasOrigem, 0);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [carregarHistorico, carregarTurmasOrigem]);

  function mudou() {
    setSimulacao(null);
    setConfirmacao('');
    setErro(null);
  }

  function alternarAlocacao(id: string) {
    setSelecionadas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
      return proximo;
    });
    mudou();
  }

  // Marca/desmarca todas as disciplinas de uma turma de uma vez.
  function alternarTurma(turmaId: string) {
    const ids = alocOrigem.filter((x) => x.turmaId === turmaId).map((x) => x.id);
    const todasMarcadas = ids.every((id) => selecionadas.has(id));
    setSelecionadas((prev) => {
      const proximo = new Set(prev);
      ids.forEach((id) => (todasMarcadas ? proximo.delete(id) : proximo.add(id)));
      return proximo;
    });
    mudou();
  }

  // Quando tudo está marcado, transfere tudo (comportamento de sempre, inclusive cotas de avaliação
  // da área); só manda a lista quando é um subconjunto de turma+disciplina.
  const alocacaoIdsParaEnviar = selecionadas.size > 0 && selecionadas.size < alocOrigem.length
    ? Array.from(selecionadas)
    : undefined;

  const turmasAgrupadas = useMemo(() => {
    const mapa = new Map<string, { turmaId: string; turma: string; itens: AlocacaoOrigem[] }>();
    alocOrigem.forEach((a) => {
      const g = mapa.get(a.turmaId) ?? { turmaId: a.turmaId, turma: a.turma, itens: [] };
      g.itens.push(a);
      mapa.set(a.turmaId, g);
    });
    return Array.from(mapa.values());
  }, [alocOrigem]);

  async function simular() {
    if (!destinoId || selecionadas.size === 0) return;
    setOcupado(true);
    setErro(null);
    try {
      setSimulacao(await simularTransferencia(origem.id, destinoId, incluirOcorrencias, alocacaoIdsParaEnviar));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao simular.');
    } finally {
      setOcupado(false);
    }
  }

  async function transferir() {
    if (!simulacao || confirmacao.trim().toUpperCase() !== CONFIRMACAO) return;
    setOcupado(true);
    setErro(null);
    try {
      setFeita(await executarTransferencia(origem.id, destinoId, incluirOcorrencias, observacao, alocacaoIdsParaEnviar));
      setSimulacao(null);
      await Promise.all([carregarHistorico(), carregarTurmasOrigem()]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao transferir.');
    } finally {
      setOcupado(false);
    }
  }

  // Depois de uma transferência parcial, sobram turmas com o professor de origem — permite
  // encadear outra transferência (para um terceiro professor, por exemplo) sem fechar o modal.
  function transferirMais() {
    setFeita(null);
    setDestinoId('');
    setObservacao('');
    mudou();
  }

  async function desfazer(id: string) {
    if (!confirm('Desfazer esta transferência? O que foi movido volta para o professor de origem (o que o destino criou depois continua com ele).')) return;
    setOcupado(true);
    setErro(null);
    try {
      await desfazerTransferencia(id);
      setFeita(null);
      await carregarHistorico();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao desfazer.');
    } finally {
      setOcupado(false);
    }
  }

  const impedimentos = simulacao ? (simulacao.conflitos.cotas_de_avaliacao ?? 0) + (simulacao.conflitos.recebe_nota_em_avaliacoes ?? 0) : 0;
  const bloqueadoPorAfastamento = !!simulacao?.avisos.some((a) => a.includes('afastamento/substituição'));
  const podeTransferir = !!simulacao && impedimentos === 0 && !bloqueadoPorAfastamento && confirmacao.trim().toUpperCase() === CONFIRMACAO && !ocupado;
  const nomeDestino = candidatos.find((p) => p.id === destinoId)?.nome ?? '';

  return (
    <ModalShell titulo={`Transferir turmas e diário — ${origem.nome}`} onClose={onClose} largura="max-w-3xl">
      <div className="space-y-5">
        <p className="text-xs text-gray-400 leading-relaxed">
          Use quando o professor saiu da escola e outro assumiu no lugar: as turmas, as atividades e vistos, as avaliações e notas, as chamadas e os
          horários passam <b>definitivamente</b> para o novo professor. Para afastamento temporário (atestado) use o botão de atestado, que espelha as turmas.
          O cadastro do professor de origem <b>não é apagado</b>, e a transferência pode ser desfeita.
        </p>

        {feita && (
          <div className="rounded-xl border border-green-700/50 bg-green-500/10 p-3 text-sm text-green-500 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <span>Transferência concluída: de <b>{feita.origem.nome}</b> para <b>{feita.destino.nome}</b>. Se algo estiver errado, desfaça pelo histórico abaixo.</span>
              {alocOrigem.length > 0 && (
                <div>
                  <p className="text-xs text-green-400/80">Ainda ficaram com {origem.nome}: {alocOrigem.map((x) => (x.disciplina ? `${x.turma} (${x.disciplina})` : x.turma)).join(', ')}.</p>
                  <button onClick={transferirMais} className="mt-1 flex items-center gap-1.5 text-xs font-bold text-ms-blue hover:underline">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir essas turmas/disciplinas para outro professor
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!feita && (
          <section className="space-y-3">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
              Professor que assume
              <select value={destinoId} onChange={(e) => { setDestinoId(e.target.value); mudou(); }} className={`${campo} mt-1`}>
                <option value="">Escolha…</option>
                {candidatos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>

            {alocOrigem.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Turmas e disciplinas a transferir <span className="text-gray-500 normal-case font-normal">(desmarque o que vai para outro professor; dá para dividir as disciplinas de uma mesma turma)</span>
                </p>
                <div className="space-y-1.5">
                  {turmasAgrupadas.map((g) => {
                    const marcadas = g.itens.filter((x) => selecionadas.has(x.id)).length;
                    return (
                      <div key={g.turmaId} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 px-2.5 py-1.5">
                        <button type="button" onClick={() => alternarTurma(g.turmaId)} className="text-xs font-black text-ms-main min-w-[4.5rem] text-left hover:text-ms-blueText" title="Marcar/desmarcar todas as disciplinas desta turma">
                          {g.turma}
                          {g.itens.length > 1 && <span className="ml-1 text-[10px] font-normal text-gray-500">{marcadas}/{g.itens.length}</span>}
                        </button>
                        {g.itens.map((a) => (
                          <label key={a.id} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border cursor-pointer ${selecionadas.has(a.id) ? 'border-ms-blue bg-ms-blue/10 text-ms-main' : 'border-gray-700 text-gray-500'}`}>
                            <input type="checkbox" checked={selecionadas.has(a.id)} onChange={() => alternarAlocacao(a.id)} className="w-3.5 h-3.5" />
                            {a.disciplina ?? 'Sem disciplina'}
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {selecionadas.size === 0 && <p className="text-xs text-red-400">Escolha ao menos uma turma/disciplina.</p>}
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-ms-main cursor-pointer">
              <input type="checkbox" checked={incluirOcorrencias} onChange={(e) => { setIncluirOcorrencias(e.target.checked); mudou(); }} className="mt-1 w-4 h-4" />
              <span>Levar também as ocorrências registradas por ele <span className="text-xs text-gray-500">(por padrão ficam com quem registrou, como histórico)</span></span>
            </label>
            <input placeholder="Observação (opcional): ex. saída em 24/09, assume o Prof. …" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} />
            <button onClick={simular} disabled={!destinoId || selecionadas.size === 0 || ocupado} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white text-sm font-bold rounded-lg disabled:opacity-50">
              {ocupado && !simulacao ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />} Simular (não altera nada)
            </button>
          </section>
        )}

        {erro && <p className="text-sm text-red-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{erro}</p>}

        {simulacao && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">O que será transferido para {nomeDestino}</h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(ROTULOS_CONTAGEM).map(([chave, rotulo]) => {
                  const n = simulacao.contagens[chave] ?? 0;
                  return (
                    <tr key={chave} className={`border-t border-gray-800 ${n === 0 ? 'opacity-40' : ''}`}>
                      <td className="py-1.5 text-gray-300">{rotulo}</td>
                      <td className="py-1.5 text-right font-bold text-ms-main">{n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {Object.entries(simulacao.conflitos).filter(([, n]) => n > 0).map(([chave, n]) => (
              <p key={chave} className="text-xs text-amber-400 flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{ROTULOS_CONFLITO[chave] ?? chave}: {n}</p>
            ))}
            {simulacao.avisos.map((a) => (
              <p key={a} className="text-xs text-amber-400 flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{a}</p>
            ))}

            <div className="rounded-xl border border-gray-700 p-3 space-y-2">
              <p className="text-xs text-gray-400">Para confirmar, digite <b className="text-ms-main">{CONFIRMACAO}</b>:</p>
              <div className="flex gap-2">
                <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={CONFIRMACAO} className={campo} aria-label="Confirmação" />
                <button onClick={transferir} disabled={!podeTransferir} className="px-4 py-2 bg-red-600 text-white text-sm font-black rounded-lg disabled:opacity-40 whitespace-nowrap flex items-center gap-2">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Transferir
                </button>
              </div>
              {(impedimentos > 0 || bloqueadoPorAfastamento) && <p className="text-xs text-red-400">Há impedimento acima: resolva antes de transferir.</p>}
            </div>
          </section>
        )}

        {historico.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Histórico de transferências deste professor</h3>
            <ul className="space-y-1.5">
              {historico.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 border border-gray-800 rounded-lg px-3 py-2 text-xs">
                  <span className="text-gray-300">
                    {new Date(h.feito_em).toLocaleString('pt-BR')} → <b className="text-ms-main">{h.destino_nome}</b>
                    {h.observacao && <span className="text-gray-500"> · {h.observacao}</span>}
                    {h.desfeita_em && <span className="text-amber-400"> · desfeita em {new Date(h.desfeita_em).toLocaleDateString('pt-BR')}</span>}
                  </span>
                  {!h.desfeita_em && (
                    <button onClick={() => desfazer(h.id)} disabled={ocupado} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold shrink-0 disabled:opacity-50">
                      <Undo2 className="w-3.5 h-3.5" /> Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ModalShell>
  );
}
