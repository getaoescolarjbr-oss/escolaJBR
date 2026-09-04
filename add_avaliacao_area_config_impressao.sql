-- Avaliação de área nunca passava embaralhar/qtd_versoes/cartao_separado pro RPC de criar,
-- então toda prova de área nascia com os padrões da coluna (embaralhar='NENHUM',
-- qtd_versoes=1, cartao_separado=false) — por isso só existia "Versão A" e faltavam as
-- opções de embaralhamento/múltiplas versões que existem pra avaliação normal de professor.
-- Também adiciona uma tabela de instruções padrão (texto pré-fixado reaproveitável ao criar
-- uma nova avaliação, em vez de digitar do zero toda vez).
--
-- IMPORTANTE: rpc_criar_avaliacao_area e rpc_listar_avaliacoes_area já tinham sido corrigidas
-- por scripts anteriores (fix_avaliacao_area_ownership_ordem_preview.sql — ordem_bloco pra
-- nunca intercalar disciplinas; fix_avaliacao_area_edicao_bloqueio.sql — edicao_bloqueada/
-- prazo_edicao_area/edicao_permitida/eh_minha_cota e filtro de visibilidade por professor).
-- Este script parte da versão MAIS RECENTE de cada uma e só acrescenta os 3 campos novos —
-- não regride nenhuma dessas correções.

-- ---------------------------------------------------------------------------
-- 1) Instruções padrão reaproveitáveis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes_avaliacoes (
  chave text PRIMARY KEY,
  valor text,
  atualizado_por uuid REFERENCES auth.users(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.configuracoes_avaliacoes TO authenticated;
ALTER TABLE public.configuracoes_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_avaliacoes_select" ON public.configuracoes_avaliacoes;
CREATE POLICY "configuracoes_avaliacoes_select" ON public.configuracoes_avaliacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "configuracoes_avaliacoes_upsert_staff" ON public.configuracoes_avaliacoes;
CREATE POLICY "configuracoes_avaliacoes_upsert_staff" ON public.configuracoes_avaliacoes
  FOR ALL TO authenticated
  USING (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'));

INSERT INTO public.configuracoes_avaliacoes (chave, valor)
VALUES ('instrucoes_padrao', 'Leia atentamente cada questão antes de responder.')
ON CONFLICT (chave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) rpc_criar_avaliacao_area: acrescenta embaralhar/qtd_versoes/cartao_separado,
--    preservando o ROW_NUMBER() OVER () que grava ordem_bloco.
--    DROP explícito: assinatura muda (3 parâmetros novos), senão CREATE OR REPLACE cria uma
--    função sobrecarregada em vez de substituir, e o PostgREST passa a recusar a chamada por
--    ambiguidade entre as duas.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_criar_avaliacao_area(TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB);

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
  p_cotas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false
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
    data_aplicacao, prazo_entrega, status, criado_por, eh_prova_area, area_conhecimento,
    status_colaboracao, embaralhar, qtd_versoes, cartao_separado
  ) VALUES (
    p_titulo, p_area_conhecimento, NULL, p_bimestre_id, p_instrucoes, p_valor_total, p_modo, p_tipo,
    p_data_aplicacao, p_prazo_entrega, 'RASCUNHO', v_usuario_id, true, p_area_conhecimento,
    'EM_ELABORACAO', COALESCE(p_embaralhar, 'NENHUM'), GREATEST(COALESCE(p_qtd_versoes, 1), 1), COALESCE(p_cartao_separado, false)
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

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_area(TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) rpc_editar_avaliacao_area: acrescenta embaralhar/qtd_versoes/cartao_separado e passa
--    a gravar ordem_bloco também (faltava desde que a função foi criada), pro mesmo motivo
--    do item 2 — senão editar uma avaliação zera a ordem dos blocos por disciplina.
--    DROP explícito pelo mesmo motivo do item 2 (assinatura antiga tinha 11 parâmetros).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_editar_avaliacao_area(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB);

CREATE OR REPLACE FUNCTION public.rpc_editar_avaliacao_area(
  p_prova_id UUID,
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_cotas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_status TEXT;
  v_criado_por UUID;
  v_bloqueio RECORD;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para editar avaliação de área.';
  END IF;

  SELECT status, criado_por INTO v_status, v_criado_por
  FROM public.provas WHERE id = p_prova_id AND eh_prova_area = true;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Avaliação de área não encontrada.';
  END IF;
  IF v_status = 'PUBLICADA' THEN
    RAISE EXCEPTION 'Avaliação já publicada não pode mais ser editada.';
  END IF;
  IF NOT (v_criado_por = v_usuario_id OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('COORDENACAO')) THEN
    RAISE EXCEPTION 'Sem permissão para editar esta avaliação de área.';
  END IF;

  SELECT c.professor_id, c.disciplina_id, c.qtd_inserida INTO v_bloqueio
  FROM public.prova_area_cotas c
  WHERE c.prova_id = p_prova_id
    AND c.qtd_inserida > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
      WHERE x.professor_id = c.professor_id
        AND x.disciplina_id IS NOT DISTINCT FROM c.disciplina_id
        AND x.qtd_questoes >= c.qtd_inserida
    )
  LIMIT 1;

  IF v_bloqueio.professor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível remover ou reduzir a cota de um professor que já inseriu % questão(ões). Peça pra ele remover as questões extras antes, ou mantenha a cota com pelo menos essa quantidade.', v_bloqueio.qtd_inserida;
  END IF;

  UPDATE public.provas SET
    titulo = p_titulo,
    bimestre_id = p_bimestre_id,
    valor_total = p_valor_total,
    modo = p_modo,
    tipo = p_tipo,
    data_aplicacao = p_data_aplicacao,
    prazo_entrega = p_prazo_entrega,
    instrucoes = p_instrucoes,
    embaralhar = COALESCE(p_embaralhar, 'NENHUM'),
    qtd_versoes = GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    cartao_separado = COALESCE(p_cartao_separado, false),
    updated_at = now()
  WHERE id = p_prova_id;

  DELETE FROM public.prova_turmas WHERE prova_id = p_prova_id;
  IF array_length(p_turma_ids, 1) > 0 THEN
    INSERT INTO public.prova_turmas (prova_id, turma_id)
    SELECT p_prova_id, unnest(p_turma_ids);
  END IF;

  DELETE FROM public.prova_area_cotas c
  WHERE c.prova_id = p_prova_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
      WHERE x.professor_id = c.professor_id AND x.disciplina_id IS NOT DISTINCT FROM c.disciplina_id
    );

  -- Upsert preservando ordem_bloco = posição no array recebido (mesma regra da criação).
  WITH nova_lista AS (
    SELECT x.professor_id, x.disciplina_id, x.qtd_questoes, ROW_NUMBER() OVER () AS ordem_bloco
    FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
  )
  INSERT INTO public.prova_area_cotas (prova_id, professor_id, disciplina_id, qtd_questoes, qtd_inserida, ordem_bloco)
  SELECT p_prova_id, n.professor_id, n.disciplina_id, n.qtd_questoes, 0, n.ordem_bloco
  FROM nova_lista n
  ON CONFLICT (prova_id, professor_id, disciplina_id)
  DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, ordem_bloco = EXCLUDED.ordem_bloco, atualizado_em = now();

  RETURN p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_editar_avaliacao_area(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) rpc_listar_avaliacoes_area: acrescenta embaralhar/qtd_versoes/cartao_separado à versão
--    mais recente da função (fix_avaliacao_area_edicao_bloqueio.sql — preserva
--    edicao_bloqueada/prazo_edicao_area/edicao_permitida/eh_minha_cota/ordem_bloco e o filtro
--    de visibilidade por professor, senão essas correções anteriores seriam perdidas).
-- ---------------------------------------------------------------------------
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
      'embaralhar', p.embaralhar,
      'qtd_versoes', p.qtd_versoes,
      'cartao_separado', p.cartao_separado,
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
