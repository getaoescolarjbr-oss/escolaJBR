-- ====================================================================================
-- BIBLIOTECA — Fase 4: autocadastro do aluno + aprovação da Secretaria.
--
-- 1) `cadastros_biblioteca_pendentes` precisa guardar o USERNAME escolhido no
--    autocadastro (o e-mail sintético usado no supabase.auth.signUp já É
--    "<username>@alunos.jbr.local", mas persistir o username aqui deixa explícito o
--    que vai virar `usuarios.username` na aprovação, sem depender de parsing de
--    string do e-mail).
-- 2) `rpc_aprovar_cadastro_biblioteca`: a aprovação mexe em 4 tabelas de uma vez
--    (usuarios, usuario_papeis, consentimentos, alunos.perfil_publico) — nenhuma
--    delas tem policy de escrita direta para SECRETARIA hoje (usuario_papeis só
--    aceita escrita via RPC de GESTAO da Fundação; usuarios não tem INSERT direto
--    pra ninguém). Por isso é uma função SECURITY DEFINER só, atômica, que faz a
--    ligação usuarios.pessoa_id = alunos.pessoa_id (o aluno já matriculado, achado
--    pela Secretaria) e SÓ NESTE MOMENTO grava o consentimento LGPD — porque só agora
--    existe um pessoa_id de verdade pra vincular (ver o raciocínio completo no
--    cabeçalho de create_biblioteca_cadastro_pendente.sql).
-- ====================================================================================

ALTER TABLE cadastros_biblioteca_pendentes ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
ALTER TABLE cadastros_biblioteca_pendentes ALTER COLUMN username DROP DEFAULT;

-- ------------------------------------------------------------------------------------
-- Correção em fn_auditoria() (mesma função de sempre, todos os triggers já existentes
-- se beneficiam automaticamente): o autocadastro é a PRIMEIRA ação do sistema feita
-- por alguém que, por desenho, ainda não tem linha em `usuarios` (só ganha uma na
-- aprovação). A função sempre presumiu que auth.uid() já estava em `usuarios` — o
-- INSERT em `auditoria` (usuario_id REFERENCES usuarios(id)) violava a FK e derrubava
-- a própria ação que deveria ser auditada. Agora só grava usuario_id quando essa linha
-- realmente existe; senão grava NULL (a ação ainda fica no rastro de auditoria, só sem
-- o vínculo com um usuário que não existe).
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
  v_usuario_id  UUID;
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

  SELECT u.id INTO v_usuario_id FROM usuarios u WHERE u.id = auth.uid();

  INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (v_usuario_id, v_acao, TG_TABLE_NAME, v_registro_id, v_pessoa_id, COALESCE(v_campos, '{}'));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadastro_biblioteca(p_cadastro_id UUID, p_aluno_id UUID)
RETURNS cadastros_biblioteca_pendentes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadastro cadastros_biblioteca_pendentes;
  v_pessoa_id UUID;
BEGIN
  IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cadastros da Biblioteca.';
  END IF;

  SELECT * INTO v_cadastro FROM cadastros_biblioteca_pendentes WHERE id = p_cadastro_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro não encontrado.';
  END IF;
  IF v_cadastro.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Este cadastro já foi analisado.';
  END IF;

  SELECT pessoa_id INTO v_pessoa_id FROM alunos WHERE id = p_aluno_id;
  IF v_pessoa_id IS NULL THEN
    RAISE EXCEPTION 'O aluno selecionado não tem identidade vinculada (pessoa_id) — regularize o cadastro em Pessoas antes de aprovar.';
  END IF;
  IF EXISTS (SELECT 1 FROM usuarios WHERE pessoa_id = v_pessoa_id) THEN
    RAISE EXCEPTION 'Este aluno já possui um login vinculado.';
  END IF;

  INSERT INTO usuarios (id, pessoa_id, ativo, username)
  VALUES (v_cadastro.auth_user_id, v_pessoa_id, true, v_cadastro.username);

  INSERT INTO usuario_papeis (usuario_id, papel) VALUES (v_cadastro.auth_user_id, 'ALUNO');

  -- Consentimento LGPD: registrado agora (pessoa_id já é o definitivo), em nome do
  -- próprio aluno — a verificação de que a família está ciente é responsabilidade da
  -- Secretaria antes de aprovar (contato disponível em responsavel_nome/contato),
  -- não uma reafirmação automática do que o aluno marcou sozinho no formulário.
  INSERT INTO consentimentos (pessoa_id, tipo, aceito, aceito_por_pessoa_id, versao_termo)
  VALUES (v_pessoa_id, 'CADASTRO', v_cadastro.aceite_termos, v_pessoa_id, 'biblioteca-v1');

  UPDATE alunos SET perfil_publico = v_cadastro.aceite_funcoes_sociais WHERE id = p_aluno_id;

  UPDATE cadastros_biblioteca_pendentes
  SET status = 'APROVADO', pessoa_id_vinculada = v_pessoa_id, analisado_por = auth.uid(), analisado_em = now()
  WHERE id = p_cadastro_id
  RETURNING * INTO v_cadastro;

  RETURN v_cadastro;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aprovar_cadastro_biblioteca(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_aprovar_cadastro_biblioteca(UUID, UUID) TO authenticated;
