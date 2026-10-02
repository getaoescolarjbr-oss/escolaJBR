import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Eye, FileText, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { signOut } from '../../services/authService';
import {
  aplicarModosPadraoNoCadastro, atualizarRascunhoCadastro, avisarEquipeNovoCadastro, enviarCadastroParaAnalise, enviarDocumentoDoCadastro, excluirDocumentoDoCadastro,
  listarCamposConvocacao, listarDocumentosDoCadastro, listarDocumentosExigidos, salvarConvocacaoDoRascunho, urlDocumentoDoCadastro,
  type CadastroServidorPendente, type CampoConvocacao, type DocumentoDoCadastro, type DocumentoExigido,
} from '../../services/cadastroServidorService';
import { ConvocacaoCampos } from './ConvocacaoCampos';
import { CadastroServidorCampos } from '../CadastroServidorCampos';
import { ScannerDocumento } from '../secretaria/ScannerDocumento';
import { formatarCpf, formatarTelefone, validarCpf, type CamposServidor } from '../../utils/cadastroServidor';

interface Props {
  cadastro: CadastroServidorPendente;
  onRecarregar: () => void; // relê o cadastro (depois de editar dados ou de enviar)
  onLogout: () => void;
}

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

function paraCampos(c: CadastroServidorPendente): CamposServidor {
  return {
    nome: c.nome, cargo: c.cargo, cpf: formatarCpf(c.cpf), dataNascimento: c.data_nascimento, telefone: formatarTelefone(c.telefone),
    areaConhecimento: c.area_conhecimento ?? '', statusServidor: c.status_servidor, aceiteLgpd: c.aceite_lgpd,
    rg: c.rg ?? '', tituloEleitor: c.titulo_eleitor ?? '', zonaEleitoral: c.zona_eleitoral ?? '', secaoEleitoral: c.secao_eleitoral ?? '',
    endereco: c.endereco ?? '', telefoneFixo: formatarTelefone(c.telefone_fixo ?? ''), formacao: c.formacao ?? '',
  };
}

// Segunda etapa do cadastro de servidor novo: anexar os documentos exigidos (câmera/escâner ou
// arquivo) e enviar para análise. O cadastro fica salvo como rascunho: dá para sair e voltar.
export function CadastroServidorRascunho({ cadastro, onRecarregar, onLogout }: Props) {
  const [exigidos, setExigidos] = useState<DocumentoExigido[]>([]);
  const [docs, setDocs] = useState<DocumentoDoCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [escaneando, setEscaneando] = useState<{ exigido: DocumentoExigido; arquivo: File | null } | null>(null);
  const [descricoes, setDescricoes] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState<CamposServidor>(() => paraCampos(cadastro));
  const [salvando, setSalvando] = useState(false);
  const [camposConv, setCamposConv] = useState<CampoConvocacao[]>([]);
  // Edição em andamento dos campos da convocação (null = sem alterações; vale o que está salvo no cadastro).
  const [editConv, setEditConv] = useState<Record<string, string> | null>(null);
  const [salvandoConv, setSalvandoConv] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const exigidoDoArquivo = useRef<DocumentoExigido | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [ex, d, campos] = await Promise.all([listarDocumentosExigidos(true), listarDocumentosDoCadastro([cadastro.id]), listarCamposConvocacao()]);
      setExigidos(ex);
      setDocs(d);
      setCamposConv(campos);
      // Cadastro sem os modos de preenchimento definidos (criado fora do fluxo atual): aplica o padrão.
      if (Object.keys(cadastro.convocacao_modos ?? {}).length === 0) {
        await aplicarModosPadraoNoCadastro(cadastro.id);
        onRecarregar();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os documentos.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastro.id]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  const convocacao = editConv ?? cadastro.convocacao ?? {};
  const convocacaoMudou = editConv !== null
    && JSON.stringify(Object.entries(editConv).filter(([, v]) => v.trim()).sort()) !== JSON.stringify(Object.entries(cadastro.convocacao ?? {}).sort());
  const modosConv = cadastro.convocacao_modos ?? {};
  const temCamposConv = camposConv.some((c) => (modosConv[c.campo] ?? 'SECRETARIA') !== 'SECRETARIA' || Boolean(cadastro.convocacao?.[c.campo]));

  async function salvarConvocacao() {
    setSalvandoConv(true);
    setErro(null);
    try {
      await salvarConvocacaoDoRascunho(cadastro.id, convocacao);
      setEditConv(null);
      onRecarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar os dados da convocação.');
    } finally {
      setSalvandoConv(false);
    }
  }

  const docsPorExigido = useMemo(() => {
    const m = new Map<string, DocumentoDoCadastro[]>();
    docs.forEach((d) => { if (d.exigido_id) m.set(d.exigido_id, [...(m.get(d.exigido_id) ?? []), d]); });
    return m;
  }, [docs]);

  const obrigatorios = exigidos.filter((e) => e.obrigatorio);
  const faltando = obrigatorios.filter((e) => !docsPorExigido.get(e.id)?.length);

  function podeAnexar(e: DocumentoExigido): boolean {
    if (e.tipo === 'CERTIFICADO' && !(descricoes[e.id] ?? '').trim()) {
      setErro(`Descreva o documento "${e.rotulo}" (curso/instituição) antes de enviar.`);
      return false;
    }
    setErro(null);
    return true;
  }

  async function enviarArquivo(e: DocumentoExigido, arquivo: File) {
    setOcupadoId(e.id);
    setErro(null);
    try {
      await enviarDocumentoDoCadastro(cadastro, e, arquivo, descricoes[e.id]);
      setDescricoes((d) => ({ ...d, [e.id]: '' }));
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar o arquivo.');
    } finally {
      setOcupadoId(null);
    }
  }

  function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = ev.target.files?.[0];
    ev.target.value = '';
    const e = exigidoDoArquivo.current;
    if (!arquivo || !e) return;
    // Foto passa pelo escâner (recorte e melhoria); PDF vai direto.
    if (arquivo.type.startsWith('image/')) setEscaneando({ exigido: e, arquivo });
    else void enviarArquivo(e, arquivo);
  }

  async function ver(d: DocumentoDoCadastro) {
    try { window.open(await urlDocumentoDoCadastro(d), '_blank'); }
    catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao abrir o documento.'); }
  }

  async function excluir(d: DocumentoDoCadastro) {
    if (!confirm(`Remover "${d.nome_arquivo}"?`)) return;
    try { await excluirDocumentoDoCadastro(d); await carregar(); }
    catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao remover.'); }
  }

  async function salvarDados() {
    if (!validarCpf(dados.cpf)) { setErro('CPF inválido. Confira os números digitados.'); return; }
    if (dados.telefone.replace(/\D/g, '').length < 10) { setErro('Informe o telefone com DDD.'); return; }
    if (!dados.rg.trim() || !dados.endereco.trim() || dados.nome.trim().length < 5) { setErro('Preencha nome completo, RG e endereço.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      await atualizarRascunhoCadastro(cadastro.id, dados);
      setEditando(false);
      onRecarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar os dados.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarParaAnalise() {
    setEnviando(true);
    setErro(null);
    try {
      if (convocacaoMudou) await salvarConvocacaoDoRascunho(cadastro.id, convocacao);
      await enviarCadastroParaAnalise(cadastro.id);
      void avisarEquipeNovoCadastro(cadastro.nome);
      onRecarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar o cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await signOut();
    onLogout();
  }

  return (
    <div className="min-h-screen bg-ms-dark p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-ms-blueText">Etapa 2 de 2 — documentos</p>
          <h1 className="text-lg font-bold text-ms-main">Falta pouco, {cadastro.nome.split(' ')[0]}!</h1>
          <p className="text-sm text-gray-400">
            Envie os documentos abaixo, fotografando com a câmera ou anexando um PDF. Quando terminar, envie o cadastro para a Secretaria conferir.
            Seus dados ficam salvos: você pode sair e continuar depois.
          </p>
        </div>

        {cadastro.correcao_motivo && cadastro.correcao_em && (!cadastro.enviado_em || new Date(cadastro.enviado_em) < new Date(cadastro.correcao_em)) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-amber-400">A Secretaria pediu uma correção</p>
            <p className="text-sm text-ms-main">{cadastro.correcao_motivo}</p>
            <p className="text-xs text-gray-400">Corrija o que foi pedido e envie o cadastro de novo.</p>
          </div>
        )}

        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Meus dados</p>
            <button onClick={() => { setEditando(!editando); setErro(null); }} className="flex items-center gap-1 text-xs font-bold text-ms-blueText hover:underline">
              <Pencil className="w-3.5 h-3.5" /> {editando ? 'Cancelar' : 'Corrigir dados'}
            </button>
          </div>
          {editando ? (
            <div className="bg-white rounded-xl p-4 space-y-4">
              <CadastroServidorCampos valores={dados} onChange={setDados} modo="edicao" />
              <button onClick={salvarDados} disabled={salvando} className="w-full flex items-center justify-center gap-2 py-3 bg-[#003366] text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar dados
              </button>
            </div>
          ) : (
            <p className="text-sm text-ms-main">
              {cadastro.nome} · {cadastro.cargo}<br />
              <span className="text-xs text-gray-400">CPF {formatarCpf(cadastro.cpf)} · RG {cadastro.rg || '—'} · {cadastro.email}</span>
            </p>
          )}
        </div>

        {temCamposConv && (
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Dados da convocação</p>
              <p className="text-xs text-gray-500 mt-1">Preencha o que souber. A Secretaria confere e completa o restante.</p>
            </div>
            <ConvocacaoCampos campos={camposConv} modos={modosConv} valores={convocacao} quem="PROFESSOR"
              onChange={(campo, valor) => setEditConv({ ...convocacao, [campo]: valor })} />
            {convocacaoMudou && (
              <button onClick={salvarConvocacao} disabled={salvandoConv} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                {salvandoConv && <Loader2 className="w-4 h-4 animate-spin" />} Salvar dados da convocação
              </button>
            )}
          </div>
        )}

        {carregando ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : exigidos.length === 0 ? (
          <p className="text-sm text-gray-400 bg-ms-card border border-gray-800 rounded-2xl p-5">Nenhum documento foi exigido. Você já pode enviar o cadastro.</p>
        ) : (
          <div className="space-y-3">
            {exigidos.map((e) => {
              const enviados = docsPorExigido.get(e.id) ?? [];
              const ocupado = ocupadoId === e.id;
              return (
                <div key={e.id} className={`bg-ms-card border rounded-2xl p-4 space-y-3 ${enviados.length ? 'border-green-700/40' : 'border-gray-800'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ms-main flex items-center gap-2">
                        {enviados.length > 0 && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                        {e.rotulo}
                      </p>
                      {e.instrucao && <p className="text-xs text-gray-400 mt-0.5">{e.instrucao}</p>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${e.obrigatorio ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-600/40'}`}>
                      {e.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </span>
                  </div>

                  {enviados.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg">
                      <span className="flex items-center gap-2 min-w-0 text-xs text-ms-main">
                        <FileText className="w-4 h-4 text-ms-blueText shrink-0" />
                        <span className="truncate">{d.descricao || d.nome_arquivo}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <button onClick={() => ver(d)} className="p-1.5 text-ms-blueText hover:bg-ms-blue/20 rounded-lg" title="Abrir"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => excluir(d)} className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-lg" title="Remover"><Trash2 className="w-4 h-4" /></button>
                      </span>
                    </div>
                  ))}

                  {e.tipo === 'CERTIFICADO' && (
                    <input value={descricoes[e.id] ?? ''} onChange={(ev) => setDescricoes((d) => ({ ...d, [e.id]: ev.target.value }))}
                      placeholder="Descreva: curso, instituição, carga horária..." className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => podeAnexar(e) && setEscaneando({ exigido: e, arquivo: null })} disabled={ocupado}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                      <Camera className="w-4 h-4" /> Escanear com a câmera
                    </button>
                    <button onClick={() => { if (podeAnexar(e)) { exigidoDoArquivo.current = e; arquivoRef.current?.click(); } }} disabled={ocupado}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-ms-dark border border-gray-700 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue disabled:opacity-50">
                      {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar PDF ou imagem
                    </button>
                  </div>
                </div>
              );
            })}
            <input ref={arquivoRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={aoEscolherArquivo} />
          </div>
        )}

        {erro && <p className="text-sm text-red-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{erro}</p>}

        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          {faltando.length > 0 ? (
            <p className="text-xs text-amber-400">Falta enviar: {faltando.map((f) => f.rotulo).join(', ')}.</p>
          ) : (
            <p className="text-xs text-green-400">Todos os documentos obrigatórios foram enviados.</p>
          )}
          <button onClick={enviarParaAnalise} disabled={enviando || faltando.length > 0 || carregando}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-500 disabled:opacity-40">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Enviar cadastro para análise
          </button>
          <button onClick={sair} className="w-full text-xs text-gray-400 hover:text-gray-200 py-1">Sair e continuar depois</button>
        </div>
      </div>

      {escaneando && (
        <ScannerDocumento
          nomeArquivo={`${slug(escaneando.exigido.rotulo)}-${new Date().toISOString().slice(0, 10)}`}
          arquivoInicial={escaneando.arquivo}
          onFechar={() => setEscaneando(null)}
          onConcluir={(pdf) => { const e = escaneando.exigido; setEscaneando(null); void enviarArquivo(e, pdf); }}
        />
      )}
    </div>
  );
}
