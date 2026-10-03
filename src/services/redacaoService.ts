import { supabase } from '../lib/supabase';

// Correção de redação (add_redacao_correcao.sql + função redacao-ia). A nota NÃO é gravada aqui:
// rpc_redacao_confirmar chama rpc_corrigir_item_dissertativo, o mesmo caminho da correção manual.

export interface LinhaTranscrita {
  n: number;
  texto: string;
  confianca: number;
}

export type StatusRedacao = 'ENVIADA' | 'TRANSCRITA' | 'COM_PREVIA' | 'REVISADA';

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

export type ChaveCompetencia = 'c1' | 'c2' | 'c3' | 'c4' | 'c5';
export const CHAVES_COMPETENCIA: ChaveCompetencia[] = ['c1', 'c2', 'c3', 'c4', 'c5'];

export interface CorrecaoIa {
  competencias: Record<ChaveCompetencia, CompetenciaIa>;
  nota_total: number;
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
  enunciado: string;
  criterios: string | null;
  valor: number | string | null;
  origem: string;
  imagem_path: string | null;
  linhas: LinhaTranscrita[] | null;
  texto_final: string | null;
  correcao_ia: CorrecaoIa | null;
  correcao_prof: { competencias: Record<ChaveCompetencia, CompetenciaProf>; comentario_geral: string | null; ia_nota_total: number | null } | null;
  nota_total: number | null;
  status: StatusRedacao;
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
  valor_obtido: number;
  nota_resposta: number;
  status_correcao: string;
  ainda_pendentes: number;
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
  competencias: Record<ChaveCompetencia, CompetenciaProf>,
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

export async function corrigirRedacaoComIa(linhas: string[], tema: string, criterios?: string): Promise<CorrecaoIa> {
  return chamarRedacaoIa('corrigir', { linhas, tema, criterios });
}

/** Ids das provas que têm questão de redação — decide se o botão "Corrigir redação" aparece. */
export async function obterProvasComRedacao(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('prova_questoes')
    .select('prova_id, questions!inner(tipo, discipline)')
    .eq('questions.discipline', 'Redação');
  if (error || !data) return new Set();
  return new Set((data as { prova_id: string }[]).map((r) => r.prova_id));
}
