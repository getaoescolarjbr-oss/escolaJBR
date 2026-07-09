import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type {
  Fornecedor,
  NotaFiscal,
  EstoqueItem,
  EstoqueLote,
  SaldoLote,
  TipoMovimentacao,
  Cardapio,
  CardapioItem,
  RefeicaoServida,
  IndicadoresPnae,
  Nutricionista,
  FichaTecnica,
  FichaIngrediente,
  NecessidadeEspecial,
  ConciliacaoPnaeLinha,
  ControleSanitario,
  InspecaoSanitaria,
  TesteAceitabilidade,
  Turno,
} from '../types/cozinha';

// --- Fornecedores ---
export async function listarFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase.from('fornecedores').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarFornecedor(dados: Partial<Fornecedor>): Promise<Fornecedor> {
  const { data, error } = await supabase.from('fornecedores').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarFornecedor(id: string, dados: Partial<Fornecedor>): Promise<void> {
  const { error } = await supabase.from('fornecedores').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Estoque: itens ---
export async function listarItensEstoque(): Promise<EstoqueItem[]> {
  const { data, error } = await supabase.from('estoque_itens').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarItemEstoque(dados: Omit<EstoqueItem, 'id'>): Promise<EstoqueItem> {
  const { data, error } = await supabase.from('estoque_itens').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

// --- Notas fiscais ---
export async function listarNotasFiscais(fornecedorId?: string): Promise<NotaFiscal[]> {
  let query = supabase.from('notas_fiscais').select('*').order('data', { ascending: false });
  if (fornecedorId) query = query.eq('fornecedor_id', fornecedorId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function criarNotaFiscal(dados: Omit<NotaFiscal, 'id' | 'criado_em'>): Promise<NotaFiscal> {
  const { data, error } = await supabase.from('notas_fiscais').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

// --- Estoque: lotes + movimentações ---
export async function listarLotes(itemId?: string): Promise<EstoqueLote[]> {
  let query = supabase.from('estoque_lotes').select('*').order('recebido_em', { ascending: false });
  if (itemId) query = query.eq('item_id', itemId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listarSaldos(): Promise<SaldoLote[]> {
  const { data, error } = await supabase.from('vw_saldo_lotes').select('*').order('validade');
  if (error) throw error;
  return data ?? [];
}

// Recebimento: cria o lote (metadados — sem risco de concorrência) e registra a
// ENTRADA correspondente via RPC (única porta de escrita no extrato — garante que o
// saldo nunca diverge de um INSERT direto e não deixado passar sem validação).
export async function receberLote(
  dados: Omit<EstoqueLote, 'id' | 'recebido_em'>,
  quantidadeRecebida: number
): Promise<EstoqueLote> {
  const { data: lote, error } = await supabase.from('estoque_lotes').insert([dados]).select().single();
  if (error) throw error;

  await registrarMovimentacao(lote.id, 'ENTRADA', quantidadeRecebida, 'Recebimento inicial do lote');

  return lote;
}

export async function registrarMovimentacao(
  loteId: string,
  tipo: TipoMovimentacao,
  quantidade: number,
  motivo?: string
): Promise<void> {
  const { error } = await supabase.rpc('rpc_registrar_movimentacao_estoque', {
    p_lote_id: loteId,
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_motivo: motivo || null,
  });
  if (error) throw error;
}

// --- Cardápios ---
export async function listarCardapios(dataInicio: string, dataFim: string): Promise<Cardapio[]> {
  const { data, error } = await supabase
    .from('cardapios')
    .select('*')
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data');
  if (error) throw error;
  return data ?? [];
}

export async function criarCardapio(dados: {
  data: string;
  turno: Turno;
  nutricionista_pessoa_id: string | null;
  observacoes?: string | null;
}): Promise<Cardapio> {
  const { data: row, error } = await supabase.from('cardapios').insert([dados]).select().single();
  if (error) throw error;
  return row;
}

export async function atualizarCardapio(id: string, dados: Partial<Cardapio>): Promise<void> {
  const { error } = await supabase.from('cardapios').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarItensCardapio(cardapioId: string): Promise<CardapioItem[]> {
  const { data, error } = await supabase.from('cardapio_itens').select('*').eq('cardapio_id', cardapioId);
  if (error) throw error;
  return data ?? [];
}

export async function adicionarItemCardapio(dados: Omit<CardapioItem, 'id'>): Promise<CardapioItem> {
  const { data, error } = await supabase.from('cardapio_itens').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function removerItemCardapio(id: string): Promise<void> {
  const { error } = await supabase.from('cardapio_itens').delete().eq('id', id);
  if (error) throw error;
}

// --- Refeições servidas ---
export async function obterRefeicaoServida(cardapioId: string): Promise<RefeicaoServida | null> {
  const { data, error } = await supabase.from('refeicoes_servidas').select('*').eq('cardapio_id', cardapioId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function registrarRefeicaoServida(cardapioId: string, quantidadeAlunos: number, registradoPor: string): Promise<void> {
  const { error } = await supabase
    .from('refeicoes_servidas')
    .upsert([{ cardapio_id: cardapioId, quantidade_alunos: quantidadeAlunos, registrado_por: registradoPor }], { onConflict: 'cardapio_id' });
  if (error) throw error;
}

// --- Nutricionistas (RT do cardápio) ---
export async function listarNutricionistas(): Promise<Nutricionista[]> {
  const { data, error } = await supabase.rpc('rpc_listar_nutricionistas');
  if (error) throw error;
  return (data ?? []) as Nutricionista[];
}

// --- Indicadores PNAE ---
export async function obterIndicadoresPnae(dataInicio: string, dataFim: string): Promise<IndicadoresPnae> {
  const { data, error } = await supabase.rpc('rpc_indicadores_pnae', { p_data_inicio: dataInicio, p_data_fim: dataFim });
  if (error) throw error;
  return data as IndicadoresPnae;
}

// --- Fichas técnicas ---
export async function listarFichasTecnicas(): Promise<FichaTecnica[]> {
  const { data, error } = await supabase.from('fichas_tecnicas').select('*').order('preparacao');
  if (error) throw error;
  return data ?? [];
}

export async function criarFichaTecnica(preparacao: string, modoPreparo: string | null, criadoPor: string): Promise<FichaTecnica> {
  const { data, error } = await supabase.from('fichas_tecnicas').insert([{ preparacao, modo_preparo: modoPreparo, criado_por: criadoPor }]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirFichaTecnica(id: string): Promise<void> {
  const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
  if (error) throw error;
}

export async function listarIngredientesFicha(fichaId: string): Promise<FichaIngrediente[]> {
  const { data, error } = await supabase.from('ficha_ingredientes').select('*').eq('ficha_id', fichaId);
  if (error) throw error;
  return data ?? [];
}

export async function adicionarIngredienteFicha(fichaId: string, itemId: string, perCapita: number): Promise<FichaIngrediente> {
  const { data, error } = await supabase.from('ficha_ingredientes').insert([{ ficha_id: fichaId, item_id: itemId, per_capita: perCapita }]).select().single();
  if (error) throw error;
  return data;
}

export async function removerIngredienteFicha(id: string): Promise<void> {
  const { error } = await supabase.from('ficha_ingredientes').delete().eq('id', id);
  if (error) throw error;
}

// --- Necessidades alimentares especiais (dado sensível de saúde) ---
export async function listarNecessidadesEspeciais(): Promise<NecessidadeEspecial[]> {
  const { data, error } = await supabase.from('necessidades_especiais').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// consentimento_id não é enviado: o trigger no servidor resolve o consentimento
// DADOS_SENSIVEIS aceito mais recente da pessoa e recusa se não existir (o cliente
// não escolhe/forja qual consentimento satisfaz a exigência).
export async function criarNecessidadeEspecial(dados: {
  aluno_id: string;
  tipo: NecessidadeEspecial['tipo'];
  descricao: string | null;
  adaptacao: string | null;
  criado_por: string;
}): Promise<NecessidadeEspecial> {
  const { data, error } = await supabase.from('necessidades_especiais').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarNecessidadeEspecial(id: string, dados: Partial<NecessidadeEspecial>): Promise<void> {
  const { error } = await supabase.from('necessidades_especiais').update(dados).eq('id', id);
  if (error) throw error;
}

const BUCKET_COZINHA_DOCUMENTOS = 'cozinha-documentos';

export async function enviarLaudoNecessidadeEspecial(necessidadeId: string, arquivo: File): Promise<void> {
  const path = `laudos/${necessidadeId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_COZINHA_DOCUMENTOS).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;
  await atualizarNecessidadeEspecial(necessidadeId, { laudo_arquivo_path: path });
}

// Cada geração de link assinado é uma leitura de dado sensível — registrada em
// auditoria (best-effort, mesmo padrão de documentosPessoaService.obterUrlAssinada).
export async function obterUrlLaudoNecessidadeEspecial(necessidade: NecessidadeEspecial): Promise<string> {
  if (!necessidade.laudo_arquivo_path) throw new Error('Nenhum laudo anexado.');
  const { data, error } = await supabase.storage.from(BUCKET_COZINHA_DOCUMENTOS).createSignedUrl(necessidade.laudo_arquivo_path, 60);
  if (error) throw error;
  await logAcesso('necessidades_especiais', necessidade.id, null, 'READ');
  return data.signedUrl;
}

// --- Conciliação servido × matriculado ---
export async function obterConciliacaoPnae(dataInicio: string, dataFim: string): Promise<ConciliacaoPnaeLinha[]> {
  const { data, error } = await supabase.rpc('rpc_conciliacao_pnae', { p_data_inicio: dataInicio, p_data_fim: dataFim });
  if (error) throw error;
  return (data ?? []) as ConciliacaoPnaeLinha[];
}

// --- Boas práticas / controle sanitário ---
export async function listarControleSanitario(): Promise<ControleSanitario[]> {
  const { data, error } = await supabase.from('controle_sanitario').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarControleSanitario(dados: Omit<ControleSanitario, 'id' | 'criado_em'>): Promise<ControleSanitario> {
  const { data, error } = await supabase.from('controle_sanitario').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

// --- Inspeções sanitárias (guarda de 5 anos) ---
export async function listarInspecoesSanitarias(): Promise<InspecaoSanitaria[]> {
  const { data, error } = await supabase.from('inspecoes_sanitarias').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarInspecaoSanitaria(dados: Omit<InspecaoSanitaria, 'id' | 'criado_em' | 'arquivo_path'>): Promise<InspecaoSanitaria> {
  const { data, error } = await supabase.from('inspecoes_sanitarias').insert([{ ...dados, arquivo_path: null }]).select().single();
  if (error) throw error;
  return data;
}

export async function enviarArquivoInspecaoSanitaria(inspecaoId: string, arquivo: File): Promise<void> {
  const path = `inspecoes/${inspecaoId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_COZINHA_DOCUMENTOS).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('inspecoes_sanitarias').update({ arquivo_path: path }).eq('id', inspecaoId);
  if (error) throw error;
}

export async function obterUrlInspecaoSanitaria(inspecao: InspecaoSanitaria): Promise<string> {
  if (!inspecao.arquivo_path) throw new Error('Nenhum arquivo anexado.');
  const { data, error } = await supabase.storage.from(BUCKET_COZINHA_DOCUMENTOS).createSignedUrl(inspecao.arquivo_path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// --- Testes de aceitabilidade ---
export async function listarTestesAceitabilidade(): Promise<TesteAceitabilidade[]> {
  const { data, error } = await supabase.from('testes_aceitabilidade').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarTesteAceitabilidade(dados: Omit<TesteAceitabilidade, 'id' | 'criado_em'>): Promise<TesteAceitabilidade> {
  const { data, error } = await supabase.from('testes_aceitabilidade').insert([dados]).select().single();
  if (error) throw error;
  return data;
}
