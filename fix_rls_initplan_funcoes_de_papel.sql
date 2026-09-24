-- Envolve chamadas constantes de usuario_tem_papel()/auth.uid()/auth.jwt()/meu_*_id()/enxerga_escola_inteira()
-- em (SELECT ...) nas políticas RLS, para virarem InitPlan (uma avaliação por consulta, não por linha).
-- Gerado e VALIDADO por scratch/otimizar-rls-initplan.mjs: as contagens de linhas visíveis por perfil
-- (cada papel, anon e sem papel) em cada tabela ficaram idênticas antes e depois.
-- Reverter: use o rls-REVERTER-*.sql gerado pelo script (ou reaplique as definições originais).

BEGIN;
ALTER POLICY "aluno_conquistas_select" ON public."aluno_conquistas"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "aluno_responsaveis_rw_gestao_secretaria" ON public."aluno_responsaveis"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "alunos_delete_gestao" ON public."alunos"
  USING (((SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "alunos_insert_servidor" ON public."alunos"
  WITH CHECK ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))));
ALTER POLICY "alunos_update_servidor" ON public."alunos"
  USING ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))))
  WITH CHECK ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))));
ALTER POLICY "reincidencia_arquivados_delete" ON public."alunos_reincidencia_arquivados"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario))));
ALTER POLICY "reincidencia_arquivados_insert" ON public."alunos_reincidencia_arquivados"
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario))));
ALTER POLICY "reincidencia_arquivados_select" ON public."alunos_reincidencia_arquivados"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario))));
ALTER POLICY "anexos_protocolo_rw_gestao_secretaria" ON public."anexos_protocolo"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "atas_alunos_delete" ON public."atas_alunos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "atas_alunos_select" ON public."atas_alunos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "atas_alunos_update" ON public."atas_alunos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "atas_colegiado_delete_gestao" ON public."atas_colegiado"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "atas_colegiado_select_membro" ON public."atas_colegiado"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM (membros_colegiado mc
     JOIN usuarios u ON ((u.pessoa_id = mc.pessoa_id)))
  WHERE ((mc.orgao_id = atas_colegiado.orgao_id) AND (u.id = (SELECT auth.uid())))))));
ALTER POLICY "atas_colegiado_update_gestao" ON public."atas_colegiado"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "atas_templates_select" ON public."atas_templates"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "atas_templates_write" ON public."atas_templates"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "atestados_servidores_select" ON public."atestados_servidores"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM professores p
  WHERE ((p.id = atestados_servidores.professor_id) AND (p.user_id = (SELECT auth.uid())))))));
ALTER POLICY "atestados_servidores_write" ON public."atestados_servidores"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "auditoria_select_gestao" ON public."auditoria"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "avisos_delete_biblioteca" ON public."avisos"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "avisos_select" ON public."avisos"
  USING (((aluno_id IS NULL) OR (aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "avisos_update_proprio" ON public."avisos"
  USING ((aluno_id = (SELECT meu_aluno_id())))
  WITH CHECK ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "avisos_write_biblioteca" ON public."avisos"
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "bens_patrimoniais_select" ON public."bens_patrimoniais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "bens_patrimoniais_write" ON public."bens_patrimoniais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "bens_patrimoniais_historico_select" ON public."bens_patrimoniais_historico"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "bloqueios_recurso_rw_coordenacao_gestao_pcpi" ON public."bloqueios_recurso"
  USING (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "cadastros_biblioteca_insert_proprio" ON public."cadastros_biblioteca_pendentes"
  WITH CHECK ((auth_user_id = (SELECT auth.uid())));
ALTER POLICY "cadastros_biblioteca_select_proprio" ON public."cadastros_biblioteca_pendentes"
  USING (((auth_user_id = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "cadastros_biblioteca_update_staff" ON public."cadastros_biblioteca_pendentes"
  USING (((SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "campos_personalizados_select" ON public."campos_personalizados"
  USING (((ativo = true) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "campos_personalizados_write" ON public."campos_personalizados"
  USING (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "cardapio_itens_delete_gestao_nutricao" ON public."cardapio_itens"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapio_itens_select_gestao_nutricao" ON public."cardapio_itens"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapio_itens_update_gestao_nutricao" ON public."cardapio_itens"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapio_itens_write_gestao_nutricao" ON public."cardapio_itens"
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapios_delete_gestao_nutricao" ON public."cardapios"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapios_select_gestao_nutricao" ON public."cardapios"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapios_update_gestao_nutricao" ON public."cardapios"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cardapios_write_gestao_nutricao" ON public."cardapios"
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "chamados_manutencao_insert" ON public."chamados_manutencao"
  WITH CHECK (((aberto_por = (SELECT auth.uid())) AND ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario)))));
ALTER POLICY "chamados_manutencao_select" ON public."chamados_manutencao"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "chamados_manutencao_update" ON public."chamados_manutencao"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (responsavel_id = (SELECT auth.uid()))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (responsavel_id = (SELECT auth.uid()))));
ALTER POLICY "chamados_manutencao_historico_select" ON public."chamados_manutencao_historico"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "colecoes_write_biblioteca" ON public."colecoes"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "comunicados_select" ON public."comunicados"
  USING (((status = 'PUBLICADO'::text) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "comunicados_write" ON public."comunicados"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "configuracoes_avaliacoes_upsert_staff" ON public."configuracoes_avaliacoes"
  USING (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))));
ALTER POLICY "configuracoes_escola_write" ON public."configuracoes_escola"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "conquistas_write_biblioteca" ON public."conquistas"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "consentimentos_insert" ON public."consentimentos"
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "consentimentos_select" ON public."consentimentos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "controle_sanitario_rw_gestao_nutricao" ON public."controle_sanitario"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "cupons_write_biblioteca" ON public."cupons"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "curtidas_delete" ON public."curtidas"
  USING ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "curtidas_insert" ON public."curtidas"
  WITH CHECK ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "deliberacoes_select_membro" ON public."deliberacoes"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM ((reunioes_colegiado r
     JOIN membros_colegiado mc ON ((mc.orgao_id = r.orgao_id)))
     JOIN usuarios u ON ((u.pessoa_id = mc.pessoa_id)))
  WHERE ((r.id = deliberacoes.reuniao_id) AND (u.id = (SELECT auth.uid())))))));
ALTER POLICY "deliberacoes_write_gestao" ON public."deliberacoes"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "denuncias_insert" ON public."denuncias"
  WITH CHECK ((denunciado_por = (SELECT meu_aluno_id())));
ALTER POLICY "denuncias_select" ON public."denuncias"
  USING (((denunciado_por = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "denuncias_update_staff" ON public."denuncias"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "disciplinas_escrita_servidor" ON public."disciplinas"
  USING ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))))
  WITH CHECK ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))));
ALTER POLICY "documentos_emitidos_rw_gestao_secretaria" ON public."documentos_emitidos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "documentos_institucionais_select" ON public."documentos_institucionais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (visibilidade = 'COMUNIDADE'::text)));
ALTER POLICY "documentos_institucionais_write" ON public."documentos_institucionais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR ((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) AND (tipo = ANY (ARRAY['PPP'::text, 'REGIMENTO'::text, 'PLANO_GESTAO'::text])))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR ((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) AND (tipo = ANY (ARRAY['PPP'::text, 'REGIMENTO'::text, 'PLANO_GESTAO'::text])))));
ALTER POLICY "documentos_pessoa_rw_gestao_secretaria" ON public."documentos_pessoa"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "duplas_insert" ON public."duplas"
  WITH CHECK (((solicitado_por = (SELECT meu_aluno_id())) AND (((SELECT meu_aluno_id()) = aluno_a) OR ((SELECT meu_aluno_id()) = aluno_b))));
ALTER POLICY "duplas_select" ON public."duplas"
  USING (((aluno_a = (SELECT meu_aluno_id())) OR (aluno_b = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "duplas_update" ON public."duplas"
  USING (((aluno_a = (SELECT meu_aluno_id())) OR (aluno_b = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((aluno_a = (SELECT meu_aluno_id())) OR (aluno_b = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "emprestimos_select" ON public."emprestimos"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (professor_id = (SELECT meu_professor_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario))));
ALTER POLICY "emprestimos_write_biblioteca" ON public."emprestimos"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "estoque_itens_rw_gestao_nutricao" ON public."estoque_itens"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "estoque_lotes_rw_gestao_nutricao" ON public."estoque_lotes"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "estoque_mov_select_gestao_nutricao" ON public."estoque_movimentacoes"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "exemplares_write_biblioteca" ON public."exemplares"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "favoritos_dono" ON public."favoritos"
  USING ((aluno_id = (SELECT meu_aluno_id())))
  WITH CHECK ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "favoritos_select_staff" ON public."favoritos"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "ficha_ingredientes_rw_gestao_nutricao" ON public."ficha_ingredientes"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "fichas_tecnicas_rw_gestao_nutricao" ON public."fichas_tecnicas"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "fornecedores_rw_gestao_nutricao" ON public."fornecedores"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "frases_select_autenticado" ON public."frases"
  USING (((ativo = true) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "frases_write_biblioteca" ON public."frases"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "frequencia_servidor_select" ON public."frequencia_servidor"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM professores p
  WHERE ((p.id = frequencia_servidor.servidor_id) AND (p.user_id = (SELECT auth.uid())))))));
ALTER POLICY "frequencia_servidor_write" ON public."frequencia_servidor"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "generos_write_biblioteca" ON public."generos"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "Permitir delete para gestores" ON public."horarios"
  USING ((EXISTS ( SELECT 1
   FROM professores
  WHERE ((professores.user_id = (SELECT auth.uid())) AND ((professores.cargo = 'Diretor'::text) OR (professores.cargo = 'Coordenador'::text))))));
ALTER POLICY "Permitir insert para gestores" ON public."horarios"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM professores
  WHERE ((professores.user_id = (SELECT auth.uid())) AND ((professores.cargo = 'Diretor'::text) OR (professores.cargo = 'Coordenador'::text))))));
ALTER POLICY "Permitir update para gestores" ON public."horarios"
  USING ((EXISTS ( SELECT 1
   FROM professores
  WHERE ((professores.user_id = (SELECT auth.uid())) AND ((professores.cargo = 'Diretor'::text) OR (professores.cargo = 'Coordenador'::text))))));
ALTER POLICY "indicacoes_compra_insert" ON public."indicacoes_compra"
  WITH CHECK (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "indicacoes_compra_select" ON public."indicacoes_compra"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "indicacoes_compra_update_staff" ON public."indicacoes_compra"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "indicacoes_dupla_insert" ON public."indicacoes_dupla"
  WITH CHECK ((de_aluno = (SELECT meu_aluno_id())));
ALTER POLICY "indicacoes_dupla_select" ON public."indicacoes_dupla"
  USING (((de_aluno = (SELECT meu_aluno_id())) OR (para_aluno = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "indicacoes_dupla_update" ON public."indicacoes_dupla"
  USING ((para_aluno = (SELECT meu_aluno_id())))
  WITH CHECK ((para_aluno = (SELECT meu_aluno_id())));
ALTER POLICY "inspecoes_sanitarias_rw_gestao_nutricao" ON public."inspecoes_sanitarias"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "jornada_servidor_rw_gestao_secretaria" ON public."jornada_servidor"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "livros_write_biblioteca" ON public."livros"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "materiais_select_servidor" ON public."materiais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "materiais_write_gestao" ON public."materiais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "matriculas_rw_gestao_secretaria" ON public."matriculas"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "membros_colegiado_select_proprio" ON public."membros_colegiado"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((u.id = (SELECT auth.uid())) AND (u.pessoa_id = membros_colegiado.pessoa_id))))));
ALTER POLICY "membros_colegiado_write_gestao" ON public."membros_colegiado"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "metas_insert" ON public."metas"
  WITH CHECK ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "metas_select" ON public."metas"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "metas_update" ON public."metas"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "movimentacao_material_select_servidor" ON public."movimentacao_material"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "necessidades_especiais_rw_gestao_nutricao" ON public."necessidades_especiais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "notas_fiscais_rw_gestao_nutricao" ON public."notas_fiscais"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "noticias_select_autenticado" ON public."noticias"
  USING (((ativo = true) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "noticias_write_biblioteca" ON public."noticias"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "ordens_servico_select" ON public."ordens_servico"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('INSPETOR'::papel_usuario))));
ALTER POLICY "ordens_servico_write" ON public."ordens_servico"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "orgaos_colegiados_select_membro" ON public."orgaos_colegiados"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM (membros_colegiado mc
     JOIN usuarios u ON ((u.pessoa_id = mc.pessoa_id)))
  WHERE ((mc.orgao_id = orgaos_colegiados.id) AND (u.id = (SELECT auth.uid())))))));
ALTER POLICY "orgaos_colegiados_write_gestao" ON public."orgaos_colegiados"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "palavras_proibidas_select_staff" ON public."palavras_proibidas"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "palavras_proibidas_write_staff" ON public."palavras_proibidas"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "pessoas_select_gestao_secretaria" ON public."pessoas"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "pessoas_select_propria" ON public."pessoas"
  USING ((id IN ( SELECT usuarios.pessoa_id
   FROM usuarios
  WHERE (usuarios.id = (SELECT auth.uid())))));
ALTER POLICY "pessoas_write_gestao_secretaria" ON public."pessoas"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "pontos_ledger_select" ON public."pontos_ledger"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "pontos_regras_write_gestao" ON public."pontos_regras"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario))));
ALTER POLICY "Permitir auto-vinculacao no primeiro acesso" ON public."professores"
  USING (((email = ((SELECT auth.jwt()) ->> 'email'::text)) AND (user_id IS NULL)))
  WITH CHECK ((email = ((SELECT auth.jwt()) ->> 'email'::text)));
ALTER POLICY "Permitir select por email durante login" ON public."professores"
  USING (((email = ((SELECT auth.jwt()) ->> 'email'::text)) OR (user_id = (SELECT auth.uid()))));
ALTER POLICY "professores_delete_gestao" ON public."professores"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "professores_insert_gestao" ON public."professores"
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (email = ((SELECT auth.jwt()) ->> 'email'::text))));
ALTER POLICY "professores_update_proprio_ou_gestao" ON public."professores"
  USING (((user_id = (SELECT auth.uid())) OR (email = ((SELECT auth.jwt()) ->> 'email'::text)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((user_id = (SELECT auth.uid())) OR (email = ((SELECT auth.jwt()) ->> 'email'::text)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "protocolos_rw_gestao_secretaria" ON public."protocolos"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "prova_alocacoes_all_dono_ou_staff" ON public."prova_alocacoes"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_alocacoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_alocacoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "prova_area_cotas_all_dono_ou_staff" ON public."prova_area_cotas"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_area_cotas.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR eh_coordenacao_geral() OR ((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) AND (NOT pca_fora_da_area(p.id))))))));
ALTER POLICY "prova_area_cotas_select" ON public."prova_area_cotas"
  USING (((professor_id IN ( SELECT professores.id
   FROM professores
  WHERE (professores.user_id = (SELECT auth.uid())))) OR (SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "prova_avaliacao_notas_all_dono_ou_staff" ON public."prova_avaliacao_notas"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_avaliacao_notas.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_avaliacao_notas.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "prova_geral_areas_select" ON public."prova_geral_areas"
  USING (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR professor_tem_cota_area(prova_id)));
ALTER POLICY "prova_leituras_all_dono_ou_staff" ON public."prova_leituras"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_leituras.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_leituras.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "prova_notas_professores_select" ON public."prova_notas_professores"
  USING (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (professor_id IN ( SELECT professores.id
   FROM professores
  WHERE (professores.user_id = (SELECT auth.uid()))))));
ALTER POLICY "prova_questoes_all_dono_ou_staff" ON public."prova_questoes"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_questoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR professor_tem_cota_area(p.id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_questoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "prova_respostas_select_dono_staff_ou_proprio_aluno" ON public."prova_respostas"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_respostas.prova_id) AND (p.criado_por = (SELECT auth.uid()))))) OR professor_tem_cota_area(prova_id)));
ALTER POLICY "prova_respostas_itens_select_dono_staff_ou_proprio_aluno" ON public."prova_respostas_itens"
  USING ((EXISTS ( SELECT 1
   FROM prova_respostas r
  WHERE ((r.id = prova_respostas_itens.resposta_id) AND ((r.aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
           FROM provas p
          WHERE ((p.id = r.prova_id) AND (p.criado_por = (SELECT auth.uid()))))) OR professor_tem_cota_area(r.prova_id))))));
ALTER POLICY "prova_turmas_all_dono_ou_staff" ON public."prova_turmas"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_turmas.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR professor_tem_cota_area(p.id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_turmas.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "prova_versoes_all_dono_ou_staff" ON public."prova_versoes"
  USING ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_versoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM provas p
  WHERE ((p.id = prova_versoes.prova_id) AND ((p.criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))))));
ALTER POLICY "provas_delete_dono_ou_gestao" ON public."provas"
  USING (((criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "provas_insert_professor_coordenacao_gestao" ON public."provas"
  WITH CHECK (((criado_por = (SELECT auth.uid())) AND ((SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)))));
ALTER POLICY "provas_select_dono_ou_staff" ON public."provas"
  USING (((criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR professor_tem_cota_area(id)));
ALTER POLICY "provas_update_dono_ou_gestao" ON public."provas"
  USING (((criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((criado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "Users can manage own subscriptions" ON public."push_subscriptions"
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "Coordenação de área pode gerenciar assunto e tópico" ON public."question_taxonomy_terms"
  USING (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) AND (field = ANY (ARRAY['assunto'::text, 'topico'::text]))))
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)) AND (field = ANY (ARRAY['assunto'::text, 'topico'::text]))));
ALTER POLICY "Gestão pode gerenciar question_taxonomy_terms" ON public."question_taxonomy_terms"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "Coordenação de área pode editar questões" ON public."questions"
  USING ((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)));
ALTER POLICY "Coordenação de área pode excluir questões" ON public."questions"
  USING ((SELECT usuario_tem_papel('COORDENACAO_AREA'::papel_usuario)));
ALTER POLICY "Gestão e professores podem gerenciar questões" ON public."questions"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))));
ALTER POLICY "Professores e coordenação podem ler questões" ON public."questions"
  USING (((SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "recompensas_write_biblioteca" ON public."recompensas"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "recursos_delete_coordenacao_gestao_pcpi" ON public."recursos"
  USING (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "recursos_update_coordenacao_gestao_pcpi" ON public."recursos"
  USING (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "recursos_write_coordenacao_gestao_pcpi" ON public."recursos"
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "refeicoes_servidas_rw_gestao_nutricao" ON public."refeicoes_servidas"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "registros_portaria_insert" ON public."registros_portaria"
  WITH CHECK (((criado_por = (SELECT auth.uid())) AND ((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)))));
ALTER POLICY "registros_portaria_select" ON public."registros_portaria"
  USING (((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "requisicao_itens_select" ON public."requisicao_itens"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM requisicoes r
  WHERE ((r.id = requisicao_itens.requisicao_id) AND (r.solicitante_id = (SELECT auth.uid())))))));
ALTER POLICY "requisicoes_select" ON public."requisicoes"
  USING (((solicitante_id = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "resenhas_insert" ON public."resenhas"
  WITH CHECK ((aluno_id = (SELECT meu_aluno_id())));
ALTER POLICY "resenhas_select" ON public."resenhas"
  USING (((status = 'VISIVEL'::text) OR (aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "resenhas_update" ON public."resenhas"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reserva_compartilhamentos_delete" ON public."reserva_compartilhamentos"
  USING (((compartilhado_por = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reserva_compartilhamentos_insert" ON public."reserva_compartilhamentos"
  WITH CHECK (((compartilhado_por = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (reservas r
     JOIN professores p ON ((p.id = r.professor_id)))
  WHERE ((r.id = reserva_compartilhamentos.reserva_id) AND ((p.user_id = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))))));
ALTER POLICY "reserva_compartilhamentos_select" ON public."reserva_compartilhamentos"
  USING (((compartilhado_por = (SELECT auth.uid())) OR (compartilhado_com_usuario_id = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reserva_valores_personalizados_rw" ON public."reserva_valores_personalizados"
  USING (((EXISTS ( SELECT 1
   FROM (reservas r
     JOIN professores p ON ((p.id = r.professor_id)))
  WHERE ((r.id = reserva_valores_personalizados.reserva_id) AND (p.user_id = (SELECT auth.uid()))))) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (reservas r
     JOIN professores p ON ((p.id = r.professor_id)))
  WHERE ((r.id = reserva_valores_personalizados.reserva_id) AND (p.user_id = (SELECT auth.uid()))))) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reservas_insert_papeis_permitidos" ON public."reservas"
  WITH CHECK (((SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario)) OR ((SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) AND (professor_id IN ( SELECT professores.id
   FROM professores
  WHERE (professores.user_id = (SELECT auth.uid())))))));
ALTER POLICY "reservas_select_papeis_permitidos" ON public."reservas"
  USING (((SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "reservas_update_dono_ou_staff" ON public."reservas"
  USING (((professor_id IN ( SELECT professores.id
   FROM professores
  WHERE (professores.user_id = (SELECT auth.uid())))) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))))
  WITH CHECK (((status = 'CANCELADA'::text) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PCPI'::papel_usuario))));
ALTER POLICY "reservas_livro_insert" ON public."reservas_livro"
  WITH CHECK (((aluno_id = (SELECT meu_aluno_id())) OR (professor_id = (SELECT meu_professor_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reservas_livro_select" ON public."reservas_livro"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (professor_id = (SELECT meu_professor_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reservas_livro_update" ON public."reservas_livro"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (professor_id = (SELECT meu_professor_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((aluno_id = (SELECT meu_aluno_id())) OR (professor_id = (SELECT meu_professor_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "reservas_serie_select" ON public."reservas_serie"
  USING (((professor_id IN ( SELECT professores.id
   FROM professores
  WHERE (professores.user_id = (SELECT auth.uid())))) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "resgates_select" ON public."resgates"
  USING (((aluno_id = (SELECT meu_aluno_id())) OR (SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "resgates_update_staff" ON public."resgates"
  USING (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('BIBLIOTECA'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "responsaveis_rw_gestao_secretaria" ON public."responsaveis"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "reuniao_presenca_select_membro" ON public."reuniao_presenca"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM ((reunioes_colegiado r
     JOIN membros_colegiado mc ON ((mc.orgao_id = r.orgao_id)))
     JOIN usuarios u ON ((u.pessoa_id = mc.pessoa_id)))
  WHERE ((r.id = reuniao_presenca.reuniao_id) AND (u.id = (SELECT auth.uid())))))));
ALTER POLICY "reuniao_presenca_write_gestao" ON public."reuniao_presenca"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "reunioes_colegiado_select_membro" ON public."reunioes_colegiado"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (EXISTS ( SELECT 1
   FROM (membros_colegiado mc
     JOIN usuarios u ON ((u.pessoa_id = mc.pessoa_id)))
  WHERE ((mc.orgao_id = reunioes_colegiado.orgao_id) AND (u.id = (SELECT auth.uid())))))));
ALTER POLICY "reunioes_colegiado_write_gestao" ON public."reunioes_colegiado"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "series_referencia_select_autenticado" ON public."series_referencia"
  USING (((SELECT auth.role()) = 'authenticated'::text));
ALTER POLICY "series_referencia_write_gestao" ON public."series_referencia"
  USING ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)))
  WITH CHECK ((SELECT usuario_tem_papel('GESTAO'::papel_usuario)));
ALTER POLICY "solicitacoes_lgpd_rw_gestao_secretaria" ON public."solicitacoes_lgpd"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "substituicoes_rw_gestao_secretaria" ON public."substituicoes"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "Gestão e professores podem gerenciar textos de apoio" ON public."support_texts"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('PROFESSOR'::papel_usuario))));
ALTER POLICY "Professores e coordenação podem ler textos de apoio" ON public."support_texts"
  USING (((SELECT usuario_tem_papel('PROFESSOR'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "terceirizados_rw_gestao_secretaria" ON public."terceirizados"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "testes_aceitabilidade_rw_gestao_nutricao" ON public."testes_aceitabilidade"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('NUTRICAO'::papel_usuario))));
ALTER POLICY "turmas_escrita_servidor" ON public."turmas"
  USING ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))))
  WITH CHECK ((NOT (SELECT usuario_tem_papel('ALUNO'::papel_usuario))));
ALTER POLICY "usuario_papeis_select_proprio" ON public."usuario_papeis"
  USING ((usuario_id = (SELECT auth.uid())));
ALTER POLICY "usuarios_select" ON public."usuarios"
  USING (((id = (SELECT auth.uid())) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario))));
ALTER POLICY "versoes_documento_select" ON public."versoes_documento"
  USING (((SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('COORDENACAO'::papel_usuario)) OR ((status = 'VIGENTE'::text) AND (EXISTS ( SELECT 1
   FROM documentos_institucionais di
  WHERE ((di.id = versoes_documento.documento_id) AND (di.visibilidade = 'COMUNIDADE'::text)))))));
ALTER POLICY "visitantes_insert" ON public."visitantes"
  WITH CHECK (((registrado_por = (SELECT auth.uid())) AND ((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario)))));
ALTER POLICY "visitantes_select" ON public."visitantes"
  USING (((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
ALTER POLICY "visitantes_update" ON public."visitantes"
  USING (((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))))
  WITH CHECK (((SELECT usuario_tem_papel('INSPETOR'::papel_usuario)) OR (SELECT usuario_tem_papel('GESTAO'::papel_usuario)) OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))));
COMMIT;
