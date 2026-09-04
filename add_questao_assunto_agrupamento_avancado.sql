-- Continuação de add_questao_assunto_normalizacao.sql. Aquele script só agrupava um assunto
-- longo sob um curto quando o curto JÁ EXISTIA sozinho no banco (ex. "Álgebra" existia, então
-- "Álgebra Linear" virou assunto="Álgebra" + tópico="Linear"). Isso deixou de fora casos como
-- "Alienação e divisão social do trabalho" / "Alienação no trabalho tayIorista", onde nenhum dos
-- dois é só "Alienação" sozinho — só têm a primeira palavra em comum.
--
-- Este script resolve isso com duas regras, SEMPRE dentro da mesma disciplina (agrupar entre
-- disciplinas diferentes não faz sentido, como você pediu):
--
-- 1) Primeira palavra em comum: quando 2+ assuntos distintos da MESMA disciplina começam com a
--    mesma primeira palavra (ignorando acento/maiúscula), essa palavra vira o assunto e o resto
--    de cada um vira o tópico. Só considera palavras com 5+ letras, pra não juntar por acidente
--    coisas que começam com "de", "no", "para" etc.
--
-- 2) Correções manuais pontuais: casos como "Acento diacrítico" vs "Acentuação Diacrítica", que
--    são a mesma coisa mas com palavras de raiz diferente (não dá pra detectar isso só com
--    prefixo/acento). Ficam num mapa explícito no início do script — adicione mais linhas nele
--    conforme encontrar outros casos, ou (melhor ainda) use o "renomear" na aba Categorias depois
--    que essa tela ganhar essa opção.

-- -----------------------------------------------------
-- 1) Agrupamento por primeira palavra em comum, por disciplina
-- -----------------------------------------------------
DO $$
DECLARE
  r RECORD;
  linha RECORD;
  pulados int := 0;
BEGIN
  FOR r IN
    WITH assuntos_distintos AS (
      SELECT DISTINCT discipline, assunto AS valor, public._normalizar_texto(assunto) AS norm
      FROM public.questions WHERE assunto IS NOT NULL
    ),
    com_primeira_palavra AS (
      SELECT discipline, valor, norm, split_part(norm, ' ', 1) AS palavra1
      FROM assuntos_distintos
    ),
    grupos AS (
      SELECT discipline, palavra1,
             -- representante: a grafia original da primeira palavra do menor assunto do grupo
             (array_agg(split_part(valor, ' ', 1) ORDER BY length(valor) ASC, valor ASC))[1] AS assunto_novo,
             array_agg(valor) AS variantes
      FROM com_primeira_palavra
      GROUP BY discipline, palavra1
      HAVING count(*) > 1 AND length(palavra1) >= 5
    )
    SELECT discipline, assunto_novo, unnest(variantes) AS valor_antigo FROM grupos
  LOOP
    FOR linha IN
      SELECT id, topico FROM public.questions
      WHERE discipline = r.discipline AND assunto = r.valor_antigo
    LOOP
      BEGIN
        UPDATE public.questions
        SET assunto = r.assunto_novo,
            topico = COALESCE(linha.topico, NULLIF(trim(substring(r.valor_antigo from length(r.assunto_novo) + 1)), ''))
        WHERE id = linha.id;
      EXCEPTION WHEN check_violation THEN
        pulados := pulados + 1;
        RAISE NOTICE 'Pulei a questão % ao agrupar "%" sob "%" (dado pré-existente inconsistente).', linha.id, r.valor_antigo, r.assunto_novo;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[primeira palavra em comum] % atualização(ões) pulada(s) por dado inconsistente pré-existente.', pulados;
END $$;

-- -----------------------------------------------------
-- 2) Correções manuais pontuais (grafias com raiz diferente que a regra acima não detecta)
-- -----------------------------------------------------
DO $$
DECLARE
  mapa CONSTANT jsonb := '[
    {"de": "Acento diacrítico", "assunto": "Acentuação", "topico": "Diacrítico"},
    {"de": "Acentuação Diacrítica", "assunto": "Acentuação", "topico": "Diacrítico"}
  ]'::jsonb;
  item jsonb;
  linha RECORD;
  pulados int := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(mapa) LOOP
    FOR linha IN SELECT id FROM public.questions WHERE assunto = (item->>'de') LOOP
      BEGIN
        UPDATE public.questions
        SET assunto = (item->>'assunto'), topico = (item->>'topico')
        WHERE id = linha.id;
      EXCEPTION WHEN check_violation THEN
        pulados := pulados + 1;
        RAISE NOTICE 'Pulei a questão % ao aplicar correção manual (dado pré-existente inconsistente).', linha.id;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[correções manuais] % atualização(ões) pulada(s) por dado inconsistente pré-existente.', pulados;
END $$;

-- -----------------------------------------------------
-- Ressincroniza question_taxonomy_terms e limpa órfãos (mesmo procedimento dos scripts anteriores)
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
