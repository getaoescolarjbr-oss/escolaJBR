-- ====================================================================================
-- FUNDAÇÃO — Etapa 3: CRUD do cadastro central de Pessoas
-- Execute no Painel do Supabase > SQL Editor, depois dos scripts da Etapa 2.
-- Não altera nem remove nenhuma coluna existente em `alunos` (matrícula continua
-- 100% no StudentManager.tsx atual — aqui só ganha um vínculo com `pessoas`).
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. alunos ganha pessoa_id (aditivo, nullable) — mesmo padrão usado em professores
--    na Etapa 2. Todas as colunas de matrícula (turma_id, status, aluno_numero,
--    atestado_*) continuam existindo e sendo geridas só pelo StudentManager.
-- ------------------------------------------------------------------------------------
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES pessoas(id);

-- Backfill: cria 1 pessoa (só identidade: nome + foto) para cada aluno existente.
-- CPF/nascimento/contatos ficam NULL até alguém preencher na tela de Pessoas ou até
-- a Secretaria coletar isso na matrícula (módulo futuro).
INSERT INTO pessoas (nome, foto_url)
SELECT a.nome, a.foto_url
FROM alunos a
WHERE a.pessoa_id IS NULL;

-- Liga cada aluno à pessoa recém-criada. Usa uma CTE numerada para casar 1:1 mesmo
-- quando há alunos com o mesmo nome (não dá para casar só por nome+foto nesse caso).
WITH alunos_sem_pessoa AS (
  SELECT id, nome, foto_url,
         row_number() OVER (PARTITION BY nome, foto_url ORDER BY created_at) AS rn
  FROM alunos
  WHERE pessoa_id IS NULL
),
pessoas_novas AS (
  SELECT id, nome, foto_url,
         row_number() OVER (PARTITION BY nome, foto_url ORDER BY criado_em) AS rn
  FROM pessoas
  WHERE id NOT IN (SELECT pessoa_id FROM alunos WHERE pessoa_id IS NOT NULL)
)
UPDATE alunos a
SET pessoa_id = pn.id
FROM alunos_sem_pessoa asp
JOIN pessoas_novas pn
  ON pn.nome = asp.nome
 AND pn.foto_url IS NOT DISTINCT FROM asp.foto_url
 AND pn.rn = asp.rn
WHERE a.id = asp.id;

-- Trigger: todo aluno NOVO cadastrado a partir de agora (via StudentManager.tsx, sem
-- nenhuma alteração naquele código) já nasce com pessoa vinculada.
CREATE OR REPLACE FUNCTION public.fn_aluno_criar_pessoa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pessoa_id IS NULL THEN
    INSERT INTO pessoas (nome, foto_url)
    VALUES (NEW.nome, NEW.foto_url)
    RETURNING id INTO NEW.pessoa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aluno_criar_pessoa ON alunos;
CREATE TRIGGER trg_aluno_criar_pessoa
  BEFORE INSERT ON alunos
  FOR EACH ROW EXECUTE FUNCTION public.fn_aluno_criar_pessoa();

-- Auditoria para alunos (adiada da Etapa 2 porque só agora a tabela tem pessoa_id).
DROP TRIGGER IF EXISTS trg_auditoria_alunos ON alunos;
CREATE TRIGGER trg_auditoria_alunos
  AFTER INSERT OR UPDATE OR DELETE ON alunos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. Responsavel (estende Pessoa) e vínculo Responsável ↔ Aluno
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responsaveis (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id   UUID NOT NULL REFERENCES pessoas(id),
  parentesco  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aluno_responsaveis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id       UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  principal      BOOLEAN NOT NULL DEFAULT false,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, responsavel_id)
);

CREATE INDEX IF NOT EXISTS idx_aluno_responsaveis_aluno ON aluno_responsaveis (aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_responsaveis_responsavel ON aluno_responsaveis (responsavel_id);

ALTER TABLE responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_responsaveis ENABLE ROW LEVEL SECURITY;

-- Mesma régua de acesso da tabela `pessoas` (Etapa 2): só GESTAO/SECRETARIA por
-- enquanto. RESPONSAVEL ainda não tem tela (previsto, sem UI nesta Fundação).
DROP POLICY IF EXISTS "responsaveis_rw_gestao_secretaria" ON responsaveis;
CREATE POLICY "responsaveis_rw_gestao_secretaria" ON responsaveis
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "aluno_responsaveis_rw_gestao_secretaria" ON aluno_responsaveis;
CREATE POLICY "aluno_responsaveis_rw_gestao_secretaria" ON aluno_responsaveis
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_responsaveis ON responsaveis;
CREATE TRIGGER trg_auditoria_responsaveis
  AFTER INSERT OR UPDATE OR DELETE ON responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_aluno_responsaveis ON aluno_responsaveis;
CREATE TRIGGER trg_auditoria_aluno_responsaveis
  AFTER INSERT OR UPDATE OR DELETE ON aluno_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. RPC de leitura agregada: vínculos de uma pessoa (Aluno / Servidor / Responsável).
--    Evita que o front precise de 3-4 SELECTs separados e mantém a checagem de papel
--    num único lugar (mesma régua de pessoas/responsaveis).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_vinculos_pessoa(p_pessoa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar vínculos de pessoas.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'aluno', (SELECT to_jsonb(a) FROM (
      SELECT id, nome, turma_id, aluno_numero, status FROM alunos WHERE pessoa_id = p_pessoa_id LIMIT 1
    ) a),
    'servidor', (SELECT to_jsonb(p) FROM (
      SELECT id, nome, cargo FROM professores WHERE pessoa_id = p_pessoa_id LIMIT 1
    ) p),
    'responsavel', (SELECT to_jsonb(r) FROM (
      SELECT id, parentesco FROM responsaveis WHERE pessoa_id = p_pessoa_id LIMIT 1
    ) r)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vinculos_pessoa(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_vinculos_pessoa(UUID) TO authenticated;
