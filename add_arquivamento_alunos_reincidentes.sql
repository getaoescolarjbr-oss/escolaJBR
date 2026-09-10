-- ====================================================================================
-- ARQUIVAR ALUNOS DA LISTA DE REINCIDENTES
--
-- Tabela simples: um aluno arquivado some da lista "Alunos Reincidentes" até alguém
-- desarquivar — não apaga nenhuma ocorrência, só marca "já tratado, não precisa
-- continuar aparecendo aqui".
-- ====================================================================================

CREATE TABLE IF NOT EXISTS public.alunos_reincidencia_arquivados (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  arquivado_por uuid REFERENCES auth.users(id),
  arquivado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.alunos_reincidencia_arquivados TO authenticated;
ALTER TABLE public.alunos_reincidencia_arquivados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reincidencia_arquivados_select" ON public.alunos_reincidencia_arquivados;
CREATE POLICY "reincidencia_arquivados_select" ON public.alunos_reincidencia_arquivados
  FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
  );

DROP POLICY IF EXISTS "reincidencia_arquivados_insert" ON public.alunos_reincidencia_arquivados;
CREATE POLICY "reincidencia_arquivados_insert" ON public.alunos_reincidencia_arquivados
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
  );

DROP POLICY IF EXISTS "reincidencia_arquivados_delete" ON public.alunos_reincidencia_arquivados;
CREATE POLICY "reincidencia_arquivados_delete" ON public.alunos_reincidencia_arquivados
  FOR DELETE TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
  );

NOTIFY pgrst, 'reload schema';
