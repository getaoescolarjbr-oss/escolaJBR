-- rpc_publicar_avaliacao_area calculava o valor_maximo do lançamento no diário de cada
-- professor como a SOMA só das questões daquela disciplina (ex.: 3 de 9 questões de uma
-- prova de 4 pontos = 1,33) -- a avaliação de área é uma prova só, corrigida como um todo, e
-- deve valer o MESMO valor_total (ex.: 4,00) no diário de TODOS os professores envolvidos,
-- não uma fração proporcional às questões que cada um contribuiu.

CREATE OR REPLACE FUNCTION public.rpc_publicar_avaliacao_area(p_prova_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_cota RECORD;
  v_turma RECORD;
  v_nota_id UUID;
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
    RAISE EXCEPTION 'Sem permissão para publicar esta avaliação de área.';
  END IF;

  -- Atualizar status da prova
  UPDATE public.provas
  SET status = 'PUBLICADA',
      status_colaboracao = 'PUBLICADA'
  WHERE id = p_prova_id;

  -- Para cada professor/disciplina da cota e para cada turma vinculada à prova:
  -- Se o tipo for AVALIACAO (gera nota), cria o registro em avaliacoes no boletim de cada
  -- professor, sempre valendo o valor_total inteiro da prova (mesma nota máxima pra todos).
  IF v_prova.tipo = 'AVALIACAO' AND v_prova.bimestre_id IS NOT NULL THEN
    FOR v_cota IN
      SELECT pac.*, p.nome AS professor_nome, d.nome AS disciplina_nome
      FROM public.prova_area_cotas pac
      JOIN public.professores p ON p.id = pac.professor_id
      LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
      WHERE pac.prova_id = p_prova_id
    LOOP
      FOR v_turma IN
        SELECT pt.turma_id
        FROM public.prova_turmas pt
        WHERE pt.prova_id = p_prova_id
      LOOP
        -- Cria a avaliação de nota no diário deste professor para esta turma
        INSERT INTO public.avaliacoes (
          professor_id,
          turma_id,
          disciplina_id,
          bimestre_id,
          nome,
          valor_maximo,
          data_avaliacao,
          publicada
        ) VALUES (
          v_cota.professor_id,
          v_turma.turma_id,
          v_cota.disciplina_id,
          v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_cota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prova.valor_total,
          v_prova.data_aplicacao,
          true
        )
        RETURNING id INTO v_nota_id;

        -- Registrar vínculo de rastreamento
        INSERT INTO public.prova_avaliacao_notas (
          prova_id,
          turma_id,
          avaliacao_id
        ) VALUES (
          p_prova_id,
          v_turma.turma_id,
          v_nota_id
        ) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_publicar_avaliacao_area TO authenticated;

-- Corrige as avaliações já publicadas por esse bug: reajusta o valor_maximo pra
-- valor_total da prova de área correspondente, em todos os lançamentos já criados.
UPDATE public.avaliacoes a
SET valor_maximo = p.valor_total
FROM public.prova_avaliacao_notas pan
JOIN public.provas p ON p.id = pan.prova_id
WHERE a.id = pan.avaliacao_id
  AND a.valor_maximo IS DISTINCT FROM p.valor_total;
