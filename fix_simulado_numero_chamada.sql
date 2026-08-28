-- ====================================================================================
-- Ajuste do link público de simulado: usar o número sequencial que já existe em
-- alunos.aluno_numero (número da chamada por turma, já usado em toda a ficha do aluno
-- — StudentManager, GradesPanel, InspetorDashboard etc.) em vez da coluna nova
-- numero_chamada (que fica sempre nula, pois não é alimentada em lugar nenhum).
-- Substitui rpc_simulado_publico_iniciar de create_simulados_publico.sql.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_simulado_publico_iniciar(p_token uuid, p_codigo_sgde text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_aluno RECORD;
  v_resposta_id uuid;
  v_nota numeric;
  v_questoes jsonb;
BEGIN
  SELECT * INTO v_prova FROM provas WHERE token_publico = p_token AND tipo = 'SIMULADO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado não encontrado.';
  END IF;
  IF v_prova.status NOT IN ('PUBLICADA', 'ENCERRADA') THEN
    RAISE EXCEPTION 'Este simulado não está disponível no momento.';
  END IF;

  SELECT al.id, al.nome, al.aluno_numero AS numero_chamada, t.nome AS turma_nome, sr.nome AS serie_nome
  INTO v_aluno
  FROM alunos al
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN series_referencia sr ON sr.id = t.serie_id
  WHERE al.codigo_sgde = p_codigo_sgde;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código SGDE não encontrado. Confira o número e tente novamente.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_turmas WHERE prova_id = v_prova.id)
    AND NOT EXISTS (
      SELECT 1 FROM prova_turmas pt JOIN alunos al ON al.turma_id = pt.turma_id
      WHERE pt.prova_id = v_prova.id AND al.id = v_aluno.id
    )
  THEN
    RAISE EXCEPTION 'Este simulado não está disponível para a sua turma.';
  END IF;

  SELECT id, nota INTO v_resposta_id, v_nota
  FROM prova_respostas WHERE prova_id = v_prova.id AND aluno_id = v_aluno.id AND finalizado_em IS NOT NULL;

  SELECT jsonb_agg(jsonb_build_object(
    'question_id', q.id,
    'ordem', pq.ordem,
    'valor', pq.valor,
    'statement', q.statement,
    'image_url', q.image_url,
    'alternatives', q.alternatives,
    'support_text_content', st.content,
    'support_text_image_url', st.image_url
  ) ORDER BY pq.ordem)
  INTO v_questoes
  FROM prova_questoes pq
  JOIN questions q ON q.id = pq.question_id
  LEFT JOIN support_texts st ON st.id = q.support_text_id
  WHERE pq.prova_id = v_prova.id;

  RETURN jsonb_build_object(
    'prova', jsonb_build_object(
      'id', v_prova.id, 'titulo', v_prova.titulo, 'disciplina', v_prova.disciplina,
      'instrucoes', v_prova.instrucoes, 'valor_total', v_prova.valor_total, 'status', v_prova.status
    ),
    'aluno', jsonb_build_object(
      'nome', v_aluno.nome, 'numero_chamada', v_aluno.numero_chamada,
      'turma', v_aluno.turma_nome, 'serie', v_aluno.serie_nome
    ),
    'ja_enviado', v_resposta_id IS NOT NULL,
    'nota', v_nota,
    'questoes', COALESCE(v_questoes, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simulado_publico_iniciar(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_simulado_publico_iniciar(uuid, text) TO anon, authenticated;

-- A coluna alunos.numero_chamada criada em create_simulados_publico.sql não é mais usada
-- (o RPC acima agora lê aluno_numero, que já é o sequencial da chamada). Pode remover:
ALTER TABLE public.alunos DROP COLUMN IF EXISTS numero_chamada;
