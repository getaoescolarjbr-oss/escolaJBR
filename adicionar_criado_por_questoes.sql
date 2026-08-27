-- Adiciona rastreio de autoria em public.questions, para permitir que o professor
-- filtre "minhas questões" ao montar uma avaliação. Questões já existentes (importadas
-- em lote) ficam com criado_por NULL — não pertencem a nenhum professor específico.

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questions_criado_por_idx ON public.questions (criado_por);
