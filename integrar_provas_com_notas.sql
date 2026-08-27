-- ====================================================================================
-- Integra o Gerador de Avaliações (provas/prova_*) com o módulo de Notas
-- (avaliacoes/notas_avaliacoes, GradesPanel.tsx): ao publicar uma prova, é criada
-- automaticamente 1 avaliação de nota por turma selecionada, pra aparecer direto no
-- boletim. A tabela `prova_avaliacao_notas` guarda o vínculo prova->avaliação(nota)
-- por turma, pra permitir excluir dos dois lados de uma vez (ver excluirAvaliacao em
-- avaliacoesService.ts) sem depender de FK cruzada entre `provas` e `avaliacoes`
-- (tabelas de módulos diferentes, propositalmente separadas — ver
-- fix_provas_table_collision.sql).
-- ====================================================================================

ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS disciplina_id uuid REFERENCES public.disciplinas(id);
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS bimestre_id integer;

CREATE TABLE IF NOT EXISTS public.prova_avaliacao_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prova_id, turma_id)
);

CREATE INDEX IF NOT EXISTS prova_avaliacao_notas_prova_id_idx ON public.prova_avaliacao_notas (prova_id);
CREATE INDEX IF NOT EXISTS prova_avaliacao_notas_avaliacao_id_idx ON public.prova_avaliacao_notas (avaliacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_avaliacao_notas TO authenticated;
GRANT ALL ON public.prova_avaliacao_notas TO service_role;

ALTER TABLE public.prova_avaliacao_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prova_avaliacao_notas_all_dono_ou_staff" ON public.prova_avaliacao_notas;
CREATE POLICY "prova_avaliacao_notas_all_dono_ou_staff"
  ON public.prova_avaliacao_notas FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));
