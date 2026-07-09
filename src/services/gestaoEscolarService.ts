import { supabase } from '../lib/supabase';
import type { IndicadoresGestaoEscolar } from '../types/gestaoEscolar';

export async function obterIndicadoresGestaoEscolar(): Promise<IndicadoresGestaoEscolar> {
  const { data, error } = await supabase.rpc('rpc_indicadores_gestao_escolar');
  if (error) throw error;
  return data as IndicadoresGestaoEscolar;
}
