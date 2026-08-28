import { useEffect, useState } from 'react';
import { Loader2, Plus, CheckCircle2, FileCheck, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { OrgaoColegiado, MembroColegiado, ReuniaoColegiado, ReuniaoPresenca, Deliberacao, AtaColegiado, TipoReuniao } from '../../../types/governanca';
import {
  listarOrgaos,
  listarMembros,
  obterNomesMembros,
  listarReunioes,
  criarReuniao,
  marcarReuniaoRealizada,
  listarPresencas,
  marcarPresenca,
  listarDeliberacoes,
  criarDeliberacao,
  emitirAtaColegiado,
  obterAtaColegiado,
} from '../../../services/governancaService';

const ROTULOS_TIPO_REUNIAO: Record<TipoReuniao, string> = {
  ORDINARIA: 'Ordinária',
  EXTRAORDINARIA: 'Extraordinária',
  ASSEMBLEIA: 'Assembleia',
};

const ROTULOS_SEGMENTO: Record<string, string> = {
  DOCENTE: 'Docente', ESPECIALISTA: 'Especialista', FUNCIONARIO: 'Funcionário', PAIS: 'Pais/Responsáveis', ALUNO: 'Aluno',
};

function montarConteudoAta(orgao: OrgaoColegiado, reuniao: ReuniaoColegiado, membros: MembroColegiado[], nomes: Record<string, string>, presencas: ReuniaoPresenca[], deliberacoes: Deliberacao[]): string {
  const dataFormatada = new Date(reuniao.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const presentesIds = new Set(presencas.filter((p) => p.presente).map((p) => p.membro_id));
  const presentes = membros.filter((m) => presentesIds.has(m.id));
  const ausentes = membros.filter((m) => !presentesIds.has(m.id));

  const linhaMembro = (m: MembroColegiado) => `- ${nomes[m.pessoa_id] ?? 'Pessoa'} (${ROTULOS_SEGMENTO[m.segmento] ?? m.segmento}${m.membro_nato ? ', membro nato' : ''})`;

  let texto = `Ata da reunião ${ROTULOS_TIPO_REUNIAO[reuniao.tipo].toLowerCase()} de ${orgao.nome}, realizada em ${dataFormatada}.\n\n`;
  if (reuniao.pauta) texto += `Pauta:\n${reuniao.pauta}\n\n`;
  texto += `Presentes:\n${presentes.length ? presentes.map(linhaMembro).join('\n') : '(nenhum registrado)'}\n\n`;
  texto += `Ausentes:\n${ausentes.length ? ausentes.map(linhaMembro).join('\n') : '(nenhum)'}\n\n`;
  texto += `Deliberações:\n`;
  texto += deliberacoes.length
    ? deliberacoes.map((d, i) => `${i + 1}. ${d.descricao}${d.resultado ? ` — ${d.resultado}` : ''}`).join('\n')
    : '(nenhuma deliberação registrada)';
  return texto;
}

export function ReunioesTab() {
  const { usuarioId } = useAuth();
  const [orgaos, setOrgaos] = useState<OrgaoColegiado[]>([]);
  const [orgaoId, setOrgaoId] = useState('');
  const [membros, setMembros] = useState<MembroColegiado[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [reunioes, setReunioes] = useState<ReuniaoColegiado[]>([]);
  const [reuniaoExpandida, setReuniaoExpandida] = useState<string | null>(null);
  const [presencas, setPresencas] = useState<Record<string, ReuniaoPresenca[]>>({});
  const [deliberacoes, setDeliberacoes] = useState<Record<string, Deliberacao[]>>({});
  const [atas, setAtas] = useState<Record<string, AtaColegiado>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState<string | null>(null);

  const [novaReuniao, setNovaReuniao] = useState({ tipo: 'ORDINARIA' as TipoReuniao, data: new Date().toISOString().slice(0, 10), pauta: '' });
  const [novaDeliberacao, setNovaDeliberacao] = useState<Record<string, { descricao: string; resultado: string }>>({});

  async function carregarOrgaos() {
    setLoading(true);
    try {
      setOrgaos(await listarOrgaos());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregarOrgaos, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!orgaoId) return;
    (async () => {
      const [listaMembros, listaNomes, listaReunioes] = await Promise.all([listarMembros(orgaoId), obterNomesMembros(orgaoId), listarReunioes(orgaoId)]);
      setMembros(listaMembros);
      setNomes(listaNomes);
      setReunioes(listaReunioes);
      setReuniaoExpandida(null);
    })();
  }, [orgaoId]);

  async function carregarDetalhesReuniao(reuniao: ReuniaoColegiado) {
    const [listaPresencas, listaDeliberacoes] = await Promise.all([listarPresencas(reuniao.id), listarDeliberacoes(reuniao.id)]);
    setPresencas((p) => ({ ...p, [reuniao.id]: listaPresencas }));
    setDeliberacoes((d) => ({ ...d, [reuniao.id]: listaDeliberacoes }));
    if (reuniao.ata_id) {
      const ata = await obterAtaColegiado(reuniao.ata_id);
      if (ata) setAtas((a) => ({ ...a, [reuniao.id]: ata }));
    }
  }

  async function handleExpandir(reuniao: ReuniaoColegiado) {
    if (reuniaoExpandida === reuniao.id) {
      setReuniaoExpandida(null);
      return;
    }
    setReuniaoExpandida(reuniao.id);
    if (!presencas[reuniao.id]) await carregarDetalhesReuniao(reuniao);
  }

  async function handleCriarReuniao() {
    if (!orgaoId || !usuarioId) return;
    setErro(null);
    try {
      await criarReuniao({ orgao_id: orgaoId, tipo: novaReuniao.tipo, data: novaReuniao.data, pauta: novaReuniao.pauta || null, criado_por: usuarioId });
      setNovaReuniao({ tipo: 'ORDINARIA', data: new Date().toISOString().slice(0, 10), pauta: '' });
      setReunioes(await listarReunioes(orgaoId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao agendar reunião.');
    }
  }

  async function handleMarcarRealizada(reuniao: ReuniaoColegiado) {
    await marcarReuniaoRealizada(reuniao.id);
    setReunioes(await listarReunioes(orgaoId));
  }

  async function handleTogglePresenca(reuniao: ReuniaoColegiado, membroId: string, presenteAtual: boolean) {
    await marcarPresenca(reuniao.id, membroId, !presenteAtual);
    await carregarDetalhesReuniao(reuniao);
  }

  async function handleAdicionarDeliberacao(reuniao: ReuniaoColegiado) {
    const form = novaDeliberacao[reuniao.id];
    if (!form?.descricao) return;
    await criarDeliberacao(reuniao.id, form.descricao, form.resultado || null);
    setNovaDeliberacao({ ...novaDeliberacao, [reuniao.id]: { descricao: '', resultado: '' } });
    await carregarDetalhesReuniao(reuniao);
  }

  async function handleEmitirAta(reuniao: ReuniaoColegiado) {
    const orgao = orgaos.find((o) => o.id === orgaoId);
    if (!orgao) return;
    setEmitindo(reuniao.id);
    setErro(null);
    try {
      const conteudo = montarConteudoAta(orgao, reuniao, membros, nomes, presencas[reuniao.id] ?? [], deliberacoes[reuniao.id] ?? []);
      const titulo = `Ata — ${orgao.nome} — ${ROTULOS_TIPO_REUNIAO[reuniao.tipo]}`;
      const anoLetivo = new Date(reuniao.data + 'T12:00:00').getFullYear();
      const ata = await emitirAtaColegiado(reuniao.id, titulo, conteudo, anoLetivo);
      setAtas((a) => ({ ...a, [reuniao.id]: ata }));
      setReunioes(await listarReunioes(orgaoId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao emitir ata.');
    } finally {
      setEmitindo(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <select value={orgaoId} onChange={(e) => setOrgaoId(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
        <option value="">Selecione o órgão...</option>
        {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>

      {!orgaoId ? (
        <p className="text-sm text-gray-500">Selecione um órgão para ver suas reuniões.</p>
      ) : (
        <>
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova reunião</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={novaReuniao.tipo} onChange={(e) => setNovaReuniao({ ...novaReuniao, tipo: e.target.value as TipoReuniao })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
                {Object.entries(ROTULOS_TIPO_REUNIAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <input type="date" value={novaReuniao.data} onChange={(e) => setNovaReuniao({ ...novaReuniao, data: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            </div>
            <textarea placeholder="Pauta" value={novaReuniao.pauta} onChange={(e) => setNovaReuniao({ ...novaReuniao, pauta: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-20" />
            <button onClick={handleCriarReuniao} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
              <Plus className="w-4 h-4" /> Agendar reunião
            </button>
          </div>

          <div className="space-y-3">
            {reunioes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma reunião cadastrada para este órgão.</p>
            ) : (
              reunioes.map((r) => {
                const expandida = reuniaoExpandida === r.id;
                const presencasReuniao = presencas[r.id] ?? [];
                const presentesMap = new Map(presencasReuniao.map((p) => [p.membro_id, p.presente]));
                const ata = atas[r.id];
                return (
                  <div key={r.id} className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden">
                    <button onClick={() => handleExpandir(r)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="text-left">
                        <p className="text-sm font-black text-ms-main">
                          {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')} — {ROTULOS_TIPO_REUNIAO[r.tipo]}
                        </p>
                        {r.pauta && <p className="text-[11px] text-gray-500 line-clamp-1">{r.pauta}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black border ${
                          r.status === 'ATA_EMITIDA' ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : r.status === 'REALIZADA' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}>
                          {r.status === 'ATA_EMITIDA' ? 'Ata emitida' : r.status === 'REALIZADA' ? 'Realizada' : 'Agendada'}
                        </span>
                        {expandida ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    {expandida && (
                      <div className="px-5 pb-5 space-y-4 border-t border-gray-800 pt-4">
                        {r.status === 'AGENDADA' && (
                          <button onClick={() => handleMarcarRealizada(r)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como realizada
                          </button>
                        )}

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Presença</p>
                          {membros.map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-sm text-gray-300 px-3 py-1.5 bg-ms-dark rounded-lg border border-gray-800">
                              <input type="checkbox" checked={presentesMap.get(m.id) ?? false} onChange={() => handleTogglePresenca(r, m.id, presentesMap.get(m.id) ?? false)} disabled={r.status === 'ATA_EMITIDA'} />
                              {nomes[m.pessoa_id] ?? 'Pessoa'}
                              <span className="text-[10px] text-gray-500">({ROTULOS_SEGMENTO[m.segmento] ?? m.segmento})</span>
                            </label>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Deliberações</p>
                          {(deliberacoes[r.id] ?? []).map((d) => (
                            <div key={d.id} className="px-3 py-2 bg-ms-dark rounded-lg border border-gray-800 text-sm text-gray-300">
                              {d.descricao}{d.resultado && <span className="text-gray-500"> — {d.resultado}</span>}
                            </div>
                          ))}
                          {r.status !== 'ATA_EMITIDA' && (
                            <div className="flex flex-col md:flex-row gap-2">
                              <input
                                placeholder="Descrição"
                                value={novaDeliberacao[r.id]?.descricao ?? ''}
                                onChange={(e) => setNovaDeliberacao({ ...novaDeliberacao, [r.id]: { descricao: e.target.value, resultado: novaDeliberacao[r.id]?.resultado ?? '' } })}
                                className="flex-1 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main"
                              />
                              <input
                                placeholder="Resultado (opcional)"
                                value={novaDeliberacao[r.id]?.resultado ?? ''}
                                onChange={(e) => setNovaDeliberacao({ ...novaDeliberacao, [r.id]: { descricao: novaDeliberacao[r.id]?.descricao ?? '', resultado: e.target.value } })}
                                className="flex-1 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main"
                              />
                              <button onClick={() => handleAdicionarDeliberacao(r)} className="px-3 py-2 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600">Adicionar</button>
                            </div>
                          )}
                        </div>

                        {r.status === 'REALIZADA' && (
                          <button onClick={() => handleEmitirAta(r)} disabled={emitindo === r.id} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50">
                            {emitindo === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                            Emitir ata (numeração oficial)
                          </button>
                        )}

                        {ata && (
                          <div className="space-y-2 pt-2 border-t border-gray-800">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-ms-main">Ata nº {ata.numero_sequencial}/{ata.ano_letivo}</p>
                              <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-ms-blueText hover:text-blue-400">
                                <Printer className="w-3.5 h-3.5" /> Imprimir
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap text-xs text-gray-300 bg-ms-dark border border-gray-800 rounded-lg p-3 font-sans">{ata.conteudo_gerado}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
