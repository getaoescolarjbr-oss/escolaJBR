-- ====================================================================================
-- Avaliações Colaborativas de Área (PCA) — permitir editar o que já foi enviado e dar
-- ao coordenador um jeito de travar a edição (manual e/ou por prazo).
--
-- 1) Professor (dono da cota) e coordenador de área agora conseguem ver e editar as
--    questões JÁ inseridas de uma disciplina, não só inserir do zero — nova RPC
--    rpc_obter_questoes_cota_area, usada pelo InserirQuestoesAreaModal.tsx pra
--    pré-carregar a seleção com o que já está salvo.
-- 2) provas ganha duas colunas novas: edicao_bloqueada (trava manual) e
--    prazo_edicao_area (trava automática por data/hora). rpc_inserir_questoes_cota_area
--    passa a recusar gravação pra QUALQUER chamador (inclusive coordenador) enquanto
--    a avaliação estiver travada — evita divergência com o que já foi impresso.
-- 3) Nova RPC rpc_definir_bloqueio_avaliacao_area, só para COORDENACAO_AREA/
--    COORDENACAO/GESTAO, liga/desliga a trava manual e define/limpa o prazo.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 0. Novas colunas de trava de edição.
-- ------------------------------------------------------------------------------------
ALTER TABLE public.provas
  ADD COLUMN IF NOT EXISTS edicao_bloqueada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_edicao_area TIMESTAMPTZ;

-- ------------------------------------------------------------------------------------
-- 1. rpc_obter_questoes_cota_area: devolve o que o professor (ou coordenador, por ele)
--    já gravou para uma disciplina desta prova, pra pré-carregar o modal de edição.
--    Mesma regra de permissão de rpc_inserir_questoes_cota_area.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_obter_questoes_cota_area(p_prova_id UUID, p_disciplina_id UUID)
RETURNS TABLE (question_id UUID, ordem INTEGER, valor NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prof_id UUID;
  v_disciplina_nome TEXT;
BEGIN
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.prova_area_cotas pac
    WHERE pac.prova_id = p_prova_id
      AND pac.disciplina_id = p_disciplina_id
      AND (
        pac.professor_id = v_prof_id
        OR public.usuario_tem_papel('COORDENACAO_AREA')
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('GESTAO')
      )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver estas questões.';
  END IF;

  SELECT nome INTO v_disciplina_nome FROM public.disciplinas WHERE id = p_disciplina_id;

  RETURN QUERY
  SELECT pq.question_id, pq.ordem, pq.valor
  FROM public.prova_questoes pq
  JOIN public.questions q ON q.id = pq.question_id
  WHERE pq.prova_id = p_prova_id
    AND q.discipline = v_disciplina_nome
  ORDER BY pq.ordem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_obter_questoes_cota_area TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. rpc_definir_bloqueio_avaliacao_area: coordenador liga/desliga a trava manual e
--    define (ou limpa, passando NULL) o prazo automático.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_definir_bloqueio_avaliacao_area(
  p_prova_id UUID,
  p_edicao_bloqueada BOOLEAN,
  p_prazo_edicao_area TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para travar/destravar a edição desta avaliação.';
  END IF;

  UPDATE public.provas
  SET edicao_bloqueada = p_edicao_bloqueada,
      prazo_edicao_area = p_prazo_edicao_area
  WHERE id = p_prova_id
    AND eh_prova_area = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação de área não encontrada.';
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_bloqueio_avaliacao_area TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. rpc_inserir_questoes_cota_area: recusa gravação pra QUALQUER chamador (professor
--    OU coordenador) enquanto a avaliação estiver travada (manual ou por prazo vencido).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_inserir_questoes_cota_area(
  p_prova_id UUID,
  p_disciplina_id UUID,
  p_questoes JSONB -- array de { question_id: uuid, valor: numeric }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prof_id UUID;
  v_cota RECORD;
  v_q RECORD;
  v_total_questoes INTEGER;
  v_ordem_base INTEGER := 0;
  v_disciplina_nome TEXT;
  v_prova RECORD;
BEGIN
  SELECT edicao_bloqueada, prazo_edicao_area INTO v_prova
  FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  IF v_prova.edicao_bloqueada OR (v_prova.prazo_edicao_area IS NOT NULL AND now() > v_prova.prazo_edicao_area) THEN
    RAISE EXCEPTION 'A edição de questões desta avaliação está bloqueada pelo coordenador.';
  END IF;

  -- Identificar professor logado
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;
  IF v_prof_id IS NULL AND NOT (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Professor não encontrado.';
  END IF;

  -- Verificar cota: dono da cota sempre pode; COORDENACAO_AREA/COORDENACAO/GESTAO podem
  -- inserir/editar em nome de qualquer professor da área (uso intencional, ver
  -- AvaliacoesAreaTab.tsx) mesmo quando também têm cadastro de professor.
  SELECT * INTO v_cota FROM public.prova_area_cotas
  WHERE prova_id = p_prova_id
    AND (
      professor_id = v_prof_id
      OR public.usuario_tem_papel('COORDENACAO_AREA')
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('GESTAO')
    )
    AND (disciplina_id = p_disciplina_id OR p_disciplina_id IS NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma cota de questões encontrada para este professor nesta avaliação.';
  END IF;

  v_total_questoes := jsonb_array_length(p_questoes);

  SELECT nome INTO v_disciplina_nome FROM public.disciplinas WHERE id = p_disciplina_id;

  -- Remover questões antigas deste professor/disciplina vinculadas à prova
  -- (recalcula ordenação). public.questions só tem a coluna discipline (texto).
  DELETE FROM public.prova_questoes pq
  WHERE pq.prova_id = p_prova_id
    AND pq.question_id IN (
      SELECT q.id FROM public.questions q WHERE q.discipline = v_disciplina_nome
    );

  -- Obter próxima ordem (provisória — renumerada por bloco logo abaixo)
  SELECT COALESCE(MAX(ordem), 0) INTO v_ordem_base FROM public.prova_questoes WHERE prova_id = p_prova_id;

  FOR v_q IN SELECT * FROM jsonb_to_recordset(p_questoes) AS x(question_id UUID, valor NUMERIC)
  LOOP
    v_ordem_base := v_ordem_base + 1;
    INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor)
    VALUES (p_prova_id, v_q.question_id, v_ordem_base, COALESCE(v_q.valor, 1.0));
  END LOOP;

  -- Renumera TODA a prova por bloco de disciplina, na ordem_bloco definida pelo
  -- coordenador na criação, preservando a ordem de seleção do professor dentro do
  -- próprio bloco — garante que as questões de cada disciplina saem em sequência,
  -- nunca intercaladas, não importa a ordem em que cada professor salvou.
  WITH bloco AS (
    SELECT
      pq.id AS pq_id,
      COALESCE(pac.ordem_bloco, 999999) AS bloco_ordem,
      pq.ordem AS ordem_original
    FROM public.prova_questoes pq
    JOIN public.questions q ON q.id = pq.question_id
    LEFT JOIN public.disciplinas d ON d.nome = q.discipline
    LEFT JOIN public.prova_area_cotas pac ON pac.prova_id = pq.prova_id AND pac.disciplina_id = d.id
    WHERE pq.prova_id = p_prova_id
  ),
  numerado AS (
    SELECT pq_id, ROW_NUMBER() OVER (ORDER BY bloco_ordem, ordem_original) AS nova_ordem
    FROM bloco
  )
  UPDATE public.prova_questoes pq
  SET ordem = numerado.nova_ordem
  FROM numerado
  WHERE pq.id = numerado.pq_id;

  -- Atualizar quantidade inserida na cota
  UPDATE public.prova_area_cotas
  SET qtd_inserida = v_total_questoes,
      atualizado_em = now()
  WHERE id = v_cota.id;

  RETURN jsonb_build_object('sucesso', true, 'qtd_inserida', v_total_questoes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_area TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. rpc_listar_avaliacoes_area: expõe o estado de trava (edicao_bloqueada,
--    prazo_edicao_area, edicao_permitida já calculado) pro front desabilitar os botões.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_listar_avaliacoes_area(p_area_conhecimento TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prof_id UUID;
  v_eh_staff BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;

  v_eh_staff := public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO');

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'titulo', p.titulo,
      'area_conhecimento', p.area_conhecimento,
      'bimestre_id', p.bimestre_id,
      'valor_total', p.valor_total,
      'modo', p.modo,
      'tipo', p.tipo,
      'status', p.status,
      'status_colaboracao', p.status_colaboracao,
      'data_aplicacao', p.data_aplicacao,
      'prazo_entrega', p.prazo_entrega,
      'instrucoes', p.instrucoes,
      'created_at', p.created_at,
      'total_questoes', (SELECT count(*) FROM public.prova_questoes pq WHERE pq.prova_id = p.id),
      'edicao_bloqueada', p.edicao_bloqueada,
      'prazo_edicao_area', p.prazo_edicao_area,
      'edicao_permitida', NOT (p.edicao_bloqueada OR (p.prazo_edicao_area IS NOT NULL AND now() > p.prazo_edicao_area)),
      'turma_nomes', (
        SELECT jsonb_agg(t.nome)
        FROM public.prova_turmas pt
        JOIN public.turmas t ON t.id = pt.turma_id
        WHERE pt.prova_id = p.id
      ),
      'cotas', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pac.id,
            'professor_id', pac.professor_id,
            'professor_nome', prof.nome,
            'disciplina_id', pac.disciplina_id,
            'disciplina_nome', d.nome,
            'qtd_questoes', pac.qtd_questoes,
            'qtd_inserida', pac.qtd_inserida,
            'eh_minha_cota', (pac.professor_id = v_prof_id)
          ) ORDER BY pac.ordem_bloco
        )
        FROM public.prova_area_cotas pac
        JOIN public.professores prof ON prof.id = pac.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
        WHERE pac.prova_id = p.id
      )
    ) ORDER BY p.created_at DESC
  ) INTO v_result
  FROM public.provas p
  WHERE p.eh_prova_area = true
    AND (p_area_conhecimento IS NULL OR p.area_conhecimento = p_area_conhecimento)
    AND (
      v_eh_staff
      OR EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        WHERE pac.prova_id = p.id
          AND pac.professor_id = v_prof_id
      )
    );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area TO authenticated;
