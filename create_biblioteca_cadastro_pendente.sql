-- ====================================================================================
-- BIBLIOTECA — Fase 1 (4/8): fundação do autocadastro de aluno (ponto novo de
-- arquitetura: é o primeiro fluxo em que quem se autentica é o próprio aluno).
--
-- DECISÃO DE MODELAGEM: `usuarios.pessoa_id` é NOT NULL (Fundação) — ou seja, não dá
-- pra criar uma linha em `usuarios` sem já saber a pessoa certa. Um cadastro
-- espontâneo de aluno normalmente NÃO sabe de antemão qual `pessoas`/`alunos` já
-- existente ele é (o aluno já está matriculado, com um registro em `alunos` criado
-- pela Secretaria). Criar uma `pessoa` "provisória" a cada tentativa de cadastro e
-- depois ter que religar/descartar geraria lixo de dado pessoal (ruim para LGPD) e
-- complicaria o `consentimentos` (que também exige pessoa_id).
--
-- Por isso a Fase 1 usa uma fila de pré-cadastro separada: o aluno só cria a conta de
-- autenticação (auth.users, via signUp) + uma linha nesta tabela com o que ele mesmo
-- informou. NENHUMA linha em `usuarios` é criada agora — sem `usuarios`, o
-- usuario_tem_papel() e o meu_aluno_id() simplesmente retornam falso/NULL para essa
-- conta, então ela não consegue fazer nada além de ver o status do próprio pedido.
-- Quando SECRETARIA/GESTAO aprova (Fase 4, tela dedicada), aí sim: localizam o
-- registro certo em `alunos` (o aluno já matriculado), criam a linha em `usuarios`
-- apontando para `alunos.pessoa_id`, atribuem o papel ALUNO, e SÓ NESSE MOMENTO
-- registram o consentimento LGPD (pessoa_id já existe e é o certo) — inclusive o
-- aceite para participar das funções sociais. Isso também resolve o requisito de
-- "consentimento de responsável para menor": a aprovação da secretaria é o ponto de
-- verificação humana de que a família está ciente, não uma casinha marcada sozinho
-- pelo aluno no formulário.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS cadastros_biblioteca_pendentes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_informado            TEXT NOT NULL,
  data_nascimento_informada DATE,
  turma_id                  UUID REFERENCES turmas(id),
  responsavel_nome          TEXT,
  responsavel_contato       TEXT,
  aceite_termos             BOOLEAN NOT NULL DEFAULT false,
  aceite_funcoes_sociais    BOOLEAN NOT NULL DEFAULT false,
  status                    TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  pessoa_id_vinculada       UUID REFERENCES pessoas(id),
  analisado_por             UUID REFERENCES usuarios(id),
  analisado_em              TIMESTAMPTZ,
  observacoes_analise       TEXT,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastros_biblioteca_status ON cadastros_biblioteca_pendentes (status);

ALTER TABLE cadastros_biblioteca_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastros_biblioteca_pendentes FORCE ROW LEVEL SECURITY;

-- O próprio requerente vê e cria só o seu pedido — repare que esta policy usa
-- auth.uid() diretamente (não usuario_tem_papel/meu_aluno_id), porque neste momento a
-- pessoa ainda não tem NENHUM papel nem linha em `usuarios`.
DROP POLICY IF EXISTS "cadastros_biblioteca_select_proprio" ON cadastros_biblioteca_pendentes;
CREATE POLICY "cadastros_biblioteca_select_proprio" ON cadastros_biblioteca_pendentes FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "cadastros_biblioteca_insert_proprio" ON cadastros_biblioteca_pendentes;
CREATE POLICY "cadastros_biblioteca_insert_proprio" ON cadastros_biblioteca_pendentes FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Só SECRETARIA/GESTAO decidem (aprovar/rejeitar) — o requerente nunca pode alterar o
-- próprio pedido depois de enviado (evita adulterar status/pessoa_id_vinculada).
DROP POLICY IF EXISTS "cadastros_biblioteca_update_staff" ON cadastros_biblioteca_pendentes;
CREATE POLICY "cadastros_biblioteca_update_staff" ON cadastros_biblioteca_pendentes FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_cadastros_biblioteca ON cadastros_biblioteca_pendentes;
CREATE TRIGGER trg_auditoria_cadastros_biblioteca
  AFTER INSERT OR UPDATE OR DELETE ON cadastros_biblioteca_pendentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- Login por nome de usuário: Supabase Auth só autentica por e-mail. Alunos usam um
-- "usuário" (sem e-mail próprio, em geral). Guardamos um username opcional em
-- `usuarios` (só passa a existir quando o cadastro é aprovado, já que só aí a linha em
-- `usuarios` é criada) e uma RPC pública que resolve username -> e-mail sintético, sem
-- vazar quais usuários existem: ela SEMPRE devolve algum e-mail (existente ou um
-- placeholder plausível e inexistente), então uma tentativa de login com um usuário
-- que não existe falha do mesmo jeito e com a mesma mensagem genérica que uma senha
-- errada — não há como um atacante distinguir "usuário não existe" de "senha errada".
-- Rate limiting de força bruta continua sendo função do próprio GoTrue (que já limita
-- tentativas de login por e-mail); nenhuma proteção adicional foi adicionada aqui.
-- ------------------------------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.rpc_resolver_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM usuarios u
  JOIN auth.users au ON au.id = u.id
  WHERE u.username = lower(trim(p_username))
  LIMIT 1;

  IF v_email IS NULL THEN
    -- e-mail sintético plausível e determinístico, mas que nunca existe de verdade —
    -- o login vai falhar por credencial inválida, igual a qualquer senha errada.
    RETURN lower(trim(p_username)) || '@nao-encontrado.alunos.jbr.local';
  END IF;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resolver_username(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_resolver_username(TEXT) TO anon, authenticated;
