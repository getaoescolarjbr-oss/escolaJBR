-- ====================================================================================
-- TRAVA POR ÁREA + DISTRIBUIÇÃO DA CORREÇÃO NA AVALIAÇÃO GERAL
--
-- 1. O coordenador de área (PCA) só mexe nas avaliações da própria área (a do seu
--    cadastro em professores.area_conhecimento). Na avaliação geral, só nas que têm a
--    área dele entre as participantes — e configura só a parte da própria área.
--    Coordenação geral (COORDENACAO) e gestão (GESTAO) continuam vendo e alterando tudo.
--    Antes a trava era só na tela (o seletor de área foi escondido para o PCA).
--
-- 2. Avaliação geral tem um "dono": quem criou (ou a coordenação geral/gestão). Só ele
--    publica, despublica, trava a edição, muda impressão/cálculo da nota e define QUAL
--    ÁREA CORRIGE CADA TURMA (prova_correcao_areas). Depois, o PCA de cada área escolhe,
--    entre os professores da área, o corretor das turmas que a área recebeu — sem
--    conseguir apagar ou trocar o corretor escolhido por outra área.
--
-- As funções existentes ganham a trava por um patch (DO no fim): uma linha de
-- verificação logo após o BEGIN, sem reescrever o resto de cada função.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Funções de apoio
-- ------------------------------------------------------------------------------------
-- Mesma regra de src/utils/areasConhecimento.ts (normalizarArea).
CREATE OR REPLACE FUNCTION public.normalizar_area(p_area TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a TEXT := lower(trim(COALESCE(p_area, '')));
BEGIN
  IF a = '' THEN RETURN 'Ciências da Natureza'; END IF;
  IF a LIKE '%natureza%' OR a LIKE '%biolog%' OR a LIKE '%físic%' OR a LIKE '%químic%' THEN RETURN 'Ciências da Natureza'; END IF;
  IF a LIKE '%humana%' OR a LIKE '%histór%' OR a LIKE '%geograf%' OR a LIKE '%filosof%' OR a LIKE '%sociolog%' OR a LIKE '%especial%' THEN RETURN 'Ciências Humanas'; END IF;
  IF a LIKE '%matemát%' OR a LIKE '%matemat%' THEN RETURN 'Matemática'; END IF;
  IF a LIKE '%linguag%' OR a LIKE '%portugu%' OR a LIKE '%ingl%' OR a LIKE '%arte%' OR a LIKE '%educação física%' OR a LIKE '%profissional%' THEN RETURN 'Linguagens'; END IF;
  RETURN 'Ciências da Natureza';
END;
$$;

CREATE OR REPLACE FUNCTION public.area_do_usuario()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalizar_area(area_conhecimento) FROM public.professores WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eh_coordenacao_geral()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO');
$$;

-- PCA "puro" (sem coordenação geral/gestão) — é a ele que a trava por área se aplica.
CREATE OR REPLACE FUNCTION public.eh_pca_restrito()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.usuario_tem_papel('COORDENACAO_AREA')
     AND NOT public.eh_coordenacao_geral();
$$;

-- A avaliação é de outra área para este PCA? (false para quem não é PCA restrito)
CREATE OR REPLACE FUNCTION public.pca_fora_da_area(p_prova_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
BEGIN
  IF NOT public.eh_pca_restrito() OR p_prova_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR v_prova.criado_por = auth.uid() THEN
    RETURN false;
  END IF;
  IF v_prova.eh_prova_geral THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM public.prova_geral_areas pga
      WHERE pga.prova_id = p_prova_id AND pga.area_conhecimento = public.area_do_usuario()
    );
  END IF;
  IF v_prova.eh_prova_area THEN
    RETURN v_prova.area_conhecimento IS DISTINCT FROM public.area_do_usuario();
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.exigir_prova_da_area(p_prova_id UUID)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.pca_fora_da_area(p_prova_id) THEN
    RAISE EXCEPTION 'Esta avaliação é de outra área — só o coordenador dela (ou a coordenação geral) pode alterá-la.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.exigir_area_do_usuario(p_area TEXT)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_area IS NOT NULL AND public.eh_pca_restrito() AND p_area IS DISTINCT FROM public.area_do_usuario() THEN
    RAISE EXCEPTION 'Você coordena %, não %.', public.area_do_usuario(), p_area;
  END IF;
END;
$$;

-- Na avaliação geral, ações de "dono" (publicar, despublicar, travar, impressão, cálculo
-- da nota, distribuir a correção) são de quem criou ou da coordenação geral/gestão.
CREATE OR REPLACE FUNCTION public.eh_dono_da_geral(p_prova_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.eh_coordenacao_geral()
      OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = p_prova_id AND p.criado_por = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.exigir_dono_se_geral(p_prova_id UUID)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.provas p WHERE p.id = p_prova_id AND p.eh_prova_geral)
     AND NOT public.eh_dono_da_geral(p_prova_id) THEN
    RAISE EXCEPTION 'Na avaliação geral, só quem a criou (ou a coordenação geral) pode fazer isso.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.area_do_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_coordenacao_geral() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. Distribuição da correção (avaliação geral): qual área corrige cada turma
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prova_correcao_areas (
  prova_id          UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  turma_id          UUID NOT NULL,
  area_conhecimento TEXT NOT NULL,
  PRIMARY KEY (prova_id, turma_id)
);
ALTER TABLE public.prova_correcao_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prova_correcao_areas_select" ON public.prova_correcao_areas;
CREATE POLICY "prova_correcao_areas_select" ON public.prova_correcao_areas
  FOR SELECT TO authenticated USING (true);

-- p_itens: [{ turma_id, area }] — substitui a distribuição inteira. area nula = turma sem
-- área (só o dono define o corretor dela). Trocar a área de uma turma apaga o corretor
-- que a área anterior tinha escolhido.
CREATE OR REPLACE FUNCTION public.rpc_definir_distribuicao_correcao(p_prova_id UUID, p_itens JSONB)
RETURNS void
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
  IF NOT public.eh_dono_da_geral(p_prova_id) THEN
    RAISE EXCEPTION 'Só quem criou a avaliação geral (ou a coordenação geral) distribui a correção entre as áreas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_itens) AS x(turma_id UUID, area TEXT)
    WHERE x.area IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM public.prova_turmas pt WHERE pt.prova_id = p_prova_id AND pt.turma_id = x.turma_id)
      OR NOT EXISTS (SELECT 1 FROM public.prova_geral_areas pga WHERE pga.prova_id = p_prova_id AND pga.area_conhecimento = x.area)
    )
  ) THEN
    RAISE EXCEPTION 'Turma ou área que não faz parte desta avaliação.';
  END IF;

  DELETE FROM public.prova_correcao_areas WHERE prova_id = p_prova_id;
  INSERT INTO public.prova_correcao_areas (prova_id, turma_id, area_conhecimento)
  SELECT DISTINCT ON (x.turma_id) p_prova_id, x.turma_id, x.area
  FROM jsonb_to_recordset(p_itens) AS x(turma_id UUID, area TEXT)
  WHERE x.turma_id IS NOT NULL AND x.area IS NOT NULL;

  -- Corretor que não é da área que agora corrige a turma deixa de valer.
  DELETE FROM public.prova_corretores pc
  USING public.prova_correcao_areas pca
  WHERE pc.prova_id = p_prova_id AND pca.prova_id = p_prova_id AND pca.turma_id = pc.turma_id
    AND NOT EXISTS (
      SELECT 1 FROM public.prova_notas_professores pnp
      WHERE pnp.prova_id = p_prova_id AND pnp.professor_id = pc.professor_id
        AND pnp.area_conhecimento = pca.area_conhecimento
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_definir_distribuicao_correcao(UUID, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. Corretores: cada um só mexe nas turmas que são suas
--    - avaliação de área: o PCA da área (ou a coordenação geral), todas as turmas;
--    - avaliação geral: o dono, todas as turmas; o PCA, só as turmas que o dono deu à
--      área dele, escolhendo entre os professores da área que recebem a nota.
--    p_corretores: [{ turma_id, professor_id }] — só as turmas que o usuário gerencia são
--    alteradas; as das outras áreas ficam como estão.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_definir_corretores(p_prova_id UUID, p_corretores JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_dono BOOLEAN;
  v_minha_area TEXT := public.area_do_usuario();
  v_invalido TEXT;
  v_minhas UUID[];
BEGIN
  IF NOT public.eh_staff_avaliacao() THEN
    RAISE EXCEPTION 'Só a coordenação pode definir os corretores.';
  END IF;
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_area THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  PERFORM public.exigir_prova_da_area(p_prova_id);
  v_dono := NOT v_prova.eh_prova_geral OR public.eh_dono_da_geral(p_prova_id);

  -- Turmas que este usuário gerencia nesta avaliação.
  v_minhas := ARRAY(
  SELECT pt.turma_id FROM public.prova_turmas pt
  WHERE pt.prova_id = p_prova_id
    AND (v_dono OR EXISTS (
      SELECT 1 FROM public.prova_correcao_areas pca
      WHERE pca.prova_id = p_prova_id AND pca.turma_id = pt.turma_id AND pca.area_conhecimento = v_minha_area
    )));

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
    WHERE x.professor_id IS NOT NULL AND NOT (x.turma_id = ANY(v_minhas))
  ) THEN
    RAISE EXCEPTION 'Uma das turmas não é da sua área nesta avaliação — quem a criou define qual área corrige cada turma.';
  END IF;

  -- O corretor precisa receber a nota desta avaliação — e, na geral, ser da área que
  -- corrige a turma (quando a turma já foi distribuída).
  SELECT prof.nome INTO v_invalido
  FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
  JOIN public.professores prof ON prof.id = x.professor_id
  LEFT JOIN public.prova_correcao_areas pca ON pca.prova_id = p_prova_id AND pca.turma_id = x.turma_id
  WHERE x.professor_id IS NOT NULL
    AND NOT (
      (v_prova.eh_prova_geral AND EXISTS (
        SELECT 1 FROM public.prova_notas_professores pnp
        WHERE pnp.prova_id = p_prova_id AND pnp.professor_id = x.professor_id
          AND (pca.area_conhecimento IS NULL OR pnp.area_conhecimento = pca.area_conhecimento)))
      OR (NOT v_prova.eh_prova_geral AND v_prova.somente_nota AND EXISTS (
        SELECT 1 FROM public.prova_notas_professores pnp
        WHERE pnp.prova_id = p_prova_id AND pnp.professor_id = x.professor_id))
      OR (NOT v_prova.eh_prova_geral AND NOT v_prova.somente_nota AND EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        WHERE pac.prova_id = p_prova_id AND pac.professor_id = x.professor_id))
    )
  LIMIT 1;
  IF v_invalido IS NOT NULL THEN
    RAISE EXCEPTION '% não recebe a nota desta avaliação pela área que corrige a turma.', v_invalido;
  END IF;

  DELETE FROM public.prova_corretores pc
  WHERE pc.prova_id = p_prova_id AND pc.turma_id = ANY(v_minhas);
  INSERT INTO public.prova_corretores (prova_id, turma_id, professor_id)
  SELECT DISTINCT ON (x.turma_id) p_prova_id, x.turma_id, x.professor_id
  FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
  WHERE x.turma_id = ANY(v_minhas) AND x.professor_id IS NOT NULL;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 4. Cotas: o acesso direto à tabela deixa de valer para PCA de outra área
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "prova_area_cotas_all_dono_ou_staff" ON public.prova_area_cotas;
CREATE POLICY "prova_area_cotas_all_dono_ou_staff" ON public.prova_area_cotas
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.provas p
    WHERE p.id = prova_area_cotas.prova_id
      AND (p.criado_por = auth.uid()
           OR public.eh_coordenacao_geral()
           OR (public.usuario_tem_papel('COORDENACAO_AREA') AND NOT public.pca_fora_da_area(p.id)))
  ));

-- ------------------------------------------------------------------------------------
-- 5. Nota vinculada: a coordenação de área altera nota das avaliações da sua área (e das
--    gerais de que a área participa); de outra área, só se for o corretor.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_editar_nota_vinculada(p_avaliacao_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id UUID;
  v_turma_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  SELECT pan.prova_id, pan.turma_id INTO v_prova_id, v_turma_id
  FROM public.prova_avaliacao_notas pan
  WHERE pan.avaliacao_id = p_avaliacao_id
  LIMIT 1;

  IF v_prova_id IS NULL THEN
    RETURN true;
  END IF;

  IF public.eh_staff_avaliacao() AND NOT public.pca_fora_da_area(v_prova_id) THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prova_corretores pc
    WHERE pc.prova_id = v_prova_id AND pc.turma_id = v_turma_id
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.prova_corretores pc
    JOIN public.professores prof ON prof.id = pc.professor_id
    WHERE pc.prova_id = v_prova_id
      AND pc.turma_id = v_turma_id
      AND prof.user_id = auth.uid()
  );
END;
$$;

-- ------------------------------------------------------------------------------------
-- 6. Trava nas funções existentes (uma linha logo após o BEGIN de cada uma)
-- ------------------------------------------------------------------------------------
DO $patch$
DECLARE
  r RECORD;
  v_def TEXT;
  v_novo TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- avaliação por id: PCA só na própria área
      ('rpc_editar_avaliacao_area',             'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_inserir_questoes_cota_area',        'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_obter_questoes_cota_area',          'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_publicar_avaliacao_area',           'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_lancar_notas_boletim',              'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_notas_avaliacao_turma',             'PERFORM public.exigir_prova_da_area(p_prova_id);'),
      ('rpc_salvar_avaliacao_area_so_nota',     'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_area_do_usuario(p_area_conhecimento);'),
      ('rpc_configurar_area_avaliacao_geral',   'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_area_do_usuario(p_area);'),
      -- ações de dono na geral + área
      ('rpc_despublicar_avaliacao',             'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_dono_se_geral(p_prova_id);'),
      ('rpc_definir_bloqueio_avaliacao_area',   'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_dono_se_geral(p_prova_id);'),
      ('rpc_definir_impressao_avaliacao_area',  'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_dono_se_geral(p_prova_id);'),
      ('rpc_definir_modo_nota',                 'PERFORM public.exigir_prova_da_area(p_prova_id); PERFORM public.exigir_dono_se_geral(p_prova_id);'),
      -- cota da geral (por id da cota)
      ('rpc_inserir_questoes_cota_geral',       'PERFORM public.exigir_prova_da_area((SELECT c.prova_id FROM public.prova_area_cotas c WHERE c.id = p_cota_id));'),
      ('rpc_obter_questoes_cota_geral',         'PERFORM public.exigir_prova_da_area((SELECT c.prova_id FROM public.prova_area_cotas c WHERE c.id = p_cota_id));'),
      -- por área informada
      ('rpc_criar_avaliacao_area',              'PERFORM public.exigir_area_do_usuario(p_area_conhecimento);'),
      ('rpc_listar_avaliacoes_area',            'PERFORM public.exigir_area_do_usuario(p_area_conhecimento);')
    ) AS t(nome, guarda)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = r.nome;
    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Função % não encontrada.', r.nome;
    END IF;
    CONTINUE WHEN position('-- trava por área' IN v_def) > 0;
    -- primeiro BEGIN em linha própria (o do corpo principal)
    v_novo := regexp_replace(v_def, '(\n\s*BEGIN\s*\r?\n)', E'\\1  -- trava por área\n  ' || r.guarda || E'\n');
    IF v_novo = v_def THEN
      RAISE EXCEPTION 'Não achei o BEGIN de %.', r.nome;
    END IF;
    EXECUTE v_novo;
  END LOOP;
END;
$patch$;

-- ------------------------------------------------------------------------------------
-- 7. Listagem: + distribuição da correção e se o usuário é dono da geral
-- ------------------------------------------------------------------------------------
DO $patch2$
DECLARE
  v_def TEXT;
  v_novo TEXT;
BEGIN
  SELECT pg_get_functiondef('public.rpc_listar_avaliacoes_area(text)'::regprocedure) INTO v_def;
  IF position('correcao_areas' IN v_def) > 0 THEN
    RETURN;
  END IF;
  v_novo := replace(v_def, E'''corretores'', (',
    E'''correcao_areas'', (SELECT jsonb_agg(jsonb_build_object(''turma_id'', pca.turma_id, ''area_conhecimento'', pca.area_conhecimento)) FROM public.prova_correcao_areas pca WHERE pca.prova_id = p.id),\n'
    || E'      ''sou_dono'', (NOT p.eh_prova_geral OR p.criado_por = v_usuario_id OR public.eh_coordenacao_geral()),\n'
    || E'      ''corretores'', (');
  IF v_novo = v_def THEN
    RAISE EXCEPTION 'Não achei o campo corretores na listagem.';
  END IF;
  EXECUTE v_novo;
END;
$patch2$;
