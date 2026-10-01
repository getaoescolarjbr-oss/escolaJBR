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
export async function iniciarCadastroServidor(dados: DadosCadastroServidor): Promise<void> {
  const email = dados.email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: dados.senha });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.');
  // Com confirmação de e-mail ligada o signUp não devolve sessão e o INSERT abaixo seria
  // negado pela RLS: falha aqui com mensagem clara em vez de deixar conta sem pedido.
  if (!authData.session) {
    throw new Error('Conta criada, mas é preciso confirmar o e-mail antes de continuar o cadastro. Confirme e tente novamente.');
  }

  const { error } = await supabase.from('cadastros_servidores_pendentes').insert([{
    auth_user_id: authData.user.id,
    email,
    status: 'RASCUNHO',
    ...camposDoPedido(dados),
  }]);
  if (error) throw error;
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
