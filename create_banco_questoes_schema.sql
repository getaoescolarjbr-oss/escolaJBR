-- Banco de Questões — reaproveita as ~12k questões já organizadas no projeto
-- aprova-prime-51-main (site de concurseiro). Aqui o uso é o professor consultar/
-- filtrar e montar provas/listas, não o aluno resolver online — por isso não há
-- tabela de tentativas/desempenho, só leitura + seleção no front-end.
--
-- RLS segue o padrão deste projeto (usuario_tem_papel(), não has_role): leitura para
-- PROFESSOR/COORDENACAO/GESTAO, escrita só para GESTAO (evita descontrole com muitos
-- professores editando o banco compartilhado).

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.support_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline text NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline text NOT NULL,
  area text,
  level text,
  banca text,
  orgao text,
  cargo text,
  ano integer,
  difficulty text,
  assunto text,
  statement text NOT NULL,
  image_url text,
  alternatives jsonb NOT NULL,
  correct_letter text NOT NULL,
  explanation text,
  support_text_id uuid REFERENCES public.support_texts(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX questions_discipline_idx ON public.questions (discipline);
CREATE INDEX questions_support_text_id_idx ON public.questions (support_text_id);

GRANT SELECT ON public.support_texts, public.questions TO authenticated;
GRANT ALL ON public.support_texts, public.questions TO service_role;

ALTER TABLE public.support_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professores e coordenação podem ler questões"
  ON public.questions FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_papel('PROFESSOR')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  );

CREATE POLICY "Gestão pode gerenciar questões"
  ON public.questions FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE POLICY "Professores e coordenação podem ler textos de apoio"
  ON public.support_texts FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_papel('PROFESSOR')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  );

CREATE POLICY "Gestão pode gerenciar textos de apoio"
  ON public.support_texts FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_texts_updated_at
  BEFORE UPDATE ON public.support_texts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- Taxonomia cadastrável dos filtros (Disciplina, Dificuldade, Assunto, Banca,
-- Órgão, Cargo, Nível, Área) + RPC que alimenta os dropdowns sem esbarrar no
-- limite de linhas do PostgREST.
-- -----------------------------------------------------
CREATE TABLE public.question_taxonomy_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field text NOT NULL CHECK (field IN ('discipline', 'difficulty', 'assunto', 'banca', 'orgao', 'cargo', 'level', 'area')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field, value)
);

GRANT SELECT ON public.question_taxonomy_terms TO authenticated;
GRANT ALL ON public.question_taxonomy_terms TO service_role;

ALTER TABLE public.question_taxonomy_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler question_taxonomy_terms"
  ON public.question_taxonomy_terms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestão pode gerenciar question_taxonomy_terms"
  ON public.question_taxonomy_terms
  FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

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
  areas text[]
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
    ) t);
$$;

GRANT EXECUTE ON FUNCTION public.question_bank_filter_options() TO authenticated;

-- -----------------------------------------------------
-- Bucket de imagens para questões cadastradas/editadas daqui pra frente pelo admin
-- (o import inicial das 12k questões usa hot-link para o storage de origem).
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens-questoes', 'imagens-questoes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "imagens_questoes_leitura_publica" ON storage.objects FOR SELECT
  USING (bucket_id = 'imagens-questoes');

CREATE POLICY "imagens_questoes_escrita_gestao" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imagens-questoes' AND public.usuario_tem_papel('GESTAO'));

CREATE POLICY "imagens_questoes_update_gestao" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imagens-questoes' AND public.usuario_tem_papel('GESTAO'));

CREATE POLICY "imagens_questoes_delete_gestao" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'imagens-questoes' AND public.usuario_tem_papel('GESTAO'));
