-- Preview da avaliação com a visão do aluno, para o professor conferir antes de
-- os alunos responderem.
--
-- Por que uma RPC nova em vez de reaproveitar rpc_questoes_avaliacao_aluno: aquela
-- começa com meu_aluno_id() e levanta 'Só alunos podem acessar avaliações.', então
-- um professor nunca conseguiria chamá-la. Afrouxar aquela função seria pior — ela
-- é a que garante que o aluno só enxergue avaliação da própria turma.
--
-- Esta devolve EXATAMENTE as mesmas colunas, e continua sem correct_letter: o
-- objetivo é o professor ver o que o aluno vê. O gabarito segue saindo só de
-- rpc_submeter_resposta_avaliacao, depois de responder.

CREATE OR REPLACE FUNCTION public.rpc_questoes_avaliacao_preview(p_avaliacao_id uuid)
RETURNS TABLE (
  question_id uuid,
  ordem integer,
  valor numeric,
  statement text,
  image_url text,
  alternatives jsonb,
  support_text_content text,
  support_text_image_url text,
  ja_respondida boolean,
  letra_marcada text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao avaliacoes;
BEGIN
  SELECT * INTO v_avaliacao FROM avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  -- Quem criou a avaliação sempre pode; coordenação e gestão também, para poderem
  -- revisar o que vai para os alunos.
  IF NOT (
    v_avaliacao.criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar esta avaliação.';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    aq.ordem,
    aq.valor,
    q.statement,
    q.image_url,
    q.alternatives,
    st.content,
    st.image_url,
    false,        -- preview nunca tem resposta gravada
    NULL::text
  FROM avaliacao_questoes aq
  JOIN questions q ON q.id = aq.question_id
  LEFT JOIN support_texts st ON st.id = q.support_text_id
  WHERE aq.avaliacao_id = p_avaliacao_id
  ORDER BY aq.ordem;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_questoes_avaliacao_preview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_questoes_avaliacao_preview(uuid) TO authenticated;
