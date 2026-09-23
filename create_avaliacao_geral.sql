-- ====================================================================================
-- AVALIAÇÃO GERAL (simulado multiárea)
--
-- Uma avaliação só (uma linha em `provas`, um gabarito, um cartão-resposta) montada por
-- várias áreas. É uma extensão da Avaliação Colaborativa de Área
-- (create_coordenacao_area_schema.sql): continua com eh_prova_area = true, então
-- impressão, versões, leitura OMR, bloqueio, despublicar e a lista de cotas do professor
-- em "Minhas Avaliações" funcionam sem mudança.
--
-- Fluxo:
--   1. Coordenação geral (ou PCA) cria com rpc_criar_avaliacao_geral: dados da prova,
--      turmas e quantas questões cabem a cada área (opcionalmente já com questões
--      sorteadas por rpc_sortear_questoes).
--   2. Cada PCA configura a sua área com rpc_configurar_area_avaliacao_geral: quem recebe
--      a nota (prova_notas_professores — separado de quem insere questão), as cotas de
--      quem insere questões e, se quiser, questões sorteadas para completar a área.
--   3. Professores inserem pela cota (rpc_inserir_questoes_cota_geral — identifica a
--      cota pelo id, não pela disciplina, porque na geral dois professores da mesma
--      disciplina podem ter cota).
--   4. Quem criou publica (rpc_publicar_avaliacao_area, ramo eh_prova_geral) quando todas
--      as áreas tiverem exatamente a quantidade prevista.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Estrutura
-- ------------------------------------------------------------------------------------
ALTER TABLE public.provas
  ADD COLUMN IF NOT EXISTS eh_prova_geral BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qtd_questoes_total INTEGER;

CREATE TABLE IF NOT EXISTS public.prova_geral_areas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id          UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  area_conhecimento TEXT NOT NULL,
  qtd_questoes      INTEGER NOT NULL CHECK (qtd_questoes >= 1),
  ordem             INTEGER NOT NULL,
  -- true depois que o PCA salvou a configuração da área ao menos uma vez.
  configurada       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_prova_geral_area UNIQUE (prova_id, area_conhecimento)
);
CREATE INDEX IF NOT EXISTS idx_prova_geral_areas_prova ON public.prova_geral_areas (prova_id);

-- Quem recebe o campo de nota no diário. Na avaliação de área comum isso é deduzido das
-- cotas (quem insere questão recebe nota); na geral são escolhas independentes.
CREATE TABLE IF NOT EXISTS public.prova_notas_professores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id          UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  professor_id      UUID NOT NULL REFERENCES public.professores(id),
  disciplina_id     UUID NOT NULL REFERENCES public.disciplinas(id),
  area_conhecimento TEXT NOT NULL,
  CONSTRAINT uq_prova_nota_professor UNIQUE (prova_id, professor_id, disciplina_id, area_conhecimento)
);
CREATE INDEX IF NOT EXISTS idx_prova_notas_professores_prova ON public.prova_notas_professores (prova_id);

ALTER TABLE public.prova_area_cotas ADD COLUMN IF NOT EXISTS area_conhecimento TEXT;

-- cota_id: de qual cota veio a questão (NULL = sorteada pela coordenação).
-- area_conhecimento: em qual bloco de área a questão fica. Só preenchidos na geral.
ALTER TABLE public.prova_questoes
  ADD COLUMN IF NOT EXISTS cota_id UUID REFERENCES public.prova_area_cotas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_conhecimento TEXT;

-- Leitura direta pelas telas; toda escrita passa pelas RPCs SECURITY DEFINER abaixo.
ALTER TABLE public.prova_geral_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_notas_professores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prova_geral_areas_select" ON public.prova_geral_areas;
CREATE POLICY "prova_geral_areas_select" ON public.prova_geral_areas
  FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.professor_tem_cota_area(prova_id)
  );

DROP POLICY IF EXISTS "prova_notas_professores_select" ON public.prova_notas_professores;
CREATE POLICY "prova_notas_professores_select" ON public.prova_notas_professores
  FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR professor_id IN (SELECT id FROM public.professores WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------------------------------
-- 2. Helpers internos (sem GRANT para o cliente)
-- ------------------------------------------------------------------------------------

-- Falha se a avaliação geral não puder mais ter questões/cotas alteradas.
CREATE OR REPLACE FUNCTION public.prova_geral_exigir_editavel(p_prova_id UUID)
RETURNS public.provas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_geral THEN
    RAISE EXCEPTION 'Avaliação geral não encontrada.';
  END IF;
  IF v_prova.status = 'PUBLICADA' THEN
    RAISE EXCEPTION 'A avaliação já foi publicada. Despublique antes de alterar.';
  END IF;
  IF v_prova.edicao_bloqueada OR (v_prova.prazo_edicao_area IS NOT NULL AND now() > v_prova.prazo_edicao_area) THEN
    RAISE EXCEPTION 'A edição desta avaliação está bloqueada.';
  END IF;
  RETURN v_prova;
END;
$$;

-- Renumera a prova inteira em blocos de área (na ordem escolhida na criação) e, dentro
-- da área, primeiro as cotas (pela ordem_bloco) e por último as sorteadas. Depois divide
-- o valor_total igualmente, com a mesma regra de rpc_inserir_questoes_cota_area (última
-- questão fica com o resto do arredondamento; respostas já corrigidas são recalculadas).
CREATE OR REPLACE FUNCTION public.prova_geral_reorganizar(p_prova_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_total NUMERIC;
  v_total INTEGER;
  v_valor_igual NUMERIC;
  v_ultima_question_id UUID;
  v_resposta RECORD;
BEGIN
  WITH ordenado AS (
    SELECT pq.id,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(pga.ordem, 999),
                      CASE WHEN pq.cota_id IS NULL THEN 1 ELSE 0 END,
                      COALESCE(pac.ordem_bloco, 0),
                      pq.ordem,
                      pq.id
           ) AS nova_ordem
    FROM public.prova_questoes pq
    LEFT JOIN public.prova_geral_areas pga
      ON pga.prova_id = pq.prova_id AND pga.area_conhecimento = pq.area_conhecimento
    LEFT JOIN public.prova_area_cotas pac ON pac.id = pq.cota_id
    WHERE pq.prova_id = p_prova_id
  )
  UPDATE public.prova_questoes pq
  SET ordem = o.nova_ordem
  FROM ordenado o
  WHERE o.id = pq.id;

  SELECT valor_total INTO v_valor_total FROM public.provas WHERE id = p_prova_id;
  SELECT count(*) INTO v_total FROM public.prova_questoes WHERE prova_id = p_prova_id;
  IF v_total = 0 OR v_valor_total IS NULL THEN
    RETURN;
  END IF;

  v_valor_igual := round(v_valor_total / v_total, 2);
  UPDATE public.prova_questoes SET valor = v_valor_igual WHERE prova_id = p_prova_id;

  SELECT question_id INTO v_ultima_question_id
  FROM public.prova_questoes WHERE prova_id = p_prova_id
  ORDER BY ordem DESC LIMIT 1;

  UPDATE public.prova_questoes
  SET valor = v_valor_total - (v_valor_igual * (v_total - 1))
  WHERE prova_id = p_prova_id AND question_id = v_ultima_question_id;

  UPDATE public.prova_respostas_itens ri
  SET valor_obtido = CASE WHEN ri.correta AND NOT ri.anulada_manual THEN pq.valor ELSE 0 END
  FROM public.prova_questoes pq
  JOIN public.prova_respostas r ON r.prova_id = pq.prova_id
  WHERE pq.prova_id = p_prova_id
    AND pq.question_id = ri.question_id
    AND ri.resposta_id = r.id
    AND ri.corrigido = true;

  FOR v_resposta IN SELECT id FROM public.prova_respostas WHERE prova_id = p_prova_id
  LOOP
    PERFORM public.recalcular_nota_prova_resposta(v_resposta.id);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.provas WHERE id = p_prova_id AND modo_nota = 'PONDERADA') THEN
    PERFORM public.rpc_recalcular_ponderada(p_prova_id);
  END IF;
END;
$$;

-- Troca as questões sorteadas (cota_id NULL) de uma área pela lista recebida.
CREATE OR REPLACE FUNCTION public.prova_geral_gravar_sorteadas(p_prova_id UUID, p_area TEXT, p_question_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_repetida UUID;
BEGIN
  DELETE FROM public.prova_questoes
  WHERE prova_id = p_prova_id AND area_conhecimento = p_area AND cota_id IS NULL;

  IF COALESCE(array_length(p_question_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  SELECT pq.question_id INTO v_repetida
  FROM public.prova_questoes pq
  WHERE pq.prova_id = p_prova_id AND pq.question_id = ANY(p_question_ids)
  LIMIT 1;
  IF v_repetida IS NOT NULL THEN
    RAISE EXCEPTION 'Uma das questões sorteadas já está em outra parte da prova. Sorteie de novo.';
  END IF;

  INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor, area_conhecimento, cota_id)
  SELECT p_prova_id, u.qid, 100000 + u.pos, 1.0, p_area, NULL
  FROM unnest(p_question_ids) WITH ORDINALITY AS u(qid, pos);
END;
$$;

REVOKE ALL ON FUNCTION public.prova_geral_exigir_editavel(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prova_geral_reorganizar(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prova_geral_gravar_sorteadas(UUID, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------------
-- 3. Sorteio de questões do banco (só objetivas — o simulado público e o cartão OMR só
--    leem letra). Só p_qtd é obrigatório; filtro NULL/vazio não restringe.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_sortear_questoes(
  p_qtd INTEGER,
  p_disciplinas TEXT[] DEFAULT NULL,
  p_assunto TEXT DEFAULT NULL,
  p_topico TEXT DEFAULT NULL,
  p_banca TEXT DEFAULT NULL,
  p_excluir UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS SETOF UUID
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT q.id
  FROM public.questions q
  WHERE q.active = true
    AND q.tipo = 'OBJETIVA'
    AND (COALESCE(array_length(p_disciplinas, 1), 0) = 0 OR q.discipline = ANY(p_disciplinas))
    AND (NULLIF(p_assunto, '') IS NULL OR q.assunto = p_assunto)
    AND (NULLIF(p_topico, '') IS NULL OR q.topico = p_topico)
    AND (NULLIF(p_banca, '') IS NULL OR q.banca = p_banca)
    AND NOT (q.id = ANY(COALESCE(p_excluir, ARRAY[]::UUID[])))
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_qtd, 0), 0), 200);
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sortear_questoes(INTEGER, TEXT[], TEXT, TEXT, TEXT, UUID[]) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Criar avaliação geral
--    p_areas: [{ "area": "Matemática", "qtd_questoes": 10, "questoes": [uuid, ...] }, ...]
--    na ordem em que os blocos devem aparecer na prova. "questoes" é opcional (sorteio
--    já feito na criação) e não pode passar de qtd_questoes.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_avaliacao_geral(
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_lancar_no_boletim BOOLEAN,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_areas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false,
  p_cartao_posicao TEXT DEFAULT 'FIM'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id UUID;
  v_area RECORD;
  v_total INTEGER;
  v_ids UUID[];
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar avaliação geral.';
  END IF;

  IF COALESCE(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;
  IF COALESCE(array_length(p_turma_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma turma.';
  END IF;
  IF jsonb_typeof(p_areas) <> 'array' OR jsonb_array_length(p_areas) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma área participante.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_areas) a
    WHERE a ->> 'area' NOT IN ('Ciências da Natureza', 'Ciências Humanas', 'Matemática', 'Linguagens')
       OR COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 1
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e ter pelo menos 1 questão.';
  END IF;

  SELECT SUM((a ->> 'qtd_questoes')::INTEGER) INTO v_total FROM jsonb_array_elements(p_areas) a;

  INSERT INTO public.provas (
    titulo, disciplina, disciplina_id, bimestre_id, instrucoes, valor_total, modo, tipo,
    data_aplicacao, prazo_entrega, status, criado_por, eh_prova_area, area_conhecimento,
    status_colaboracao, embaralhar, qtd_versoes, cartao_separado, cartao_posicao,
    lancar_no_boletim, eh_prova_geral, qtd_questoes_total
  ) VALUES (
    trim(p_titulo), 'Avaliação Geral', NULL, p_bimestre_id, p_instrucoes, p_valor_total, p_modo, p_tipo,
    p_data_aplicacao, p_prazo_entrega, 'RASCUNHO', auth.uid(), true, 'Geral',
    'EM_ELABORACAO', COALESCE(p_embaralhar, 'NENHUM'), GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    COALESCE(p_cartao_separado, false),
    CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    COALESCE(p_lancar_no_boletim, true), true, v_total
  )
  RETURNING id INTO v_prova_id;

  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT v_prova_id, unnest(p_turma_ids);

  FOR v_area IN
    SELECT a.value AS item, a.ordinality AS ordem
    FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  LOOP
    INSERT INTO public.prova_geral_areas (prova_id, area_conhecimento, qtd_questoes, ordem)
    VALUES (v_prova_id, v_area.item ->> 'area', (v_area.item ->> 'qtd_questoes')::INTEGER, v_area.ordem);

    SELECT COALESCE(array_agg(x::UUID), ARRAY[]::UUID[]) INTO v_ids
    FROM jsonb_array_elements_text(COALESCE(v_area.item -> 'questoes', '[]'::jsonb)) x;

    IF array_length(v_ids, 1) > (v_area.item ->> 'qtd_questoes')::INTEGER THEN
      RAISE EXCEPTION 'A área % tem mais questões sorteadas do que o previsto.', v_area.item ->> 'area';
    END IF;

    PERFORM public.prova_geral_gravar_sorteadas(v_prova_id, v_area.item ->> 'area', v_ids);
  END LOOP;

  PERFORM public.prova_geral_reorganizar(v_prova_id);
  RETURN v_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_geral(TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 5. PCA configura a sua área
--    p_notas: [{ professor_id, disciplina_id }]              — quem recebe a nota
--    p_cotas: [{ professor_id, disciplina_id, qtd_questoes }] — quem insere questões
--    p_questoes_sorteadas: NULL mantém as sorteadas atuais; array (mesmo vazio) substitui.
--    Soma das cotas + sorteadas não pode passar da quantidade da área.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_configurar_area_avaliacao_geral(
  p_prova_id UUID,
  p_area TEXT,
  p_notas JSONB DEFAULT '[]'::jsonb,
  p_cotas JSONB DEFAULT '[]'::jsonb,
  p_questoes_sorteadas UUID[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qtd_area INTEGER;
  v_soma_cotas INTEGER;
  v_qtd_sorteadas INTEGER;
  v_conflito TEXT;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para configurar a área.';
  END IF;

  PERFORM public.prova_geral_exigir_editavel(p_prova_id);

  SELECT qtd_questoes INTO v_qtd_area
  FROM public.prova_geral_areas
  WHERE prova_id = p_prova_id AND area_conhecimento = p_area;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A área % não participa desta avaliação.', p_area;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
    WHERE x.professor_id IS NULL OR x.disciplina_id IS NULL OR COALESCE(x.qtd_questoes, 0) < 1
  ) THEN
    RAISE EXCEPTION 'Cada professor que insere questões precisa de disciplina e de pelo menos 1 questão.';
  END IF;

  SELECT COALESCE(SUM(x.qtd_questoes), 0) INTO v_soma_cotas
  FROM jsonb_to_recordset(p_cotas) AS x(qtd_questoes INTEGER);

  IF p_questoes_sorteadas IS NULL THEN
    SELECT count(*) INTO v_qtd_sorteadas FROM public.prova_questoes
    WHERE prova_id = p_prova_id AND area_conhecimento = p_area AND cota_id IS NULL;
  ELSE
    v_qtd_sorteadas := COALESCE(array_length(p_questoes_sorteadas, 1), 0);
  END IF;

  IF v_soma_cotas + v_qtd_sorteadas > v_qtd_area THEN
    RAISE EXCEPTION 'A área % tem % questão(ões), mas a distribuição soma % (cotas) + % (sorteadas).',
      p_area, v_qtd_area, v_soma_cotas, v_qtd_sorteadas;
  END IF;

  -- Professor com questão já inserida não pode sair nem ficar com cota menor que o inserido.
  SELECT prof.nome INTO v_conflito
  FROM public.prova_area_cotas pac
  JOIN public.professores prof ON prof.id = pac.professor_id
  LEFT JOIN jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
    ON x.professor_id = pac.professor_id AND x.disciplina_id = pac.disciplina_id
  WHERE pac.prova_id = p_prova_id
    AND pac.area_conhecimento = p_area
    AND pac.qtd_inserida > 0
    AND (x.professor_id IS NULL OR x.qtd_questoes < pac.qtd_inserida)
  LIMIT 1;
  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION '% já inseriu questões — não pode ser removido(a) nem ter a cota reduzida abaixo do que já inseriu.', v_conflito;
  END IF;

  -- A mesma dupla professor+disciplina só pode ter cota em uma área da prova.
  SELECT prof.nome INTO v_conflito
  FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID)
  JOIN public.prova_area_cotas pac
    ON pac.prova_id = p_prova_id AND pac.professor_id = x.professor_id AND pac.disciplina_id = x.disciplina_id
  JOIN public.professores prof ON prof.id = pac.professor_id
  WHERE pac.area_conhecimento IS DISTINCT FROM p_area
  LIMIT 1;
  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION '% já tem cota nesta disciplina por outra área desta avaliação.', v_conflito;
  END IF;

  DELETE FROM public.prova_area_cotas pac
  WHERE pac.prova_id = p_prova_id
    AND pac.area_conhecimento = p_area
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID)
      WHERE x.professor_id = pac.professor_id AND x.disciplina_id = pac.disciplina_id
    );

  INSERT INTO public.prova_area_cotas (prova_id, professor_id, disciplina_id, qtd_questoes, qtd_inserida, ordem_bloco, area_conhecimento)
  SELECT p_prova_id, x.professor_id, x.disciplina_id, x.qtd_questoes, 0, x.ordem, p_area
  FROM ROWS FROM (jsonb_to_recordset(p_cotas) AS (professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER))
       WITH ORDINALITY AS x(professor_id, disciplina_id, qtd_questoes, ordem)
  ON CONFLICT (prova_id, professor_id, disciplina_id)
  DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, ordem_bloco = EXCLUDED.ordem_bloco, atualizado_em = now();

  DELETE FROM public.prova_notas_professores WHERE prova_id = p_prova_id AND area_conhecimento = p_area;
  INSERT INTO public.prova_notas_professores (prova_id, professor_id, disciplina_id, area_conhecimento)
  SELECT DISTINCT p_prova_id, x.professor_id, x.disciplina_id, p_area
  FROM jsonb_to_recordset(p_notas) AS x(professor_id UUID, disciplina_id UUID)
  WHERE x.professor_id IS NOT NULL AND x.disciplina_id IS NOT NULL;

  IF p_questoes_sorteadas IS NOT NULL THEN
    PERFORM public.prova_geral_gravar_sorteadas(p_prova_id, p_area, p_questoes_sorteadas);
  END IF;

  UPDATE public.prova_geral_areas SET configurada = true
  WHERE prova_id = p_prova_id AND area_conhecimento = p_area;

  PERFORM public.prova_geral_reorganizar(p_prova_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_configurar_area_avaliacao_geral(UUID, TEXT, JSONB, JSONB, UUID[]) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 6. Professor (ou coordenação em nome dele) insere/obtém as questões de uma cota
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_inserir_questoes_cota_geral(p_cota_id UUID, p_questoes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cota public.prova_area_cotas;
  v_prof_id UUID;
  v_total INTEGER;
  v_repetida UUID;
BEGIN
  SELECT * INTO v_cota FROM public.prova_area_cotas WHERE id = p_cota_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cota não encontrada.';
  END IF;

  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = auth.uid();
  IF NOT (
    v_cota.professor_id = v_prof_id
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para inserir questões nesta cota.';
  END IF;

  PERFORM public.prova_geral_exigir_editavel(v_cota.prova_id);

  v_total := jsonb_array_length(p_questoes);
  IF v_total > v_cota.qtd_questoes THEN
    RAISE EXCEPTION 'A cota é de % questão(ões).', v_cota.qtd_questoes;
  END IF;

  SELECT pq.question_id INTO v_repetida
  FROM public.prova_questoes pq
  JOIN jsonb_to_recordset(p_questoes) AS x(question_id UUID) ON x.question_id = pq.question_id
  WHERE pq.prova_id = v_cota.prova_id
    AND pq.cota_id IS DISTINCT FROM p_cota_id
  LIMIT 1;
  IF v_repetida IS NOT NULL THEN
    RAISE EXCEPTION 'Uma das questões escolhidas já foi inserida por outro professor nesta avaliação.';
  END IF;

  DELETE FROM public.prova_questoes WHERE prova_id = v_cota.prova_id AND cota_id = p_cota_id;

  INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor, cota_id, area_conhecimento)
  SELECT v_cota.prova_id, x.question_id, 100000 + x.pos, 1.0, p_cota_id, v_cota.area_conhecimento
  FROM ROWS FROM (jsonb_to_recordset(p_questoes) AS (question_id UUID))
       WITH ORDINALITY AS x(question_id, pos);

  UPDATE public.prova_area_cotas
  SET qtd_inserida = v_total, atualizado_em = now()
  WHERE id = p_cota_id;

  PERFORM public.prova_geral_reorganizar(v_cota.prova_id);

  RETURN jsonb_build_object('sucesso', true, 'qtd_inserida', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_obter_questoes_cota_geral(p_cota_id UUID)
RETURNS TABLE(question_id UUID, ordem INTEGER, valor NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cota public.prova_area_cotas;
  v_prof_id UUID;
BEGIN
  SELECT * INTO v_cota FROM public.prova_area_cotas WHERE id = p_cota_id;
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = auth.uid();
  IF v_cota.id IS NULL OR NOT (
    v_cota.professor_id = v_prof_id
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver estas questões.';
  END IF;

  RETURN QUERY
  SELECT pq.question_id, pq.ordem, pq.valor
  FROM public.prova_questoes pq
  WHERE pq.prova_id = v_cota.prova_id AND pq.cota_id = p_cota_id
  ORDER BY pq.ordem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_geral(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_obter_questoes_cota_geral(UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 7. Publicar: ramo novo para a geral. O ramo da avaliação de área comum é o mesmo da
--    versão atual (fix_rpc_publicar_avaliacao_area_valor_dividido.sql), sem mudança.
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
  v_nota RECORD;
  v_nota_id UUID;
  v_pendentes TEXT;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  -- ---------------- Avaliação geral ----------------
  IF v_prova.eh_prova_geral THEN
    IF NOT (v_prova.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO')) THEN
      RAISE EXCEPTION 'Somente quem criou a avaliação geral pode publicá-la.';
    END IF;

    SELECT string_agg(pga.area_conhecimento || ' (' || COALESCE(q.qtd, 0) || '/' || pga.qtd_questoes || ')', ', ' ORDER BY pga.ordem)
    INTO v_pendentes
    FROM public.prova_geral_areas pga
    LEFT JOIN (
      SELECT area_conhecimento, count(*) AS qtd
      FROM public.prova_questoes WHERE prova_id = p_prova_id
      GROUP BY area_conhecimento
    ) q ON q.area_conhecimento = pga.area_conhecimento
    WHERE pga.prova_id = p_prova_id
      AND COALESCE(q.qtd, 0) <> pga.qtd_questoes;

    IF v_pendentes IS NOT NULL THEN
      RAISE EXCEPTION 'Ainda há áreas sem a quantidade prevista de questões: %.', v_pendentes;
    END IF;

    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA'
       AND NOT EXISTS (SELECT 1 FROM public.prova_notas_professores WHERE prova_id = p_prova_id) THEN
      RAISE EXCEPTION 'Nenhum professor foi selecionado para receber a nota. Cada PCA escolhe isso ao configurar a sua área.';
    END IF;

    UPDATE public.provas
    SET status = 'PUBLICADA', status_colaboracao = 'PUBLICADA'
    WHERE id = p_prova_id;

    -- Campo de nota só nas turmas em que o professor dá aquela disciplina.
    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA' AND v_prova.bimestre_id IS NOT NULL THEN
      FOR v_nota IN
        SELECT DISTINCT pnp.professor_id, pnp.disciplina_id, d.nome AS disciplina_nome, pt.turma_id
        FROM public.prova_notas_professores pnp
        JOIN public.prova_turmas pt ON pt.prova_id = pnp.prova_id
        JOIN public.alocacoes_v2 al
          ON al.professor_id = pnp.professor_id
         AND al.disciplina_id = pnp.disciplina_id
         AND al.turma_id = pt.turma_id
        LEFT JOIN public.disciplinas d ON d.id = pnp.disciplina_id
        WHERE pnp.prova_id = p_prova_id
      LOOP
        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
        ) VALUES (
          v_nota.professor_id, v_nota.turma_id, v_nota.disciplina_id, v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_nota.disciplina_nome, 'Geral') || ')',
          v_prova.valor_total, v_prova.data_aplicacao, true
        )
        RETURNING id INTO v_nota_id;

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_nota.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
  END IF;

  -- ---------------- Avaliação de área (sem mudança) ----------------
  IF NOT (
    v_prova.criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para publicar esta avaliação de área.';
  END IF;

  UPDATE public.provas
  SET status = 'PUBLICADA',
      status_colaboracao = 'PUBLICADA'
  WHERE id = p_prova_id;

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
        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
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

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_turma.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_publicar_avaliacao_area(UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 8. Professor que só recebe a nota (sem cota) também precisa ver resultados e lançar
--    as notas no boletim (rpc_lancar_notas_boletim usa pode_corrigir_prova).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_corrigir_prova(p_prova_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.pode_gerir_prova(p_prova_id)
    OR EXISTS (
      SELECT 1
      FROM provas p
      JOIN prova_area_cotas pac ON pac.prova_id = p.id
      JOIN professores prof ON prof.id = pac.professor_id
      WHERE p.id = p_prova_id
        AND p.eh_prova_area = true
        AND prof.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM prova_notas_professores pnp
      JOIN professores prof ON prof.id = pnp.professor_id
      WHERE pnp.prova_id = p_prova_id
        AND prof.user_id = auth.uid()
    );
$$;

-- ------------------------------------------------------------------------------------
-- 9. Listagem: mesmos campos de antes + os da geral. Com p_area_conhecimento, traz as
--    avaliações daquela área E as gerais de que a área participa.
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
      'embaralhar', p.embaralhar,
      'qtd_versoes', p.qtd_versoes,
      'cartao_separado', p.cartao_separado,
      'cartao_posicao', p.cartao_posicao,
      'total_questoes', (SELECT count(*) FROM public.prova_questoes pq WHERE pq.prova_id = p.id),
      'edicao_bloqueada', p.edicao_bloqueada,
      'prazo_edicao_area', p.prazo_edicao_area,
      'edicao_permitida', NOT (p.edicao_bloqueada OR (p.prazo_edicao_area IS NOT NULL AND now() > p.prazo_edicao_area)),
      'eh_prova_geral', p.eh_prova_geral,
      'qtd_questoes_total', p.qtd_questoes_total,
      'lancar_no_boletim', p.lancar_no_boletim,
      'token_publico', p.token_publico,
      'criado_por_mim', (p.criado_por = v_usuario_id),
      'turma_ids', (SELECT jsonb_agg(pt.turma_id) FROM public.prova_turmas pt WHERE pt.prova_id = p.id),
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
            'area_conhecimento', pac.area_conhecimento,
            'eh_minha_cota', (pac.professor_id = v_prof_id)
          ) ORDER BY pac.ordem_bloco
        )
        FROM public.prova_area_cotas pac
        JOIN public.professores prof ON prof.id = pac.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
        WHERE pac.prova_id = p.id
      ),
      'areas', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'area_conhecimento', pga.area_conhecimento,
            'qtd_questoes', pga.qtd_questoes,
            'ordem', pga.ordem,
            'configurada', pga.configurada,
            'qtd_inserida', (
              SELECT count(*) FROM public.prova_questoes pq
              WHERE pq.prova_id = p.id AND pq.area_conhecimento = pga.area_conhecimento
            ),
            'questoes_sorteadas', (
              SELECT COALESCE(jsonb_agg(pq.question_id ORDER BY pq.ordem), '[]'::jsonb)
              FROM public.prova_questoes pq
              WHERE pq.prova_id = p.id AND pq.area_conhecimento = pga.area_conhecimento AND pq.cota_id IS NULL
            )
          ) ORDER BY pga.ordem
        )
        FROM public.prova_geral_areas pga
        WHERE pga.prova_id = p.id
      ),
      'notas_professores', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'professor_id', pnp.professor_id,
            'professor_nome', prof.nome,
            'disciplina_id', pnp.disciplina_id,
            'disciplina_nome', d.nome,
            'area_conhecimento', pnp.area_conhecimento
          ) ORDER BY prof.nome
        )
        FROM public.prova_notas_professores pnp
        JOIN public.professores prof ON prof.id = pnp.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pnp.disciplina_id
        WHERE pnp.prova_id = p.id
      )
    ) ORDER BY p.created_at DESC
  ) INTO v_result
  FROM public.provas p
  WHERE p.eh_prova_area = true
    AND (
      p_area_conhecimento IS NULL
      OR p.area_conhecimento = p_area_conhecimento
      OR (p.eh_prova_geral AND EXISTS (
        SELECT 1 FROM public.prova_geral_areas pga
        WHERE pga.prova_id = p.id AND pga.area_conhecimento = p_area_conhecimento
      ))
    )
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

GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 10. Editar os dados da avaliação geral (só antes de publicar). Mesmos campos da criação.
--     p_areas: [{ "area", "qtd_questoes" }] na nova ordem dos blocos.
--     - área nova entra sem questões (o PCA configura);
--     - área retirada só se ainda não tiver nenhuma questão;
--     - quantidade não pode ficar abaixo do que já foi distribuído (cotas + sorteadas).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_editar_avaliacao_geral(
  p_prova_id UUID,
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_lancar_no_boletim BOOLEAN,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_areas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false,
  p_cartao_posicao TEXT DEFAULT 'FIM'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_problema TEXT;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_geral THEN
    RAISE EXCEPTION 'Avaliação geral não encontrada.';
  END IF;
  IF NOT (v_prova.criado_por = auth.uid() OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Somente quem criou a avaliação geral (ou a coordenação/gestão) pode editá-la.';
  END IF;
  IF v_prova.status = 'PUBLICADA' THEN
    RAISE EXCEPTION 'Avaliação já publicada não pode ser editada. Despublique antes.';
  END IF;

  IF COALESCE(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;
  IF COALESCE(array_length(p_turma_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma turma.';
  END IF;
  IF jsonb_typeof(p_areas) <> 'array' OR jsonb_array_length(p_areas) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma área participante.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_areas) a
    WHERE a ->> 'area' NOT IN ('Ciências da Natureza', 'Ciências Humanas', 'Matemática', 'Linguagens')
       OR COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 1
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e ter pelo menos 1 questão.';
  END IF;

  -- Área retirada que já tem questão.
  SELECT string_agg(pga.area_conhecimento, ', ') INTO v_problema
  FROM public.prova_geral_areas pga
  WHERE pga.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pga.area_conhecimento)
    AND EXISTS (SELECT 1 FROM public.prova_questoes pq WHERE pq.prova_id = p_prova_id AND pq.area_conhecimento = pga.area_conhecimento);
  IF v_problema IS NOT NULL THEN
    RAISE EXCEPTION 'Não dá para retirar área que já tem questões: %. Remova as questões dela antes.', v_problema;
  END IF;

  -- Quantidade abaixo do já distribuído (cotas + sorteadas).
  SELECT string_agg(x.area || ' (mínimo ' || x.distribuido || ')', ', ') INTO v_problema
  FROM (
    SELECT a ->> 'area' AS area, (a ->> 'qtd_questoes')::INTEGER AS qtd,
      COALESCE((SELECT SUM(pac.qtd_questoes) FROM public.prova_area_cotas pac
                WHERE pac.prova_id = p_prova_id AND pac.area_conhecimento = a ->> 'area'), 0)
      + (SELECT count(*) FROM public.prova_questoes pq
         WHERE pq.prova_id = p_prova_id AND pq.area_conhecimento = a ->> 'area' AND pq.cota_id IS NULL) AS distribuido
    FROM jsonb_array_elements(p_areas) a
  ) x
  WHERE x.qtd < x.distribuido;
  IF v_problema IS NOT NULL THEN
    RAISE EXCEPTION 'A quantidade de questões ficou abaixo do que já foi distribuído: %.', v_problema;
  END IF;

  UPDATE public.provas SET
    titulo = trim(p_titulo),
    bimestre_id = p_bimestre_id,
    valor_total = p_valor_total,
    modo = p_modo,
    tipo = p_tipo,
    lancar_no_boletim = COALESCE(p_lancar_no_boletim, true),
    data_aplicacao = p_data_aplicacao,
    prazo_entrega = p_prazo_entrega,
    instrucoes = p_instrucoes,
    embaralhar = COALESCE(p_embaralhar, 'NENHUM'),
    qtd_versoes = GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    cartao_separado = COALESCE(p_cartao_separado, false),
    cartao_posicao = CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    qtd_questoes_total = (SELECT SUM((a ->> 'qtd_questoes')::INTEGER) FROM jsonb_array_elements(p_areas) a),
    updated_at = now()
  WHERE id = p_prova_id;

  DELETE FROM public.prova_turmas WHERE prova_id = p_prova_id;
  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT p_prova_id, unnest(p_turma_ids);

  -- Áreas retiradas (sem questões): some cota, nota e a própria área.
  DELETE FROM public.prova_area_cotas pac
  WHERE pac.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pac.area_conhecimento);
  DELETE FROM public.prova_notas_professores pnp
  WHERE pnp.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pnp.area_conhecimento);
  DELETE FROM public.prova_geral_areas pga
  WHERE pga.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pga.area_conhecimento);

  INSERT INTO public.prova_geral_areas (prova_id, area_conhecimento, qtd_questoes, ordem)
  SELECT p_prova_id, a.value ->> 'area', (a.value ->> 'qtd_questoes')::INTEGER, a.ordinality
  FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  ON CONFLICT (prova_id, area_conhecimento)
  DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, ordem = EXCLUDED.ordem;

  -- Valor total ou ordem das áreas podem ter mudado: renumera e redistribui o valor.
  PERFORM public.prova_geral_reorganizar(p_prova_id);
  RETURN p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_editar_avaliacao_geral(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT) TO authenticated;
