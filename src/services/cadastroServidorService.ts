import { supabase } from '../lib/supabase';
import type { Papel } from '../types/rbac';
import { soDigitos } from '../utils/cadastroServidor';
import { sendPushToUsers } from './pushService';

// Cadastro de servidor com aprovação (create_cadastro_servidor_com_aprovacao.sql e
// create_cadastro_servidor_fase1.sql). Quem se cadastra cria a conta + um pedido em RASCUNHO,
// informa os dados, anexa os documentos exigidos e só então envia para análise. A Secretaria/
// Gestão, ao aprovar, cria professor/pessoa/usuário/papel e leva dados e arquivos para a ficha.
// Antes disso a conta não tem acesso a nada.

export interface DadosCadastroServidor {
  email: string;
  senha: string;
  nome: string;
  cargo: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  areaConhecimento: string;
  statusServidor: string;
  aceiteLgpd: boolean;
  rg: string;
  tituloEleitor: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  endereco: string;
  telefoneFixo: string;
  formacao: string;
}

// Quem preenche cada campo da convocação (termo de convocado): só a Secretaria, só o servidor ou os dois.
export type ModoPreenchimento = 'SECRETARIA' | 'PROFESSOR' | 'AMBOS';

export interface CampoConvocacao {
  id: string;
  campo: string;
  rotulo: string;
  dica: string | null;
  modo: ModoPreenchimento;
  ordem: number;
}

export interface ConviteCadastro {
  id: string;
  token: string;
  email: string | null;
  nome: string | null;
  campos: Record<string, { modo?: ModoPreenchimento; valor?: string }>;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  cadastro_id: string | null;
  revogado: boolean;
}

export interface ConsultaConvite {
  valido: boolean;
  motivo?: string;
  email?: string | null;
  nome?: string | null;
}

export type StatusCadastroServidor = 'RASCUNHO' | 'PENDENTE' | 'APROVADO' | 'REJEITADO';

export interface CadastroServidorPendente {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  cargo: string;
  cpf: string;
  data_nascimento: string;
  telefone: string;
  area_conhecimento: string | null;
  status_servidor: string;
  aceite_lgpd: boolean;
  status: StatusCadastroServidor;
  papel_concedido: Papel | null;
  observacoes_analise: string | null;
  criado_em: string;
  enviado_em: string | null;
  rg: string | null;
  titulo_eleitor: string | null;
  zona_eleitoral: string | null;
  secao_eleitoral: string | null;
  endereco: string | null;
  telefone_fixo: string | null;
  formacao: string | null;
  convite_id: string | null;
  correcao_motivo: string | null;
  correcao_em: string | null;
  analisado_em: string | null;
  convocacao: Record<string, string>;
  convocacao_modos: Record<string, ModoPreenchimento>;
}

export type TipoDocumentoExigido = 'DOCUMENTO_PESSOAL' | 'CERTIFICADO' | 'ATESTADO_MEDICO' | 'OUTRO';

export interface DocumentoExigido {
  id: string;
  rotulo: string;
  instrucao: string | null;
  tipo: TipoDocumentoExigido;
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number;
}

export interface DocumentoDoCadastro {
  id: string;
  cadastro_id: string;
  exigido_id: string | null;
  rotulo: string;
  tipo: TipoDocumentoExigido;
  descricao: string | null;
  nome_arquivo: string;
  arquivo_path: string;
  enviado_em: string;
}

const BUCKET = 'documentos-pessoas';

// Só os campos que o próprio servidor edita enquanto o cadastro é rascunho.
function camposDoPedido(dados: Omit<DadosCadastroServidor, 'email' | 'senha'>) {
  const vazio = (v: string) => (v.trim() ? v.trim() : null);
  return {
    nome: dados.nome.trim(),
    cargo: dados.cargo,
    cpf: soDigitos(dados.cpf),
    data_nascimento: dados.dataNascimento,
    telefone: soDigitos(dados.telefone),
    area_conhecimento: dados.areaConhecimento || null,
    status_servidor: dados.statusServidor,
    aceite_lgpd: dados.aceiteLgpd,
    rg: vazio(dados.rg),
    titulo_eleitor: vazio(dados.tituloEleitor),
    zona_eleitoral: vazio(dados.zonaEleitoral),
    secao_eleitoral: vazio(dados.secaoEleitoral),
    endereco: vazio(dados.endereco),
    telefone_fixo: vazio(dados.telefoneFixo) ? soDigitos(dados.telefoneFixo) : null,
    formacao: vazio(dados.formacao),
  };
}

// Resposta só sim/não (o front não recebe a lista de e-mails da escola).
export async function emailJaCadastradoPelaEscola(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_email_de_professor_existe', { p_email: email });
  if (error) throw error;
  return Boolean(data);
}

// Cria a conta e o pedido em RASCUNHO. Os documentos vêm na etapa seguinte (tela "Cadastro
// incompleto"), que já abre sozinha porque a conta criada fica logada.
// `conviteToken` (link da Secretaria) traz os campos da convocação já combinados; sem ele valem os modos padrão.
//
// Com a confirmação de e-mail ligada (Parâmetros Gerais) o signUp não devolve sessão e o pedido não
// pode ser criado agora (a RLS exige login). Os dados seguem guardados na própria conta
// (user_metadata) e o pedido é criado no primeiro login depois da confirmação:
// ver criarCadastroDosMetadados.
export interface ResultadoInicioCadastro {
  precisaConfirmarEmail: boolean;
  // false se o convite não pôde ser aplicado (ex.: usado entre a consulta e o envio): o cadastro segue normal.
  conviteAplicado: boolean;
}

type PedidoServidor = ReturnType<typeof camposDoPedido>;

// Colunas do pedido que o servidor pode informar. Também filtra o que volta dos metadados da conta,
// que o próprio usuário consegue editar: nada fora desta lista chega ao INSERT.
const COLUNAS_DO_PEDIDO: (keyof PedidoServidor)[] = [
  'nome', 'cargo', 'cpf', 'data_nascimento', 'telefone', 'area_conhecimento', 'status_servidor', 'aceite_lgpd',
  'rg', 'titulo_eleitor', 'zona_eleitoral', 'secao_eleitoral', 'endereco', 'telefone_fixo', 'formacao',
];

function filtrarPedido(bruto: Record<string, unknown>): Partial<PedidoServidor> {
  const limpo: Record<string, string | boolean | null> = {};
  COLUNAS_DO_PEDIDO.forEach((c) => {
    const v = bruto[c];
    if (typeof v === 'string' || typeof v === 'boolean' || v === null) limpo[c] = v;
  });
  return limpo as Partial<PedidoServidor>;
}

async function criarPedidoRascunho(userId: string, email: string, pedido: Partial<PedidoServidor>, conviteToken: string | null): Promise<boolean> {
  const { data, error } = await supabase.from('cadastros_servidores_pendentes').insert([{
    auth_user_id: userId,
    email,
    status: 'RASCUNHO',
    ...pedido,
  }]).select('id').single();
  if (error) throw error;

  if (conviteToken) {
    const { error: erroConvite } = await supabase.rpc('rpc_aplicar_convite', { p_cadastro_id: data.id, p_token: conviteToken });
    if (!erroConvite) return true;
  }
  const { error: erroPadrao } = await supabase.rpc('rpc_aplicar_convite', { p_cadastro_id: data.id, p_token: null });
  if (erroPadrao) throw new Error(erroPadrao.message);
  return false;
}

export async function iniciarCadastroServidor(dados: DadosCadastroServidor, conviteToken?: string | null): Promise<ResultadoInicioCadastro> {
  const email = dados.email.trim().toLowerCase();
  const pedido = camposDoPedido(dados);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: dados.senha,
    options: { data: { cadastro_servidor: { pedido, convite: conviteToken ?? null } } },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.');
  if (!authData.session) return { precisaConfirmarEmail: true, conviteAplicado: false };

  const conviteAplicado = await criarPedidoRascunho(authData.user.id, email, pedido, conviteToken ?? null);
  // Os dados já estão no pedido: tira o rascunho guardado na conta (best-effort).
  await supabase.auth.updateUser({ data: { cadastro_servidor: null } }).catch(() => undefined);
  return { precisaConfirmarEmail: false, conviteAplicado };
}

// Primeiro login depois de confirmar o e-mail: cria o pedido a partir dos dados guardados na conta.
// Devolve false se não há nada guardado (conta que não veio deste cadastro).
export async function criarCadastroDosMetadados(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  const guardado = user?.user_metadata?.cadastro_servidor as { pedido?: Record<string, unknown>; convite?: unknown } | null | undefined;
  if (!user?.email || !guardado?.pedido || typeof guardado.pedido !== 'object') return false;

  try {
    await criarPedidoRascunho(user.id, user.email.toLowerCase(), filtrarPedido(guardado.pedido), typeof guardado.convite === 'string' ? guardado.convite : null);
  } catch (e) {
    // 23505: o pedido já existe (duas abas, ou recarregou no meio): segue com o que há.
    if ((e as { code?: string }).code !== '23505') throw e;
  }
  await supabase.auth.updateUser({ data: { cadastro_servidor: null } }).catch(() => undefined);
  return true;
}

// Link da Secretaria: vale? (chamado antes do cadastro, sem login).
export async function consultarConvite(token: string): Promise<ConsultaConvite> {
  const { data, error } = await supabase.rpc('rpc_consultar_convite', { p_token: token });
  if (error) throw new Error(error.message);
  return data as ConsultaConvite;
}

export async function atualizarRascunhoCadastro(id: string, dados: Omit<DadosCadastroServidor, 'email' | 'senha'>): Promise<void> {
  const { error } = await supabase.from('cadastros_servidores_pendentes').update(camposDoPedido(dados)).eq('id', id);
  if (error) throw error;
}

export async function meuCadastroServidor(authUserId: string): Promise<CadastroServidorPendente | null> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CadastroServidorPendente | null) ?? null;
}

export async function listarDocumentosExigidos(apenasAtivos = true): Promise<DocumentoExigido[]> {
  let consulta = supabase.from('documentos_exigidos').select('*').order('ordem').order('rotulo');
  if (apenasAtivos) consulta = consulta.eq('ativo', true);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as DocumentoExigido[];
}

export async function listarDocumentosDoCadastro(cadastroIds: string[]): Promise<DocumentoDoCadastro[]> {
  if (cadastroIds.length === 0) return [];
  const { data, error } = await supabase.from('cadastro_servidor_documentos').select('*').in('cadastro_id', cadastroIds).order('enviado_em');
  if (error) throw error;
  return (data ?? []) as DocumentoDoCadastro[];
}

const nomeSeguro = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');

// Sobe o arquivo para pendentes/<usuário>/ e registra no pedido. Se o registro falhar, o arquivo
// recém-enviado é removido para não sobrar lixo no armazenamento.
export async function enviarDocumentoDoCadastro(
  cadastro: Pick<CadastroServidorPendente, 'id' | 'auth_user_id'>,
  exigido: Pick<DocumentoExigido, 'id' | 'rotulo' | 'tipo'>,
  arquivo: File,
  descricao?: string,
): Promise<DocumentoDoCadastro> {
  const path = `pendentes/${cadastro.auth_user_id}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: false });
  if (erroUpload) throw erroUpload;

  const { data, error } = await supabase
    .from('cadastro_servidor_documentos')
    .insert([{ cadastro_id: cadastro.id, exigido_id: exigido.id, rotulo: exigido.rotulo, tipo: exigido.tipo, descricao: descricao?.trim() || null, nome_arquivo: arquivo.name, arquivo_path: path }])
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as DocumentoDoCadastro;
}

export async function excluirDocumentoDoCadastro(doc: DocumentoDoCadastro): Promise<void> {
  const { error } = await supabase.from('cadastro_servidor_documentos').delete().eq('id', doc.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
}

// Link temporário (60 s) para abrir um documento do cadastro: o dono vê os próprios e a
// Secretaria/Gestão veem todos (política de storage).
export async function urlDocumentoDoCadastro(doc: Pick<DocumentoDoCadastro, 'arquivo_path'>): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.arquivo_path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// Confere os documentos obrigatórios no banco e passa o cadastro de RASCUNHO para PENDENTE.
export async function enviarCadastroParaAnalise(cadastroId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_enviar_cadastro_servidor', { p_cadastro_id: cadastroId });
  if (error) throw new Error(error.message);
}

export async function listarCadastrosServidoresPendentes(): Promise<CadastroServidorPendente[]> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('*')
    .eq('status', 'PENDENTE')
    .order('criado_em');
  if (error) throw error;
  return (data ?? []) as CadastroServidorPendente[];
}

export async function aprovarCadastroServidor(cadastroId: string, papel: Papel): Promise<void> {
  const { error } = await supabase.rpc('rpc_aprovar_cadastro_servidor', { p_cadastro_id: cadastroId, p_papel: papel });
  if (error) throw error;
}

// Devolve o cadastro em análise ao servidor (volta a RASCUNHO) com o que precisa ser corrigido.
export async function devolverCadastroServidor(cadastroId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_devolver_cadastro_servidor', { p_cadastro_id: cadastroId, p_motivo: motivo });
  if (error) throw new Error(error.message);
}

// Convocação do cadastro mais recente do servidor (para preencher o termo depois da aprovação).
export async function convocacaoDoServidor(authUserId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('convocacao')
    .eq('auth_user_id', authUserId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.convocacao as Record<string, string> | undefined) ?? {};
}

export async function rejeitarCadastroServidor(cadastroId: string, observacoes: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_rejeitar_cadastro_servidor', { p_cadastro_id: cadastroId, p_observacoes: observacoes });
  if (error) throw error;
}

// ---- Configuração dos documentos exigidos (Secretária Geral / Gestão) ----
export async function salvarDocumentoExigido(doc: Partial<DocumentoExigido> & { rotulo: string }): Promise<void> {
  const dados = {
    rotulo: doc.rotulo.trim(), instrucao: doc.instrucao?.trim() || null, tipo: doc.tipo ?? 'DOCUMENTO_PESSOAL',
    obrigatorio: doc.obrigatorio ?? false, ativo: doc.ativo ?? true, ordem: doc.ordem ?? 0, atualizado_em: new Date().toISOString(),
  };
  const { error } = doc.id
    ? await supabase.from('documentos_exigidos').update(dados).eq('id', doc.id)
    : await supabase.from('documentos_exigidos').insert([dados]);
  if (error) throw error;
}

export async function excluirDocumentoExigido(id: string): Promise<void> {
  const { error } = await supabase.from('documentos_exigidos').delete().eq('id', id);
  if (error) throw error;
}

// ---- Campos da convocação e convites (Fase 2) ----
export async function listarCamposConvocacao(): Promise<CampoConvocacao[]> {
  const { data, error } = await supabase.from('convocacao_campos').select('*').order('ordem');
  if (error) throw error;
  return (data ?? []) as CampoConvocacao[];
}

export async function salvarModoCampoConvocacao(id: string, modo: ModoPreenchimento): Promise<void> {
  const { error } = await supabase.from('convocacao_campos').update({ modo }).eq('id', id);
  if (error) throw error;
}

// Servidor: grava os campos da convocação que ele pode preencher (o banco ignora os demais).
export async function salvarConvocacaoDoRascunho(cadastroId: string, convocacao: Record<string, string>): Promise<void> {
  const { error } = await supabase.from('cadastros_servidores_pendentes').update({ convocacao }).eq('id', cadastroId);
  if (error) throw error;
}

// Secretaria/Gestão: edita qualquer campo da convocação, em rascunho ou em análise.
export async function salvarConvocacaoDoCadastro(cadastroId: string, convocacao: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('rpc_salvar_convocacao_cadastro', { p_cadastro_id: cadastroId, p_convocacao: convocacao });
  if (error) throw new Error(error.message);
}

export async function listarConvites(): Promise<ConviteCadastro[]> {
  const { data, error } = await supabase.from('convites_cadastro_servidor').select('*').order('criado_em', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as ConviteCadastro[];
}

export async function criarConvite(dados: { email: string; nome: string; campos: ConviteCadastro['campos'] }): Promise<ConviteCadastro> {
  const { data, error } = await supabase
    .from('convites_cadastro_servidor')
    .insert([{ email: dados.email.trim().toLowerCase() || null, nome: dados.nome.trim() || null, campos: dados.campos }])
    .select()
    .single();
  if (error) throw error;
  return data as ConviteCadastro;
}

export async function revogarConvite(id: string): Promise<void> {
  const { error } = await supabase.from('convites_cadastro_servidor').update({ revogado: true }).eq('id', id);
  if (error) throw error;
}

export const linkDoConvite = (token: string) => `${window.location.origin}/?convite=${token}`;

// Cadastro criado antes da Fase 2 (ou sem passar pelo convite): congela os modos padrão.
export async function aplicarModosPadraoNoCadastro(cadastroId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_aplicar_convite', { p_cadastro_id: cadastroId, p_token: null });
  if (error) throw new Error(error.message);
}

// ---- Acompanhamento, aviso à equipe e rascunhos abandonados (Fase 5) ----
export async function listarCadastrosServidores(status: StatusCadastroServidor[], limite = 100): Promise<CadastroServidorPendente[]> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('*')
    .in('status', status)
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as CadastroServidorPendente[];
}

// Quantos cadastros esperam análise (selo na aba da Secretaria). Quem não é da equipe vê 0 pela RLS.
export async function contarCadastrosEmAnalise(): Promise<number> {
  const { count, error } = await supabase.from('cadastros_servidores_pendentes').select('id', { count: 'exact', head: true }).eq('status', 'PENDENTE');
  return error ? 0 : (count ?? 0);
}

// Apaga o rascunho (e os registros dos documentos) pelo banco, que devolve os caminhos dos arquivos;
// os arquivos saem pela API de Storage (apagar por SQL deixaria o arquivo no bucket).
export async function removerRascunhoCadastro(cadastroId: string): Promise<void> {
  const { data, error } = await supabase.rpc('rpc_remover_rascunho_cadastro', { p_cadastro_id: cadastroId });
  if (error) throw new Error(error.message);
  const caminhos = (data as string[] | null) ?? [];
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
}

// Avisa (push) a Secretaria/Gestão que chegou um cadastro. É só um extra: nunca atrapalha o envio.
export async function avisarEquipeNovoCadastro(nome: string): Promise<void> {
  try {
    const { data } = await supabase.rpc('rpc_destinatarios_novo_cadastro');
    const ids = (data as string[] | null) ?? [];
    if (ids.length === 0) return;
    await sendPushToUsers({
      user_ids: ids,
      title: 'Novo cadastro de servidor',
      message: `${nome} enviou o cadastro para análise.`,
      url: '/?modulo=secretaria',
      tag: 'cadastro-servidor',
    });
  } catch { /* sem aviso, o cadastro continua na fila */ }
}

// Quem já está logado (conta criada antes) e ficou sem pedido, por exemplo depois de um rascunho removido.
export async function refazerCadastroServidor(dados: Omit<DadosCadastroServidor, 'email' | 'senha'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Sessão inválida. Entre novamente.');
  await criarPedidoRascunho(user.id, user.email.toLowerCase(), camposDoPedido(dados), null);
}
