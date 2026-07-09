// Papéis de acesso da Fundação. Precisa ficar em sincronia com o enum
// `papel_usuario` criado em create_fundacao_pessoas_rbac.sql.
export type Papel =
  | 'GESTAO'
  | 'SECRETARIA'
  | 'COORDENACAO'
  | 'PROFESSOR'
  | 'NUTRICAO'
  | 'BIBLIOTECA'
  | 'RESPONSAVEL'
  | 'INSPETOR'
  | 'ALUNO';

export const TODOS_PAPEIS: Papel[] = [
  'GESTAO',
  'SECRETARIA',
  'COORDENACAO',
  'PROFESSOR',
  'NUTRICAO',
  'BIBLIOTECA',
  'RESPONSAVEL',
  'INSPETOR',
  'ALUNO',
];

export interface UsuarioPapel {
  usuario_id: string;
  pessoa_nome: string;
  email: string | null;
  // null quando o usuário ainda não tem nenhum papel atribuído (LEFT JOIN na RPC).
  papel: Papel | null;
  ativo: boolean;
}
