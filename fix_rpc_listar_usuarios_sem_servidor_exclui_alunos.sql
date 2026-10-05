-- ====================================================================================
-- FIX: rpc_listar_usuarios_sem_servidor() estava listando QUALQUER usuário sem
-- professor vinculado — incluindo contas de Aluno (BiblioClube) e Responsável, que
-- não fazem sentido no seletor "vincular conta" de um servidor (Usuários e Funções).
--
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- ====================================================================================
DROP FUNCTION IF EXISTS public.rpc_listar_usuarios_sem_servidor();
CREATE OR REPLACE FUNCTION public.rpc_listar_usuarios_sem_servidor()
RETURNS TABLE (usuario_id UUID, nome TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id AS usuario_id, pe.nome, pe.email
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  WHERE u.id NOT IN (
    SELECT pr.user_id FROM professores pr WHERE pr.user_id IS NOT NULL
  )
  AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.pessoa_id = u.pessoa_id)
  AND NOT EXISTS (SELECT 1 FROM responsaveis r WHERE r.pessoa_id = u.pessoa_id)
  ORDER BY pe.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_sem_servidor() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_sem_servidor() TO authenticated;
