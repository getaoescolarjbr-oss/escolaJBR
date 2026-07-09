import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, FileText, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { OrgaoColegiado, MembroColegiado, TipoOrgaoColegiado, SegmentoMembro, FuncaoMembro, TitularSuplente } from '../../../types/governanca';
import {
  listarOrgaos,
  criarOrgao,
  atualizarOrgao,
  enviarEstatuto,
  obterUrlEstatuto,
  listarMembros,
  criarMembro,
  excluirMembro,
  obterNomesMembros,
} from '../../../services/governancaService';
import { listarPessoas } from '../../../services/pessoasService';
import type { Pessoa } from '../../../types/pessoas';
import { ComposicaoColegiadoEscolar } from './ComposicaoColegiadoEscolar';

const ROTULOS_TIPO: Record<TipoOrgaoColegiado, string> = {
  COLEGIADO_ESCOLAR: 'Colegiado Escolar',
  APM: 'APM',
  GREMIO: 'Grêmio Estudantil',
};

const ROTULOS_SEGMENTO: Record<SegmentoMembro, string> = {
  DOCENTE: 'Docente',
  ESPECIALISTA: 'Especialista',
  FUNCIONARIO: 'Funcionário',
  PAIS: 'Pais/Responsáveis',
  ALUNO: 'Aluno',
};

const ROTULOS_FUNCAO: Record<FuncaoMembro, string> = {
  PRESIDENTE: 'Presidente',
  SECRETARIO: 'Secretário(a)',
  CONSELHEIRO: 'Conselheiro(a)',
  DIRETORIA: 'Diretoria',
  CONSELHO_FISCAL: 'Conselho Fiscal',
};

// Mandato a vencer: alerta visual dentro de 60 dias (ou já vencido) — o mesmo
// horizonte usado para "lotes vencendo" na Cozinha, por consistência de produto.
const DIAS_ALERTA_MANDATO = 60;

function diasParaVencer(mandatoFim: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(mandatoFim + 'T00:00:00');
  return Math.round((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function OrgaosTab() {
  const [orgaos, setOrgaos] = useState<OrgaoColegiado[]>([]);
  const [membrosPorOrgao, setMembrosPorOrgao] = useState<Record<string, MembroColegiado[]>>({});
  const [nomesPessoas, setNomesPessoas] = useState<Record<string, string>>({});
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [orgaoExpandido, setOrgaoExpandido] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoEstatuto, setEnviandoEstatuto] = useState<string | null>(null);

  const [novoOrgao, setNovoOrgao] = useState({ tipo: 'COLEGIADO_ESCOLAR' as TipoOrgaoColegiado, nome: '', mandato_inicio: '', mandato_fim: '', cnpj: '' });
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [novoMembro, setNovoMembro] = useState({ pessoa_id: '', segmento: 'DOCENTE' as SegmentoMembro, funcao: 'CONSELHEIRO' as FuncaoMembro, titular_ou_suplente: 'TITULAR' as TitularSuplente, mandato_inicio: '', mandato_fim: '', membro_nato: false });

  async function carregar() {
    setLoading(true);
    try {
      setOrgaos(await listarOrgaos());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setPessoas(buscaPessoa.trim() ? await listarPessoas(buscaPessoa) : []);
    }, 250);
    return () => clearTimeout(timeout);
  }, [buscaPessoa]);

  async function carregarMembros(orgaoId: string) {
    setMembrosPorOrgao((m) => ({ ...m, [orgaoId]: [] }));
    const [lista, nomes] = await Promise.all([listarMembros(orgaoId), obterNomesMembros(orgaoId)]);
    setMembrosPorOrgao((m) => ({ ...m, [orgaoId]: lista }));
    setNomesPessoas((n) => ({ ...n, ...nomes }));
  }

  async function handleExpandir(orgaoId: string) {
    if (orgaoExpandido === orgaoId) {
      setOrgaoExpandido(null);
      return;
    }
    setOrgaoExpandido(orgaoId);
    if (!membrosPorOrgao[orgaoId]) await carregarMembros(orgaoId);
  }

  async function handleCriarOrgao() {
    if (!novoOrgao.nome) {
      setErro('Informe o nome do órgão.');
      return;
    }
    setErro(null);
    try {
      await criarOrgao({
        tipo: novoOrgao.tipo,
        nome: novoOrgao.nome,
        mandato_inicio: novoOrgao.mandato_inicio || null,
        mandato_fim: novoOrgao.mandato_fim || null,
        cnpj: novoOrgao.tipo === 'APM' ? novoOrgao.cnpj || null : null,
      });
      setNovoOrgao({ tipo: 'COLEGIADO_ESCOLAR', nome: '', mandato_inicio: '', mandato_fim: '', cnpj: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar órgão.');
    }
  }

  async function handleEnviarEstatuto(orgaoId: string, arquivo: File) {
    setEnviandoEstatuto(orgaoId);
    setErro(null);
    try {
      await enviarEstatuto(orgaoId, arquivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar estatuto.');
    } finally {
      setEnviandoEstatuto(null);
    }
  }

  async function handleVerEstatuto(orgao: OrgaoColegiado) {
    try {
      const url = await obterUrlEstatuto(orgao);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir estatuto.');
    }
  }

  async function handleAdicionarMembro(orgaoId: string) {
    if (!novoMembro.pessoa_id || !novoMembro.mandato_inicio || !novoMembro.mandato_fim) {
      setErro('Selecione a pessoa e o período do mandato.');
      return;
    }
    setErro(null);
    try {
      await criarMembro({ orgao_id: orgaoId, ...novoMembro });
      setNovoMembro({ pessoa_id: '', segmento: 'DOCENTE', funcao: 'CONSELHEIRO', titular_ou_suplente: 'TITULAR', mandato_inicio: '', mandato_fim: '', membro_nato: false });
      setBuscaPessoa('');
      await carregarMembros(orgaoId);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar membro.');
    }
  }

  async function handleExcluirMembro(orgaoId: string, membroId: string) {
    await excluirMembro(membroId);
    await carregarMembros(orgaoId);
  }

  function nomePessoa(pessoaId: string) {
    // Prioriza o mapa carregado via RPC (cobre COORDENACAO, que não lê `pessoas`
    // diretamente); cai pro resultado de busca só como fallback imediato ao
    // adicionar um membro novo, antes do próximo carregarMembros().
    return nomesPessoas[pessoaId] ?? pessoas.find((p) => p.id === pessoaId)?.nome;
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo órgão colegiado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novoOrgao.tipo} onChange={(e) => setNovoOrgao({ ...novoOrgao, tipo: e.target.value as TipoOrgaoColegiado })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input placeholder="Nome" value={novoOrgao.nome} onChange={(e) => setNovoOrgao({ ...novoOrgao, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" placeholder="Mandato início" value={novoOrgao.mandato_inicio} onChange={(e) => setNovoOrgao({ ...novoOrgao, mandato_inicio: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" placeholder="Mandato fim" value={novoOrgao.mandato_fim} onChange={(e) => setNovoOrgao({ ...novoOrgao, mandato_fim: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          {novoOrgao.tipo === 'APM' && (
            <input placeholder="CNPJ (APM é Unidade Executora)" value={novoOrgao.cnpj} onChange={(e) => setNovoOrgao({ ...novoOrgao, cnpj: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue md:col-span-2" />
          )}
        </div>
        <button onClick={handleCriarOrgao} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Criar órgão
        </button>
      </div>

      <div className="space-y-3">
        {orgaos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum órgão colegiado cadastrado.</p>
        ) : (
          orgaos.map((o) => {
            const expandido = orgaoExpandido === o.id;
            const membros = membrosPorOrgao[o.id] ?? [];
            return (
              <div key={o.id} className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden">
                <button onClick={() => handleExpandir(o.id)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-black text-ms-main flex items-center gap-2">
                      {o.nome}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-black">{ROTULOS_TIPO[o.tipo]}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {o.mandato_inicio && o.mandato_fim
                        ? `Mandato ${new Date(o.mandato_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} — ${new Date(o.mandato_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                        : 'Sem período de mandato definido'}
                      {o.cnpj && ` · CNPJ ${o.cnpj}`}
                    </p>
                  </div>
                  {expandido ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {expandido && (
                  <div className="px-5 pb-5 space-y-4 border-t border-gray-800 pt-4">
                    {o.tipo === 'APM' && (
                      <div className="flex items-center gap-3">
                        {o.estatuto_doc_path ? (
                          <button onClick={() => handleVerEstatuto(o)} className="flex items-center gap-1.5 text-xs font-bold text-ms-blue hover:text-blue-400">
                            <FileText className="w-3.5 h-3.5" /> Ver estatuto
                          </button>
                        ) : (
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer">
                            {enviandoEstatuto === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            Anexar estatuto
                            <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEnviarEstatuto(o.id, f); }} />
                          </label>
                        )}
                      </div>
                    )}

                    {o.tipo === 'COLEGIADO_ESCOLAR' && (
                      <ComposicaoColegiadoEscolar membros={membros} nomePessoa={nomePessoa} />
                    )}

                    <div className="space-y-1.5">
                      {membros.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum membro cadastrado.</p>
                      ) : (
                        membros.map((m) => {
                          const dias = diasParaVencer(m.mandato_fim);
                          const alerta = dias <= DIAS_ALERTA_MANDATO;
                          return (
                            <div key={m.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${alerta ? 'bg-amber-950/10 border-amber-700/40' : 'bg-ms-dark border-gray-800'}`}>
                              <div>
                                <span className="text-gray-300">{nomePessoa(m.pessoa_id) ?? 'Pessoa'}</span>
                                {m.membro_nato && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-black">Nato</span>}
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 uppercase font-black">{ROTULOS_SEGMENTO[m.segmento]}</span>
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 uppercase font-black">{ROTULOS_FUNCAO[m.funcao]}</span>
                                <span className="ml-1 text-[10px] text-gray-500">{m.titular_ou_suplente === 'TITULAR' ? 'Titular' : 'Suplente'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {alerta && (
                                  <span className="flex items-center gap-1 text-[10px] font-black text-amber-500">
                                    <AlertTriangle className="w-3 h-3" /> {dias < 0 ? 'Mandato vencido' : `Vence em ${dias}d`}
                                  </span>
                                )}
                                <button onClick={() => handleExcluirMembro(o.id, m.id)} className="p-1 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-800">
                      <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Adicionar membro</p>
                      <input
                        placeholder="Buscar pessoa por nome..."
                        value={buscaPessoa}
                        onChange={(e) => { setBuscaPessoa(e.target.value); setNovoMembro({ ...novoMembro, pessoa_id: '' }); }}
                        className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      />
                      {pessoas.length > 0 && !novoMembro.pessoa_id && (
                        <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-1.5">
                          {pessoas.map((p) => (
                            <button key={p.id} onClick={() => { setNovoMembro({ ...novoMembro, pessoa_id: p.id }); setBuscaPessoa(p.nome); }} className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-ms-blue/20 rounded">
                              {p.nome}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select value={novoMembro.segmento} onChange={(e) => setNovoMembro({ ...novoMembro, segmento: e.target.value as SegmentoMembro })} className="px-2 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                          {Object.entries(ROTULOS_SEGMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <select value={novoMembro.funcao} onChange={(e) => setNovoMembro({ ...novoMembro, funcao: e.target.value as FuncaoMembro })} className="px-2 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                          {Object.entries(ROTULOS_FUNCAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <select value={novoMembro.titular_ou_suplente} onChange={(e) => setNovoMembro({ ...novoMembro, titular_ou_suplente: e.target.value as TitularSuplente })} className="px-2 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                          <option value="TITULAR">Titular</option>
                          <option value="SUPLENTE">Suplente</option>
                        </select>
                        <div />
                        <input type="date" placeholder="Mandato início" value={novoMembro.mandato_inicio} onChange={(e) => setNovoMembro({ ...novoMembro, mandato_inicio: e.target.value })} className="px-2 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main" />
                        <input type="date" placeholder="Mandato fim" value={novoMembro.mandato_fim} onChange={(e) => setNovoMembro({ ...novoMembro, mandato_fim: e.target.value })} className="px-2 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main" />
                      </div>
                      {o.tipo === 'COLEGIADO_ESCOLAR' && (
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                          <input type="checkbox" checked={novoMembro.membro_nato} onChange={(e) => setNovoMembro({ ...novoMembro, membro_nato: e.target.checked })} />
                          Membro nato (Diretor/Diretor-Adjunto — secretário executivo, sem voto na presidência, fora da paridade)
                        </label>
                      )}
                      <button onClick={() => handleAdicionarMembro(o.id)} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Adicionar membro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
