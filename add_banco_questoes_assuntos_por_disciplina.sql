-- Assunto deve ser filtrado pela disciplina selecionada no Banco de Questões,
-- em vez de listar os ~1500 assuntos de todas as disciplinas juntas.
CREATE FUNCTION public.question_bank_assuntos_by_discipline(p_discipline text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT assunto ORDER BY assunto)
  FROM public.questions
  WHERE discipline = p_discipline AND assunto IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.question_bank_assuntos_by_discipline(text) TO authenticated;
