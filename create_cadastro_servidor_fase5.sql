-- Cadastro de servidor — Fase 5: acompanhamento, aviso à Secretaria, remoção de rascunhos
-- abandonados e CORREÇÃO da aprovação (Fase 1).
--
-- CORREÇÃO: rpc_aprovar_cadastro_servidor movia os documentos de pendentes/<uid>/ para
-- pessoas/<pessoa_id>/ com UPDATE direto em storage.objects. O Supabase avisa que mexer em
-- storage.objects por SQL não altera o arquivo no bucket (só o registro): o arquivo continuaria no
-- caminho antigo e o novo caminho apontaria para nada. Agora a aprovação NÃO renomeia: o documento
-- fica em pendentes/<uid>/ e documentos_pessoa guarda esse mesmo caminho. A Secretária Geral já lê
-- pendentes/; aqui ela também ganha alterar/excluir esses arquivos dos servidores.
--
--  * rpc_remover_rascunho_cadastro: Secretaria/Gestão apaga o pedido em rascunho (e os registros dos
--    documentos) e devolve os caminhos; o front apaga os arquivos pela API de Storage.
--  * rpc_destinatarios_novo_cadastro: quem acabou de enviar o cadastro descobre quem avisar (push).

-- ---------------------------------------------------------------------------
-- 1. Aprovação sem renomear arquivos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadastro_servidor(p_cadastro_id UUID, p_papel papel_usuario)
RETURNS cadastros_servidores_pendentes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_cad cadastros_servidores_pendentes; v_pessoa_id UUID; v_email_tem_prof BOOLEAN; v_doc cadastro_servidor_documentos;
BEGIN
  IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cadastros de servidores.' USING ERRCODE = '42501'; END IF;
  IF p_papel IN ('GESTAO', 'SECRETARIA') AND NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Somente a Gestão pode conceder o papel %.', p_papel USING ERRCODE = '42501'; END IF;
  IF p_papel IN ('ALUNO', 'RESPONSAVEL') THEN RAISE EXCEPTION 'O papel % não se aplica a servidores.', p_papel; END IF;
  SELECT * INTO v_cad FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado.'; END IF;
  IF v_cad.status = 'RASCUNHO' THEN RAISE EXCEPTION 'O servidor ainda não enviou o cadastro (está em rascunho).'; END IF;
  IF v_cad.status <> 'PENDENTE' THEN RAISE EXCEPTION 'Este cadastro já foi analisado.'; END IF;
  SELECT EXISTS (SELECT 1 FROM professores WHERE lower(email) = lower(v_cad.email)) INTO v_email_tem_prof;
  IF v_email_tem_prof OR EXISTS (SELECT 1 FROM professores WHERE user_id = v_cad.auth_user_id) THEN
    RAISE EXCEPTION 'Já existe um servidor com este e-mail. Vincule a conta pelo painel de Servidores.'; END IF;
  SELECT id INTO v_pessoa_id FROM pessoas WHERE cpf = v_cad.cpf;
  IF v_pessoa_id IS NOT NULL AND EXISTS (SELECT 1 FROM usuarios WHERE pessoa_id = v_pessoa_id) THEN
    RAISE EXCEPTION 'O CPF informado já pertence a uma pessoa com login. Regularize em Pessoas antes de aprovar.'; END IF;
  INSERT INTO professores (user_id, pessoa_id, nome, email, cargo, telefone, data_nascimento, area_conhecimento, status_servidor)
  VALUES (v_cad.auth_user_id, v_pessoa_id, trim(v_cad.nome), lower(trim(v_cad.email)), v_cad.cargo, v_cad.telefone, v_cad.data_nascimento, NULLIF(v_cad.area_conhecimento, ''), v_cad.status_servidor)
  RETURNING pessoa_id INTO v_pessoa_id;
  UPDATE pessoas SET cpf = v_cad.cpf, telefone = coalesce(telefone, v_cad.telefone), data_nascimento = coalesce(data_nascimento, v_cad.data_nascimento), atualizado_em = now() WHERE id = v_pessoa_id;
  INSERT INTO servidor_dados_complementares (pessoa_id, rg, titulo_eleitor, zona_eleitoral, secao_eleitoral, endereco, telefone_fixo, formacao)
  VALUES (v_pessoa_id, NULLIF(trim(v_cad.rg), ''), NULLIF(trim(v_cad.titulo_eleitor), ''), NULLIF(trim(v_cad.zona_eleitoral), ''), NULLIF(trim(v_cad.secao_eleitoral), ''), NULLIF(trim(v_cad.endereco), ''), NULLIF(trim(v_cad.telefone_fixo), ''), NULLIF(trim(v_cad.formacao), ''))
  ON CONFLICT (pessoa_id) DO UPDATE SET
    rg = coalesce(EXCLUDED.rg, servidor_dados_complementares.rg), titulo_eleitor = coalesce(EXCLUDED.titulo_eleitor, servidor_dados_complementares.titulo_eleitor),
    zona_eleitoral = coalesce(EXCLUDED.zona_eleitoral, servidor_dados_complementares.zona_eleitoral), secao_eleitoral = coalesce(EXCLUDED.secao_eleitoral, servidor_dados_complementares.secao_eleitoral),
    endereco = coalesce(EXCLUDED.endereco, servidor_dados_complementares.endereco), telefone_fixo = coalesce(EXCLUDED.telefone_fixo, servidor_dados_complementares.telefone_fixo),
    formacao = coalesce(EXCLUDED.formacao, servidor_dados_complementares.formacao), atualizado_em = now();
  INSERT INTO usuario_papeis (usuario_id, papel, concedido_por) VALUES (v_cad.auth_user_id, p_papel, auth.uid()) ON CONFLICT (usuario_id, papel) DO NOTHING;
  INSERT INTO consentimentos (pessoa_id, tipo, aceito, aceito_por_pessoa_id, versao_termo) VALUES (v_pessoa_id, 'CADASTRO', v_cad.aceite_lgpd, v_pessoa_id, 'servidor-v1');
  -- Os arquivos continuam onde o servidor os enviou (pendentes/<uid>/...): só ganham o registro na ficha.
  FOR v_doc IN SELECT * FROM cadastro_servidor_documentos WHERE cadastro_id = v_cad.id ORDER BY enviado_em LOOP
    INSERT INTO documentos_pessoa (pessoa_id, tipo, nome_arquivo, arquivo_path, enviado_por, observacoes)
    VALUES (v_pessoa_id, v_doc.tipo, v_doc.nome_arquivo, v_doc.arquivo_path, v_cad.auth_user_id, concat_ws(' — ', v_doc.rotulo, NULLIF(v_doc.descricao, '')));
  END LOOP;
  UPDATE cadastros_servidores_pendentes SET status = 'APROVADO', papel_concedido = p_papel, analisado_por = auth.uid(), analisado_em = now() WHERE id = p_cadastro_id RETURNING * INTO v_cad;
  RETURN v_cad;
END;
$f$;

-- ---------------------------------------------------------------------------
-- 2. Secretária Geral também altera/exclui os arquivos de pendentes/ dos servidores
-- ---------------------------------------------------------------------------
ALTER POLICY "documentos_pessoas_sg_update" ON storage.objects
  USING (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')) AND (
    EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2])
    OR ((storage.foldername(name))[1] = 'pendentes' AND EXISTS (SELECT 1 FROM public.professores p WHERE p.user_id::text = (storage.foldername(name))[2]))));
ALTER POLICY "documentos_pessoas_sg_delete" ON storage.objects
  USING (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')) AND (
    EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2])
    OR ((storage.foldername(name))[1] = 'pendentes' AND EXISTS (SELECT 1 FROM public.professores p WHERE p.user_id::text = (storage.foldername(name))[2]))));

-- ---------------------------------------------------------------------------
-- 3. Remover rascunho abandonado
-- ---------------------------------------------------------------------------
-- Só rascunho (nunca um cadastro enviado ou analisado). A conta de login do servidor NÃO é apagada
-- (outras tabelas a referenciam): ele pode refazer o cadastro ao entrar de novo.
-- Devolve os caminhos dos arquivos; o front os remove pela API de Storage.
CREATE OR REPLACE FUNCTION public.rpc_remover_rascunho_cadastro(p_cadastro_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_paths JSONB;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para remover cadastros.' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id AND status = 'RASCUNHO' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rascunho não encontrado (só cadastros ainda não enviados podem ser removidos).'; END IF;
  SELECT coalesce(jsonb_agg(arquivo_path), '[]'::jsonb) INTO v_paths FROM cadastro_servidor_documentos WHERE cadastro_id = p_cadastro_id;
  DELETE FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id;  -- os registros de documentos saem em cascata
  RETURN v_paths;
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_remover_rascunho_cadastro(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_remover_rascunho_cadastro(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Quem avisar quando um cadastro é enviado
-- ---------------------------------------------------------------------------
-- Só responde a quem tem um cadastro próprio em análise (evita listar a equipe para qualquer logado).
CREATE OR REPLACE FUNCTION public.rpc_destinatarios_novo_cadastro()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cadastros_servidores_pendentes WHERE auth_user_id = auth.uid() AND status = 'PENDENTE') THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  RETURN ARRAY(SELECT DISTINCT usuario_id FROM usuario_papeis WHERE papel IN ('SECRETARIA', 'GESTAO'));
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_destinatarios_novo_cadastro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_destinatarios_novo_cadastro() TO authenticated;
