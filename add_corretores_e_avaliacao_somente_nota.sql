-- ====================================================================================
-- CORRETOR POR TURMA + AVALIAÇÃO GERAL SÓ DE NOTA
--
-- 1. Corretor por turma (avaliação de área, avaliação geral e geral só de nota):
--    o coordenador escolhe, por turma, o professor que corrige/lança a nota. Os demais
--    professores que recebem a nota só a veem — não conseguem alterar. A coordenação
--    (COORDENACAO_AREA, COORDENACAO, GESTAO) altera qualquer nota.
--    Turma SEM corretor definido continua como antes (qualquer professor vinculado
--    altera), para não travar avaliações que já existem.
--
--    A regra fica em gatilhos de notas_avaliacoes, não só nas RPCs: a tabela aceita
--    gravação direta de qualquer usuário logado, e há telas que gravam direto
--    (GradeCellEditModal). Outro gatilho copia a nota para o campo de todos os
--    professores da mesma prova+turma, por qualquer caminho de gravação.
--
-- 2. Avaliação geral só de nota (provas.somente_nota): sem questões, só cria o campo de
--    nota para os professores escolhidos por cada área. Áreas ficam com 0 questões;
--    publicar/editar/configurar reaproveitam as RPCs da avaliação geral.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Estrutura
-- ------------------------------------------------------------------------------------
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS somente_nota BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.prova_geral_areas DROP CONSTRAINT IF EXISTS prova_geral_areas_qtd_questoes_check;
ALTER TABLE public.prova_geral_areas ADD CONSTRAINT prova_geral_areas_qtd_questoes_check CHECK (qtd_questoes >= 0);

CREATE TABLE IF NOT EXISTS public.prova_corretores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id      UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  turma_id      UUID NOT NULL,
  professor_id  UUID NOT NULL REFERENCES public.professores(id),
  CONSTRAINT uq_prova_corretor_turma UNIQUE (prova_id, turma_id)
);
CREATE INDEX IF NOT EXISTS idx_prova_corretores_prova ON public.prova_corretores (prova_id);

-- Quem é o corretor não é dado sensível: o professor precisa saber quem lança a nota.
ALTER TABLE public.prova_corretores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prova_corretores_select" ON public.prova_corretores;
CREATE POLICY "prova_corretores_select" ON public.prova_corretores
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------------------------------
-- 2. Regra de quem pode alterar nota vinculada (prova_avaliacao_notas)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eh_staff_avaliacao()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_tem_papel('COORDENACAO_AREA')
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('GESTAO');
$$;

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
  -- Rotinas do sistema (cron, service role) não têm usuário.
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  SELECT pan.prova_id, pan.turma_id INTO v_prova_id, v_turma_id
  FROM public.prova_avaliacao_notas pan
  WHERE pan.avaliacao_id = p_avaliacao_id
  LIMIT 1;

  -- Nota de avaliação comum (sem vínculo com prova de área/geral): regra de sempre.
  IF v_prova_id IS NULL THEN
    RETURN true;
  END IF;

  IF public.eh_staff_avaliacao() THEN
    RETURN true;
  END IF;

  -- Turma sem corretor definido: comportamento antigo.
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

CREATE OR REPLACE FUNCTION public.trg_notas_vinculadas_checar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND NOT public.pode_editar_nota_vinculada(OLD.avaliacao_id) THEN
    RAISE EXCEPTION 'NOTA_BLOQUEADA: só o professor corretor desta turma (ou a coordenação) pode alterar esta nota.';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NOT public.pode_editar_nota_vinculada(NEW.avaliacao_id) THEN
    RAISE EXCEPTION 'NOTA_BLOQUEADA: só o professor corretor desta turma (ou a coordenação) pode alterar esta nota.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Copia a nota para o campo dos outros professores da mesma prova+turma. Não roda
-- quando a gravação já veio de uma cópia (pg_trigger_depth > 1) nem quando a RPC que
-- gravou já copiou sozinha (app.sem_propagar_nota).
CREATE OR REPLACE FUNCTION public.trg_notas_vinculadas_propagar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.avaliacao_id ELSE NEW.avaliacao_id END;
  v_prova_id UUID;
  v_turma_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 OR COALESCE(current_setting('app.sem_propagar_nota', true), '') = '1' THEN
    RETURN NULL;
  END IF;

  SELECT pan.prova_id, pan.turma_id INTO v_prova_id, v_turma_id
  FROM public.prova_avaliacao_notas pan
  WHERE pan.avaliacao_id = v_avaliacao_id
  LIMIT 1;
  IF v_prova_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notas_avaliacoes na
    USING public.prova_avaliacao_notas pan
    WHERE pan.prova_id = v_prova_id
      AND pan.turma_id = v_turma_id
      AND na.avaliacao_id = pan.avaliacao_id
      AND na.aluno_id = OLD.aluno_id
      AND na.avaliacao_id <> OLD.avaliacao_id;
  ELSE
    INSERT INTO public.notas_avaliacoes (avaliacao_id, aluno_id, nota)
    SELECT pan.avaliacao_id, NEW.aluno_id,
           CASE WHEN NEW.nota IS NULL THEN NULL ELSE LEAST(NEW.nota, a.valor_maximo) END
    FROM public.prova_avaliacao_notas pan
    JOIN public.avaliacoes a ON a.id = pan.avaliacao_id
    WHERE pan.prova_id = v_prova_id
      AND pan.turma_id = v_turma_id
      AND pan.avaliacao_id <> NEW.avaliacao_id
    ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notas_vinculadas_checar ON public.notas_avaliacoes;
CREATE TRIGGER notas_vinculadas_checar
  BEFORE INSERT OR UPDATE OR DELETE ON public.notas_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_notas_vinculadas_checar();

DROP TRIGGER IF EXISTS notas_vinculadas_propagar ON public.notas_avaliacoes;
CREATE TRIGGER notas_vinculadas_propagar
  AFTER INSERT OR UPDATE OR DELETE ON public.notas_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_notas_vinculadas_propagar();

REVOKE ALL ON FUNCTION public.trg_notas_vinculadas_checar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_notas_vinculadas_propagar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_nota_vinculada(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_staff_avaliacao() TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. Definir corretores / consultar bloqueios / notas por turma
-- ------------------------------------------------------------------------------------
-- p_corretores: [{ turma_id, professor_id }] — substitui a lista inteira. Turma fora da
-- lista (ou com professor_id nulo) fica sem corretor (comportamento antigo).
CREATE OR REPLACE FUNCTION public.rpc_definir_corretores(p_prova_id UUID, p_corretores JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_invalido TEXT;
BEGIN
  IF NOT public.eh_staff_avaliacao() THEN
    RAISE EXCEPTION 'Só a coordenação pode definir os corretores.';
  END IF;

  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_area THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
    WHERE x.professor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.prova_turmas pt WHERE pt.prova_id = p_prova_id AND pt.turma_id = x.turma_id)
  ) THEN
    RAISE EXCEPTION 'Uma das turmas não faz parte desta avaliação.';
  END IF;

  -- O corretor precisa ser alguém que recebe a nota desta avaliação.
  SELECT prof.nome INTO v_invalido
  FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
  JOIN public.professores prof ON prof.id = x.professor_id
  WHERE x.professor_id IS NOT NULL
    AND NOT (
      (v_prova.eh_prova_geral AND EXISTS (
        SELECT 1 FROM public.prova_notas_professores pnp
        WHERE pnp.prova_id = p_prova_id AND pnp.professor_id = x.professor_id))
      OR (NOT v_prova.eh_prova_geral AND EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        WHERE pac.prova_id = p_prova_id AND pac.professor_id = x.professor_id))
    )
  LIMIT 1;
  IF v_invalido IS NOT NULL THEN
    RAISE EXCEPTION '% não recebe a nota desta avaliação — escolha um dos professores que recebem.', v_invalido;
  END IF;

  DELETE FROM public.prova_corretores WHERE prova_id = p_prova_id;
  INSERT INTO public.prova_corretores (prova_id, turma_id, professor_id)
  SELECT DISTINCT ON (x.turma_id) p_prova_id, x.turma_id, x.professor_id
  FROM jsonb_to_recordset(p_corretores) AS x(turma_id UUID, professor_id UUID)
  WHERE x.turma_id IS NOT NULL AND x.professor_id IS NOT NULL;
END;
$$;

-- Das avaliações recebidas, quais o usuário logado NÃO pode alterar (e quem corrige).
CREATE OR REPLACE FUNCTION public.rpc_notas_bloqueadas(p_avaliacao_ids UUID[])
RETURNS TABLE(avaliacao_id UUID, corretor_nome TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pan.avaliacao_id, prof.nome
  FROM public.prova_avaliacao_notas pan
  JOIN public.prova_corretores pc ON pc.prova_id = pan.prova_id AND pc.turma_id = pan.turma_id
  JOIN public.professores prof ON prof.id = pc.professor_id
  WHERE pan.avaliacao_id = ANY(p_avaliacao_ids)
    AND NOT public.pode_editar_nota_vinculada(pan.avaliacao_id);
$$;

-- Notas de uma turma numa avaliação publicada (para a coordenação ou o corretor
-- conferirem/alterarem). avaliacao_id é um dos campos vinculados — gravar nele via
-- rpc_lancar_nota_manual_area copia para os demais.
CREATE OR REPLACE FUNCTION public.rpc_notas_avaliacao_turma(p_prova_id UUID, p_turma_id UUID)
RETURNS TABLE(aluno_id UUID, aluno_nome TEXT, aluno_numero INTEGER, status TEXT, nota NUMERIC, avaliacao_id UUID, valor_maximo NUMERIC, pode_editar BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao_id UUID;
  v_valor NUMERIC;
BEGIN
  SELECT pan.avaliacao_id, a.valor_maximo INTO v_avaliacao_id, v_valor
  FROM public.prova_avaliacao_notas pan
  JOIN public.avaliacoes a ON a.id = pan.avaliacao_id
  WHERE pan.prova_id = p_prova_id AND pan.turma_id = p_turma_id
  ORDER BY a.id
  LIMIT 1;

  IF v_avaliacao_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (public.eh_staff_avaliacao() OR EXISTS (
    SELECT 1 FROM public.prova_corretores pc JOIN public.professores prof ON prof.id = pc.professor_id
    WHERE pc.prova_id = p_prova_id AND pc.turma_id = p_turma_id AND prof.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'Sem permissão para ver as notas desta turma aqui.';
  END IF;

  RETURN QUERY
  SELECT al.id, al.nome, al.aluno_numero, al.status, na.nota, v_avaliacao_id, v_valor,
         public.pode_editar_nota_vinculada(v_avaliacao_id)
  FROM public.alunos al
  LEFT JOIN public.notas_avaliacoes na ON na.avaliacao_id = v_avaliacao_id AND na.aluno_id = al.id
  WHERE al.turma_id = p_turma_id
  ORDER BY al.aluno_numero NULLS LAST, al.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_corretores(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notas_bloqueadas(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notas_avaliacao_turma(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Lançamento manual e lançamento do cartão/online respeitam o corretor
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_lancar_nota_manual_area(p_avaliacao_id uuid, p_aluno_id uuid, p_nota numeric, p_confirmar_substituicao boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aval avaliacoes;
  v_prova_id uuid;
  v_turma_id uuid;
  v_nota_capada numeric;
  v_conflitos integer;
  v_lancadas integer;
BEGIN
  SELECT * INTO v_aval FROM avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação de nota não encontrada.';
  END IF;

  IF NOT (
    public.eh_staff_avaliacao()
    OR EXISTS (
      SELECT 1 FROM professores prof
      WHERE prof.id = v_aval.professor_id AND prof.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para lançar nota nesta avaliação.';
  END IF;

  IF NOT public.pode_editar_nota_vinculada(p_avaliacao_id) THEN
    RAISE EXCEPTION 'NOTA_BLOQUEADA: só o professor corretor desta turma (ou a coordenação) pode alterar esta nota.';
  END IF;

  -- Esta RPC já copia para todos os campos vinculados; o gatilho não precisa copiar de novo.
  PERFORM set_config('app.sem_propagar_nota', '1', true);

  SELECT pan.prova_id, pan.turma_id INTO v_prova_id, v_turma_id
  FROM prova_avaliacao_notas pan
  WHERE pan.avaliacao_id = p_avaliacao_id
  LIMIT 1;

  IF p_nota IS NULL THEN
    IF v_prova_id IS NULL THEN
      DELETE FROM notas_avaliacoes WHERE avaliacao_id = p_avaliacao_id AND aluno_id = p_aluno_id;
      RETURN jsonb_build_object('nota', NULL, 'propagada', false, 'professores', 1);
    END IF;

    DELETE FROM notas_avaliacoes na
    USING prova_avaliacao_notas pan
    WHERE na.avaliacao_id = pan.avaliacao_id
      AND na.aluno_id = p_aluno_id
      AND pan.prova_id = v_prova_id
      AND pan.turma_id = v_turma_id;

    GET DIAGNOSTICS v_lancadas = ROW_COUNT;
    RETURN jsonb_build_object('nota', NULL, 'propagada', true, 'professores', v_lancadas);
  END IF;

  v_nota_capada := GREATEST(0, LEAST(p_nota, v_aval.valor_maximo));

  IF v_prova_id IS NULL THEN
    INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
    VALUES (p_avaliacao_id, p_aluno_id, v_nota_capada)
    ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;
    RETURN jsonb_build_object('nota', v_nota_capada, 'propagada', false, 'professores', 1);
  END IF;

  SELECT count(*) INTO v_conflitos
  FROM prova_avaliacao_notas pan
  JOIN notas_avaliacoes na ON na.avaliacao_id = pan.avaliacao_id AND na.aluno_id = p_aluno_id
  WHERE pan.prova_id = v_prova_id
    AND pan.turma_id = v_turma_id
    AND pan.avaliacao_id <> p_avaliacao_id
    AND na.nota IS NOT NULL
    AND na.nota IS DISTINCT FROM v_nota_capada;

  IF v_conflitos > 0 AND NOT p_confirmar_substituicao THEN
    RAISE EXCEPTION 'CONFIRMACAO_SUBSTITUICAO:% outro(s) professor(es) já tinha(m) nota diferente lançada pra este aluno.', v_conflitos;
  END IF;

  WITH alvos AS (
    SELECT pan.avaliacao_id, LEAST(v_nota_capada, a2.valor_maximo) AS nota_capada
    FROM prova_avaliacao_notas pan
    JOIN avaliacoes a2 ON a2.id = pan.avaliacao_id
    WHERE pan.prova_id = v_prova_id AND pan.turma_id = v_turma_id
  )
  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT alvos.avaliacao_id, p_aluno_id, alvos.nota_capada FROM alvos
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;

  RETURN jsonb_build_object('nota', v_nota_capada, 'propagada', true, 'professores', v_lancadas);
END;
$function$;

-- Lança as notas do cartão/online no boletim. Com corretor definido, um professor só
-- lança nas turmas que corrige (a coordenação lança em todas).
CREATE OR REPLACE FUNCTION public.rpc_lancar_notas_boletim(p_prova_id uuid, p_confirmar_substituicao boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prova provas;
  v_lancadas integer;
  v_conflitos integer;
  v_staff boolean := public.eh_staff_avaliacao();
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para lançar as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;
  IF v_prova.modo_nota = 'SEM_NOTA' THEN
    RAISE EXCEPTION 'Esta prova está configurada como "sem nota" — ela gera relatório, mas não vai para o boletim.';
  END IF;
  IF NOT v_prova.lancar_no_boletim THEN
    RAISE EXCEPTION 'Esta prova está marcada para não lançar nota no boletim.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM prova_avaliacao_notas WHERE prova_id = p_prova_id) THEN
    RAISE EXCEPTION 'Esta prova ainda não tem avaliação de nota vinculada. Confira se disciplina e bimestre foram preenchidos ao publicar.';
  END IF;

  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(p_prova_id);
  END IF;

  -- Já grava em todos os campos vinculados de cada turma: o gatilho não copia de novo.
  PERFORM set_config('app.sem_propagar_nota', '1', true);

  SELECT count(*) INTO v_conflitos
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  JOIN notas_avaliacoes na ON na.avaliacao_id = pan.avaliacao_id AND na.aluno_id = r.aluno_id
  WHERE r.prova_id = p_prova_id
    AND r.finalizado_em IS NOT NULL
    AND na.nota IS NOT NULL
    AND (v_staff OR public.pode_editar_nota_vinculada(pan.avaliacao_id))
    AND na.nota IS DISTINCT FROM (
      CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
    );

  IF v_conflitos > 0 AND NOT p_confirmar_substituicao THEN
    RAISE EXCEPTION 'CONFIRMACAO_SUBSTITUICAO:% nota(s) já preenchida(s) seria(m) substituída(s). Chame de novo confirmando para continuar.', v_conflitos;
  END IF;

  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT
    pan.avaliacao_id,
    r.aluno_id,
    CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
    AND (v_staff OR public.pode_editar_nota_vinculada(pan.avaliacao_id))
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;
  RETURN v_lancadas;
END;
$function$;

-- ------------------------------------------------------------------------------------
-- 5. Avaliação geral só de nota: criar e editar
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_criar_avaliacao_geral(TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT);

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
  p_cartao_posicao TEXT DEFAULT 'FIM',
  p_somente_nota BOOLEAN DEFAULT false
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
  v_so_nota BOOLEAN := COALESCE(p_somente_nota, false);
BEGIN
  IF NOT public.eh_staff_avaliacao() THEN
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
       OR (NOT v_so_nota AND COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 1)
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e ter pelo menos 1 questão.';
  END IF;

  SELECT CASE WHEN v_so_nota THEN 0 ELSE SUM((a ->> 'qtd_questoes')::INTEGER) END
  INTO v_total FROM jsonb_array_elements(p_areas) a;

  INSERT INTO public.provas (
    titulo, disciplina, disciplina_id, bimestre_id, instrucoes, valor_total, modo, tipo,
    data_aplicacao, prazo_entrega, status, criado_por, eh_prova_area, area_conhecimento,
    status_colaboracao, embaralhar, qtd_versoes, cartao_separado, cartao_posicao,
    lancar_no_boletim, eh_prova_geral, qtd_questoes_total, somente_nota
  ) VALUES (
    trim(p_titulo), 'Avaliação Geral', NULL, p_bimestre_id, p_instrucoes, p_valor_total,
    CASE WHEN v_so_nota THEN 'IMPRESSA' ELSE p_modo END,
    CASE WHEN v_so_nota THEN 'AVALIACAO' ELSE p_tipo END,
    p_data_aplicacao, p_prazo_entrega, 'RASCUNHO', auth.uid(), true, 'Geral',
    'EM_ELABORACAO', COALESCE(p_embaralhar, 'NENHUM'), GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    COALESCE(p_cartao_separado, false),
    CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    CASE WHEN v_so_nota THEN true ELSE COALESCE(p_lancar_no_boletim, true) END,
    true, v_total, v_so_nota
  )
  RETURNING id INTO v_prova_id;

  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT v_prova_id, unnest(p_turma_ids);

  FOR v_area IN
    SELECT a.value AS item, a.ordinality AS ordem
    FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  LOOP
    INSERT INTO public.prova_geral_areas (prova_id, area_conhecimento, qtd_questoes, ordem)
    VALUES (v_prova_id, v_area.item ->> 'area',
            CASE WHEN v_so_nota THEN 0 ELSE (v_area.item ->> 'qtd_questoes')::INTEGER END,
            v_area.ordem);

    IF NOT v_so_nota THEN
      SELECT COALESCE(array_agg(x::UUID), ARRAY[]::UUID[]) INTO v_ids
      FROM jsonb_array_elements_text(COALESCE(v_area.item -> 'questoes', '[]'::jsonb)) x;

      IF array_length(v_ids, 1) > (v_area.item ->> 'qtd_questoes')::INTEGER THEN
        RAISE EXCEPTION 'A área % tem mais questões sorteadas do que o previsto.', v_area.item ->> 'area';
      END IF;

      PERFORM public.prova_geral_gravar_sorteadas(v_prova_id, v_area.item ->> 'area', v_ids);
    END IF;
  END LOOP;

  IF NOT v_so_nota THEN
    PERFORM public.prova_geral_reorganizar(v_prova_id);
  END IF;
  RETURN v_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_geral(TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

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
  v_so_nota BOOLEAN;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_geral THEN
    RAISE EXCEPTION 'Avaliação geral não encontrada.';
  END IF;
  v_so_nota := v_prova.somente_nota;
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
       OR (NOT v_so_nota AND COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 1)
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e ter pelo menos 1 questão.';
  END IF;

  SELECT string_agg(pga.area_conhecimento, ', ') INTO v_problema
  FROM public.prova_geral_areas pga
  WHERE pga.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pga.area_conhecimento)
    AND EXISTS (SELECT 1 FROM public.prova_questoes pq WHERE pq.prova_id = p_prova_id AND pq.area_conhecimento = pga.area_conhecimento);
  IF v_problema IS NOT NULL THEN
    RAISE EXCEPTION 'Não dá para retirar área que já tem questões: %. Remova as questões dela antes.', v_problema;
  END IF;

  IF NOT v_so_nota THEN
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
  END IF;

  UPDATE public.provas SET
    titulo = trim(p_titulo),
    bimestre_id = p_bimestre_id,
    valor_total = p_valor_total,
    modo = CASE WHEN v_so_nota THEN 'IMPRESSA' ELSE p_modo END,
    tipo = CASE WHEN v_so_nota THEN 'AVALIACAO' ELSE p_tipo END,
    lancar_no_boletim = CASE WHEN v_so_nota THEN true ELSE COALESCE(p_lancar_no_boletim, true) END,
    data_aplicacao = p_data_aplicacao,
    prazo_entrega = p_prazo_entrega,
    instrucoes = p_instrucoes,
    embaralhar = COALESCE(p_embaralhar, 'NENHUM'),
    qtd_versoes = GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    cartao_separado = COALESCE(p_cartao_separado, false),
    cartao_posicao = CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    qtd_questoes_total = CASE WHEN v_so_nota THEN 0 ELSE (SELECT SUM((a ->> 'qtd_questoes')::INTEGER) FROM jsonb_array_elements(p_areas) a) END,
    updated_at = now()
  WHERE id = p_prova_id;

  DELETE FROM public.prova_turmas WHERE prova_id = p_prova_id;
  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT p_prova_id, unnest(p_turma_ids);

  -- Corretor de turma que saiu da avaliação não faz mais sentido.
  DELETE FROM public.prova_corretores pc
  WHERE pc.prova_id = p_prova_id AND NOT (pc.turma_id = ANY(p_turma_ids));

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
  SELECT p_prova_id, a.value ->> 'area',
         CASE WHEN v_so_nota THEN 0 ELSE (a.value ->> 'qtd_questoes')::INTEGER END,
         a.ordinality
  FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  ON CONFLICT (prova_id, area_conhecimento)
  DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, ordem = EXCLUDED.ordem;

  IF NOT v_so_nota THEN
    PERFORM public.prova_geral_reorganizar(p_prova_id);
  END IF;
  RETURN p_prova_id;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 6. Listagem: + somente_nota e corretores
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
  v_eh_staff := public.eh_staff_avaliacao();

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
      'somente_nota', p.somente_nota,
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
      'corretores', (
        SELECT jsonb_agg(jsonb_build_object(
          'turma_id', pc.turma_id, 'turma_nome', t.nome,
          'professor_id', pc.professor_id, 'professor_nome', prof.nome
        ) ORDER BY t.nome)
        FROM public.prova_corretores pc
        JOIN public.professores prof ON prof.id = pc.professor_id
        LEFT JOIN public.turmas t ON t.id = pc.turma_id
        WHERE pc.prova_id = p.id
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
