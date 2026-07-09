-- ====================================================================================
-- COZINHA (PNAE) — Fase 5: boas práticas/higiene/temperatura, inspeções sanitárias
-- (guarda de 5 anos, reaproveita o bucket cozinha-documentos já criado) e testes de
-- aceitabilidade. Mesma audiência do resto do módulo (GESTAO/NUTRICAO) — não é dado
-- pessoal, mas também não tem motivo pra ser público.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. controle_sanitario — checklists de higiene/temperatura/limpeza.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controle_sanitario (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data         DATE NOT NULL DEFAULT current_date,
  tipo         TEXT NOT NULL CHECK (tipo IN ('HIGIENE', 'TEMPERATURA', 'LIMPEZA')),
  itens        JSONB NOT NULL DEFAULT '[]'::jsonb,
  conforme     BOOLEAN NOT NULL,
  responsavel  UUID NOT NULL REFERENCES usuarios(id),
  observacoes  TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controle_sanitario_data ON controle_sanitario (data);

ALTER TABLE controle_sanitario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "controle_sanitario_rw_gestao_nutricao" ON controle_sanitario;
CREATE POLICY "controle_sanitario_rw_gestao_nutricao" ON controle_sanitario FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_controle_sanitario ON controle_sanitario;
CREATE TRIGGER trg_auditoria_controle_sanitario
  AFTER INSERT OR UPDATE OR DELETE ON controle_sanitario
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. inspecoes_sanitarias — guarda de 5 anos. arquivo_path vive no bucket
--    cozinha-documentos (já GESTAO/NUTRICAO), path sugerido: inspecoes/{id}/arquivo.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspecoes_sanitarias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data           DATE NOT NULL,
  orgao          TEXT NOT NULL,
  resultado      TEXT NOT NULL,
  arquivo_path   TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspecoes_sanitarias_data ON inspecoes_sanitarias (data);

ALTER TABLE inspecoes_sanitarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspecoes_sanitarias_rw_gestao_nutricao" ON inspecoes_sanitarias;
CREATE POLICY "inspecoes_sanitarias_rw_gestao_nutricao" ON inspecoes_sanitarias FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_inspecoes_sanitarias ON inspecoes_sanitarias;
CREATE TRIGGER trg_auditoria_inspecoes_sanitarias
  AFTER INSERT OR UPDATE OR DELETE ON inspecoes_sanitarias
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. testes_aceitabilidade — referencia uma ficha técnica (preparação específica) ou
--    um cardápio (teste do dia inteiro); ao menos um dos dois precisa estar presente.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testes_aceitabilidade (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id             UUID REFERENCES fichas_tecnicas(id),
  cardapio_id          UUID REFERENCES cardapios(id),
  metodo               TEXT NOT NULL,
  data                 DATE NOT NULL DEFAULT current_date,
  percentual_aceitacao NUMERIC(5, 2) NOT NULL CHECK (percentual_aceitacao BETWEEN 0 AND 100),
  registrado_por       UUID NOT NULL REFERENCES usuarios(id),
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ficha_id IS NOT NULL OR cardapio_id IS NOT NULL)
);

ALTER TABLE testes_aceitabilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testes_aceitabilidade_rw_gestao_nutricao" ON testes_aceitabilidade;
CREATE POLICY "testes_aceitabilidade_rw_gestao_nutricao" ON testes_aceitabilidade FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

DROP TRIGGER IF EXISTS trg_auditoria_testes_aceitabilidade ON testes_aceitabilidade;
CREATE TRIGGER trg_auditoria_testes_aceitabilidade
  AFTER INSERT OR UPDATE OR DELETE ON testes_aceitabilidade
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
