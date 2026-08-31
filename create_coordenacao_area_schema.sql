-- ====================================================================================
-- COORDENAÇÃO DE ÁREA (PCA) & AVALIAÇÕES COLABORATIVAS POR ÁREA
--
-- PRÉ-REQUISITO: Executar alter_papel_usuario_add_coordenacao_area.sql antes deste.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Extensão da tabela `provas` para suportar Avaliações de Área Colaborativas
-- ------------------------------------------------------------------------------------
ALTER TABLE public.provas
  ADD COLUMN IF NOT EXISTS eh_prova_area BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS area_conhecimento TEXT,
  ADD COLUMN IF NOT EXISTS status_colaboracao TEXT NOT NULL DEFAULT 'EM_ELABORACAO'
    CHECK (status_colaboracao IN ('EM_ELABORACAO', 'PRONTA_PARA_PUBLICAR', 'PUBLICADA'));

-- ------------------------------------------------------------------------------------
-- 2. Tabela `prova_area_cotas` (Cotas de Questões por Professor da Área)
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prova_area_cotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id        UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  professor_id    UUID NOT NULL REFERENCES public.professores(id),
  disciplina_id   UUID REFERENCES public.disciplinas(id),
  qtd_questoes    INTEGER NOT NULL DEFAULT 1,
  qtd_inserida    INTEGER NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prova_area_cota UNIQUE (prova_id, professor_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_prova_area_cotas_prova ON public.prova_area_cotas (prova_id);
CREATE INDEX IF NOT EXISTS idx_prova_area_cotas_prof ON public.prova_area_cotas (professor_id);

ALTER TABLE public.prova_area_cotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prova_area_cotas_select" ON public.prova_area_cotas;
CREATE POLICY "prova_area_cotas_select" ON public.prova_area_cotas
  FOR SELECT TO authenticated
  USING (
    professor_id IN (SELECT id FROM public.professores WHERE user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  );

DROP POLICY IF EXISTS "prova_area_cotas_all_dono_ou_staff" ON public.prova_area_cotas;
CREATE POLICY "prova_area_cotas_all_dono_ou_staff" ON public.prova_area_cotas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.provas p
      WHERE p.id = prova_id
        AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
    )
  );

-- ------------------------------------------------------------------------------------
-- 3. RPC: Criar Avaliação de Área Colaborativa
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
  v_cota RECORD;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar avaliação de área.';
  END IF;

  INSERT INTO public.provas (
    titulo,
    disciplina,
    disciplina_id,
    bimestre_id,
    instrucoes,
    valor_total,
    modo,
    tipo,
    data_aplicacao,
    prazo_entrega,
    status,
    criado_por,
    eh_prova_area,
    area_conhecimento,
    status_colaboracao
  ) VALUES (
    p_titulo,
    p_area_conhecimento,
    NULL,
    p_bimestre_id,
    p_instrucoes,
    p_valor_total,
    p_modo,
    p_tipo,
    p_data_aplicacao,
    p_prazo_entrega,
    'RASCUNHO',
    v_usuario_id,
    true,
    p_area_conhecimento,
    'EM_ELABORACAO'
  )
  RETURNING id INTO v_prova_id;

  -- Vincular turmas
  IF array_length(p_turma_ids, 1) > 0 THEN
    INSERT INTO public.prova_turmas (prova_id, turma_id)
    SELECT v_prova_id, unnest(p_turma_ids);
  END IF;

  -- Inserir cotas por professor
  FOR v_cota IN SELECT * FROM jsonb_to_recordset(p_cotas) AS x(
    professor_id UUID,
    disciplina_id UUID,
    qtd_questoes INTEGER
  )
  LOOP
    INSERT INTO public.prova_area_cotas (
      prova_id,
      professor_id,
      disciplina_id,
      qtd_questoes,
      qtd_inserida
    ) VALUES (
      v_prova_id,
      v_cota.professor_id,
      v_cota.disciplina_id,
      v_cota.qtd_questoes,
      0
    );
  END LOOP;

  RETURN v_prova_id;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 4. RPC: Professor insere suas questões da cota na Avaliação de Área
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
BEGIN
  -- Identificar professor logado
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;
  IF v_prof_id IS NULL AND NOT (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Professor não encontrado.';
  END IF;

  -- Verificar cota
  SELECT * INTO v_cota FROM public.prova_area_cotas
  WHERE prova_id = p_prova_id
    AND (professor_id = v_prof_id OR public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO'))
    AND (disciplina_id = p_disciplina_id OR p_disciplina_id IS NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma cota de questões encontrada para este professor nesta avaliação.';
  END IF;

  v_total_questoes := jsonb_array_length(p_questoes);

  -- Remover questões antigas deste professor/disciplina vinculadas à prova
  -- (recalcula ordenação)
  DELETE FROM public.prova_questoes pq
  WHERE pq.prova_id = p_prova_id
    AND pq.question_id IN (
      SELECT q.id FROM public.questions q WHERE q.discipline_id = p_disciplina_id OR q.discipline = (SELECT nome FROM public.disciplinas WHERE id = p_disciplina_id)
    );

  -- Obter próxima ordem
  SELECT COALESCE(MAX(ordem), 0) INTO v_ordem_base FROM public.prova_questoes WHERE prova_id = p_prova_id;

  -- Inserir novas questões
  FOR v_q IN SELECT * FROM jsonb_to_recordset(p_questoes) AS x(question_id UUID, valor NUMERIC)
  LOOP
    v_ordem_base := v_ordem_base + 1;
    INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor)
    VALUES (p_prova_id, v_q.question_id, v_ordem_base, COALESCE(v_q.valor, 1.0));
  END LOOP;

  -- Atualizar quantidade inserida na cota
  UPDATE public.prova_area_cotas
  SET qtd_inserida = v_total_questoes,
      atualizado_em = now()
  WHERE id = v_cota.id;

  RETURN jsonb_build_object('sucesso', true, 'qtd_inserida', v_total_questoes);
END;
$$;

-- ------------------------------------------------------------------------------------
-- 5. RPC: Publicar Avaliação de Área e Criar Notas para Todos os Professores da Área
-- ------------------------------------------------------------------------------------
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
  v_prof_valor NUMERIC;
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
  -- Se o tipo for AVALIACAO (gera nota), cria o registro em avaliacoes no boletim de cada professor
  IF v_prova.tipo = 'AVALIACAO' AND v_prova.bimestre_id IS NOT NULL THEN
    FOR v_cota IN
      SELECT pac.*, p.nome AS professor_nome, d.nome AS disciplina_nome
      FROM public.prova_area_cotas pac
      JOIN public.professores p ON p.id = pac.professor_id
      LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
      WHERE pac.prova_id = p_prova_id
    LOOP
      -- Calcular o valor total somado das questões inseridas por este professor/disciplina
      SELECT COALESCE(SUM(pq.valor), v_prova.valor_total) INTO v_prof_valor
      FROM public.prova_questoes pq
      JOIN public.questions q ON q.id = pq.question_id
      WHERE pq.prova_id = p_prova_id
        AND (q.discipline_id = v_cota.disciplina_id OR q.discipline = v_cota.disciplina_nome);

      IF v_prof_valor IS NULL OR v_prof_valor = 0 THEN
        v_prof_valor := v_prova.valor_total;
      END IF;

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
          v_prof_valor,
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

-- ------------------------------------------------------------------------------------
-- 6. RPC: Listar Avaliações de Área com Cotas
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_listar_avaliacoes_area(p_area_conhecimento TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
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
            'qtd_inserida', pac.qtd_inserida
          )
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
    AND (p_area_conhecimento IS NULL OR p.area_conhecimento = p_area_conhecimento);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publicar_avaliacao_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area TO authenticated;
