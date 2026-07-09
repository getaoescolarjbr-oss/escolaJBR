import { supabase } from '../lib/supabase';

// ------------------------------------------------------------------------------------
// Duplas de leitura
// ------------------------------------------------------------------------------------
export type StatusDupla = 'PENDENTE' | 'ACEITA' | 'DESFEITA';

export interface DuplaComParceiro {
  id: string;
  status: StatusDupla;
  solicitado_por: string;
  aluno_a: string;
  aluno_b: string;
  parceiro_id: string;
  parceiro_nome: string;
  sou_eu_quem_convidou: boolean;
}

// A dupla "ativa" pro aluno logado é a PENDENTE ou ACEITA mais recente onde ele é um
// dos dois lados — o índice único da Fase 1 garante que só existe uma por vez.
export async function obterMinhaDupla(meuAlunoId: string): Promise<DuplaComParceiro | null> {
  const { data, error } = await supabase
    .from('duplas')
    .select('id, status, solicitado_por, aluno_a, aluno_b, alunos_a:aluno_a(nome), alunos_b:aluno_b(nome)')
    .in('status', ['PENDENTE', 'ACEITA'])
    .or(`aluno_a.eq.${meuAlunoId},aluno_b.eq.${meuAlunoId}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const linha = data as unknown as { id: string; status: StatusDupla; solicitado_por: string; aluno_a: string; aluno_b: string; alunos_a: { nome: string }; alunos_b: { nome: string } };
  const souA = linha.aluno_a === meuAlunoId;
  return {
    id: linha.id,
    status: linha.status,
    solicitado_por: linha.solicitado_por,
    aluno_a: linha.aluno_a,
    aluno_b: linha.aluno_b,
    parceiro_id: souA ? linha.aluno_b : linha.aluno_a,
    parceiro_nome: souA ? linha.alunos_b.nome : linha.alunos_a.nome,
    sou_eu_quem_convidou: linha.solicitado_por === meuAlunoId,
  };
}

export async function convidarParaDupla(meuAlunoId: string, colegaId: string): Promise<void> {
  const { error } = await supabase.from('duplas').insert([{ aluno_a: meuAlunoId, aluno_b: colegaId, solicitado_por: meuAlunoId }]);
  if (error) throw error;
}

export async function aceitarConviteDupla(duplaId: string): Promise<void> {
  const { error } = await supabase.from('duplas').update({ status: 'ACEITA', aceito_em: new Date().toISOString() }).eq('id', duplaId);
  if (error) throw error;
}

export async function desfazerDupla(duplaId: string): Promise<void> {
  const { error } = await supabase.from('duplas').update({ status: 'DESFEITA' }).eq('id', duplaId);
  if (error) throw error;
}

export interface IndicacaoDupla {
  id: string;
  dupla_id: string;
  de_aluno: string;
  para_aluno: string;
  livro_id: string;
  livro_titulo: string;
  status: 'PENDENTE' | 'LIDO' | 'RECUSADA';
  criado_em: string;
}

export async function listarIndicacoesDupla(duplaId: string): Promise<IndicacaoDupla[]> {
  const { data, error } = await supabase
    .from('indicacoes_dupla')
    .select('*, livros(titulo)')
    .eq('dupla_id', duplaId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({ ...i, livro_titulo: (i as unknown as { livros: { titulo: string } }).livros.titulo }));
}

export async function indicarLivroParaDupla(dados: { dupla_id: string; de_aluno: string; para_aluno: string; livro_id: string }): Promise<void> {
  const { error } = await supabase.from('indicacoes_dupla').insert([dados]);
  if (error) throw error;
}

export async function atualizarIndicacaoDupla(id: string, status: 'LIDO' | 'RECUSADA'): Promise<void> {
  const { error } = await supabase.from('indicacoes_dupla').update({ status }).eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------------------------------
// Feed de resenhas
// ------------------------------------------------------------------------------------
export interface ResenhaFeed {
  id: string;
  aluno_id: string;
  livro_id: string;
  nota: number;
  texto: string;
  criado_em: string;
  livro_titulo: string;
  aluno_nome: string;
  curtidas: number;
  minhaCurtida: boolean;
}

export async function listarFeedResenhas(meuAlunoId: string | null, limite = 30): Promise<ResenhaFeed[]> {
  const { data, error } = await supabase
    .from('resenhas')
    .select('id, aluno_id, livro_id, nota, texto, criado_em, livros(titulo), alunos(nome)')
    .eq('status', 'VISIVEL')
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;
  const resenhas = data ?? [];
  const ids = resenhas.map((r) => r.id);

  const { data: curtidasData, error: curtidasError } = ids.length
    ? await supabase.from('curtidas').select('resenha_id, aluno_id').in('resenha_id', ids)
    : { data: [], error: null };
  if (curtidasError) throw curtidasError;

  return resenhas.map((r) => {
    const linha = r as unknown as { id: string; aluno_id: string; livro_id: string; nota: number; texto: string; criado_em: string; livros: { titulo: string }; alunos: { nome: string } };
    const curtidasDaResenha = (curtidasData ?? []).filter((c) => c.resenha_id === linha.id);
    return {
      id: linha.id,
      aluno_id: linha.aluno_id,
      livro_id: linha.livro_id,
      nota: linha.nota,
      texto: linha.texto,
      criado_em: linha.criado_em,
      livro_titulo: linha.livros.titulo,
      aluno_nome: linha.alunos.nome,
      curtidas: curtidasDaResenha.length,
      minhaCurtida: meuAlunoId ? curtidasDaResenha.some((c) => c.aluno_id === meuAlunoId) : false,
    };
  });
}

export async function criarResenha(dados: { aluno_id: string; livro_id: string; nota: number; texto: string }): Promise<{ status: string }> {
  const { data, error } = await supabase.from('resenhas').insert([dados]).select('status').single();
  if (error) throw error;
  return data;
}

export async function curtirResenha(resenhaId: string, alunoId: string): Promise<void> {
  const { error } = await supabase.from('curtidas').insert([{ resenha_id: resenhaId, aluno_id: alunoId }]);
  if (error) throw error;
}

export async function descurtirResenha(resenhaId: string, alunoId: string): Promise<void> {
  const { error } = await supabase.from('curtidas').delete().eq('resenha_id', resenhaId).eq('aluno_id', alunoId);
  if (error) throw error;
}

export async function denunciarResenha(resenhaId: string, denunciadoPor: string, motivo: string): Promise<void> {
  const { error } = await supabase.from('denuncias').insert([{ resenha_id: resenhaId, denunciado_por: denunciadoPor, motivo }]);
  if (error) throw error;
}

export async function obterFraseDoDia(): Promise<{ texto: string; autor: string | null } | null> {
  const { data, error } = await supabase.from('frases').select('texto, autor').eq('ativo', true);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  // Determinístico por dia (não aleatório a cada render): mesma frase o dia todo.
  const dia = new Date().toISOString().slice(0, 10);
  const indice = Math.abs([...dia].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % data.length;
  return data[indice];
}

// ------------------------------------------------------------------------------------
// Moderação (BIBLIOTECA/COORDENACAO/GESTAO)
// ------------------------------------------------------------------------------------
export interface DenunciaDetalhada {
  id: string;
  resenha_id: string;
  denunciado_por: string;
  motivo: string;
  status: 'ABERTA' | 'TRATADA' | 'ARQUIVADA';
  acao_tomada: string | null;
  criado_em: string;
  resenha_texto: string;
  resenha_status: string;
  autor_id: string;
  autor_nome: string;
  denunciante_nome: string;
}

export async function listarDenuncias(filtroStatus: 'ABERTA' | 'TRATADA' | 'ARQUIVADA' = 'ABERTA'): Promise<DenunciaDetalhada[]> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('*, resenhas(texto, status, aluno_id, alunos(nome)), denunciante:denunciado_por(nome)')
    .eq('status', filtroStatus)
    .order('criado_em');
  if (error) throw error;
  return (data ?? []).map((d) => {
    const linha = d as unknown as { resenhas: { texto: string; status: string; aluno_id: string; alunos: { nome: string } }; denunciante: { nome: string } };
    return {
      ...d,
      resenha_texto: linha.resenhas.texto,
      resenha_status: linha.resenhas.status,
      autor_id: linha.resenhas.aluno_id,
      autor_nome: linha.resenhas.alunos.nome,
      denunciante_nome: linha.denunciante.nome,
    };
  });
}

export interface ResenhaModeracao {
  id: string;
  texto: string;
  nota: number;
  status: string;
  motivo_ocultacao: string | null;
  criado_em: string;
  aluno_id: string;
  aluno_nome: string;
  livro_titulo: string;
}

// Resenhas ocultas pelo filtro automático, aguardando decisão humana.
export async function listarResenhasOcultas(): Promise<ResenhaModeracao[]> {
  const { data, error } = await supabase
    .from('resenhas')
    .select('id, texto, nota, status, motivo_ocultacao, criado_em, aluno_id, alunos(nome), livros(titulo)')
    .eq('status', 'OCULTA')
    .order('criado_em');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    aluno_nome: (r as unknown as { alunos: { nome: string } }).alunos.nome,
    livro_titulo: (r as unknown as { livros: { titulo: string } }).livros.titulo,
  }));
}

// Quantas resenhas deste aluno já foram ocultadas/removidas antes — pista de
// reincidência pra staff decidir se escala pra COORDENACAO (decisão humana, não
// automática).
export async function contarModeracoesDoAluno(alunoId: string): Promise<number> {
  const { count, error } = await supabase
    .from('resenhas')
    .select('*', { count: 'exact', head: true })
    .eq('aluno_id', alunoId)
    .in('status', ['OCULTA', 'REMOVIDA']);
  if (error) throw error;
  return count ?? 0;
}

export async function moderarResenha(id: string, status: 'VISIVEL' | 'OCULTA' | 'REMOVIDA', motivo: string | null, moderadorId: string): Promise<void> {
  const { error } = await supabase
    .from('resenhas')
    .update({ status, oculto_por: moderadorId, oculto_em: new Date().toISOString(), motivo_ocultacao: motivo })
    .eq('id', id);
  if (error) throw error;
}

export async function tratarDenuncia(id: string, status: 'TRATADA' | 'ARQUIVADA', acaoTomada: string, tratadoPor: string): Promise<void> {
  const { error } = await supabase
    .from('denuncias')
    .update({ status, acao_tomada: acaoTomada, tratado_por: tratadoPor, tratado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export interface PalavraProibida {
  palavra: string;
  ativo: boolean;
  criado_em: string;
}

export async function listarPalavrasProibidas(): Promise<PalavraProibida[]> {
  const { data, error } = await supabase.from('palavras_proibidas').select('*').order('palavra');
  if (error) throw error;
  return data ?? [];
}

export async function adicionarPalavraProibida(palavra: string): Promise<void> {
  const { error } = await supabase.from('palavras_proibidas').insert([{ palavra: palavra.trim().toLowerCase() }]);
  if (error) throw error;
}

export async function atualizarPalavraProibida(palavra: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('palavras_proibidas').update({ ativo }).eq('palavra', palavra);
  if (error) throw error;
}
