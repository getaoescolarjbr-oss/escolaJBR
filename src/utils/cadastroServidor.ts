import type { Papel } from '../types/rbac';

// Mesma lista de ProfessorManager (defaultCargos): quem cadastra sozinho escolhe entre os
// cargos que a escola já usa, para não gerar variações de grafia.
export const CARGOS_SERVIDOR = [
  'Professor',
  'Coordenador',
  'Coordenador de Área (PCA)',
  'PCPI (Recursos e Agendamento)',
  'Diretor',
  'Vice-Diretor',
  'Inspetor',
  'Portaria',
  'Auxiliar de Secretaria',
  'Secretário(a)',
  'Administrativo (Secretaria)',
  'Administrativo (Biblioteca)',
  'Administrativo (Inspetor(a))',
  'Administrativo (Limpeza)',
  'Administrativo (Cozinha)',
  'Administrativo (Manutenção)',
] as const;

export const AREAS_CONHECIMENTO_CADASTRO = [
  'Matemática',
  'Ciências da Natureza',
  'Linguagens',
  'Humanas',
  'Educação Especial',
  'Educação Profissional',
] as const;

export const STATUS_SERVIDOR_CADASTRO = ['Efetivo(a)', 'Convocado(a)', 'Contratado(a)'] as const;

// Papéis que a aprovação pode conceder a um servidor (ALUNO/RESPONSAVEL não se aplicam).
export const PAPEIS_SERVIDOR: Papel[] = [
  'PROFESSOR',
  'COORDENACAO_AREA',
  'COORDENACAO',
  'PCPI',
  'INSPETOR',
  'BIBLIOTECA',
  'NUTRICAO',
  'SECRETARIA',
  'GESTAO',
];

// Sugestão para quem aprova — nunca é aplicada sem confirmação. Cargos sem papel óbvio
// (limpeza, manutenção) voltam null e obrigam a escolha.
export function papelSugeridoPorCargo(cargo: string): Papel | null {
  switch (cargo) {
    case 'Professor': return 'PROFESSOR';
    case 'Coordenador': return 'COORDENACAO';
    case 'Coordenador de Área (PCA)': return 'COORDENACAO_AREA';
    case 'PCPI (Recursos e Agendamento)': return 'PCPI';
    case 'Diretor':
    case 'Vice-Diretor': return 'GESTAO';
    case 'Inspetor':
    case 'Portaria':
    case 'Administrativo (Inspetor(a))': return 'INSPETOR';
    case 'Auxiliar de Secretaria':
    case 'Secretário(a)':
    case 'Administrativo (Secretaria)': return 'SECRETARIA';
    case 'Administrativo (Biblioteca)': return 'BIBLIOTECA';
    case 'Administrativo (Cozinha)': return 'NUTRICAO';
    default: return null;
  }
}

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function validarCpf(valor: string): boolean {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}

export function formatarCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export interface CamposServidor {
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

export const CAMPOS_SERVIDOR_VAZIOS: CamposServidor = {
  nome: '',
  cargo: 'Professor',
  cpf: '',
  dataNascimento: '',
  telefone: '',
  areaConhecimento: '',
  statusServidor: 'Efetivo(a)',
  aceiteLgpd: false,
  rg: '',
  tituloEleitor: '',
  zonaEleitoral: '',
  secaoEleitoral: '',
  endereco: '',
  telefoneFixo: '',
  formacao: '',
};
