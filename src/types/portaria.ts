export interface Visitante {
  id: string;
  nome: string;
  documento: string;
  motivo: string | null;
  pessoa_a_visitar: string | null;
  entrada_em: string;
  saida_em: string | null;
  registrado_por: string | null;
  criado_em: string;
}

export interface RegistroPortaria {
  id: string;
  tipo: string;
  descricao: string;
  criado_por: string | null;
  criado_em: string;
}
