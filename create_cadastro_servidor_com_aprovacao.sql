-- ====================================================================================
-- CADASTRO DE SERVIDORES COM APROVAÇÃO (Secretaria / Gestão)
--
-- Antes: quem criava conta só precisava ter o e-mail em `professores` (checagem feita no
-- navegador) e a própria pessoa se vinculava à linha. Agora, e-mail NOVO cria um pedido
-- em `cadastros_servidores_pendentes` (dados completos) e não ganha acesso nenhum até a
-- Secretaria/Gestão aprovar. E-mail que já está em `professores` segue o fluxo antigo.
--
-- Mesmo molde do autocadastro do BiblioClube (create_biblioteca_cadastro_pendente.sql).
-- Alterações no banco: 1 tabela nova, 2 RPCs novas e 1 política trocada (item 4).
-- Reversão: rollback_cadastro_servidor_com_aprovacao.sql
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Fila de pedidos
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastros_servidores_pendentes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL CHECK (length(trim(nome)) >= 5),
  email               TEXT NOT NULL,
  cargo               TEXT NOT NULL,
  cpf                 TEXT NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  data_nascimento     DATE NOT NULL,
  telefone            TEXT NOT NULL,
  area_conhecimento   TEXT,
  status_servidor     TEXT NOT NULL DEFAULT 'Efetivo(a)',
  aceite_lgpd         BOOLEAN NOT NULL CHECK (aceite_lgpd),
  status              TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  papel_concedido     papel_usuario,
  analisado_por       UUID REFERENCES usuarios(id),
  analisado_em        TIMESTAMPTZ,
  observacoes_analise TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastros_servidores_status ON cadastros_servidores_pendentes (status);
-- Dois pedidos abertos com o mesmo CPF só atrapalham quem aprova.
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_servidores_cpf_pendente
  ON cadastros_servidores_pendentes (cpf) WHERE status = 'PENDENTE';

ALTER TABLE cadastros_servidores_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastros_servidores_pendentes FORCE ROW LEVEL SECURITY;

-- Cada um vê o próprio pedido; Secretaria/Gestão veem todos.
DROP POLICY IF EXISTS "cad_serv_select" ON cadastros_servidores_pendentes;
CREATE POLICY "cad_serv_select" ON cadastros_servidores_pendentes FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT public.usuario_tem_papel('SECRETARIA'))
    OR (SELECT public.usuario_tem_papel('GESTAO'))
  );

-- Só cria o próprio pedido, e sempre como PENDENTE (não dá para nascer "APROVADO").
DROP POLICY IF EXISTS "cad_serv_insert" ON cadastros_servidores_pendentes;
CREATE POLICY "cad_serv_insert" ON cadastros_servidores_pendentes FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND status = 'PENDENTE'
    AND papel_concedido IS NULL
    AND analisado_por IS NULL
    AND lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

-- Sem policy de UPDATE/DELETE: aprovar e rejeitar só pelas RPCs abaixo.

DROP TRIGGER IF EXISTS trg_auditoria_cadastros_servidores ON cadastros_servidores_pendentes;
CREATE TRIGGER trg_auditoria_cadastros_servidores
  AFTER INSERT OR UPDATE OR DELETE ON cadastros_servidores_pendentes
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. Aprovar: cria pessoa/professor/usuário/papel/consentimento de uma vez só
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadastro_servidor(p_cadastro_id UUID, p_papel papel_usuario)
RETURNS cadastros_servidores_pendentes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cad        cadastros_servidores_pendentes;
  v_pessoa_id  UUID;
  v_email_tem_prof BOOLEAN;
BEGIN
  IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cadastros de servidores.' USING ERRCODE = '42501';
  END IF;

  -- Papéis que dão poder sobre os outros ficam com a Gestão; aluno/responsável não são servidores.
  IF p_papel IN ('GESTAO', 'SECRETARIA') AND NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Somente a Gestão pode conceder o papel %.', p_papel USING ERRCODE = '42501';
  END IF;
  IF p_papel IN ('ALUNO', 'RESPONSAVEL') THEN
    RAISE EXCEPTION 'O papel % não se aplica a servidores.', p_papel;
  END IF;

  SELECT * INTO v_cad FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado.'; END IF;
  IF v_cad.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Este cadastro já foi analisado.'; END IF;

  SELECT EXISTS (SELECT 1 FROM professores WHERE lower(email) = lower(v_cad.email)) INTO v_email_tem_prof;
  IF v_email_tem_prof OR EXISTS (SELECT 1 FROM professores WHERE user_id = v_cad.auth_user_id) THEN
    RAISE EXCEPTION 'Já existe um servidor com este e-mail. Vincule a conta pelo painel de Servidores.';
  END IF;

  -- Reaproveita a pessoa quando o CPF já existe (ex.: já era responsável/aluno), desde
  -- que ela ainda não tenha login; senão o aprovador precisa resolver em Pessoas.
  SELECT id INTO v_pessoa_id FROM pessoas WHERE cpf = v_cad.cpf;
  IF v_pessoa_id IS NOT NULL AND EXISTS (SELECT 1 FROM usuarios WHERE pessoa_id = v_pessoa_id) THEN
    RAISE EXCEPTION 'O CPF informado já pertence a uma pessoa com login. Regularize em Pessoas antes de aprovar.';
  END IF;

  INSERT INTO professores (user_id, pessoa_id, nome, email, cargo, telefone, data_nascimento, area_conhecimento, status_servidor)
  VALUES (v_cad.auth_user_id, v_pessoa_id, trim(v_cad.nome), lower(trim(v_cad.email)), v_cad.cargo, v_cad.telefone,
          v_cad.data_nascimento, NULLIF(v_cad.area_conhecimento, ''), v_cad.status_servidor)
  RETURNING pessoa_id INTO v_pessoa_id;  -- gatilhos criam a pessoa (se nula) e a linha em `usuarios`

  UPDATE pessoas
     SET cpf = v_cad.cpf,
         telefone = coalesce(telefone, v_cad.telefone),
         data_nascimento = coalesce(data_nascimento, v_cad.data_nascimento),
         atualizado_em = now()
   WHERE id = v_pessoa_id;

  INSERT INTO usuario_papeis (usuario_id, papel, concedido_por)
  VALUES (v_cad.auth_user_id, p_papel, auth.uid())
  ON CONFLICT (usuario_id, papel) DO NOTHING;

  INSERT INTO consentimentos (pessoa_id, tipo, aceito, aceito_por_pessoa_id, versao_termo)
  VALUES (v_pessoa_id, 'CADASTRO', v_cad.aceite_lgpd, v_pessoa_id, 'servidor-v1');

  UPDATE cadastros_servidores_pendentes
     SET status = 'APROVADO', papel_concedido = p_papel, analisado_por = auth.uid(), analisado_em = now()
   WHERE id = p_cadastro_id
  RETURNING * INTO v_cad;

  RETURN v_cad;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 3. Rejeitar
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_rejeitar_cadastro_servidor(p_cadastro_id UUID, p_observacoes TEXT DEFAULT NULL)
RETURNS cadastros_servidores_pendentes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cad cadastros_servidores_pendentes;
BEGIN
  IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar cadastros de servidores.' USING ERRCODE = '42501';
  END IF;

  UPDATE cadastros_servidores_pendentes
     SET status = 'REJEITADO', analisado_por = auth.uid(), analisado_em = now(),
         observacoes_analise = NULLIF(trim(coalesce(p_observacoes, '')), '')
   WHERE id = p_cadastro_id AND status = 'PENDENTE'
  RETURNING * INTO v_cad;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado ou já analisado.'; END IF;
  RETURN v_cad;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aprovar_cadastro_servidor(UUID, papel_usuario) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_rejeitar_cadastro_servidor(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_aprovar_cadastro_servidor(UUID, papel_usuario) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rejeitar_cadastro_servidor(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Fecha a auto-inserção em `professores`
--
-- A política antiga deixava QUALQUER usuário logado inserir a própria linha (email = e-mail
-- do token). Como a linha em `professores` é o que libera o acesso, quem criasse a conta
-- direto pela API se aprovaria sozinho. Agora só Gestão/Secretaria inserem, mais a exceção
-- do administrador geral (App.tsx cria o perfil dele no primeiro login).
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "professores_insert_gestao" ON professores;
CREATE POLICY "professores_insert_gestao" ON professores FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.usuario_tem_papel('GESTAO'))
    OR (SELECT public.usuario_tem_papel('SECRETARIA'))
    OR (email = 'gestaoescolarjbr@gmail.com' AND email = ((SELECT auth.jwt()) ->> 'email'))
  );
