-- Questões de somatória no banco de questões (provas UFMS 2006-2010 usam esse
-- formato: cada questão tem de 4 a 8 itens numerados, cada item com um código fixo
-- em potência de 2 -- 01, 02, 04, 08, 16, 32... -- e a resposta certa é a SOMA dos
-- códigos dos itens verdadeiros, não uma letra A-E.
--
-- Segue o mesmo molde de add_questoes_dissertativas_redacao.sql: novo `tipo`,
-- reaproveita `alternatives` (que já é jsonb e já é lido de forma genérica —
-- `.map(a => a.letter/a.text)` -- em QuestionCard, enriquecer.mjs etc., então
-- guardar itens de somatória lá não quebra nada que já lê essa coluna) e adiciona
-- só o que é realmente novo: a soma correta.
--
-- FORA DO ESCOPO DESTE ARQUIVO, DE PROPÓSITO: correção automática por OMR. Esse
-- formato usa uma grade de bolhas bem diferente de A-E (uma bolha por ITEM, não por
-- alternativa), e linhas_cartao_versao/bolha_para_alternativa/rpc_corrigir_omr (em
-- create_correcao_omr.sql) só entendem A-E. Até isso ser desenhado, questão
-- SOMATORIA se corrige manualmente, do mesmo jeito que dissertativa/redação hoje —
-- por isso correct_sum não participa de rpc_corrigir_omr nem de linhas_cartao_versao.

ALTER TABLE public.questions
  ADD CONSTRAINT questions_tipo_check_v2 CHECK (tipo IN ('OBJETIVA', 'DISSERTATIVA', 'REDACAO', 'SOMATORIA'));

-- Troca o CHECK antigo pelo novo (não dá pra só adicionar SOMATORIA ao check
-- existente porque um CHECK não é alterável in place no Postgres).
DO $$ BEGIN
  ALTER TABLE public.questions DROP CONSTRAINT questions_tipo_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.questions RENAME CONSTRAINT questions_tipo_check_v2 TO questions_tipo_check;

-- A soma correta (ex.: itens II e IV certos -> 2 + 8 = 10). NULL para os outros
-- tipos, do mesmo jeito que correct_letter é NULL para dissertativa/redação.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_sum integer;

DO $$ BEGIN
  ALTER TABLE public.questions ADD CONSTRAINT questions_correct_sum_check
    CHECK (correct_sum IS NULL OR correct_sum >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Substitui o CHECK de coerência tipo<->conteúdo para incluir o terceiro formato.
--
-- NOT VALID de propósito: o CHECK antigo já convivia com pelo menos 3 linhas
-- OBJETIVA legadas com alternatives = '[]' (import que perdeu alternativa em
-- imagem -- ver add_questoes_dissertativas_redacao.sql). Recriar o CHECK sem
-- NOT VALID valida a tabela inteira na hora e falha nessas linhas velhas, que
-- não têm nada a ver com SOMATORIA. NOT VALID aceita a troca sem tocar no dado
-- antigo; só barra linha NOVA fora do padrão daqui pra frente.
DO $$ BEGIN
  ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_tipo_conteudo_check;

  ALTER TABLE public.questions ADD CONSTRAINT questions_tipo_conteudo_check CHECK (
    (tipo = 'OBJETIVA'
      AND correct_letter IS NOT NULL
      AND correct_sum IS NULL
      AND jsonb_typeof(alternatives) = 'array'
      AND jsonb_array_length(alternatives) >= 2)
    OR
    (tipo IN ('DISSERTATIVA', 'REDACAO')
      AND correct_letter IS NULL
      AND correct_sum IS NULL
      AND jsonb_typeof(alternatives) = 'array'
      AND jsonb_array_length(alternatives) = 0)
    OR
    (tipo = 'SOMATORIA'
      AND correct_letter IS NULL
      AND correct_sum IS NOT NULL
      AND jsonb_typeof(alternatives) = 'array'
      AND jsonb_array_length(alternatives) BETWEEN 2 AND 8)
  ) NOT VALID;
END $$;

COMMENT ON COLUMN public.questions.tipo IS 'OBJETIVA | DISSERTATIVA | REDACAO | SOMATORIA';
COMMENT ON COLUMN public.questions.correct_sum IS
  'Soma dos códigos (1,2,4,8,16,32...) dos itens verdadeiros, só para tipo SOMATORIA. '
  'Os itens em si ficam em alternatives: [{"letter":"I","codigo":1,"text":"..."}, ...].';
