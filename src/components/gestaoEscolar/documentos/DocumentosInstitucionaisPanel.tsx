import { useEffect, useState } from 'react';
import { Loader2, Plus, Upload, FileText, ChevronDown, ChevronUp, CheckCircle2, History, Globe, Lock, Award } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { DocumentoInstitucional, VersaoDocumento, TipoDocumentoInstitucional, VisibilidadeDocumento, StatusVersaoDocumento } from '../../../types/documentosInstitucionais';
import {
  listarDocumentos,
  criarDocumento,
  atualizarDocumento,
  listarVersoes,
  criarVersaoDocumento,
  obterUrlVersao,
  promoverVersaoVigente,
  listarOrgaosParaSelecao,
} from '../../../services/documentosInstitucionaisService';

const ROTULOS_TIPO: Record<TipoDocumentoInstitucional, string> = {
  PPP: 'Projeto Político-Pedagógico',
  REGIMENTO: 'Regimento Escolar',
  PLANO_GESTAO: 'Plano de Gestão',
  ATO_NORMATIVO: 'Ato Normativo',
  OUTRO: 'Outro',
};

const TIPOS_PEDAGOGICOS: TipoDocumentoInstitucional[] = ['PPP', 'REGIMENTO', 'PLANO_GESTAO'];

const ROTULOS_STATUS: Record<StatusVersaoDocumento, string> = {
  RASCUNHO: 'Rascunho',
  EM_APROVACAO: 'Em aprovação',
  VIGENTE: 'Vigente',
  SUBSTITUIDA: 'Substituída',
};

const CORES_STATUS: Record<StatusVersaoDocumento, string> = {
  RASCUNHO: 'bg-gray-800 text-gray-400 border-gray-700',
  EM_APROVACAO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  VIGENTE: 'bg-green-500/10 text-green-500 border-green-500/20',
  SUBSTITUIDA: 'bg-gray-800 text-gray-500 border-gray-700 line-through',
};

export function DocumentosInstitucionaisPanel() {
  const { hasRole } = useAuth();
  const ehGestao = hasRole('GESTAO');
  const tiposPermitidos = ehGestao ? (Object.keys(ROTULOS_TIPO) as TipoDocumentoInstitucional[]) : TIPOS_PEDAGOGICOS;

  const [documentos, setDocumentos] = useState<DocumentoInstitucional[]>([]);
  const [orgaos, setOrgaos] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [versoesPorDocumento, setVersoesPorDocumento] = useState<Record<string, VersaoDocumento[]>>({});
  const [documentoExpandido, setDocumentoExpandido] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [promovendo, setPromovendo] = useState<string | null>(null);
  const [versaoParaPromover, setVersaoParaPromover] = useState<VersaoDocumento | null>(null);
  const [orgaoAprovadorEscolhido, setOrgaoAprovadorEscolhido] = useState('');

  const [novoDocumento, setNovoDocumento] = useState({ tipo: tiposPermitidos[0], titulo: '', descricao: '', visibilidade: 'INTERNO' as VisibilidadeDocumento });
  const [novaVersao, setNovaVersao] = useState<Record<string, { arquivo: File | null; resumo: string }>>({});

  async function carregar() {
    setLoading(true);
    try {
      const [listaDocumentos, listaOrgaos] = await Promise.all([listarDocumentos(), listarOrgaosParaSelecao()]);
      setDocumentos(listaDocumentos);
      setOrgaos(listaOrgaos);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function carregarVersoes(documentoId: string) {
    const lista = await listarVersoes(documentoId);
    setVersoesPorDocumento((v) => ({ ...v, [documentoId]: lista }));
  }

  async function handleExpandir(documentoId: string) {
    if (documentoExpandido === documentoId) {
      setDocumentoExpandido(null);
      return;
    }
    setDocumentoExpandido(documentoId);
    if (!versoesPorDocumento[documentoId]) await carregarVersoes(documentoId);
  }

  async function handleCriarDocumento() {
    if (!novoDocumento.titulo) {
      setErro('Informe o título do documento.');
      return;
    }
    setErro(null);
    try {
      await criarDocumento({
        tipo: novoDocumento.tipo,
        titulo: novoDocumento.titulo,
        descricao: novoDocumento.descricao || null,
        visibilidade: novoDocumento.visibilidade,
      });
      setNovoDocumento({ tipo: tiposPermitidos[0], titulo: '', descricao: '', visibilidade: 'INTERNO' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar documento.');
    }
  }

  async function handleEnviarVersao(documentoId: string) {
    const form = novaVersao[documentoId];
    if (!form?.arquivo) {
      setErro('Selecione o arquivo da nova versão.');
      return;
    }
    setEnviando(documentoId);
    setErro(null);
    try {
      await criarVersaoDocumento(documentoId, form.arquivo, form.resumo);
      setNovaVersao({ ...novaVersao, [documentoId]: { arquivo: null, resumo: '' } });
      await carregarVersoes(documentoId);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar nova versão (verifique se você tem permissão para este tipo de documento).');
    } finally {
      setEnviando(null);
    }
  }

  async function handleVerArquivo(versao: VersaoDocumento) {
    try {
      const url = await obterUrlVersao(versao);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir arquivo.');
    }
  }

  function versaoVigente(documentoId: string): VersaoDocumento | undefined {
    return (versoesPorDocumento[documentoId] ?? []).find((v) => v.status === 'VIGENTE');
  }

  function exigeColegiado(documento: DocumentoInstitucional): boolean {
    return documento.tipo === 'PPP' || documento.tipo === 'REGIMENTO';
  }

  async function handleConfirmarPromocao(documento: DocumentoInstitucional) {
    if (!versaoParaPromover) return;
    if (exigeColegiado(documento) && !orgaoAprovadorEscolhido) {
      setErro('PPP e Regimento exigem o registro do órgão aprovador (Colegiado Escolar).');
      return;
    }
    setPromovendo(versaoParaPromover.id);
    setErro(null);
    try {
      await promoverVersaoVigente(versaoParaPromover.id, orgaoAprovadorEscolhido || null);
      setVersaoParaPromover(null);
      setOrgaoAprovadorEscolhido('');
      await carregarVersoes(documento.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao promover versão a vigente.');
    } finally {
      setPromovendo(null);
    }
  }

  async function handleAlterarVisibilidade(documento: DocumentoInstitucional) {
    const nova: VisibilidadeDocumento = documento.visibilidade === 'COMUNIDADE' ? 'INTERNO' : 'COMUNIDADE';
    try {
      await atualizarDocumento(documento.id, { visibilidade: nova });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao alterar visibilidade.');
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  const documentosPorTipo = tiposPermitidos.map((tipo) => ({ tipo, docs: documentos.filter((d) => d.tipo === tipo) }));

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-xs text-gray-500">
        Repositório versionado, não um editor colaborativo: subir uma nova versão nunca sobrescreve a anterior — o
        histórico completo fica preservado.
      </p>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo documento institucional</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novoDocumento.tipo} onChange={(e) => setNovoDocumento({ ...novoDocumento, tipo: e.target.value as TipoDocumentoInstitucional })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {tiposPermitidos.map((t) => <option key={t} value={t}>{ROTULOS_TIPO[t]}</option>)}
          </select>
          <input placeholder="Título" value={novoDocumento.titulo} onChange={(e) => setNovoDocumento({ ...novoDocumento, titulo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <textarea placeholder="Descrição (opcional)" value={novoDocumento.descricao} onChange={(e) => setNovoDocumento({ ...novoDocumento, descricao: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-20" />
        <label className="flex items-center gap-2 text-sm text-ms-main">
          <input type="checkbox" checked={novoDocumento.visibilidade === 'COMUNIDADE'} onChange={(e) => setNovoDocumento({ ...novoDocumento, visibilidade: e.target.checked ? 'COMUNIDADE' : 'INTERNO' })} />
          Visível à comunidade escolar (padrão: interno)
        </label>
        <button onClick={handleCriarDocumento} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Criar documento
        </button>
      </div>

      {documentosPorTipo.map(({ tipo, docs }) => (
        docs.length === 0 ? null : (
          <div key={tipo} className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">{ROTULOS_TIPO[tipo]}</p>
            {docs.map((d) => {
              const expandido = documentoExpandido === d.id;
              const versoes = versoesPorDocumento[d.id] ?? [];
              const vigente = versaoVigente(d.id);
              const historicoVisivel = historicoAberto === d.id;
              const outrasVersoes = versoes.filter((v) => v.status !== 'VIGENTE');
              return (
                <div key={d.id} className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden">
                  <button onClick={() => handleExpandir(d.id)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="text-left">
                      <p className="text-sm font-black text-ms-main flex items-center gap-2">
                        {d.titulo}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleAlterarVisibilidade(d); }}
                          title="Clique para alternar a visibilidade"
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase font-black border cursor-pointer hover:opacity-80 ${d.visibilidade === 'COMUNIDADE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                        >
                          {d.visibilidade === 'COMUNIDADE' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {d.visibilidade === 'COMUNIDADE' ? 'Comunidade' : 'Interno'}
                        </span>
                      </p>
                      {d.descricao && <p className="text-[11px] text-gray-500 mt-0.5">{d.descricao}</p>}
                    </div>
                    {expandido ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>

                  {expandido && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-800 pt-4">
                      {vigente ? (
                        <div className="flex items-center justify-between px-3 py-2.5 bg-green-950/10 border border-green-700/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-ms-main">Versão vigente: v{vigente.versao}</p>
                              {vigente.resumo_alteracoes && <p className="text-[11px] text-gray-500">{vigente.resumo_alteracoes}</p>}
                            </div>
                          </div>
                          <button onClick={() => handleVerArquivo(vigente)} className="flex items-center gap-1.5 text-xs font-bold text-ms-blue hover:text-blue-400 flex-shrink-0">
                            <FileText className="w-3.5 h-3.5" /> Ver arquivo
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-500">Nenhuma versão vigente ainda — este documento precisa ser aprovado/promovido.</p>
                      )}

                      {outrasVersoes.length > 0 && (
                        <div>
                          <button onClick={() => setHistoricoAberto(historicoVisivel ? null : d.id)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-200">
                            <History className="w-3.5 h-3.5" /> {historicoVisivel ? 'Ocultar' : 'Ver'} histórico ({outrasVersoes.length})
                          </button>
                          {historicoVisivel && (
                            <div className="space-y-1.5 mt-2">
                              {outrasVersoes.map((v) => {
                                const podePromover = v.status === 'RASCUNHO' || v.status === 'EM_APROVACAO';
                                const formAberto = versaoParaPromover?.id === v.id;
                                return (
                                  <div key={v.id} className="space-y-2">
                                    <div className="flex items-center justify-between px-3 py-2 bg-ms-dark rounded-lg border border-gray-800 text-sm">
                                      <div>
                                        <span className="text-gray-300">v{v.versao}</span>
                                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full uppercase font-black border ${CORES_STATUS[v.status]}`}>{ROTULOS_STATUS[v.status]}</span>
                                        {v.resumo_alteracoes && <span className="ml-2 text-[11px] text-gray-500">{v.resumo_alteracoes}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {v.arquivo_path && (
                                          <button onClick={() => handleVerArquivo(v)} className="p-1 hover:bg-ms-blue/20 text-ms-blue rounded"><FileText className="w-3.5 h-3.5" /></button>
                                        )}
                                        {podePromover && (
                                          <button
                                            onClick={() => { setVersaoParaPromover(formAberto ? null : v); setOrgaoAprovadorEscolhido(''); }}
                                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700"
                                          >
                                            <Award className="w-3 h-3" /> Promover a vigente
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {formAberto && (
                                      <div className="px-3 py-3 bg-emerald-950/10 border border-emerald-700/30 rounded-lg space-y-2">
                                        {exigeColegiado(d) ? (
                                          <>
                                            <p className="text-[11px] text-amber-400 font-bold">PPP/Regimento exigem o registro do órgão aprovador (Colegiado Escolar).</p>
                                            <select value={orgaoAprovadorEscolhido} onChange={(e) => setOrgaoAprovadorEscolhido(e.target.value)} className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                                              <option value="">Órgão aprovador...</option>
                                              {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                            </select>
                                          </>
                                        ) : (
                                          <select value={orgaoAprovadorEscolhido} onChange={(e) => setOrgaoAprovadorEscolhido(e.target.value)} className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main">
                                            <option value="">Órgão aprovador (opcional)...</option>
                                            {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                          </select>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleConfirmarPromocao(d)}
                                            disabled={promovendo === v.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                                          >
                                            {promovendo === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            Confirmar promoção
                                          </button>
                                          <button onClick={() => setVersaoParaPromover(null)} className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-200">Cancelar</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">Nova versão</p>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => setNovaVersao({ ...novaVersao, [d.id]: { arquivo: e.target.files?.[0] ?? null, resumo: novaVersao[d.id]?.resumo ?? '' } })}
                          className="w-full text-xs text-gray-400"
                        />
                        <textarea
                          placeholder="Resumo das alterações"
                          value={novaVersao[d.id]?.resumo ?? ''}
                          onChange={(e) => setNovaVersao({ ...novaVersao, [d.id]: { arquivo: novaVersao[d.id]?.arquivo ?? null, resumo: e.target.value } })}
                          className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main h-16"
                        />
                        <button onClick={() => handleEnviarVersao(d.id)} disabled={enviando === d.id} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
                          {enviando === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Enviar nova versão (rascunho)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ))}
    </div>
  );
}
