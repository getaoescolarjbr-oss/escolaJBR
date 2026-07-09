-- ====================================================================================
-- BIBLIOTECA — Fase 1 (1/8): funções auxiliares reutilizadas por todo o módulo.
-- Rode DEPOIS de alter_papel_usuario_add_aluno.sql.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. meu_aluno_id(): resolve o `alunos.id` do usuário logado, via
--    usuarios.pessoa_id = alunos.pessoa_id. Evita repetir esse JOIN em toda policy de
--    RLS do módulo (mesmo espírito do usuario_tem_papel() da Fundação). Retorna NULL
--    para quem não é aluno (professor, staff, etc.) ou cujo aluno ainda não foi
--    vinculado a uma pessoa (matrícula antiga sem pessoa_id preenchido).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meu_aluno_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id
  FROM alunos a
  JOIN usuarios u ON u.pessoa_id = a.pessoa_id
  WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.meu_aluno_id() FROM public;
GRANT EXECUTE ON FUNCTION public.meu_aluno_id() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. fn_auditoria(): melhoria retrocompatível (mesma função, mesmo nome — todos os
--    triggers já existentes em outras tabelas passam a se beneficiar automaticamente).
--    Várias tabelas novas da Biblioteca (emprestimos, resgates, favoritos, metas...)
--    não têm coluna `pessoa_id` direta, e sim `aluno_id`. Antes, isso fazia
--    pessoa_afetada_id ficar sempre NULL nessas tabelas. Agora, quando não existe
--    `pessoa_id` na linha, a função tenta resolver via `aluno_id -> alunos.pessoa_id`.
--    Tabelas que não têm nem `pessoa_id` nem `aluno_id` continuam com NULL, como antes.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao        TEXT;
  v_registro_id UUID;
  v_pessoa_id   UUID;
  v_campos      TEXT[];
  v_linha       JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao        := 'CREATE';
    v_linha       := to_jsonb(NEW);
    v_registro_id := (v_linha ->> 'id')::uuid;
    SELECT array_agg(key) INTO v_campos FROM jsonb_object_keys(v_linha) AS key;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao        := 'UPDATE';
    v_linha       := to_jsonb(NEW);
    v_registro_id := (v_linha ->> 'id')::uuid;
    SELECT array_agg(n.key) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
      WHERE n.value IS DISTINCT FROM o.value;
  ELSE -- DELETE
    v_acao        := 'DELETE';
    v_linha       := to_jsonb(OLD);
    v_registro_id := (v_linha ->> 'id')::uuid;
    SELECT array_agg(key) INTO v_campos FROM jsonb_object_keys(v_linha) AS key;
  END IF;

  IF TG_TABLE_NAME = 'pessoas' THEN
    v_pessoa_id := v_registro_id;
  ELSIF v_linha ? 'pessoa_id' THEN
    v_pessoa_id := NULLIF(v_linha ->> 'pessoa_id', '')::uuid;
  ELSIF v_linha ? 'aluno_id' THEN
    SELECT a.pessoa_id INTO v_pessoa_id FROM alunos a WHERE a.id = NULLIF(v_linha ->> 'aluno_id', '')::uuid;
  END IF;

  INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), v_acao, TG_TABLE_NAME, v_registro_id, v_pessoa_id, COALESCE(v_campos, '{}'));

  RETURN COALESCE(NEW, OLD);
END;
$$;
