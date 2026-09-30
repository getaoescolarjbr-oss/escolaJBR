-- ====================================================================================
-- CADASTRO RÁPIDO DE SUBSTITUTO (Folha do Substituto)
--
-- O professor substituto pode ser escolhido do banco de professores da escola (`professores`)
-- OU de um cadastro rápido, para quem ainda não tem cadastro completo (convocado novo, por
-- exemplo). O cadastro rápido guarda só o essencial e depois aparece na lista de escolha
-- junto com os professores, sem digitar o nome de novo. Só GESTAO e SECRETARIA.
-- Aditivo. Reversão no fim do arquivo.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS substitutos_rapidos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL CHECK (length(trim(nome)) >= 3),
  telefone    TEXT,
  cpf         TEXT CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  observacoes TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_por  UUID REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evita duplicar a mesma pessoa (mesmo nome ou mesmo CPF) na lista.
CREATE UNIQUE INDEX IF NOT EXISTS substitutos_rapidos_nome_unico ON substitutos_rapidos (lower(trim(nome))) WHERE ativo;
CREATE UNIQUE INDEX IF NOT EXISTS substitutos_rapidos_cpf_unico ON substitutos_rapidos (cpf) WHERE cpf IS NOT NULL AND ativo;

ALTER TABLE substitutos_rapidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutos_rapidos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "substitutos_rapidos_gestao_secretaria" ON substitutos_rapidos;
CREATE POLICY "substitutos_rapidos_gestao_secretaria" ON substitutos_rapidos FOR ALL TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')));

DROP TRIGGER IF EXISTS trg_auditoria_substitutos_rapidos ON substitutos_rapidos;
CREATE TRIGGER trg_auditoria_substitutos_rapidos AFTER INSERT OR UPDATE OR DELETE ON substitutos_rapidos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- O lançamento aponta para o substituto do cadastro rápido (quando for o caso).
ALTER TABLE folha_substituto_lancamentos
  ADD COLUMN IF NOT EXISTS substituto_rapido_id UUID REFERENCES substitutos_rapidos(id) ON DELETE SET NULL;

-- REVERSÃO (descarta o cadastro rápido; os lançamentos mantêm o nome gravado):
--   ALTER TABLE folha_substituto_lancamentos DROP COLUMN IF EXISTS substituto_rapido_id;
--   DROP TABLE IF EXISTS substitutos_rapidos;
