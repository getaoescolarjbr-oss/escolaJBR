import { supabase } from '../lib/supabase';
import type { Genero, Colecao, Livro, Exemplar, Emprestimo, ReservaLivro, IndicacaoCompra, Conquista, Meta, Recompensa, Resgate } from '../types/biblioteca';

// --- Gêneros ---
export async function listarGeneros(): Promise<Genero[]> {
  const { data, error } = await supabase.from('generos').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarGenero(nome: string): Promise<Genero> {
  const { data, error } = await supabase.from('generos').insert([{ nome }]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarGenero(id: string, dados: Partial<Genero>): Promise<void> {
  const { error } = await supabase.from('generos').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Coleções ---
export async function listarColecoes(): Promise<Colecao[]> {
  const { data, error } = await supabase.from('colecoes').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarColecao(dados: { nome: string; descricao: string | null }): Promise<Colecao> {
  const { data, error } = await supabase.from('colecoes').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarColecao(id: string, dados: Partial<Colecao>): Promise<void> {
  const { error } = await supabase.from('colecoes').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Livros ---
export interface FiltroLivros {
  busca?: string;
  tipoAcervo?: 'FISICO' | 'ONLINE';
  generoId?: string;
  somenteAtivos?: boolean;
}

export async function listarLivros(filtro: FiltroLivros = {}): Promise<Livro[]> {
  let query = supabase.from('livros').select('*').order('titulo');
  if (filtro.busca) query = query.or(`titulo.ilike.%${filtro.busca}%,autor.ilike.%${filtro.busca}%`);
  if (filtro.tipoAcervo) query = query.eq('tipo_acervo', filtro.tipoAcervo);
  if (filtro.generoId) query = query.eq('genero_id', filtro.generoId);
  if (filtro.somenteAtivos) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function criarLivro(dados: Omit<Livro, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Livro> {
  const { data, error } = await supabase.from('livros').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarLivro(id: string, dados: Partial<Livro>): Promise<void> {
  const { error } = await supabase.from('livros').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// --- Exemplares ---
export async function listarExemplares(livroId: string): Promise<Exemplar[]> {
  const { data, error } = await supabase.from('exemplares').select('*').eq('livro_id', livroId).order('tombo');
  if (error) throw error;
  return data ?? [];
}

export async function criarExemplar(dados: { livro_id: string; tombo: string; estado: Exemplar['estado']; localizacao: string | null }): Promise<Exemplar> {
  const { data, error } = await supabase.from('exemplares').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarExemplar(id: string, dados: Partial<Exemplar>): Promise<void> {
  const { error } = await supabase.from('exemplares').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Circulação (balcão da BIBLIOTECA) ---

export interface AlunoBusca {
  id: string;
  nome: string;
  turma_nome: string | null;
}

export async function buscarAlunos(busca: string): Promise<AlunoBusca[]> {
  if (!busca.trim()) return [];
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, turmas(nome)')
    .ilike('nome', `%${busca.trim()}%`)
    .eq('status', 'ATIVO')
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    turma_nome: (a as unknown as { turmas: { nome: string } | null }).turmas?.nome ?? null,
  }));
}

export interface ProfessorBusca {
  id: string;
  nome: string;
  cargo: string | null;
}

// Mesma busca de patrono no balcão, agora para professor (ver
// create_biblioteca_professor_emprestimos.sql).
export async function buscarProfessores(busca: string): Promise<ProfessorBusca[]> {
  if (!busca.trim()) return [];
  const { data, error } = await supabase
    .from('professores')
    .select('id, nome, cargo')
    .ilike('nome', `%${busca.trim()}%`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export interface ExemplarComLivro extends Exemplar {
  livro_titulo: string;
  livro_autor: string;
}

// Busca exemplares DISPONÍVEIS por tombo ou por título/autor do livro — usado na
// tela de registrar empréstimo (o bibliotecário digita o tombo ou o título).
export async function buscarExemplaresDisponiveis(busca: string): Promise<ExemplarComLivro[]> {
  if (!busca.trim()) return [];
  const { data, error } = await supabase
    .from('exemplares')
    .select('*, livros!inner(titulo, autor)')
    .eq('status', 'DISPONIVEL')
    .or(`tombo.ilike.%${busca.trim()}%,titulo.ilike.%${busca.trim()}%,autor.ilike.%${busca.trim()}%`, { foreignTable: 'livros' })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    ...e,
    livro_titulo: (e as unknown as { livros: { titulo: string; autor: string } }).livros.titulo,
    livro_autor: (e as unknown as { livros: { titulo: string; autor: string } }).livros.autor,
  }));
}

export interface EmprestimoDetalhado extends Emprestimo {
  tombo: string;
  livro_id: string;
  livro_titulo: string;
  // Nome de quem pegou emprestado — aluno ou professor (ver tomador_tipo).
  tomador_nome: string;
  tomador_tipo: 'ALUNO' | 'PROFESSOR';
}

export async function listarEmprestimosAtivos(): Promise<EmprestimoDetalhado[]> {
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*, exemplares(tombo, livro_id, livros(titulo)), alunos(nome), professores(nome)')
    .eq('status', 'ATIVO')
    .order('data_prevista');
  if (error) throw error;
  return (data ?? []).map((e) => {
    const row = e as unknown as {
      exemplares: { tombo: string; livro_id: string; livros: { titulo: string } };
      alunos: { nome: string } | null;
      professores: { nome: string } | null;
    };
    return {
      ...e,
      tombo: row.exemplares.tombo,
      livro_id: row.exemplares.livro_id,
      livro_titulo: row.exemplares.livros.titulo,
      tomador_nome: row.alunos?.nome ?? row.professores?.nome ?? '—',
      tomador_tipo: row.alunos ? 'ALUNO' : 'PROFESSOR',
    };
  });
}

export async function criarEmprestimo(dados: { exemplar_id: string; aluno_id?: string | null; professor_id?: string | null; data_prevista: string; criado_por: string | null }): Promise<Emprestimo> {
  const { data, error } = await supabase.from('emprestimos').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function registrarDevolucao(id: string): Promise<void> {
  const { error } = await supabase.from('emprestimos').update({ status: 'DEVOLVIDO', data_devolucao: new Date().toISOString().slice(0, 10) }).eq('id', id);
  if (error) throw error;
}

export async function renovarEmprestimo(id: string): Promise<Emprestimo> {
  const { data, error } = await supabase.rpc('rpc_renovar_emprestimo', { p_emprestimo_id: id });
  if (error) throw error;
  return data as Emprestimo;
}

// Quantas reservas ATIVAS existem para o mesmo livro do exemplar emprestado — usado
// para avisar o bibliotecário, na devolução, que há gente esperando esse título.
export async function contarReservasAtivas(livroId: string): Promise<number> {
  const { count, error } = await supabase.from('reservas_livro').select('*', { count: 'exact', head: true }).eq('livro_id', livroId).eq('status', 'ATIVA');
  if (error) throw error;
  return count ?? 0;
}

// --- Reservas de título ---
export interface ReservaLivroDetalhada extends ReservaLivro {
  livro_titulo: string;
  tomador_nome: string;
  tomador_tipo: 'ALUNO' | 'PROFESSOR';
}

export async function listarReservasAtivas(): Promise<ReservaLivroDetalhada[]> {
  const { data, error } = await supabase
    .from('reservas_livro')
    .select('*, livros(titulo), alunos(nome), professores(nome)')
    .eq('status', 'ATIVA')
    .order('data');
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as { livros: { titulo: string }; alunos: { nome: string } | null; professores: { nome: string } | null };
    return {
      ...r,
      livro_titulo: row.livros.titulo,
      tomador_nome: row.alunos?.nome ?? row.professores?.nome ?? '—',
      tomador_tipo: row.alunos ? 'ALUNO' : 'PROFESSOR',
    };
  });
}

export async function criarReservaLivro(livroId: string, alunoId: string): Promise<ReservaLivro> {
  const { data, error } = await supabase.from('reservas_livro').insert([{ livro_id: livroId, aluno_id: alunoId }]).select().single();
  if (error) throw error;
  return data;
}

// Mesma reserva de título, só que para um professor (autoatendimento — ver
// create_biblioteca_professor_emprestimos.sql: aluno_id/professor_id são mutuamente
// exclusivos na mesma tabela, não é uma tabela nova).
export async function criarReservaLivroProfessor(livroId: string, professorId: string): Promise<ReservaLivro> {
  const { data, error } = await supabase.from('reservas_livro').insert([{ livro_id: livroId, professor_id: professorId }]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarReservaLivro(id: string, status: ReservaLivro['status']): Promise<void> {
  const { error } = await supabase.from('reservas_livro').update({ status }).eq('id', id);
  if (error) throw error;
}

// --- Indicações de compra ---
export interface IndicacaoCompraDetalhada extends IndicacaoCompra {
  aluno_nome: string;
}

export async function listarIndicacoesCompra(): Promise<IndicacaoCompraDetalhada[]> {
  const { data, error } = await supabase.from('indicacoes_compra').select('*, alunos(nome)').order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({ ...i, aluno_nome: (i as unknown as { alunos: { nome: string } }).alunos.nome }));
}

export async function atualizarIndicacaoCompra(id: string, dados: Partial<IndicacaoCompra>): Promise<void> {
  const { error } = await supabase.from('indicacoes_compra').update(dados).eq('id', id);
  if (error) throw error;
}

export async function criarIndicacaoCompra(dados: { aluno_id: string; titulo: string; autor: string | null }): Promise<IndicacaoCompra> {
  const { data, error } = await supabase.from('indicacoes_compra').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

// --- Home do aluno (Fase 4) ---

// id em `alunos` do usuário logado, via a função meu_aluno_id() (Fase 1) — null para
// quem não é aluno.
export async function obterMeuAlunoId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('meu_aluno_id');
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function obterMeuSaldoPontos(alunoId: string): Promise<number> {
  const { data, error } = await supabase.from('vw_saldo_pontos').select('saldo').eq('aluno_id', alunoId).maybeSingle();
  if (error) throw error;
  return data?.saldo ?? 0;
}

export async function listarMeusEmprestimos(alunoId: string): Promise<EmprestimoDetalhado[]> {
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*, exemplares(tombo, livro_id, livros(titulo)), alunos(nome)')
    .eq('aluno_id', alunoId)
    .eq('status', 'ATIVO')
    .order('data_prevista');
  if (error) throw error;
  return (data ?? []).map((e) => ({
    ...e,
    tombo: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.tombo,
    livro_id: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.livro_id,
    livro_titulo: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.livros.titulo,
    aluno_nome: (e as unknown as { alunos: { nome: string } }).alunos.nome,
  }));
}

export interface EmprestimoProfessor {
  id: string;
  status: string;
  data_emprestimo: string;
  data_prevista: string;
  renovacoes: number;
  tombo: string;
  livro_id: string;
  livro_titulo: string;
}

export async function listarMeusEmprestimosProfessor(professorId: string): Promise<EmprestimoProfessor[]> {
  const { data, error } = await supabase
    .from('emprestimos')
    .select('id, status, data_emprestimo, data_prevista, renovacoes, exemplares(tombo, livro_id, livros(titulo))')
    .eq('professor_id', professorId)
    .eq('status', 'ATIVO')
    .order('data_prevista');
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    status: e.status,
    data_emprestimo: e.data_emprestimo,
    data_prevista: e.data_prevista,
    renovacoes: e.renovacoes,
    tombo: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.tombo,
    livro_id: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.livro_id,
    livro_titulo: (e as unknown as { exemplares: { tombo: string; livro_id: string; livros: { titulo: string } } }).exemplares.livros.titulo,
  }));
}

export interface FavoritoComLivro {
  id: string;
  livro_id: string;
  livro_titulo: string;
  livro_autor: string;
  capa_url: string | null;
}

export async function listarMeusFavoritos(alunoId: string): Promise<FavoritoComLivro[]> {
  const { data, error } = await supabase.from('favoritos').select('id, livro_id, livros(titulo, autor, capa_url)').eq('aluno_id', alunoId);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    livro_id: f.livro_id,
    livro_titulo: (f as unknown as { livros: { titulo: string; autor: string; capa_url: string | null } }).livros.titulo,
    livro_autor: (f as unknown as { livros: { titulo: string; autor: string; capa_url: string | null } }).livros.autor,
    capa_url: (f as unknown as { livros: { titulo: string; autor: string; capa_url: string | null } }).livros.capa_url,
  }));
}

export async function adicionarFavorito(alunoId: string, livroId: string): Promise<void> {
  const { error } = await supabase.from('favoritos').insert([{ aluno_id: alunoId, livro_id: livroId }]);
  if (error) throw error;
}

export async function removerFavorito(favoritoId: string): Promise<void> {
  const { error } = await supabase.from('favoritos').delete().eq('id', favoritoId);
  if (error) throw error;
}

// --- Gamificação (Fase 5): catálogo de conquistas (staff) ---
export async function listarConquistas(): Promise<Conquista[]> {
  const { data, error } = await supabase.from('conquistas').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarConquista(dados: Omit<Conquista, 'id' | 'criado_em'>): Promise<Conquista> {
  const { data, error } = await supabase.from('conquistas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarConquista(id: string, dados: Partial<Conquista>): Promise<void> {
  const { error } = await supabase.from('conquistas').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Gamificação: conquistas do aluno e metas ---
export interface ConquistaGanha {
  id: string;
  conquista_id: string;
  conquistado_em: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
}

export async function listarMinhasConquistas(alunoId: string): Promise<ConquistaGanha[]> {
  const { data, error } = await supabase
    .from('aluno_conquistas')
    .select('id, conquista_id, conquistado_em, conquistas(nome, descricao, icone)')
    .eq('aluno_id', alunoId)
    .order('conquistado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    conquista_id: c.conquista_id,
    conquistado_em: c.conquistado_em,
    nome: (c as unknown as { conquistas: { nome: string; descricao: string | null; icone: string | null } }).conquistas.nome,
    descricao: (c as unknown as { conquistas: { nome: string; descricao: string | null; icone: string | null } }).conquistas.descricao,
    icone: (c as unknown as { conquistas: { nome: string; descricao: string | null; icone: string | null } }).conquistas.icone,
  }));
}

export async function listarMinhasMetas(alunoId: string): Promise<Meta[]> {
  const { data, error } = await supabase.from('metas').select('*').eq('aluno_id', alunoId).order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarMeta(dados: { aluno_id: string; descricao: string; livro_id: string | null; data_alvo: string | null }): Promise<Meta> {
  const { data, error } = await supabase.from('metas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function concluirMeta(id: string): Promise<void> {
  const { error } = await supabase.from('metas').update({ status: 'CONCLUIDA' }).eq('id', id);
  if (error) throw error;
}

export async function cancelarMeta(id: string): Promise<void> {
  const { error } = await supabase.from('metas').update({ status: 'CANCELADA' }).eq('id', id);
  if (error) throw error;
}

// --- Loja de prêmios (Fase 6) ---
export async function listarRecompensas(): Promise<Recompensa[]> {
  const { data, error } = await supabase.from('recompensas').select('*').order('custo_pontos');
  if (error) throw error;
  return data ?? [];
}

export async function listarRecompensasDisponiveis(): Promise<Recompensa[]> {
  const { data, error } = await supabase.from('recompensas').select('*').eq('ativo', true).gt('estoque', 0).order('custo_pontos');
  if (error) throw error;
  return data ?? [];
}

export async function criarRecompensa(dados: Omit<Recompensa, 'id' | 'criado_em' | 'criado_por'>): Promise<Recompensa> {
  const { data, error } = await supabase.from('recompensas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarRecompensa(id: string, dados: Partial<Recompensa>): Promise<void> {
  const { error } = await supabase.from('recompensas').update(dados).eq('id', id);
  if (error) throw error;
}

export interface ResgateDetalhado extends Resgate {
  recompensa_nome: string;
  aluno_nome: string;
}

export async function listarResgates(filtroStatus?: Resgate['status']): Promise<ResgateDetalhado[]> {
  let query = supabase.from('resgates').select('*, recompensas(nome), alunos(nome)').order('criado_em', { ascending: false });
  if (filtroStatus) query = query.eq('status', filtroStatus);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recompensa_nome: (r as unknown as { recompensas: { nome: string } }).recompensas.nome,
    aluno_nome: (r as unknown as { alunos: { nome: string } }).alunos.nome,
  }));
}

export async function marcarResgateEntregue(id: string, entreguePor: string): Promise<void> {
  const { error } = await supabase.from('resgates').update({ status: 'ENTREGUE', entregue_por: entreguePor, entregue_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function cancelarResgate(id: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_cancelar_resgate', { p_resgate_id: id });
  if (error) throw error;
}

export async function resgatarRecompensa(recompensaId: string): Promise<Resgate> {
  const { data, error } = await supabase.rpc('rpc_resgatar_recompensa', { p_recompensa_id: recompensaId });
  if (error) throw error;
  return data as Resgate;
}

export async function listarMeusResgates(alunoId: string): Promise<ResgateDetalhado[]> {
  const { data, error } = await supabase
    .from('resgates')
    .select('*, recompensas(nome), alunos(nome)')
    .eq('aluno_id', alunoId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recompensa_nome: (r as unknown as { recompensas: { nome: string } }).recompensas.nome,
    aluno_nome: (r as unknown as { alunos: { nome: string } }).alunos.nome,
  }));
}

// --- Upload de arquivos (Storage) ---

// Comprime a capa via Canvas antes do upload (max 500x500, JPEG 80%) — mesmo padrão já
// usado para fotos de aluno em StudentManager.tsx.
function comprimirImagem(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 500;
      let { width, height } = img;
      if (width > height) {
        if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
      } else if (height > MAX) {
        width = Math.round((width * MAX) / height); height = MAX;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao comprimir imagem'))), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
}

export async function enviarCapa(file: File, livroId: string): Promise<string> {
  const comprimida = await comprimirImagem(file);
  const path = `${livroId}.jpg`;
  const { error } = await supabase.storage.from('capas-livros').upload(path, comprimida, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('capas-livros').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Sem compressão — é o texto/PDF de domínio público em si, não uma imagem.
export async function enviarArquivoOnline(file: File, livroId: string): Promise<string> {
  const path = `${livroId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('acervo-online').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('acervo-online').getPublicUrl(path);
  return data.publicUrl;
}
