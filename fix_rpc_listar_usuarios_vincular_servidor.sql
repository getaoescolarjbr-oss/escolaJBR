-- ====================================================================================
-- FIX: Corrige rpc_listar_usuarios_papeis para incluir servidores NÃO vinculados
--      e adiciona rpc_vincular_servidor_usuario para criar o vínculo na interface.
--
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Corrige a RPC de listagem para incluir também professores sem conta vinculada
--    Agora retorna:
--      - Todos os usuários com vínculo a pessoa (como antes)
--      - Mais: servidores da tabela `professores` que ainda não têm usuario_id
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_listar_usuarios_papeis();
CREATE OR REPLACE FUNCTION public.rpc_listar_usuarios_papeis()
RETURNS TABLE (
  usuario_id     UUID,
  pessoa_nome    TEXT,
  email          TEXT,
  papel          papel_usuario,
  ativo          BOOLEAN,
  -- Campos extras para servidores não vinculados
  servidor_id    UUID,   -- ID da tabela professores (se vier de lá)
  vinculado      BOOLEAN -- true = tem conta de acesso; false = não tem
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas usuários com papel GESTAO podem listar usuários e papéis.' USING ERRCODE = '42501';
  END IF;

  -- Usuários com vínculo (conta criada e ligada a uma pessoa)
  RETURN QUERY
  SELECT
    u.id           AS usuario_id,
    pe.nome        AS pessoa_nome,
    pe.email       AS email,
    up.papel       AS papel,
    u.ativo        AS ativo,
    NULL::UUID     AS servidor_id,
    TRUE           AS vinculado
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  LEFT JOIN usuario_papeis up ON up.usuario_id = u.id

  UNION ALL

  -- Servidores cadastrados na tabela professores mas SEM vínculo (usuario_id IS NULL)
  SELECT
    NULL::UUID     AS usuario_id,
    pr.nome        AS pessoa_nome,
    pr.email       AS email,
    NULL::papel_usuario AS papel,
    FALSE          AS ativo,
    pr.id          AS servidor_id,
    FALSE          AS vinculado
  FROM professores pr
  WHERE pr.usuario_id IS NULL

  ORDER BY pessoa_nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_papeis() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_papeis() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. RPC para vincular um servidor (professores.id) a um usuário já existente
--    Uso: gestão busca o e-mail no auth, obtém o usuario_id e vincula ao servidor.
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_vincular_servidor_usuario(UUID, UUID);
CREATE OR REPLACE FUNCTION public.rpc_vincular_servidor_usuario(
  p_servidor_id UUID,  -- ID da tabela professores
  p_usuario_id  UUID   -- ID da tabela usuarios (não auth.users)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão para vincular servidores.' USING ERRCODE = '42501';
  END IF;

  -- Obtém e-mail do usuário para sincronizar no servidor
  SELECT pe.email INTO v_email
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  WHERE u.id = p_usuario_id;

  -- Atualiza o servidor com o usuario_id
  UPDATE professores
  SET usuario_id = p_usuario_id
  WHERE id = p_servidor_id;

  RETURN jsonb_build_object('sucesso', true, 'servidor_id', p_servidor_id, 'usuario_id', p_usuario_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_servidor_usuario(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_servidor_usuario(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. RPC auxiliar: lista usuários com conta mas sem vínculo a nenhum servidor
--    (útil para o dropdown de "vincular conta" na interface)
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
  SELECT u.id, pe.nome, pe.email
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  WHERE u.id NOT IN (
    SELECT pr.usuario_id FROM professores pr WHERE pr.usuario_id IS NOT NULL
  )
  ORDER BY pe.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_sem_servidor() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_sem_servidor() TO authenticated;
