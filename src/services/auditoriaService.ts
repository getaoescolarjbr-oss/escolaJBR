import { supabase } from '../lib/supabase';

// Chama log_acesso() (RPC criada em create_fundacao_auditoria.sql) para READ/EXPORT.
// Best-effort por natureza: se a chamada falhar, não deve travar a tela — a garantia
// de auditoria real é o trigger de escrita (CREATE/UPDATE/DELETE), não este log.
export async function logAcesso(
  tabela: string,
  registroId: string,
  pessoaAfetadaId: string | null,
  acao: 'READ' | 'EXPORT' = 'READ'
) {
  try {
    await supabase.rpc('log_acesso', {
      p_tabela: tabela,
      p_registro_id: registroId,
      p_pessoa_afetada_id: pessoaAfetadaId,
      p_acao: acao,
    });
  } catch (err) {
    console.warn('log_acesso falhou (best-effort, não bloqueia a tela):', err);
  }
}
