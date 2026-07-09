-- ====================================================================================
-- GOVERNANÇA COLEGIADA — Etapa 4 (final): comunicação institucional. Reaproveita a
-- ENTREGA já existente (pushService.sendPushToUsers → Edge Function
-- send-push-notification, já usada por Biblioteca/Agendamento/Ocorrências) — esta RPC
-- só resolve QUEM recebe, a partir de destino/destino_ref; o disparo em si acontece no
-- cliente, chamando a mesma função de sempre. Nenhum segundo pipeline de notificação.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_destinatarios_comunicado(p_destino TEXT, p_destino_ref TEXT)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  IF p_destino = 'TODOS' THEN
    RETURN QUERY SELECT u.id FROM usuarios u WHERE u.ativo = true;

  ELSIF p_destino = 'SEGMENTO' THEN
    RETURN QUERY
    SELECT up.usuario_id
    FROM usuario_papeis up
    WHERE up.papel = (CASE p_destino_ref
      WHEN 'DOCENTE'      THEN 'PROFESSOR'
      WHEN 'ESPECIALISTA' THEN 'COORDENACAO'
      WHEN 'PAIS'         THEN 'RESPONSAVEL'
      WHEN 'ALUNO'        THEN 'ALUNO'
      ELSE NULL
    END)::papel_usuario
    UNION
    SELECT up.usuario_id
    FROM usuario_papeis up
    WHERE p_destino_ref = 'FUNCIONARIO' AND up.papel IN ('SECRETARIA', 'NUTRICAO', 'BIBLIOTECA', 'INSPETOR');

  ELSIF p_destino = 'TURMA' THEN
    RETURN QUERY
    -- Alunos da turma (via pessoa_id) + seus responsáveis (via aluno_responsaveis).
    SELECT DISTINCT u.id
    FROM alunos a
    JOIN usuarios u ON u.pessoa_id = a.pessoa_id
    WHERE a.turma_id = p_destino_ref::uuid
    UNION
    SELECT DISTINCT u.id
    FROM alunos a
    JOIN aluno_responsaveis ar ON ar.aluno_id = a.id
    JOIN responsaveis r ON r.id = ar.responsavel_id
    JOIN usuarios u ON u.pessoa_id = r.pessoa_id
    WHERE a.turma_id = p_destino_ref::uuid;

  ELSIF p_destino = 'ORGAO' THEN
    RETURN QUERY
    SELECT DISTINCT u.id
    FROM membros_colegiado mc
    JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
    WHERE mc.orgao_id = p_destino_ref::uuid;

  ELSE
    RAISE EXCEPTION 'Destino inválido: %', p_destino;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_destinatarios_comunicado(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_destinatarios_comunicado(TEXT, TEXT) TO authenticated;
