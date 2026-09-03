-- ====================================================================================
-- FIX: Avaliações Colaborativas de Área (PCA) — 3 problemas reportados:
--
-- 1) Um professor comum (sem papel de coordenação) conseguia tentar inserir questões na
--    cota de OUTRO professor. A RPC rpc_inserir_questoes_cota_area já rejeitava isso no
--    backend (só libera dono da cota ou quem tem COORDENACAO_AREA/COORDENACAO/GESTAO —
--    e o coordenador de área PODE, de propósito, inserir/editar questões em nome de
--    qualquer professor da área, ver AvaliacoesAreaTab.tsx). O buraco real era só de
--    interface: a tela pessoal do professor ("Minhas Avaliações",
--    MinhasAvaliacoesTab.tsx) listava e mostrava o botão "Inserir Questões" também nos
--    cartões dos COLEGAS, não só no do próprio professor — mesmo sem conseguir salvar,
--    ficava exposto e confuso. Corrige escondendo, nessa tela pessoal, os cartões que
--    não são do próprio professor (usa o novo campo eh_minha_cota abaixo). A tela do
--    coordenador continua mostrando todas as cotas, como deve ser.
--
-- 2) Não havia como o professor pré-visualizar a prova de área sendo montada. A RPC
--    rpc_questoes_avaliacao_preview (add_avaliacao_preview_professor.sql) já libera
--    qualquer PROFESSOR/COORDENACAO/GESTAO — só faltava o botão no front (ver
--    MinhasAvaliacoesTab.tsx).
--
-- 3) Questões de disciplinas diferentes podiam ficar intercaladas na prova final,
--    porque a ordem final dependia da ORDEM DE CHEGADA de cada professor salvando sua
--    parte (quem salva por último fica no fim, mesmo que resalve depois de outro).
--    Corrige adicionando prova_area_cotas.ordem_bloco (posição fixa definida pelo
--    coordenador ao criar a cota) e renumerando prova_questoes.ordem por bloco de
--    disciplina após cada inserção, preservando a ordem de seleção do professor DENTRO
--    do bloco dele.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 0. Nova coluna: posição fixa do bloco da disciplina na prova (definida na criação).
-- ------------------------------------------------------------------------------------
ALTER TABLE public.prova_area_cotas
  ADD COLUMN IF NOT EXISTS ordem_bloco INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------------------------
-- 1. rpc_criar_avaliacao_area: grava ordem_bloco = posição da cota no array recebido
--    do coordenador (a ordem em que ele montou a lista de professores/disciplinas).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_avaliacao_area(
  p_titulo TEXT,
  p_area_conhecimento TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_cotas JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prova_id UUID;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar avaliação de área.';
  END IF;

  INSERT INTO public.provas (
    titulo, disciplina, disciplina_id, bimestre_id, instrucoes, valor_total, modo, tipo,
    data_aplicacao, prazo_entrega, status, criado_por, eh_prova_area, area_conhecimento, status_colaboracao
  ) VALUES (
    p_titulo, p_area_conhecimento, NULL, p_bimestre_id, p_instrucoes, p_valor_total, p_modo, p_tipo,
    p_data_aplicacao, p_prazo_entrega, 'RASCUNHO', v_usuario_id, true, p_area_conhecimento, 'EM_ELABORACAO'
  )
  RETURNING id INTO v_prova_id;

  IF array_length(p_turma_ids, 1) > 0 THEN
    INSERT INTO public.prova_turmas (prova_id, turma_id)
    SELECT v_prova_id, unnest(p_turma_ids);
  END IF;

  -- ROW_NUMBER() sobre a expansão do jsonb preserva a ordem do array enviado pelo
  -- coordenador — essa é a ordem de blocos usada depois para nunca intercalar disciplinas.
  INSERT INTO public.prova_area_cotas (prova_id, professor_id, disciplina_id, qtd_questoes, qtd_inserida, ordem_bloco)
  SELECT v_prova_id, x.professor_id, x.disciplina_id, x.qtd_questoes, 0, ROW_NUMBER() OVER ()
  FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER);

  RETURN v_prova_id;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 2. rpc_inserir_questoes_cota_area: exige dono da cota (bloqueia disciplina alheia) e
--    renumera prova_questoes.ordem por bloco ao final, na ordem_bloco definida.
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
BEGIN
  -- Identificar professor logado
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;
  IF v_prof_id IS NULL AND NOT (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Professor não encontrado.';
  END IF;

  -- Verificar cota: dono da cota sempre pode; COORDENACAO_AREA/COORDENACAO/GESTAO podem
  -- inserir/editar em nome de qualquer professor da área (uso intencional, ver
  -- AvaliacoesAreaTab.tsx) mesmo quando também têm cadastro de professor. Quem só tem o
  -- papel PROFESSOR (sem essas funções) cai fora dessa condição e só acerta a própria
  -- disciplina — o bloqueio de "professor mexendo na disciplina alheia" é isto aqui, já
  -- valia antes desta correção; o que faltava era só esconder o botão no front (ver
  -- MinhasAvaliacoesTab.tsx) pra não ficar exposto/confuso.
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

-- ------------------------------------------------------------------------------------
-- 3. rpc_listar_avaliacoes_area: expõe eh_minha_cota (pra front esconder o card/botão
--    "Inserir Questões" de colegas) e ordena as cotas pelo bloco definido na criação.
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

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area TO authenticated;
