-- ====================================================================================
-- FUNDAÇÃO — Etapa 2 (parte de auditoria mínima necessária para o RBAC)
-- Trilha de auditoria central. A cobertura de LGPD completa (consentimentos,
-- solicitações de exportação/exclusão) fica para a Etapa 4 — aqui só o registro
-- de CREATE/UPDATE/DELETE nas tabelas de identidade/RBAC criadas na Etapa 2.
-- Execute no Painel do Supabase > SQL Editor.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Tabela de auditoria
--    IMPORTANTE (decisão de segurança): NÃO guardamos os valores antigos/novos das
--    colunas (isso duplicaria dado sensível de Pessoa em um segundo lugar). Guardamos
--    apenas os NOMES dos campos alterados. Quem precisar do valor exato vai até o
--    registro atual (ou, no futuro, a um snapshot já mascarado).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID REFERENCES usuarios(id),
  acao              TEXT NOT NULL CHECK (acao IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT')),
  tabela            TEXT NOT NULL,
  registro_id       UUID,
  pessoa_afetada_id UUID REFERENCES pessoas(id),
  campos_alterados  TEXT[] NOT NULL DEFAULT '{}',
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_pessoa ON auditoria (pessoa_afetada_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_registro ON auditoria (tabela, registro_id);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria FORCE ROW LEVEL SECURITY;

-- Leitura: só GESTAO.
DROP POLICY IF EXISTS "auditoria_select_gestao" ON auditoria;
CREATE POLICY "auditoria_select_gestao" ON auditoria
  FOR SELECT
  USING (public.usuario_tem_papel('GESTAO'));

-- Sem policy de INSERT/UPDATE/DELETE para ninguém (nem GESTAO): por padrão o
-- PostgREST/RLS nega tudo que não tem policy permissiva. A única forma de inserir é
-- pela função fn_auditoria() abaixo, que é SECURITY DEFINER (roda como dono da
-- função/tabela e por isso não é bloqueada pela ausência de policy de INSERT).
-- Não existe UPDATE nem DELETE em lugar nenhum deste script — o log é append-only,
-- inclusive para GESTAO.

-- ------------------------------------------------------------------------------------
-- 2. Função de trigger genérica — qualquer tabela futura só precisa de:
--      CREATE TRIGGER trg_auditoria_<tabela>
--        AFTER INSERT OR UPDATE OR DELETE ON <tabela>
--        FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
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
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao        := 'CREATE';
    v_registro_id := (to_jsonb(NEW) ->> 'id')::uuid;
    v_pessoa_id   := CASE WHEN TG_TABLE_NAME = 'pessoas' THEN v_registro_id
                          ELSE NULLIF(to_jsonb(NEW) ->> 'pessoa_id', '')::uuid END;
    SELECT array_agg(key) INTO v_campos FROM jsonb_object_keys(to_jsonb(NEW)) AS key;

  ELSIF TG_OP = 'UPDATE' THEN
    v_acao        := 'UPDATE';
    v_registro_id := (to_jsonb(NEW) ->> 'id')::uuid;
    v_pessoa_id   := CASE WHEN TG_TABLE_NAME = 'pessoas' THEN v_registro_id
                          ELSE NULLIF(to_jsonb(NEW) ->> 'pessoa_id', '')::uuid END;
    SELECT array_agg(n.key) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
      WHERE n.value IS DISTINCT FROM o.value;

  ELSE -- DELETE
    v_acao        := 'DELETE';
    v_registro_id := (to_jsonb(OLD) ->> 'id')::uuid;
    v_pessoa_id   := CASE WHEN TG_TABLE_NAME = 'pessoas' THEN v_registro_id
                          ELSE NULLIF(to_jsonb(OLD) ->> 'pessoa_id', '')::uuid END;
    SELECT array_agg(key) INTO v_campos FROM jsonb_object_keys(to_jsonb(OLD)) AS key;
  END IF;

  INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), v_acao, TG_TABLE_NAME, v_registro_id, v_pessoa_id, COALESCE(v_campos, '{}'));

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ------------------------------------------------------------------------------------
-- 3. Anexa a auditoria às tabelas de identidade/RBAC criadas na Etapa 2.
--    (alunos entra na Etapa 3, quando ganhar pessoa_id.)
-- ------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria_pessoas ON pessoas;
CREATE TRIGGER trg_auditoria_pessoas
  AFTER INSERT OR UPDATE OR DELETE ON pessoas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_professores ON professores;
CREATE TRIGGER trg_auditoria_professores
  AFTER INSERT OR UPDATE OR DELETE ON professores
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_usuarios ON usuarios;
CREATE TRIGGER trg_auditoria_usuarios
  AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_usuario_papeis ON usuario_papeis;
CREATE TRIGGER trg_auditoria_usuario_papeis
  AFTER INSERT OR UPDATE OR DELETE ON usuario_papeis
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. log_acesso(): registro de leitura/exportação (READ/EXPORT).
--    LIMITAÇÃO DOCUMENTADA: ao contrário de CREATE/UPDATE/DELETE (garantidos por
--    trigger de banco, o cliente NÃO tem como pular), READ/EXPORT dependem do
--    front-end (ou de uma Edge Function) chamar esta RPC explicitamente no momento
--    da consulta. É "best-effort": um SELECT feito direto na API sem passar por essa
--    chamada não deixa rastro. NÃO tratar isso como garantia de conformidade LGPD —
--    a garantia de auditoria é o trigger de escrita (item 2/3 acima). Para os módulos
--    que exibirem dado sensível (ex.: prontuário do aluno), a tela deve chamar
--    log_acesso() ao abrir o registro.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_acesso(p_tabela TEXT, p_registro_id UUID, p_pessoa_afetada_id UUID, p_acao TEXT DEFAULT 'READ')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_acao NOT IN ('READ', 'EXPORT') THEN
    RAISE EXCEPTION 'log_acesso só aceita READ ou EXPORT; CREATE/UPDATE/DELETE são automáticos.';
  END IF;

  INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), p_acao, p_tabela, p_registro_id, p_pessoa_afetada_id, '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.log_acesso(TEXT, UUID, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.log_acesso(TEXT, UUID, UUID, TEXT) TO authenticated;
