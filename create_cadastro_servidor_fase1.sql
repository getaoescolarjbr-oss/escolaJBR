-- ====================================================================================
-- CADASTRO DE SERVIDOR — FASE 1: dados completos + documentos + rascunho
--
-- O novo servidor passa a (1) informar os dados completos (inclui RG, título, endereço, formação),
-- (2) anexar os documentos exigidos (por câmera/escâner ou arquivo) e (3) só então enviar o
-- cadastro para análise. Antes de enviar, o cadastro fica como RASCUNHO e pode ser retomado.
-- Quais documentos são pedidos (e quais são obrigatórios) é configurado pela Secretária Geral
-- ou pela Gestão. Na aprovação, dados e arquivos vão para a ficha do servidor.
--
-- Aditivo e compatível com o front que está no ar (o INSERT direto como PENDENTE continua
-- aceito até o front novo entrar; depois um passo final fecha essa porta).
-- Reversão no fim do arquivo.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Documentos exigidos (configuração)
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_exigidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo        TEXT NOT NULL CHECK (length(trim(rotulo)) >= 2),
  instrucao     TEXT,
  tipo          TEXT NOT NULL DEFAULT 'DOCUMENTO_PESSOAL' CHECK (tipo IN ('DOCUMENTO_PESSOAL', 'CERTIFICADO', 'ATESTADO_MEDICO', 'OUTRO')),
  obrigatorio   BOOLEAN NOT NULL DEFAULT false,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documentos_exigidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_exigidos FORCE ROW LEVEL SECURITY;

-- A lista não é sensível: qualquer pessoa logada (inclusive quem está se cadastrando) lê.
DROP POLICY IF EXISTS "doc_exigidos_select" ON documentos_exigidos;
CREATE POLICY "doc_exigidos_select" ON documentos_exigidos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "doc_exigidos_escrita" ON documentos_exigidos;
CREATE POLICY "doc_exigidos_escrita" ON documentos_exigidos FOR ALL TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')));

DROP TRIGGER IF EXISTS trg_auditoria_documentos_exigidos ON documentos_exigidos;
CREATE TRIGGER trg_auditoria_documentos_exigidos AFTER INSERT OR UPDATE OR DELETE ON documentos_exigidos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- Padrão inicial (só se a tabela estiver vazia): a Secretária Geral ajusta depois.
INSERT INTO documentos_exigidos (rotulo, instrucao, tipo, obrigatorio, ordem)
SELECT * FROM (VALUES
  ('RG', 'Frente e verso do RG (ou CNH).', 'DOCUMENTO_PESSOAL', true, 10),
  ('CPF', 'Documento com o número do CPF.', 'DOCUMENTO_PESSOAL', true, 20),
  ('Comprovante de residência', 'Conta de água, luz ou telefone recente, em seu nome ou de familiar.', 'DOCUMENTO_PESSOAL', true, 30),
  ('Título de eleitor', 'Frente e verso, ou o e-Título.', 'DOCUMENTO_PESSOAL', false, 40),
  ('Diploma ou certificado de formação', 'Graduação e especializações.', 'CERTIFICADO', false, 50),
  ('Certificados de cursos', 'Cursos e capacitações. Pode enviar mais de um.', 'CERTIFICADO', false, 60)
) AS padrao(rotulo, instrucao, tipo, obrigatorio, ordem)
WHERE NOT EXISTS (SELECT 1 FROM documentos_exigidos);

-- ------------------------------------------------------------------------------------
-- 2. Pedido de cadastro: campos novos, rascunho e política de edição
-- ------------------------------------------------------------------------------------
ALTER TABLE cadastros_servidores_pendentes
  ADD COLUMN IF NOT EXISTS rg              TEXT,
  ADD COLUMN IF NOT EXISTS titulo_eleitor  TEXT,
  ADD COLUMN IF NOT EXISTS zona_eleitoral  TEXT,
  ADD COLUMN IF NOT EXISTS secao_eleitoral TEXT,
  ADD COLUMN IF NOT EXISTS endereco        TEXT,
  ADD COLUMN IF NOT EXISTS telefone_fixo   TEXT,
  ADD COLUMN IF NOT EXISTS formacao        TEXT,
  ADD COLUMN IF NOT EXISTS enviado_em      TIMESTAMPTZ;

ALTER TABLE cadastros_servidores_pendentes DROP CONSTRAINT IF EXISTS cadastros_servidores_pendentes_status_check;
ALTER TABLE cadastros_servidores_pendentes ADD CONSTRAINT cadastros_servidores_pendentes_status_check
  CHECK (status IN ('RASCUNHO', 'PENDENTE', 'APROVADO', 'REJEITADO'));

-- Novo pedido nasce como RASCUNHO (ou PENDENTE, enquanto o front antigo ainda estiver no ar).
DROP POLICY IF EXISTS "cad_serv_insert" ON cadastros_servidores_pendentes;
CREATE POLICY "cad_serv_insert" ON cadastros_servidores_pendentes FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND status IN ('RASCUNHO', 'PENDENTE')
    AND papel_concedido IS NULL
    AND analisado_por IS NULL
    AND lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

-- O dono edita o próprio pedido só enquanto é rascunho; passar para PENDENTE só pela função
-- rpc_enviar_cadastro_servidor (que confere os documentos obrigatórios).
DROP POLICY IF EXISTS "cad_serv_update_rascunho" ON cadastros_servidores_pendentes;
CREATE POLICY "cad_serv_update_rascunho" ON cadastros_servidores_pendentes FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) AND status = 'RASCUNHO')
  WITH CHECK (
    auth_user_id = (SELECT auth.uid()) AND status = 'RASCUNHO'
    AND papel_concedido IS NULL AND analisado_por IS NULL
    AND lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

-- ------------------------------------------------------------------------------------
-- 3. Documentos anexados ao pedido
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cadastro_servidor_documentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadastro_id  UUID NOT NULL REFERENCES cadastros_servidores_pendentes(id) ON DELETE CASCADE,
  exigido_id   UUID REFERENCES documentos_exigidos(id) ON DELETE SET NULL,
  rotulo       TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('DOCUMENTO_PESSOAL', 'CERTIFICADO', 'ATESTADO_MEDICO', 'OUTRO')),
  descricao    TEXT,
  nome_arquivo TEXT NOT NULL,
  arquivo_path TEXT NOT NULL UNIQUE,
  enviado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cad_serv_docs_cadastro ON cadastro_servidor_documentos (cadastro_id);

ALTER TABLE cadastro_servidor_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_servidor_documentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_serv_docs_select" ON cadastro_servidor_documentos;
CREATE POLICY "cad_serv_docs_select" ON cadastro_servidor_documentos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cadastros_servidores_pendentes c WHERE c.id = cadastro_id AND c.auth_user_id = (SELECT auth.uid()))
    OR (SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
  );

DROP POLICY IF EXISTS "cad_serv_docs_insert" ON cadastro_servidor_documentos;
CREATE POLICY "cad_serv_docs_insert" ON cadastro_servidor_documentos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM cadastros_servidores_pendentes c WHERE c.id = cadastro_id AND c.auth_user_id = (SELECT auth.uid()) AND c.status = 'RASCUNHO')
    AND arquivo_path LIKE 'pendentes/' || (SELECT auth.uid())::text || '/%'
  );

DROP POLICY IF EXISTS "cad_serv_docs_delete" ON cadastro_servidor_documentos;
CREATE POLICY "cad_serv_docs_delete" ON cadastro_servidor_documentos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM cadastros_servidores_pendentes c WHERE c.id = cadastro_id AND c.auth_user_id = (SELECT auth.uid()) AND c.status = 'RASCUNHO'));

DROP TRIGGER IF EXISTS trg_auditoria_cad_serv_docs ON cadastro_servidor_documentos;
CREATE TRIGGER trg_auditoria_cad_serv_docs AFTER INSERT OR UPDATE OR DELETE ON cadastro_servidor_documentos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. Armazenamento: pasta pendentes/<id do usuário>/ no bucket privado já existente
-- ------------------------------------------------------------------------------------
-- Quem está se cadastrando envia, vê e apaga só os próprios arquivos de rascunho.
DROP POLICY IF EXISTS "cad_serv_arq_insert" ON storage.objects;
CREATE POLICY "cad_serv_arq_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-pessoas' AND (storage.foldername(name))[1] = 'pendentes'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "cad_serv_arq_select" ON storage.objects;
CREATE POLICY "cad_serv_arq_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (storage.foldername(name))[1] = 'pendentes'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "cad_serv_arq_delete" ON storage.objects;
CREATE POLICY "cad_serv_arq_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (storage.foldername(name))[1] = 'pendentes'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

-- GESTAO e SECRETARIA já leem o bucket todo (políticas existentes). A Secretária Geral lê os
-- arquivos de cadastros em análise.
DROP POLICY IF EXISTS "cad_serv_arq_sg_select" ON storage.objects;
CREATE POLICY "cad_serv_arq_sg_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (storage.foldername(name))[1] = 'pendentes'
    AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')));

-- Só PDF e imagem, até 15 MB por arquivo.
UPDATE storage.buckets
   SET file_size_limit = 15728640,
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'documentos-pessoas';

-- ------------------------------------------------------------------------------------
-- 5. Enviar o cadastro para análise (confere os documentos obrigatórios)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_enviar_cadastro_servidor(p_cadastro_id UUID)
RETURNS cadastros_servidores_pendentes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cad   cadastros_servidores_pendentes;
  v_falta TEXT;
BEGIN
  SELECT * INTO v_cad FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id AND auth_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado.'; END IF;
  IF v_cad.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Este cadastro já foi enviado.'; END IF;

  SELECT string_agg(e.rotulo, ', ' ORDER BY e.ordem) INTO v_falta
    FROM documentos_exigidos e
   WHERE e.ativo AND e.obrigatorio
     AND NOT EXISTS (SELECT 1 FROM cadastro_servidor_documentos d WHERE d.cadastro_id = v_cad.id AND d.exigido_id = e.id);
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'Faltam documentos obrigatórios: %.', v_falta;
  END IF;

  IF EXISTS (SELECT 1 FROM cadastros_servidores_pendentes x WHERE x.cpf = v_cad.cpf AND x.status = 'PENDENTE' AND x.id <> v_cad.id) THEN
    RAISE EXCEPTION 'Já existe um cadastro em análise com este CPF. Procure a Secretaria.';
  END IF;

  UPDATE cadastros_servidores_pendentes SET status = 'PENDENTE', enviado_em = now() WHERE id = v_cad.id RETURNING * INTO v_cad;
  RETURN v_cad;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_enviar_cadastro_servidor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_enviar_cadastro_servidor(UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 6. Aprovação: além do que já fazia, leva os dados complementares e os documentos para a ficha
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadastro_servidor(p_cadastro_id UUID, p_papel papel_usuario)
RETURNS cadastros_servidores_pendentes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cad        cadastros_servidores_pendentes;
  v_pessoa_id  UUID;
  v_email_tem_prof BOOLEAN;
  v_doc        cadastro_servidor_documentos;
  v_novo       TEXT;
  v_n          INTEGER;
BEGIN
  IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cadastros de servidores.' USING ERRCODE = '42501';
  END IF;
  IF p_papel IN ('GESTAO', 'SECRETARIA') AND NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Somente a Gestão pode conceder o papel %.', p_papel USING ERRCODE = '42501';
  END IF;
  IF p_papel IN ('ALUNO', 'RESPONSAVEL') THEN
    RAISE EXCEPTION 'O papel % não se aplica a servidores.', p_papel;
  END IF;
  SELECT * INTO v_cad FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado.'; END IF;
  IF v_cad.status = 'RASCUNHO' THEN RAISE EXCEPTION 'O servidor ainda não enviou o cadastro (está em rascunho).'; END IF;
  IF v_cad.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Este cadastro já foi analisado.'; END IF;

  SELECT EXISTS (SELECT 1 FROM professores WHERE lower(email) = lower(v_cad.email)) INTO v_email_tem_prof;
  IF v_email_tem_prof OR EXISTS (SELECT 1 FROM professores WHERE user_id = v_cad.auth_user_id) THEN
    RAISE EXCEPTION 'Já existe um servidor com este e-mail. Vincule a conta pelo painel de Servidores.';
  END IF;

  SELECT id INTO v_pessoa_id FROM pessoas WHERE cpf = v_cad.cpf;
  IF v_pessoa_id IS NOT NULL AND EXISTS (SELECT 1 FROM usuarios WHERE pessoa_id = v_pessoa_id) THEN
    RAISE EXCEPTION 'O CPF informado já pertence a uma pessoa com login. Regularize em Pessoas antes de aprovar.';
  END IF;

  INSERT INTO professores (user_id, pessoa_id, nome, email, cargo, telefone, data_nascimento, area_conhecimento, status_servidor)
  VALUES (v_cad.auth_user_id, v_pessoa_id, trim(v_cad.nome), lower(trim(v_cad.email)), v_cad.cargo, v_cad.telefone,
          v_cad.data_nascimento, NULLIF(v_cad.area_conhecimento, ''), v_cad.status_servidor)
  RETURNING pessoa_id INTO v_pessoa_id;

  UPDATE pessoas SET cpf = v_cad.cpf, telefone = coalesce(telefone, v_cad.telefone),
         data_nascimento = coalesce(data_nascimento, v_cad.data_nascimento), atualizado_em = now()
   WHERE id = v_pessoa_id;

  -- Dados complementares informados no cadastro (RG, título, endereço...).
  INSERT INTO servidor_dados_complementares (pessoa_id, rg, titulo_eleitor, zona_eleitoral, secao_eleitoral, endereco, telefone_fixo, formacao)
  VALUES (v_pessoa_id, NULLIF(trim(v_cad.rg), ''), NULLIF(trim(v_cad.titulo_eleitor), ''), NULLIF(trim(v_cad.zona_eleitoral), ''),
          NULLIF(trim(v_cad.secao_eleitoral), ''), NULLIF(trim(v_cad.endereco), ''), NULLIF(trim(v_cad.telefone_fixo), ''), NULLIF(trim(v_cad.formacao), ''))
  ON CONFLICT (pessoa_id) DO UPDATE SET
    rg = coalesce(EXCLUDED.rg, servidor_dados_complementares.rg),
    titulo_eleitor = coalesce(EXCLUDED.titulo_eleitor, servidor_dados_complementares.titulo_eleitor),
    zona_eleitoral = coalesce(EXCLUDED.zona_eleitoral, servidor_dados_complementares.zona_eleitoral),
    secao_eleitoral = coalesce(EXCLUDED.secao_eleitoral, servidor_dados_complementares.secao_eleitoral),
    endereco = coalesce(EXCLUDED.endereco, servidor_dados_complementares.endereco),
    telefone_fixo = coalesce(EXCLUDED.telefone_fixo, servidor_dados_complementares.telefone_fixo),
    formacao = coalesce(EXCLUDED.formacao, servidor_dados_complementares.formacao),
    atualizado_em = now();

  INSERT INTO usuario_papeis (usuario_id, papel, concedido_por) VALUES (v_cad.auth_user_id, p_papel, auth.uid())
  ON CONFLICT (usuario_id, papel) DO NOTHING;

  INSERT INTO consentimentos (pessoa_id, tipo, aceito, aceito_por_pessoa_id, versao_termo)
  VALUES (v_pessoa_id, 'CADASTRO', v_cad.aceite_lgpd, v_pessoa_id, 'servidor-v1');

  -- Documentos: o arquivo sai de pendentes/<usuário>/ para pessoas/<pessoa>/ (onde a ficha lê)
  -- e vira um documento da ficha. Se algum arquivo não for achado, nada é aprovado.
  FOR v_doc IN SELECT * FROM cadastro_servidor_documentos WHERE cadastro_id = v_cad.id ORDER BY enviado_em LOOP
    v_novo := 'pessoas/' || v_pessoa_id::text || '/' || regexp_replace(v_doc.arquivo_path, '^pendentes/[^/]+/', '');
    UPDATE storage.objects SET name = v_novo WHERE bucket_id = 'documentos-pessoas' AND name = v_doc.arquivo_path;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      RAISE EXCEPTION 'Arquivo "%" não encontrado no armazenamento. Peça ao servidor para enviar de novo.', v_doc.nome_arquivo;
    END IF;
    INSERT INTO documentos_pessoa (pessoa_id, tipo, nome_arquivo, arquivo_path, enviado_por, observacoes)
    VALUES (v_pessoa_id, v_doc.tipo, v_doc.nome_arquivo, v_novo, v_cad.auth_user_id, concat_ws(' — ', v_doc.rotulo, NULLIF(v_doc.descricao, '')));
    UPDATE cadastro_servidor_documentos SET arquivo_path = v_novo WHERE id = v_doc.id;
  END LOOP;

  UPDATE cadastros_servidores_pendentes SET status = 'APROVADO', papel_concedido = p_papel, analisado_por = auth.uid(), analisado_em = now()
   WHERE id = p_cadastro_id RETURNING * INTO v_cad;
  RETURN v_cad;
END;
$$;

-- REVERSÃO (descarta rascunhos e documentos enviados):
--   DROP FUNCTION IF EXISTS public.rpc_enviar_cadastro_servidor(UUID);
--   DROP POLICY IF EXISTS "cad_serv_arq_insert" ON storage.objects;  (e cad_serv_arq_select / _delete / _sg_select)
--   DROP TABLE IF EXISTS cadastro_servidor_documentos;
--   DROP POLICY IF EXISTS "cad_serv_update_rascunho" ON cadastros_servidores_pendentes;
--   ALTER TABLE cadastros_servidores_pendentes DROP COLUMN rg, DROP COLUMN titulo_eleitor, DROP COLUMN zona_eleitoral,
--     DROP COLUMN secao_eleitoral, DROP COLUMN endereco, DROP COLUMN telefone_fixo, DROP COLUMN formacao, DROP COLUMN enviado_em;
--   (status_check e cad_serv_insert: voltar ao texto de create_cadastro_servidor_com_aprovacao.sql;
--    rpc_aprovar_cadastro_servidor: recriar a versão desse mesmo arquivo)
--   DROP TABLE IF EXISTS documentos_exigidos;
