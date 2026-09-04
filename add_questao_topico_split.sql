-- Divide "assunto" em dois níveis: assunto (categoria/gênero, ex. "Álgebra") e o novo campo
-- topico (subdivisão específica dentro do assunto, ex. "Equações do 1º Grau"). Muitos assuntos
-- importados vieram concatenados numa string só ("Álgebra: Equações do 1º Grau"), o que impedia
-- agrupar questões do mesmo gênero no filtro. Faz backfill dividindo pelo primeiro ":" e limpa
-- termos de taxonomia (assunto/tópico) que não têm mais nenhuma questão associada.

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topico text;

-- Backfill: separa "Álgebra: Equações do 1º Grau" em assunto="Álgebra" + topico="Equações do 1º Grau".
-- Feito linha a linha (em vez de um UPDATE em massa) porque algumas questões já tinham dados
-- inconsistentes de tipo/alternativas/gabarito de antes (violam questions_tipo_conteudo_check) —
-- um UPDATE em massa nelas travaria a migração inteira por causa de um problema não relacionado
-- a assunto/tópico. Aqui cada linha problemática é pulada e reportada, sem travar as demais.
DO $$
DECLARE
  r RECORD;
  pulados int := 0;
BEGIN
  FOR r IN
    SELECT id, assunto FROM public.questions WHERE assunto LIKE '%:%'
  LOOP
    BEGIN
      UPDATE public.questions
      SET
        topico = trim(substring(r.assunto from position(':' in r.assunto) + 1)),
        assunto = trim(substring(r.assunto from 1 for position(':' in r.assunto) - 1))
      WHERE id = r.id;
    EXCEPTION WHEN check_violation THEN
      pulados := pulados + 1;
      RAISE NOTICE 'Pulei a questão % (dado pré-existente de tipo/alternativas/gabarito inconsistente, sem relação com assunto/tópico) — precisa de correção manual.', r.id;
    END;
  END LOOP;
  RAISE NOTICE '% questão(ões) pulada(s) por dado inconsistente pré-existente.', pulados;
END $$;

ALTER TABLE public.question_taxonomy_terms DROP CONSTRAINT IF EXISTS question_taxonomy_terms_field_check;
ALTER TABLE public.question_taxonomy_terms
  ADD CONSTRAINT question_taxonomy_terms_field_check
  CHECK (field IN ('discipline', 'difficulty', 'assunto', 'banca', 'orgao', 'cargo', 'level', 'area', 'topico'));

-- Divide os termos de taxonomia de assunto que também seguiam o formato "Categoria: Subdivisão"
WITH split AS (
  SELECT
    trim(substring(value from 1 for position(':' in value) - 1)) AS categoria,
    trim(substring(value from position(':' in value) + 1)) AS subdivisao
  FROM public.question_taxonomy_terms
  WHERE field = 'assunto' AND value LIKE '%:%'
)
INSERT INTO public.question_taxonomy_terms (field, value)
SELECT 'assunto', categoria FROM split
UNION
SELECT 'topico', subdivisao FROM split
ON CONFLICT (field, value) DO NOTHING;

DELETE FROM public.question_taxonomy_terms
WHERE field = 'assunto' AND value LIKE '%:%';

-- Garante que todo tópico já usado em alguma questão também existe como termo cadastrado
INSERT INTO public.question_taxonomy_terms (field, value)
SELECT DISTINCT 'topico', topico FROM public.questions WHERE topico IS NOT NULL
ON CONFLICT (field, value) DO NOTHING;

-- Limpeza pedida: remove termos de assunto/tópico cadastrados sem nenhuma questão associada
DELETE FROM public.question_taxonomy_terms t
WHERE t.field = 'assunto'
  AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.assunto = t.value);

DELETE FROM public.question_taxonomy_terms t
WHERE t.field = 'topico'
  AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.topico = t.value);

-- Estende question_bank_filter_options() com "topicos"
DROP FUNCTION IF EXISTS public.question_bank_filter_options();

CREATE FUNCTION public.question_bank_filter_options()
RETURNS TABLE (
  disciplines text[],
  difficulties text[],
  orgaos text[],
  cargos text[],
  anos integer[],
  assuntos text[],
  bancas text[],
  levels text[],
  areas text[],
  topicos text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT discipline AS v FROM public.questions WHERE discipline IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'discipline'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT difficulty AS v FROM public.questions WHERE difficulty IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'difficulty'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT orgao AS v FROM public.questions WHERE orgao IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'orgao'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT cargo AS v FROM public.questions WHERE cargo IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'cargo'
    ) t),
    (SELECT array_agg(DISTINCT ano) FROM public.questions WHERE ano IS NOT NULL),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT assunto AS v FROM public.questions WHERE assunto IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'assunto'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT banca AS v FROM public.questions WHERE banca IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'banca'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT level AS v FROM public.questions WHERE level IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'level'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT area AS v FROM public.questions WHERE area IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'area'
    ) t),
    (SELECT array_agg(DISTINCT v) FROM (
      SELECT topico AS v FROM public.questions WHERE topico IS NOT NULL
      UNION
      SELECT value FROM public.question_taxonomy_terms WHERE field = 'topico'
    ) t);
$$;

GRANT EXECUTE ON FUNCTION public.question_bank_filter_options() TO authenticated;

-- Tópicos de um assunto específico (cascata no editor/filtros), no mesmo padrão de
-- question_bank_assuntos_by_discipline (só considera o que já está em uso nas questões).
CREATE OR REPLACE FUNCTION public.question_bank_topicos_by_assunto(p_assunto text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT topico ORDER BY topico)
  FROM public.questions
  WHERE assunto = p_assunto AND topico IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.question_bank_topicos_by_assunto(text) TO authenticated;
