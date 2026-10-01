import { supabase } from '../lib/supabase';
import type { Papel } from '../types/rbac';
import { soDigitos } from '../utils/cadastroServidor';

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
// Devolve false se o convite não pôde ser aplicado (ex.: usado entre a consulta e o envio): o cadastro segue normal.
export async function iniciarCadastroServidor(dados: DadosCadastroServidor, conviteToken?: string | null): Promise<boolean> {
  const email = dados.email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: dados.senha });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.');
  // Com confirmação de e-mail ligada o signUp não devolve sessão e o INSERT abaixo seria
  // negado pela RLS: falha aqui com mensagem clara em vez de deixar conta sem pedido.
  if (!authData.session) {
    throw new Error('Conta criada, mas é preciso confirmar o e-mail antes de continuar o cadastro. Confirme e tente novamente.');
  }

  const { data: pedido, error } = await supabase.from('cadastros_servidores_pendentes').insert([{
    auth_user_id: authData.user.id,
    email,
    status: 'RASCUNHO',
    ...camposDoPedido(dados),
  }]).select('id').single();
  if (error) throw error;

  if (conviteToken) {
    const { error: erroConvite } = await supabase.rpc('rpc_aplicar_convite', { p_cadastro_id: pedido.id, p_token: conviteToken });
    if (!erroConvite) return true;
  }
  const { error: erroPadrao } = await supabase.rpc('rpc_aplicar_convite', { p_cadastro_id: pedido.id, p_token: null });
  if (erroPadrao) throw new Error(erroPadrao.message);
  return false;
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
