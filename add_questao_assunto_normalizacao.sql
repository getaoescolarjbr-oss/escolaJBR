-- Continuação do add_questao_topico_split.sql: aquele arquivo só separava assuntos que já
-- vinham concatenados com ":" (ex. "Álgebra: Equações do 1º Grau"). A maioria dos assuntos
-- parecidos NÃO usa ":" — são strings soltas tipo "Álgebra", "Álgebra Linear", "Álgebra e
-- Tabelas", "Álgebra e operações" — que deveriam virar assunto="Álgebra" + tópico específico.
-- Este script faz duas coisas, sempre que a operação for 100% segura de decidir sozinha:
--
-- 1) Padronização: assuntos/tópicos que só diferem por acento ou maiúscula/minúscula
--    (ex. "Álgebra" / "algebra" / "ÁLGEBRA") viram um único valor canônico (o mais usado).
-- 2) Agrupamento por prefixo: quando um assunto mais longo (ex. "Álgebra Linear") começa
--    literalmente com um assunto mais curto que JÁ EXISTE sozinho no banco (ex. "Álgebra"),
--    o mais longo passa a ser assunto="Álgebra" + tópico="Linear". Só agrupa quando o prefixo
--    mais curto já é, ele mesmo, um assunto usado em alguma questão — isso evita criar
--    agrupamentos inventados a partir de palavras genéricas (ex. não junta "Da Costa..." com
--    "Da Silva..." só por começarem com "Da").
--
-- Assuntos sem nenhum parente reconhecido dessa forma (a maioria dos ~1500) continuam como
-- estão — juntar por "primeira palavra em comum" sem um parente confirmado é arriscado demais
-- pra fazer automaticamente num banco de produção com disciplinas tão diferentes.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public._normalizar_texto(v text) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT lower(unaccent(trim(regexp_replace(v, '\s+', ' ', 'g'))))
$$;

-- -----------------------------------------------------
-- 1) Padronização de acento/maiúscula-minúscula (assunto e tópico)
-- -----------------------------------------------------
DO $$
DECLARE
  r RECORD;
  linha RECORD;
  pulados int := 0;
BEGIN
  FOR r IN
    SELECT (array_agg(value ORDER BY cnt DESC, length(value) ASC, value ASC))[1] AS canonico,
           array_agg(value) AS variantes
    FROM (
      SELECT assunto AS value, public._normalizar_texto(assunto) AS norm, count(*) AS cnt
      FROM public.questions WHERE assunto IS NOT NULL GROUP BY assunto
    ) x
    GROUP BY norm
    HAVING count(*) > 1
  LOOP
    FOR linha IN SELECT id FROM public.questions WHERE assunto = ANY(r.variantes) AND assunto <> r.canonico LOOP
      BEGIN
        UPDATE public.questions SET assunto = r.canonico WHERE id = linha.id;
      EXCEPTION WHEN check_violation THEN
        pulados := pulados + 1;
        RAISE NOTICE 'Pulei a questão % ao padronizar assunto (dado pré-existente inconsistente de tipo/alternativas/gabarito).', linha.id;
      END;
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT (array_agg(value ORDER BY cnt DESC, length(value) ASC, value ASC))[1] AS canonico,
           array_agg(value) AS variantes
    FROM (
      SELECT topico AS value, public._normalizar_texto(topico) AS norm, count(*) AS cnt
      FROM public.questions WHERE topico IS NOT NULL GROUP BY topico
    ) x
    GROUP BY norm
    HAVING count(*) > 1
  LOOP
    FOR linha IN SELECT id FROM public.questions WHERE topico = ANY(r.variantes) AND topico <> r.canonico LOOP
      BEGIN
        UPDATE public.questions SET topico = r.canonico WHERE id = linha.id;
      EXCEPTION WHEN check_violation THEN
        pulados := pulados + 1;
        RAISE NOTICE 'Pulei a questão % ao padronizar tópico (dado pré-existente inconsistente de tipo/alternativas/gabarito).', linha.id;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[padronização] % atualização(ões) pulada(s) por dado inconsistente pré-existente.', pulados;
END $$;

-- -----------------------------------------------------
-- 2) Agrupamento por prefixo reconhecido (assunto mais curto já existe sozinho no banco)
-- -----------------------------------------------------
DO $$
DECLARE
  r RECORD;
  linha RECORD;
  pulados int := 0;
BEGIN
  FOR r IN
    WITH assuntos_distintos AS (
      SELECT DISTINCT assunto AS valor, public._normalizar_texto(assunto) AS norm
      FROM public.questions WHERE assunto IS NOT NULL
    ),
    candidatos AS (
      SELECT longo.valor AS valor_longo, curto.valor AS valor_curto,
             trim(substring(longo.valor from length(curto.valor) + 1)) AS resto
      FROM assuntos_distintos longo
      JOIN assuntos_distintos curto
        ON longo.valor <> curto.valor
       AND longo.norm LIKE curto.norm || ' %'
    ),
    melhor AS (
      SELECT valor_longo, valor_curto, resto,
             row_number() OVER (PARTITION BY valor_longo ORDER BY length(valor_curto) DESC) AS rn
      FROM candidatos
    )
    SELECT valor_longo, valor_curto, resto FROM melhor WHERE rn = 1 AND resto <> ''
  LOOP
    FOR linha IN SELECT id, topico FROM public.questions WHERE assunto = r.valor_longo LOOP
      BEGIN
        UPDATE public.questions
        SET assunto = r.valor_curto,
            topico = COALESCE(linha.topico, r.resto)
        WHERE id = linha.id;
      EXCEPTION WHEN check_violation THEN
        pulados := pulados + 1;
        RAISE NOTICE 'Pulei a questão % ao agrupar "%" sob "%" (dado pré-existente inconsistente de tipo/alternativas/gabarito).', linha.id, r.valor_longo, r.valor_curto;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[agrupamento por prefixo] % atualização(ões) pulada(s) por dado inconsistente pré-existente.', pulados;
END $$;

-- -----------------------------------------------------
-- Ressincroniza question_taxonomy_terms com os valores atuais de questions e limpa órfãos
-- (mesmo procedimento do add_questao_topico_split.sql, repetido aqui porque este script pode
-- ter mudado os valores de assunto/tópico em uso).
-- -----------------------------------------------------
INSERT INTO public.question_taxonomy_terms (field, value)
SELECT DISTINCT 'assunto', assunto FROM public.questions WHERE assunto IS NOT NULL
ON CONFLICT (field, value) DO NOTHING;

INSERT INTO public.question_taxonomy_terms (field, value)
SELECT DISTINCT 'topico', topico FROM public.questions WHERE topico IS NOT NULL
ON CONFLICT (field, value) DO NOTHING;

DELETE FROM public.question_taxonomy_terms t
WHERE t.field = 'assunto'
  AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.assunto = t.value);

DELETE FROM public.question_taxonomy_terms t
WHERE t.field = 'topico'
  AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.topico = t.value);
