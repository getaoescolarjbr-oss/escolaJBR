-- Permite desfazer a publicação de uma avaliação (normal ou de área): volta pra rascunho e
-- remove a(s) nota(s) já lançada(s) no diário — mesma limpeza que excluirAvaliacao() já faz
-- pra prova_avaliacao_notas/avaliacoes/notas_avaliacoes, só que sem apagar a prova em si
-- (questões, cotas e turmas continuam intactas, prontas pra editar e publicar de novo).
--
-- Recusa despublicar se algum aluno já tiver resposta finalizada (prova_respostas) ou
-- cartão já lido (prova_leituras) — mesmo critério do "Sortear de novo" — porque nesse
-- ponto já existe correção de verdade em cima da publicação, e desfazer silenciosamente
-- apagaria isso do boletim sem avisar quem já corrigiu.

CREATE OR REPLACE FUNCTION public.rpc_despublicar_avaliacao(p_prova_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_notas_ids UUID[];
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  IF NOT (
    v_prova.criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para despublicar esta avaliação.';
  END IF;

  IF v_prova.status <> 'PUBLICADA' THEN
    RAISE EXCEPTION 'Esta avaliação não está publicada.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.prova_respostas WHERE prova_id = p_prova_id AND finalizado_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.prova_leituras WHERE prova_id = p_prova_id)
  THEN
    RAISE EXCEPTION 'Esta avaliação já tem resposta enviada ou cartão corrigido — despublicar apagaria essas notas do boletim. Corrija manualmente as notas antes, se precisar remover.';
  END IF;

  SELECT array_agg(avaliacao_id) INTO v_notas_ids
  FROM public.prova_avaliacao_notas
  WHERE prova_id = p_prova_id;

  IF v_notas_ids IS NOT NULL THEN
    DELETE FROM public.notas_avaliacoes WHERE avaliacao_id = ANY(v_notas_ids);
    DELETE FROM public.avaliacoes WHERE id = ANY(v_notas_ids);
    DELETE FROM public.prova_avaliacao_notas WHERE prova_id = p_prova_id;
  END IF;

  UPDATE public.provas
  SET status = 'RASCUNHO',
      status_colaboracao = CASE WHEN eh_prova_area THEN 'EM_ELABORACAO' ELSE status_colaboracao END
  WHERE id = p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_despublicar_avaliacao(UUID) TO authenticated;
