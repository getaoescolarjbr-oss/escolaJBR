-- ====================================================================================
-- FIX: Corrige rpc_listar_usuarios_papeis para incluir servidores NÃO vinculados
--      e adiciona RPCs de vinculação usando a estrutura real do banco.
--
-- Estrutura real:
--   professores.user_id  →  auth.users.id  =  usuarios.id
--   usuarios.id          =  auth.users.id  (PRIMARY KEY é o próprio auth.uid())
--   usuarios.pessoa_id   →  pessoas.id
--
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Corrige a RPC de listagem para incluir também professores sem vínculo (user_id IS NULL)
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_listar_usuarios_papeis();
CREATE OR REPLACE FUNCTION public.rpc_listar_usuarios_papeis()
RETURNS TABLE (
  usuario_id     UUID,
  pessoa_nome    TEXT,
  email          TEXT,
  papel          papel_usuario,
  ativo          BOOLEAN,
  servidor_id    UUID,
  vinculado      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas usuários com papel GESTAO podem listar usuários e papéis.' USING ERRCODE = '42501';
  END IF;

  -- Usuários com conta vinculada (usuarios.id = auth.users.id)
  RETURN QUERY
  SELECT
    u.id           AS usuario_id,
    pe.nome        AS pessoa_nome,
    pe.email       AS email,
    up.papel       AS papel,
    u.ativo        AS ativo,
    pr.id          AS servidor_id,
    TRUE           AS vinculado
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  LEFT JOIN usuario_papeis up ON up.usuario_id = u.id
  LEFT JOIN professores pr ON pr.user_id = u.id

  UNION ALL

  -- Servidores cadastrados em professores mas SEM conta (user_id IS NULL)
  SELECT
    NULL::UUID         AS usuario_id,
    pr.nome            AS pessoa_nome,
    pr.email           AS email,
    NULL::papel_usuario AS papel,
    FALSE              AS ativo,
    pr.id              AS servidor_id,
    FALSE              AS vinculado
  FROM professores pr
  WHERE pr.user_id IS NULL

  ORDER BY pessoa_nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_papeis() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_papeis() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. RPC para vincular um servidor (professores.id) a um usuário existente
--    Ao atualizar professores.user_id, o trigger fn_professor_criar_usuario
--    cria automaticamente o registro em usuarios.
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_vincular_servidor_usuario(UUID, UUID);
CREATE OR REPLACE FUNCTION public.rpc_vincular_servidor_usuario(
  p_servidor_id UUID,  -- ID da tabela professores
  p_usuario_id  UUID   -- ID do auth.users (= usuarios.id)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão para vincular servidores.' USING ERRCODE = '42501';
  END IF;

  -- Atualiza professores.user_id — o trigger cuida de criar o registro em usuarios
  UPDATE professores
  SET user_id = p_usuario_id
  WHERE id = p_servidor_id;

  RETURN jsonb_build_object('sucesso', true, 'servidor_id', p_servidor_id, 'usuario_id', p_usuario_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_servidor_usuario(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_servidor_usuario(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. RPC auxiliar: usuários com conta no auth mas sem professor vinculado
--    (para o dropdown de "qual conta vincular ao servidor")
-- ------------------------------------------------------------------------------------
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
  ORDER BY pe.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_sem_servidor() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_sem_servidor() TO authenticated;
