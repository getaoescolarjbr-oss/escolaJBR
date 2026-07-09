import { supabase } from '../lib/supabase';
import type { SerieReferencia, Matricula, DivergenciaMatricula } from '../types/secretaria';

export async function listarSeries(): Promise<SerieReferencia[]> {
  const { data, error } = await supabase.from('series_referencia').select('*').order('ordem');
  if (error) throw error;
  return data ?? [];
}

export async function criarSerie(dados: Pick<SerieReferencia, 'codigo' | 'nome' | 'ordem'>) {
  const { error } = await supabase.from('series_referencia').insert([dados]);
  if (error) throw error;
}

export async function atualizarSerie(id: string, dados: Partial<SerieReferencia>) {
  const { error } = await supabase.from('series_referencia').update(dados).eq('id', id);
  if (error) throw error;
}

export async function obterMatricula(pessoaId: string, anoLetivo: number): Promise<Matricula | null> {
  const { data, error } = await supabase
    .from('matriculas')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .eq('ano_letivo', anoLetivo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarMatriculasDaPessoa(pessoaId: string): Promise<Matricula[]> {
  const { data, error } = await supabase
    .from('matriculas')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('ano_letivo', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// A trigger trg_matricula_exige_consentimento no banco bloqueia o INSERT se não
// existir consentimento CADASTRO aceito para a pessoa — o erro do Postgres sobe até
// aqui como Error comum; a tela precisa tratar essa mensagem específica e oferecer o
// registro de consentimento antes de tentar de novo.
export async function criarMatricula(dados: Omit<Matricula, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Matricula> {
  const { data, error } = await supabase.from('matriculas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarMatricula(id: string, dados: Partial<Matricula>): Promise<void> {
  const { error } = await supabase.from('matriculas').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarDivergencias(anoLetivo?: number): Promise<DivergenciaMatricula[]> {
  const { data, error } = await supabase.rpc('rpc_divergencias_matricula', { p_ano_letivo: anoLetivo ?? null });
  if (error) throw error;
  return (data ?? []) as DivergenciaMatricula[];
}
