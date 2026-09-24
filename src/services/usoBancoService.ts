import { supabase } from '../lib/supabase';

export interface UsoBancoDados {
  total_bytes: number;
  storage_bytes: number;
  public_bytes: number;
  maiores_tabelas: { tabela: string; bytes: number }[];
}

// Cotas do plano gratuito do Supabase (por projeto). Se o plano mudar, é só editar aqui.
export const LIMITE_BANCO_BYTES = 500 * 1024 * 1024;
export const LIMITE_STORAGE_BYTES = 1024 * 1024 * 1024;

// Só a GESTAO consegue chamar (a checagem é dentro da função no banco).
export async function obterUsoBancoDados(): Promise<UsoBancoDados> {
  const { data, error } = await supabase.rpc('rpc_uso_banco_dados');
  if (error) throw new Error(error.message);
  return data as UsoBancoDados;
}
