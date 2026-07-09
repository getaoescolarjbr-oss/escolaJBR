export interface Genero {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
}

export interface Colecao {
  id: string;
  nome: string;
  descricao: string | null;
  criado_em: string;
}

export type TipoAcervo = 'FISICO' | 'ONLINE';

export interface Livro {
  id: string;
  titulo: string;
  autor: string;
  isbn: string | null;
  editora: string | null;
  ano_publicacao: number | null;
  genero_id: string | null;
  colecao_id: string | null;
  volume: number | null;
  sinopse: string | null;
  capa_url: string | null;
  tipo_acervo: TipoAcervo;
  dominio_publico: boolean;
  fonte_dominio_publico: string | null;
  arquivo_url: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstadoExemplar = 'Novo' | 'Bom' | 'Regular' | 'Danificado';
export type StatusExemplar = 'DISPONIVEL' | 'EMPRESTADO' | 'RESERVADO' | 'BAIXADO';

export interface Exemplar {
  id: string;
  livro_id: string;
  tombo: string;
  estado: EstadoExemplar;
  status: StatusExemplar;
  localizacao: string | null;
  ativo: boolean;
  criado_em: string;
}

export type StatusEmprestimo = 'ATIVO' | 'DEVOLVIDO' | 'ATRASADO';

export interface Emprestimo {
  id: string;
  exemplar_id: string;
  aluno_id: string;
  data_emprestimo: string;
  data_prevista: string;
  data_devolucao: string | null;
  status: StatusEmprestimo;
  renovacoes: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type StatusReservaLivro = 'ATIVA' | 'ATENDIDA' | 'CANCELADA' | 'EXPIRADA';

export interface ReservaLivro {
  id: string;
  livro_id: string;
  aluno_id: string;
  data: string;
  status: StatusReservaLivro;
  criado_em: string;
}

export type StatusIndicacaoCompra = 'PENDENTE' | 'ANALISE' | 'COMPRADO' | 'RECUSADO';

export interface IndicacaoCompra {
  id: string;
  aluno_id: string;
  titulo: string;
  autor: string | null;
  status: StatusIndicacaoCompra;
  observacao_biblioteca: string | null;
  criado_em: string;
}

// Precisa ficar em sincronia com os `WHEN` de fn_avaliar_conquistas() no banco — um
// regra_tipo fora desta lista simplesmente nunca concede nada (falha segura), não dá
// erro, então o cadastro na tela também não deveria oferecer um valor inventado.
export type RegraTipoConquista = 'PRIMEIRO_EMPRESTIMO' | 'LIVROS_LIDOS' | 'METAS_CONCLUIDAS' | 'RESENHAS_PUBLICADAS' | 'DUPLAS_FORMADAS';

export interface Conquista {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  regra_tipo: string;
  regra_limiar: number | null;
  ativo: boolean;
  criado_em: string;
}

export type StatusMeta = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

export interface Meta {
  id: string;
  aluno_id: string;
  descricao: string;
  livro_id: string | null;
  status: StatusMeta;
  data_alvo: string | null;
  concluida_em: string | null;
  criado_em: string;
}

export interface Recompensa {
  id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  custo_pontos: number;
  estoque: number;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
}

export type StatusResgate = 'PENDENTE' | 'ENTREGUE' | 'CANCELADO';

export interface Resgate {
  id: string;
  aluno_id: string;
  recompensa_id: string;
  custo_pontos: number;
  codigo: string;
  status: StatusResgate;
  entregue_por: string | null;
  entregue_em: string | null;
  criado_em: string;
}
