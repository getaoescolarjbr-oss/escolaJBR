-- Questões dissertativas e propostas de redação no banco de questões.
--
-- Até aqui a tabela só comportava múltipla escolha: alternatives e correct_letter
-- eram NOT NULL. As dissertativas e as propostas de redação (UNESP e outras bancas)
-- não cabiam nesse formato.
--
-- Três decisões que valem explicação:
--
-- 1) alternatives CONTINUA NOT NULL, com '[]' para dissertativa/redação, em vez de
--    virar nullable. Todo o front faz `q.alternatives.map(...)` sem guarda de null
--    (QuestionCard, QuestaoAlunoView, GerarProvaModal); permitir NULL quebraria
--    essas telas em runtime. Array vazio percorre sem quebrar nada. Passa a ter
--    DEFAULT '[]' para que um INSERT de dissertativa não precise citar a coluna.
--
-- 2) correct_letter passa a aceitar NULL, porque não existe letra certa numa
--    dissertativa. Os pontos que leem essa coluna já comparam com a letra da
--    alternativa (`a.letter === q.correct_letter`), o que é seguro com null.
--
-- 3) O CHECK de coerência é criado como NOT VALID quando o banco já tem linhas
--    fora do padrão. Verificação feita em 2026-08-30 sobre as 9684 questões:
--    3 delas são OBJETIVAS com alternatives = '[]' (importação que perdeu as
--    alternativas em imagem) — são dados quebrados, não dissertativas:
--      3f324d34-332a-4699-b023-3db394517d7b  (INEP 2023, roda-gigante)
--      70cabab8-bc31-4dce-95e5-97f3ac4723cc  (INEP 2023, jogo digital)
--      f56d1064-8cdf-432f-888c-b9c406fb605d  (Itame 2024, y = ax²+bx+c)
--    NOT VALID barra dado novo ruim sem invalidar as 9684 já existentes nem fazer
--    o script falhar. Depois de corrigir/desativar essas três, rode:
--      ALTER TABLE public.questions VALIDATE CONSTRAINT questions_tipo_conteudo_check;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'OBJETIVA';

DO $$ BEGIN
  ALTER TABLE public.questions
    ADD CONSTRAINT questions_tipo_check CHECK (tipo IN ('OBJETIVA', 'DISSERTATIVA', 'REDACAO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Resposta esperada / critérios de correção. Serve tanto pra dissertativa
-- (resposta esperada, o que precisa aparecer) quanto pra redação (competências
-- avaliadas). Fica separado de explanation, que é o comentário pedagógico exibido
-- ao aluno depois — critérios são para o olho do professor na hora de corrigir.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS criterios_correcao text;

-- Quantas linhas pautadas imprimir abaixo do enunciado. NULL = o gerador de prova
-- decide pelo tipo (dissertativa 8, redação 30). Deixar NULL como "usa o padrão"
-- em vez de gravar 8/30 na linha evita ter que migrar tudo se o padrão mudar.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS linhas_resposta integer;

DO $$ BEGIN
  ALTER TABLE public.questions
    ADD CONSTRAINT questions_linhas_resposta_check
    CHECK (linhas_resposta IS NULL OR (linhas_resposta > 0 AND linhas_resposta <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.questions ALTER COLUMN correct_letter DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN alternatives SET DEFAULT '[]'::jsonb;

-- CHECK de coerência tipo <-> conteúdo: nada de objetiva sem gabarito, nem
-- dissertativa com alternativa órfã. O jsonb_typeof é necessário porque
-- jsonb_array_length levanta erro (não retorna NULL) se o valor não for array.
DO $$
DECLARE
  v_ruins integer;
  v_ids   text;
BEGIN
  SELECT count(*), string_agg(id::text, ', ')
    INTO v_ruins, v_ids
  FROM public.questions
  WHERE tipo = 'OBJETIVA'
    AND (correct_letter IS NULL
         OR jsonb_typeof(alternatives) <> 'array'
         OR jsonb_array_length(alternatives) < 2);

  BEGIN
    IF v_ruins > 0 THEN
      RAISE WARNING 'questions: % linha(s) OBJETIVA(s) fora do padrão (sem gabarito ou com menos de 2 alternativas). O CHECK será criado como NOT VALID. IDs: %', v_ruins, v_ids;
      ALTER TABLE public.questions ADD CONSTRAINT questions_tipo_conteudo_check CHECK (
        (tipo = 'OBJETIVA'
          AND correct_letter IS NOT NULL
          AND jsonb_typeof(alternatives) = 'array'
          AND jsonb_array_length(alternatives) >= 2)
        OR
        (tipo IN ('DISSERTATIVA', 'REDACAO')
          AND correct_letter IS NULL
          AND jsonb_typeof(alternatives) = 'array'
          AND jsonb_array_length(alternatives) = 0)
      ) NOT VALID;
    ELSE
      ALTER TABLE public.questions ADD CONSTRAINT questions_tipo_conteudo_check CHECK (
        (tipo = 'OBJETIVA'
          AND correct_letter IS NOT NULL
          AND jsonb_typeof(alternatives) = 'array'
          AND jsonb_array_length(alternatives) >= 2)
        OR
        (tipo IN ('DISSERTATIVA', 'REDACAO')
          AND correct_letter IS NULL
          AND jsonb_typeof(alternatives) = 'array'
          AND jsonb_array_length(alternatives) = 0)
      );
    END IF;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'questions_tipo_conteudo_check já existe — nada a fazer.';
  END;
END $$;

-- Índice para os filtros do banco de questões ("só dissertativas", "só redação").
-- Parcial, porque OBJETIVA é ~100% da tabela e nunca compensa indexar.
CREATE INDEX IF NOT EXISTS questions_tipo_nao_objetiva_idx
  ON public.questions (tipo) WHERE tipo <> 'OBJETIVA';

COMMENT ON COLUMN public.questions.tipo IS 'OBJETIVA | DISSERTATIVA | REDACAO';
COMMENT ON COLUMN public.questions.criterios_correcao IS 'Resposta esperada (dissertativa) ou competências avaliadas (redação). Visível só para o professor.';
COMMENT ON COLUMN public.questions.linhas_resposta IS 'Linhas pautadas na prova impressa. NULL = padrão por tipo (dissertativa 8, redação 30).';
