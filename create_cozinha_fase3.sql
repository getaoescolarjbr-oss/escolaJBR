-- ====================================================================================
-- COZINHA (PNAE) — Fase 3 (final): fichas técnicas + necessidades alimentares
-- especiais. Reaproveita a Fundação (usuario_tem_papel, consentimentos, fn_auditoria,
-- bucket privado já criado — cozinha-documentos) e o padrão já usado em
-- create_secretaria_matricula_consentimento_id.sql (trigger resolve e grava
-- QUAL consentimento satisfez a exigência, sem confiar no cliente).
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. fichas_tecnicas / ficha_ingredientes — mesma audiência do resto do módulo
--    (GESTAO/NUTRICAO); não é dado sensível, mas também não tem motivo pra ser público
--    (diferente do cardápio, que abre quando publicado).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preparacao   TEXT NOT NULL,
  modo_preparo TEXT,
  criado_por   UUID NOT NULL REFERENCES usuarios(id),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fichas_tecnicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fichas_tecnicas_rw_gestao_nutricao" ON fichas_tecnicas;
CREATE POLICY "fichas_tecnicas_rw_gestao_nutricao" ON fichas_tecnicas FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_fichas_tecnicas ON fichas_tecnicas;
CREATE TRIGGER trg_auditoria_fichas_tecnicas
  AFTER INSERT OR UPDATE OR DELETE ON fichas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TABLE IF NOT EXISTS ficha_ingredientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id   UUID NOT NULL REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES estoque_itens(id),
  per_capita NUMERIC(10, 3) NOT NULL CHECK (per_capita > 0)
);

CREATE INDEX IF NOT EXISTS idx_ficha_ingredientes_ficha ON ficha_ingredientes (ficha_id);

ALTER TABLE ficha_ingredientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ficha_ingredientes_rw_gestao_nutricao" ON ficha_ingredientes;
CREATE POLICY "ficha_ingredientes_rw_gestao_nutricao" ON ficha_ingredientes FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_ficha_ingredientes ON ficha_ingredientes;
CREATE TRIGGER trg_auditoria_ficha_ingredientes
  AFTER INSERT OR UPDATE OR DELETE ON ficha_ingredientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. necessidades_especiais — DADO SENSÍVEL DE SAÚDE. RLS travada com FORCE (mesmo
--    endurecimento de consentimentos: nem o dono da tabela escapa da RLS por acidente).
--    laudo_arquivo_path aponta pro bucket cozinha-documentos (já GESTAO/NUTRICAO —
--    audiência certa, path sugerido: laudos/{necessidade_id}/arquivo), não pro bucket
--    documentos-pessoas da Secretaria (esse é GESTAO/SECRETARIA — audiência errada
--    para dado de saúde alimentar).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS necessidades_especiais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id          UUID NOT NULL REFERENCES alunos(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('ALERGIA', 'INTOLERANCIA', 'CELIACO', 'DIABETES', 'SELETIVIDADE', 'OUTRO')),
  descricao         TEXT,
  laudo_arquivo_path TEXT,
  adaptacao         TEXT,
  consentimento_id  UUID REFERENCES consentimentos(id),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  criado_por        UUID NOT NULL REFERENCES usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_necessidades_especiais_aluno ON necessidades_especiais (aluno_id);

ALTER TABLE necessidades_especiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE necessidades_especiais FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "necessidades_especiais_rw_gestao_nutricao" ON necessidades_especiais;
CREATE POLICY "necessidades_especiais_rw_gestao_nutricao" ON necessidades_especiais FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_necessidades_especiais ON necessidades_especiais;
CREATE TRIGGER trg_auditoria_necessidades_especiais
  AFTER INSERT OR UPDATE OR DELETE ON necessidades_especiais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Exige consentimento DADOS_SENSIVEIS aceito do responsável antes de cadastrar —
-- mesmo padrão de fn_matricula_exige_consentimento: o trigger resolve e grava QUAL
-- consentimento satisfez a exigência, o cliente não escolhe/forja o id.
CREATE OR REPLACE FUNCTION public.fn_necessidade_especial_exige_consentimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa_id UUID;
  v_consentimento_id UUID;
BEGIN
  SELECT pessoa_id INTO v_pessoa_id FROM alunos WHERE id = NEW.aluno_id;

  SELECT id INTO v_consentimento_id
  FROM consentimentos
  WHERE pessoa_id = v_pessoa_id AND tipo = 'DADOS_SENSIVEIS' AND aceito = true
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_consentimento_id IS NULL THEN
    RAISE EXCEPTION 'Cadastro de necessidade alimentar especial requer consentimento de DADOS_SENSIVEIS aceito pelo responsável.'
      USING ERRCODE = '23514';
  END IF;

  NEW.consentimento_id := v_consentimento_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_necessidade_especial_exige_consentimento ON necessidades_especiais;
CREATE TRIGGER trg_necessidade_especial_exige_consentimento
  BEFORE INSERT ON necessidades_especiais
  FOR EACH ROW EXECUTE FUNCTION public.fn_necessidade_especial_exige_consentimento();
