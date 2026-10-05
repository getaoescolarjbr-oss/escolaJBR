import { supabase } from '../lib/supabase';

// Correção de redação (add_redacao_correcao.sql + add_redacao_digitada.sql + add_redacao_modos_correcao.sql
// + função redacao-ia). A nota NÃO é gravada aqui: rpc_redacao_confirmar chama rpc_corrigir_item_dissertativo,
// o mesmo caminho da correção manual. O MODO de correção (critérios e pesos) é uma rubrica escolhida pelo
// professor: ver rubricas_redacao.

export interface LinhaTranscrita {
  n: number;
  texto: string;
  confianca: number;
}

export type StatusRedacao = 'ENVIADA' | 'TRANSCRITA' | 'COM_PREVIA' | 'REVISADA';

// ---- modos de correção (rubricas) ----

export interface CriterioRubrica {
  /** c1, c2... (1 a 10 por rubrica). */
  chave: string;
  rotulo: string;
  /** Pontos máximos do critério (o peso). */
  max: number;
  /** Notas permitidas = múltiplos do passo, de 0 até o max. */
  passo: number;
  /** Texto que orienta a IA e o professor. */
  descritores: string;
}

export interface RubricaRedacao {
  id: string;
  chave: string | null;
  nome: string;
  descricao: string | null;
  /** Modelo do sistema (ENEM, UFMS, UFGD): não se edita, só se duplica. */
  sistema: boolean;
  criterios: CriterioRubrica[];
  instrucoes: string | null;
  linhas_min: number;
  linhas_max: number;
  aviso_linhas_min: string | null;
  ativa: boolean;
  criado_por: string | null;
}

/** A rubrica que vale para uma redação: escolhida nela, padrão da avaliação, ou a da banca da proposta. */
export interface RubricaEfetiva {
  id: string;
  nome: string;
  criterios: CriterioRubrica[];
  instrucoes: string | null;
  linhas_min: number;
  linhas_max: number;
  aviso_linhas_min: string | null;
  origem: 'REDACAO' | 'AVALIACAO' | 'BANCA' | 'CONFIRMADA';
}

export interface RedacaoDaLista {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  numero_chamada: number | null;
  question_id: string;
  tema: string | null;
  valor: number | string;
  envio_id: string | null;
  status: StatusRedacao | null;
  nota_total: number | null;
  nota_maxima: number | null;
  tem_imagem: boolean | null;
  origem: string | null;
  /** O aluno digitou a redação na avaliação online. */
  tem_texto_digitado: boolean | null;
}

export interface CompetenciaIa {
  nota: number;
  justificativa: string;
  trechos: string[];
}

export interface CorrecaoIa {
  /** Rubrica que a IA usou: se for outra que a atual, a prévia está desatualizada. */
  rubrica?: { id?: string; nome: string; criterios: Pick<CriterioRubrica, 'chave' | 'rotulo' | 'max' | 'passo'>[] };
  competencias: Record<string, CompetenciaIa>;
  nota_total: number;
  nota_maxima?: number;
  desvios: string[];
  alertas: string[];
  linhas_preenchidas: number;
  modelo: string;
}

export interface CompetenciaProf {
  nota: number;
  concorda: boolean;
  comentario: string;
}

export interface RedacaoDetalhe {
  envio_id: string;
  prova_id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  question_id: string;
  tema: string | null;
  banca: string | null;
  enunciado: string;
  /** "Observações para o professor" da questão: o que se espera que o aluno aborde. */
  observacoes: string | null;
  valor: number | string | null;
  origem: string;
  imagem_path: string | null;
  linhas: LinhaTranscrita[] | null;
  texto_final: string | null;
  correcao_ia: CorrecaoIa | null;
  correcao_prof: { competencias: Record<string, CompetenciaProf>; comentario_geral: string | null; ia_nota_total: number | null } | null;
  nota_total: number | null;
  nota_maxima: number | null;
  status: StatusRedacao;
  rubrica: RubricaEfetiva | null;
  /** Modo escolhido nesta redação (nulo = usa o padrão da avaliação/banca). */
  rubrica_escolhida_id: string | null;
  /** O aluno vê "o que se esperava neste tema" na devolutiva? */
  mostrar_esperado: boolean;
}

export type PreparoRedacao =
  | { precisa_escolher_questao: true; questoes: { question_id: string; tema: string | null }[] }
  | {
      precisa_escolher_questao?: undefined;
      envio_id: string;
      prova_id: string;
      aluno_id: string;
      aluno_nome: string;
      turma_nome: string | null;
      question_id: string;
      tema: string | null;
      valor: number | string | null;
      status: StatusRedacao;
    };

export interface ResultadoConfirmacao {
  nota_total: number;
  nota_maxima: number;
  valor_obtido: number;
  nota_resposta: number;
  status_correcao: string;
  ainda_pendentes: number;
}

/** Devolutiva de UMA redação já confirmada, como o aluno a vê. Nunca traz a prévia da IA. */
export interface DevolutivaRedacao {
  question_id: string;
  tema: string | null;
  valor: number | string;
  nota_total: number;
  nota_maxima: number;
  /** Pontos que a redação valeu na prova (nota/máximo × valor da questão). */
  valor_obtido: number | string;
  rubrica_nome: string | null;
  criterios: { rotulo: string; max: number; nota: number; descritores: string | null; comentario: string | null }[];
  comentario_geral: string | null;
  texto: string | null;
  /** Só vem preenchido se o professor liberou. */
  esperado: string | null;
}

/** Notas que o critério aceita: múltiplos do passo, de 0 até o max. */
export function valoresPermitidos(c: Pick<CriterioRubrica, 'max' | 'passo'>): number[] {
  const out: number[] = [];
  for (let v = 0; v <= c.max; v += c.passo) out.push(v);
  return out;
}

export async function listarRedacoes(provaId: string): Promise<RedacaoDaLista[]> {
  const { data, error } = await supabase.rpc('rpc_redacao_listar', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as RedacaoDaLista[];
}

export async function prepararRedacao(codigo: string, questionId?: string): Promise<PreparoRedacao> {
  const { data, error } = await supabase.rpc('rpc_redacao_preparar', { p_codigo: codigo, p_question_id: questionId ?? null });
  if (error) throw error;
  return data as PreparoRedacao;
}

/** Abre a redação de um aluno sem QR (digitada online ou para o professor digitar/colar). */
export async function prepararRedacaoAluno(provaId: string, alunoId: string, questionId?: string): Promise<PreparoRedacao> {
  const { data, error } = await supabase.rpc('rpc_redacao_preparar_aluno', {
    p_prova_id: provaId,
    p_aluno_id: alunoId,
    p_question_id: questionId ?? null,
  });
  if (error) throw error;
  return data as PreparoRedacao;
}

// ---- rascunho da redação digitada pelo aluno (tabela à parte; não conta como resposta enviada) ----

export async function salvarRascunhoRedacao(avaliacaoId: string, questionId: string, texto: string): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_redacao_rascunho_salvar', {
    p_avaliacao_id: avaliacaoId,
    p_question_id: questionId,
    p_texto: texto,
  });
  if (error) throw error;
  return data as string;
}

export async function obterRascunhosRedacao(avaliacaoId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('rpc_redacao_rascunho_obter', { p_avaliacao_id: avaliacaoId });
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { question_id: string; texto: string }[]).map((r) => [r.question_id, r.texto]));
}

export async function obterRedacao(envioId: string): Promise<RedacaoDetalhe> {
  const { data, error } = await supabase.rpc('rpc_redacao_obter', { p_envio_id: envioId });
  if (error) throw error;
  return data as RedacaoDetalhe;
}

export async function salvarRedacao(
  envioId: string,
  campos: { imagemPath?: string; linhas?: LinhaTranscrita[]; textoFinal?: string; correcaoIa?: CorrecaoIa },
): Promise<StatusRedacao> {
  const { data, error } = await supabase.rpc('rpc_redacao_salvar', {
    p_envio_id: envioId,
    p_imagem_path: campos.imagemPath ?? null,
    p_linhas: campos.linhas ?? null,
    p_texto_final: campos.textoFinal ?? null,
    p_correcao_ia: campos.correcaoIa ?? null,
  });
  if (error) throw error;
  return data as StatusRedacao;
}

export async function confirmarRedacao(
  envioId: string,
  competencias: Record<string, CompetenciaProf>,
  comentario: string | null,
): Promise<ResultadoConfirmacao> {
  const { data, error } = await supabase.rpc('rpc_redacao_confirmar', {
    p_envio_id: envioId,
    p_competencias: competencias,
    p_comentario: comentario,
  });
  if (error) throw error;
  return data as ResultadoConfirmacao;
}

// ---- modo de correção (rubricas) ----

const CAMPOS_RUBRICA = 'id, chave, nome, descricao, sistema, criterios, instrucoes, linhas_min, linhas_max, aviso_linhas_min, ativa, criado_por';

/** Rubricas visíveis ao professor: modelos do sistema primeiro. */
export async function listarRubricas(): Promise<RubricaRedacao[]> {
  const { data, error } = await supabase.from('rubricas_redacao').select(CAMPOS_RUBRICA).order('sistema', { ascending: false }).order('nome');
  if (error) throw error;
  return (data ?? []) as RubricaRedacao[];
}

export type DadosRubrica = Pick<RubricaRedacao, 'nome' | 'descricao' | 'criterios' | 'instrucoes' | 'linhas_min' | 'linhas_max' | 'aviso_linhas_min' | 'ativa'>;

export async function criarRubrica(dados: DadosRubrica): Promise<RubricaRedacao> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('rubricas_redacao')
    .insert({ ...dados, sistema: false, chave: null, criado_por: u.user?.id })
    .select(CAMPOS_RUBRICA)
    .single();
  if (error) throw error;
  return data as RubricaRedacao;
}

export async function atualizarRubrica(id: string, dados: DadosRubrica): Promise<void> {
  const { error } = await supabase.from('rubricas_redacao').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Apaga uma rubrica própria. Redação já confirmada guarda cópia da rubrica usada, então não muda. */
export async function apagarRubrica(id: string): Promise<void> {
  const { error } = await supabase.from('rubricas_redacao').delete().eq('id', id);
  if (error) throw error;
}

/** Professor: mostrar ou não ao aluno o que se esperava no tema (as observações da questão). */
export async function definirMostrarEsperado(envioId: string, valor: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_redacao_mostrar_esperado', { p_envio_id: envioId, p_valor: valor });
  if (error) throw error;
  return data as boolean;
}

/** Aluno: devolutivas das próprias redações desta avaliação (só as que o professor confirmou), por questão. */
export async function obterDevolutivasRedacao(avaliacaoId: string): Promise<Record<string, DevolutivaRedacao>> {
  const { data, error } = await supabase.rpc('rpc_redacao_devolutiva', { p_avaliacao_id: avaliacaoId });
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as DevolutivaRedacao[]).map((d) => [d.question_id, d]));
}

/** Escolhe o modo de correção desta redação (nulo = volta ao padrão da avaliação/banca). */
export async function definirRubricaRedacao(envioId: string, rubricaId: string | null): Promise<RubricaEfetiva> {
  const { data, error } = await supabase.rpc('rpc_redacao_definir_rubrica', { p_envio_id: envioId, p_rubrica_id: rubricaId });
  if (error) throw error;
  return data as RubricaEfetiva;
}

// ---- imagem recortada (bucket privado redacoes-scans; a pasta de topo é o prova_id) ----

export async function enviarImagemRedacao(provaId: string, alunoId: string, envioId: string, imagem: Blob): Promise<string> {
  const caminho = `${provaId}/${alunoId}/${envioId}.jpg`;
  const { error } = await supabase.storage.from('redacoes-scans').upload(caminho, imagem, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '60',
  });
  if (error) throw error;
  return caminho;
}

export async function urlImagemRedacao(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('redacoes-scans').createSignedUrl(caminho, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ---- IA (função redacao-ia; a chave do Gemini fica no servidor) ----

async function chamarRedacaoIa<T>(op: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('redacao-ia', { body: { op, args } });
  if (error) {
    let mensagem = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const corpo = await ctx.json();
        if (corpo?.erro) mensagem = corpo.erro;
      } catch { /* mantém a mensagem genérica */ }
    }
    throw new Error(mensagem);
  }
  return (data as { data: T }).data;
}

/** Recebe SÓ o recorte da caixa de texto (sem nome nem QR). */
export async function transcreverRedacao(imagemBase64: string): Promise<{ linhas: LinhaTranscrita[]; modelo: string }> {
  return chamarRedacaoIa('transcrever', { imagemBase64, mimeType: 'image/jpeg' });
}

export async function corrigirRedacaoComIa(linhas: string[], tema: string, rubrica: RubricaEfetiva, esperado?: string | null): Promise<CorrecaoIa> {
  return chamarRedacaoIa('corrigir', {
    linhas,
    tema,
    esperado: esperado ?? undefined,
    rubrica: {
      id: rubrica.id,
      nome: rubrica.nome,
      criterios: rubrica.criterios,
      instrucoes: rubrica.instrucoes,
      linhas_min: rubrica.linhas_min,
      linhas_max: rubrica.linhas_max,
      aviso_linhas_min: rubrica.aviso_linhas_min,
    },
  });
}

/** Ids das provas que têm questão de redação — decide se o botão "Corrigir redações" aparece. */
export async function obterProvasComRedacao(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('prova_questoes')
    .select('prova_id, questions!inner(tipo, discipline)')
    .eq('questions.discipline', 'Redação');
  if (error || !data) return new Set();
  return new Set((data as { prova_id: string }[]).map((r) => r.prova_id));
}
