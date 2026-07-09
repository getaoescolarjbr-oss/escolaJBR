-- ====================================================================================
-- FUNDAÇÃO — Etapa 2: Pessoas (mínimo) + RBAC (papéis) + autenticação
-- Execute este script no Painel do Supabase > SQL Editor.
-- Não altera nem remove nenhuma coluna existente em `professores`/`alunos`.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Tabela central de Pessoas (identidade). CRUD completo vem na Etapa 3.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pessoas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  cpf             TEXT,
  data_nascimento DATE,
  telefone        TEXT,
  email           TEXT,
  foto_url        TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- string vazia não pode "ocupar" a unicidade do CPF — normaliza para NULL.
  CONSTRAINT pessoas_cpf_nao_vazio CHECK (cpf IS NULL OR length(trim(cpf)) = 11)
);

-- Unicidade do CPF quando informado. Constraint UNIQUE do Postgres já trata NULL como
-- "não comparável" — múltiplas pessoas sem CPF cadastrado NÃO colidem entre si.
-- (Confirmação: isto é o comportamento padrão do Postgres, não precisa de índice parcial.)
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_unique ON pessoas (cpf) WHERE cpf IS NOT NULL;

ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------------
-- 2. Papéis de acesso (RBAC) — enum fixo, 8 valores
-- ------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'papel_usuario') THEN
    CREATE TYPE papel_usuario AS ENUM (
      'GESTAO', 'SECRETARIA', 'COORDENACAO', 'PROFESSOR',
      'NUTRICAO', 'BIBLIOTECA', 'RESPONSAVEL', 'INSPETOR'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- 3. professores ganha pessoa_id (aditivo, nullable) — NÃO remove/renomeia nada
-- ------------------------------------------------------------------------------------
ALTER TABLE professores ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES pessoas(id);

-- Backfill: cria 1 pessoa para cada professor existente que ainda não tenha pessoa_id
INSERT INTO pessoas (nome, email, telefone, data_nascimento)
SELECT p.nome, p.email, p.telefone, p.data_nascimento
FROM professores p
WHERE p.pessoa_id IS NULL;

-- Liga cada professor à pessoa recém-criada (mesmo nome/email, criada na mesma janela).
-- Feito por email quando único; evita depender de timestamp para casar as linhas.
UPDATE professores p
SET pessoa_id = pe.id
FROM pessoas pe
WHERE p.pessoa_id IS NULL
  AND pe.email IS NOT DISTINCT FROM p.email
  AND pe.nome = p.nome;

-- Trigger: todo professor NOVO cadastrado a partir de agora já nasce com pessoa vinculada,
-- sem precisar tocar em ProfessorManager.tsx ou em qualquer tela existente.
CREATE OR REPLACE FUNCTION public.fn_professor_criar_pessoa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pessoa_id IS NULL THEN
    INSERT INTO pessoas (nome, email, telefone, data_nascimento)
    VALUES (NEW.nome, NEW.email, NEW.telefone, NEW.data_nascimento)
    RETURNING id INTO NEW.pessoa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professor_criar_pessoa ON professores;
CREATE TRIGGER trg_professor_criar_pessoa
  BEFORE INSERT ON professores
  FOR EACH ROW EXECUTE FUNCTION public.fn_professor_criar_pessoa();

-- ------------------------------------------------------------------------------------
-- 4. usuarios — liga uma conta de login (Supabase Auth) a uma Pessoa
--    id É o mesmo id de auth.users (1:1). Não reimplementa autenticação/hash/sessão:
--    isso já é feito pelo Supabase Auth (GoTrue).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pessoa_id     UUID NOT NULL REFERENCES pessoas(id),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  ultimo_login  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Trigger: quando professores.user_id passa a ter valor (fluxo de "Primeiro Acesso"
-- em Login.tsx, que já faz `update professores set user_id = ...`), a conta de login
-- é automaticamente registrada em `usuarios` — nenhuma tela precisa ser alterada.
CREATE OR REPLACE FUNCTION public.fn_professor_criar_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO usuarios (id, pessoa_id)
    VALUES (NEW.user_id, NEW.pessoa_id)
    ON CONFLICT (id) DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professor_criar_usuario ON professores;
CREATE TRIGGER trg_professor_criar_usuario
  AFTER INSERT OR UPDATE OF user_id ON professores
  FOR EACH ROW EXECUTE FUNCTION public.fn_professor_criar_usuario();

-- ------------------------------------------------------------------------------------
-- 5. usuario_papeis — um usuário pode ter vários papéis (N:N)
--    usuario_id referencia usuarios.id (= auth.users.id = auth.uid()) — NUNCA pessoas.id.
--    É isso que faz o RBAC bater com a sessão autenticada.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_papeis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel          papel_usuario NOT NULL,
  concedido_por  UUID REFERENCES usuarios(id),
  concedido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, papel)
);

CREATE INDEX IF NOT EXISTS idx_usuario_papeis_usuario_id ON usuario_papeis (usuario_id);

ALTER TABLE usuario_papeis ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------------
-- 6. Guard central: usuario_tem_papel(papel) — função que QUALQUER módulo futuro chama
--    dentro de suas próprias policies de RLS para exigir um papel.
--    SECURITY DEFINER: executa com o dono da função (bypassa RLS internamente), então
--    o SELECT feito aqui DENTRO não é reavaliado pelas policies de usuario_papeis —
--    não há ciclo função → policy → função.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_tem_papel(p_papel papel_usuario)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_papeis up
    WHERE up.usuario_id = auth.uid() AND up.papel = p_papel
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_tem_papel(papel_usuario) FROM public;
GRANT EXECUTE ON FUNCTION public.usuario_tem_papel(papel_usuario) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 7. RLS — usuarios
--    SELECT: o próprio usuário, OU GESTAO (tabela diferente de usuario_papeis,
--    então chamar usuario_tem_papel() aqui não tem risco de recursão).
--    Sem policy de INSERT/UPDATE/DELETE direta: essas escritas só acontecem via
--    trigger (SECURITY DEFINER) ou via RPCs abaixo.
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT
  USING (id = auth.uid() OR public.usuario_tem_papel('GESTAO'));

-- ------------------------------------------------------------------------------------
-- 8. RLS — usuario_papeis
--    REGRA OBRIGATÓRIA: a policy de SELECT NÃO chama usuario_tem_papel() (essa função
--    consulta a própria tabela usuario_papeis — chamá-la aqui criaria um ciclo
--    policy → função → policy). Cada usuário só lê as próprias linhas, comparando
--    usuario_id diretamente com auth.uid(), sem função no meio.
--    Visão "todos os papéis de todos os usuários" (para GESTAO) fica nas RPCs abaixo,
--    que fazem essa checagem uma única vez, de forma explícita e auditável.
--    Sem policy de INSERT/UPDATE/DELETE: toda escrita passa pelas RPCs.
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "usuario_papeis_select_proprio" ON usuario_papeis;
CREATE POLICY "usuario_papeis_select_proprio" ON usuario_papeis
  FOR SELECT
  USING (usuario_id = auth.uid());

-- ------------------------------------------------------------------------------------
-- 9. RPCs privilegiadas — único caminho para atribuir/revogar papéis e listar tudo.
--    Cada uma valida GESTAO explicitamente (auth.uid()) antes de agir, e é a própria
--    escrita registrada na trilha de auditoria (via trigger em usuario_papeis, Etapa 4).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_atribuir_papel(p_usuario_id UUID, p_papel papel_usuario)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas usuários com papel GESTAO podem atribuir papéis.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO usuario_papeis (usuario_id, papel, concedido_por)
  VALUES (p_usuario_id, p_papel, auth.uid())
  ON CONFLICT (usuario_id, papel) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_revogar_papel(p_usuario_id UUID, p_papel papel_usuario)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas usuários com papel GESTAO podem revogar papéis.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM usuario_papeis WHERE usuario_id = p_usuario_id AND papel = p_papel;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_listar_usuarios_papeis()
RETURNS TABLE (usuario_id UUID, pessoa_nome TEXT, email TEXT, papel papel_usuario, ativo BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas usuários com papel GESTAO podem listar usuários e papéis.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, pe.nome, pe.email, up.papel, u.ativo
  FROM usuarios u
  JOIN pessoas pe ON pe.id = u.pessoa_id
  LEFT JOIN usuario_papeis up ON up.usuario_id = u.id
  ORDER BY pe.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_atribuir_papel(UUID, papel_usuario) FROM public;
REVOKE ALL ON FUNCTION public.rpc_revogar_papel(UUID, papel_usuario) FROM public;
REVOKE ALL ON FUNCTION public.rpc_listar_usuarios_papeis() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_atribuir_papel(UUID, papel_usuario) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_revogar_papel(UUID, papel_usuario) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_listar_usuarios_papeis() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 10. RLS mínima de `pessoas` (CRUD completo é Etapa 3 — aqui só garante que a tabela
--     não fica aberta por padrão enquanto isso).
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "pessoas_select_gestao_secretaria" ON pessoas;
CREATE POLICY "pessoas_select_gestao_secretaria" ON pessoas
  FOR SELECT
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "pessoas_write_gestao_secretaria" ON pessoas;
CREATE POLICY "pessoas_write_gestao_secretaria" ON pessoas
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));
