// Cadastro central de Pessoas. Aluno, Responsável e Servidor (professores) são
// extensões desta identidade — módulos futuros (Secretaria, Biblioteca, Agendamento,
// Gestão) devem referenciar `pessoas`/`pessoa_id`, não duplicar estes campos.
export interface Pessoa {
  id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  foto_url: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface VinculoAluno {
  id: string;
  nome: string;
  turma_id: string | null;
  aluno_numero: number | null;
  status: string | null;
}

export interface VinculoServidor {
  id: string;
  nome: string;
  cargo: string;
}

export interface VinculoResponsavel {
  id: string;
  parentesco: string | null;
}

export interface VinculosPessoa {
  aluno: VinculoAluno | null;
  servidor: VinculoServidor | null;
  responsavel: VinculoResponsavel | null;
}

export interface AlunoResponsavelVinculo {
  id: string;
  aluno_id: string;
  responsavel_id: string;
  principal: boolean;
  aluno_nome?: string;
}
