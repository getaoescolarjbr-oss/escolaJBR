-- ====================================================================================
-- SECRETÁRIA GERAL — acesso à ficha do servidor (documentos)
--
-- O papel SECRETARIA_GERAL só enxerga o módulo Servidores, e o botão "Ficha do servidor"
-- (certificados, documentos pessoais, atestados médicos, termos assinados) depende de
-- documentos_pessoa e do bucket privado `documentos-pessoas`, hoje só GESTAO/SECRETARIA.
--
-- Acesso mínimo necessário, somente a documentos de SERVIDORES:
--   - documentos_pessoa: só linhas cuja pessoa é um servidor (existe em `professores`) e só
--     dos tipos da ficha (CERTIFICADO, DOCUMENTO_PESSOAL, ATESTADO_MEDICO,
--     TERMO_CONVOCACAO_ASSINADO, OUTRO). Documentos de alunos/responsáveis ficam de fora.
--   - Storage: só arquivos cuja pasta pessoas/<pessoa_id>/ é de um servidor.
-- Aditivo: políticas novas ao lado das existentes (GESTAO/SECRETARIA não mudam).
-- Reversão no fim do arquivo.
-- ====================================================================================

DROP POLICY IF EXISTS "documentos_pessoa_servidores_sec_geral" ON documentos_pessoa;
CREATE POLICY "documentos_pessoa_servidores_sec_geral" ON documentos_pessoa FOR ALL TO authenticated
  USING (
    (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND tipo IN ('CERTIFICADO', 'DOCUMENTO_PESSOAL', 'ATESTADO_MEDICO', 'TERMO_CONVOCACAO_ASSINADO', 'OUTRO')
    AND pessoa_id IN (SELECT p.pessoa_id FROM professores p WHERE p.pessoa_id IS NOT NULL)
  )
  WITH CHECK (
    (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND tipo IN ('CERTIFICADO', 'DOCUMENTO_PESSOAL', 'ATESTADO_MEDICO', 'TERMO_CONVOCACAO_ASSINADO', 'OUTRO')
    AND pessoa_id IN (SELECT p.pessoa_id FROM professores p WHERE p.pessoa_id IS NOT NULL)
  );

-- Storage: pasta pessoas/<pessoa_id>/arquivo — (storage.foldername(name))[2] é o <pessoa_id>.
DROP POLICY IF EXISTS "documentos_pessoas_sg_select" ON storage.objects;
CREATE POLICY "documentos_pessoas_sg_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2]));

DROP POLICY IF EXISTS "documentos_pessoas_sg_insert" ON storage.objects;
CREATE POLICY "documentos_pessoas_sg_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2]));

DROP POLICY IF EXISTS "documentos_pessoas_sg_update" ON storage.objects;
CREATE POLICY "documentos_pessoas_sg_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2]))
  WITH CHECK (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2]));

DROP POLICY IF EXISTS "documentos_pessoas_sg_delete" ON storage.objects;
CREATE POLICY "documentos_pessoas_sg_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-pessoas' AND (SELECT public.usuario_tem_papel('SECRETARIA_GERAL'))
    AND EXISTS (SELECT 1 FROM public.professores p WHERE p.pessoa_id::text = (storage.foldername(name))[2]));

-- REVERSÃO:
--   DROP POLICY IF EXISTS "documentos_pessoa_servidores_sec_geral" ON documentos_pessoa;
--   DROP POLICY IF EXISTS "documentos_pessoas_sg_select" ON storage.objects;
--   DROP POLICY IF EXISTS "documentos_pessoas_sg_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "documentos_pessoas_sg_update" ON storage.objects;
--   DROP POLICY IF EXISTS "documentos_pessoas_sg_delete" ON storage.objects;
