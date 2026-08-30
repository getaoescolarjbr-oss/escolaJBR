-- ====================================================================================
-- Resposta online + correção manual de questões dissertativas / redação.
--
-- PRÉ-REQUISITO: rodar add_questoes_dissertativas_redacao.sql ANTES deste arquivo
-- (este depende de questions.tipo, questions.criterios_correcao e linhas_resposta).
--
-- RECONCILIAÇÃO (apurada em 2026-08-30 contra o banco de produção, via PostgREST):
-- ao contrário do que se supunha, fix_provas_table_collision.sql e
-- add_avaliacao_preview_professor.sql JÁ FORAM APLICADOS. Existem e respondem:
--   rpc_minhas_avaliacoes_aluno, rpc_questoes_avaliacao_aluno,
--   rpc_questoes_avaliacao_preview, rpc_resultados_avaliacao,
--   rpc_submeter_resposta_avaliacao, usuario_tem_papel, meu_aluno_id,
--   question_bank_filter_options.
-- (prova_respostas tem 24 linhas e prova_respostas_itens 96 — o fluxo online já
-- rodou de verdade.) Portanto este arquivo NÃO recria o schema de provas; ele só
-- estende o que já existe. Se num banco divergente as tabelas prova_* faltarem,
-- rode fix_provas_table_collision.sql primeiro.
--
-- MODELO DE CORREÇÃO
-- Um item de resposta passa a ter dois caminhos:
--   * OBJETIVA      -> corrigido na hora do envio, corrigido = true de saída.
--   * DISSERTATIVA  -> grava resposta_texto, valor_obtido = 0, corrigido = false,
--     / REDACAO        e só ganha nota quando o professor passar por ele.
-- A nota da resposta é sempre a soma do que JÁ foi corrigido — nunca uma promessa.
-- Por isso o aluno de uma prova com dissertativa vê uma nota parcial que sobe
-- conforme o professor corrige, em vez de um zero enganoso que depois muda sozinho.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Colunas novas
-- ------------------------------------------------------------------------------------

-- letra_marcada precisa aceitar NULL: numa dissertativa não há letra nenhuma.
-- No schema de fix_provas_table_collision.sql a coluna já é nullable; o comando
-- abaixo é no-op nesse caso e existe só para o script ser seguro em banco divergente.
ALTER TABLE public.prova_respostas_itens ALTER COLUMN letra_marcada DROP NOT NULL;

ALTER TABLE public.prova_respostas_itens
  ADD COLUMN IF NOT EXISTS resposta_texto text;

-- corrigido = "este item já tem nota definitiva". Objetivas nascem true.
ALTER TABLE public.prova_respostas_itens
  ADD COLUMN IF NOT EXISTS corrigido boolean NOT NULL DEFAULT false;

ALTER TABLE public.prova_respostas_itens
  ADD COLUMN IF NOT EXISTS observacao_professor text;

ALTER TABLE public.prova_respostas_itens
  ADD COLUMN IF NOT EXISTS corrigido_por uuid REFERENCES auth.users(id);

ALTER TABLE public.prova_respostas_itens
  ADD COLUMN IF NOT EXISTS corrigido_em timestamptz;

-- Os 96 itens que já existem são todos de prova objetiva e já têm nota fechada;
-- marcá-los como corrigidos evita que apareçam na fila do professor e que o
-- recálculo do passo 7 zere notas antigas.
--
-- O filtro por q.tipo = 'OBJETIVA' é o que torna este UPDATE seguro numa
-- REAPLICAÇÃO do script: sem ele, rodar o arquivo de novo depois que já houver
-- dissertativas respondidas marcaria como corrigido tudo que ainda está na fila
-- do professor — dando nota 0 definitiva para o aluno em silêncio.
UPDATE public.prova_respostas_itens ri
   SET corrigido = true
  FROM public.questions q
 WHERE q.id = ri.question_id
   AND ri.corrigido = false
   AND q.tipo = 'OBJETIVA';

ALTER TABLE public.prova_respostas
  ADD COLUMN IF NOT EXISTS status_correcao text NOT NULL DEFAULT 'AUTOMATICA';

DO $$ BEGIN
  ALTER TABLE public.prova_respostas
    ADD CONSTRAINT prova_respostas_status_correcao_check
    CHECK (status_correcao IN ('AUTOMATICA', 'PENDENTE', 'CORRIGIDA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Índice da fila de correção: só o que ainda está pendente entra no índice, que
-- assim fica minúsculo mesmo com a tabela de itens crescendo.
CREATE INDEX IF NOT EXISTS prova_respostas_itens_pendentes_idx
  ON public.prova_respostas_itens (resposta_id) WHERE corrigido = false;

CREATE INDEX IF NOT EXISTS prova_respostas_status_correcao_idx
  ON public.prova_respostas (prova_id, status_correcao);

COMMENT ON COLUMN public.prova_respostas_itens.resposta_texto IS 'Texto respondido pelo aluno em questão dissertativa/redação.';
COMMENT ON COLUMN public.prova_respostas_itens.corrigido IS 'true = valor_obtido é definitivo. Objetivas nascem true; dissertativas viram true na correção manual.';
COMMENT ON COLUMN public.prova_respostas.status_correcao IS 'AUTOMATICA (só objetivas) | PENDENTE (tem dissertativa não corrigida) | CORRIGIDA.';

-- ------------------------------------------------------------------------------------
-- 2. Recálculo de nota e status.
--    Uma função só, chamada de todos os lugares, para que envio e correção nunca
--    discordem sobre como a nota é formada.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_nota_prova_resposta(p_resposta_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota      numeric;
  v_pendentes integer;
  v_dissert   integer;
  v_status    text;
BEGIN
  -- Só soma item corrigido: nota parcial honesta em vez de zero enganoso.
  SELECT COALESCE(SUM(ri.valor_obtido) FILTER (WHERE ri.corrigido), 0),
         count(*) FILTER (WHERE NOT ri.corrigido),
         count(*) FILTER (WHERE q.tipo IN ('DISSERTATIVA', 'REDACAO'))
    INTO v_nota, v_pendentes, v_dissert
  FROM prova_respostas_itens ri
  JOIN questions q ON q.id = ri.question_id
  WHERE ri.resposta_id = p_resposta_id;

  v_status := CASE
    WHEN v_dissert = 0   THEN 'AUTOMATICA'   -- prova só de objetivas: fecha sozinha
    WHEN v_pendentes > 0 THEN 'PENDENTE'
    ELSE 'CORRIGIDA'
  END;

  UPDATE prova_respostas
     SET nota = v_nota, status_correcao = v_status
   WHERE id = p_resposta_id;

  RETURN v_nota;
END;
$$;

-- Função interna: ninguém a chama de fora, só as RPCs abaixo.
REVOKE ALL ON FUNCTION public.recalcular_nota_prova_resposta(uuid) FROM public;

-- ------------------------------------------------------------------------------------
-- 3. Envio da resposta pelo aluno — agora aceita item com texto.
--
--    p_respostas: [{"question_id": uuid, "letra": "A"},
--                  {"question_id": uuid, "texto": "..."}]
--    'letra' e 'texto' são ambos opcionais; quem decide qual vale é o tipo da
--    questão, não o que o cliente mandou — assim um cliente malicioso não
--    consegue transformar dissertativa em objetiva mandando uma letra.
--
--    O DROP é necessário porque o retorno ganhou colunas (resposta_texto,
--    pendente_correcao) e CREATE OR REPLACE não muda tipo de retorno. As colunas
--    antigas mantêm nome e tipo, então o front que já consome esta RPC por nome
--    de campo continua funcionando.
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_submeter_resposta_avaliacao(uuid, jsonb);

CREATE FUNCTION public.rpc_submeter_resposta_avaliacao(p_avaliacao_id uuid, p_respostas jsonb)
RETURNS TABLE (
  question_id       uuid,
  letra_marcada     text,
  correct_letter    text,
  correta           boolean,
  valor_obtido      numeric,
  nota_final        numeric,
  resposta_texto    text,
  pendente_correcao boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id    uuid;
  v_prova       provas;
  v_resposta_id uuid;
  v_item        jsonb;
  v_nota        numeric := 0;
BEGIN
  v_aluno_id := public.meu_aluno_id();
  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Só alunos podem responder avaliações.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_avaliacao_id;
  IF NOT FOUND OR v_prova.status <> 'PUBLICADA' THEN
    RAISE EXCEPTION 'Esta avaliação não está disponível para envio.';
  END IF;
  IF v_prova.prazo_entrega IS NOT NULL AND now() > v_prova.prazo_entrega THEN
    RAISE EXCEPTION 'O prazo de entrega desta avaliação já encerrou.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM prova_turmas pt JOIN alunos al ON al.turma_id = pt.turma_id
    WHERE pt.prova_id = p_avaliacao_id AND al.id = v_aluno_id
  ) THEN
    RAISE EXCEPTION 'Esta avaliação não está disponível para a sua turma.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM prova_respostas
    WHERE prova_id = p_avaliacao_id AND aluno_id = v_aluno_id AND finalizado_em IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Você já enviou esta avaliação.';
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (p_avaliacao_id, v_aluno_id)
  ON CONFLICT (prova_id, aluno_id) DO UPDATE SET prova_id = EXCLUDED.prova_id
  RETURNING id INTO v_resposta_id;

  DELETE FROM prova_respostas_itens WHERE resposta_id = v_resposta_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_respostas)
  LOOP
    INSERT INTO prova_respostas_itens (
      resposta_id, question_id, letra_marcada, resposta_texto, correta, valor_obtido, corrigido
    )
    SELECT
      v_resposta_id,
      q.id,
      CASE WHEN q.tipo = 'OBJETIVA'  THEN v_item ->> 'letra' END,
      CASE WHEN q.tipo <> 'OBJETIVA' THEN v_item ->> 'texto' END,
      -- 'correta' só faz sentido em objetiva. Em dissertativa fica false até a
      -- correção manual, que decide por valor_obtido e não por esse booleano.
      CASE WHEN q.tipo = 'OBJETIVA'
           THEN COALESCE(q.correct_letter = (v_item ->> 'letra'), false)
           ELSE false END,
      CASE WHEN q.tipo = 'OBJETIVA' AND q.correct_letter = (v_item ->> 'letra')
           THEN pq.valor ELSE 0 END,
      (q.tipo = 'OBJETIVA')   -- objetiva já sai corrigida; o resto entra na fila
    FROM prova_questoes pq
    JOIN questions q ON q.id = pq.question_id
    WHERE pq.prova_id = p_avaliacao_id
      AND pq.question_id = (v_item ->> 'question_id')::uuid;
  END LOOP;

  UPDATE prova_respostas SET finalizado_em = now() WHERE id = v_resposta_id;
  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  RETURN QUERY
  SELECT
    ri.question_id,
    ri.letra_marcada,
    -- Gabarito não vaza em dissertativa (nem existe lá).
    CASE WHEN q.tipo = 'OBJETIVA' THEN q.correct_letter END,
    ri.correta,
    ri.valor_obtido,
    v_nota,
    ri.resposta_texto,
    (NOT ri.corrigido)
  FROM prova_respostas_itens ri
  JOIN questions q ON q.id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Fila de correção do professor
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_itens_pendentes_correcao(uuid);

CREATE FUNCTION public.rpc_itens_pendentes_correcao(p_prova_id uuid)
RETURNS TABLE (
  item_id            uuid,
  resposta_id        uuid,
  aluno_id           uuid,
  aluno_nome         text,
  turma_nome         text,
  question_id        uuid,
  ordem              integer,
  valor              numeric,
  tipo               text,
  statement          text,
  criterios_correcao text,
  linhas_resposta    integer,
  resposta_texto     text,
  finalizado_em      timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mesma regra de rpc_resultados_avaliacao: dono da prova, coordenação ou gestão.
  -- Não basta ter papel PROFESSOR — professor não corrige prova alheia.
  IF NOT EXISTS (
    SELECT 1 FROM provas p WHERE p.id = p_prova_id
      AND (p.criado_por = auth.uid()
           OR public.usuario_tem_papel('COORDENACAO')
           OR public.usuario_tem_papel('GESTAO'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta avaliação.';
  END IF;

  RETURN QUERY
  SELECT
    ri.id, r.id, al.id, al.nome, t.nome,
    q.id, pq.ordem, pq.valor, q.tipo, q.statement,
    q.criterios_correcao, q.linhas_resposta,
    ri.resposta_texto, r.finalizado_em
  FROM prova_respostas_itens ri
  JOIN prova_respostas r ON r.id = ri.resposta_id
  JOIN questions q       ON q.id = ri.question_id
  JOIN prova_questoes pq ON pq.prova_id = r.prova_id AND pq.question_id = q.id
  JOIN alunos al         ON al.id = r.aluno_id
  LEFT JOIN turmas t     ON t.id = al.turma_id
  WHERE r.prova_id = p_prova_id
    AND ri.corrigido = false
    AND q.tipo IN ('DISSERTATIVA', 'REDACAO')
  -- Ordenado por questão e não por aluno de propósito: corrigir a mesma questão
  -- em sequência para vários alunos dá critério mais consistente do que pular de
  -- tema em tema aluno a aluno.
  ORDER BY pq.ordem, t.nome, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_itens_pendentes_correcao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_itens_pendentes_correcao(uuid) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 5. Correção de um item
-- ------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_corrigir_item_dissertativo(uuid, numeric, text);

CREATE FUNCTION public.rpc_corrigir_item_dissertativo(
  p_item_id      uuid,
  p_valor_obtido numeric,
  p_observacao   text DEFAULT NULL
)
RETURNS TABLE (
  item_id         uuid,
  resposta_id     uuid,
  valor_obtido    numeric,
  nota_resposta   numeric,
  status_correcao text,
  ainda_pendentes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resposta_id uuid;
  v_prova_id    uuid;
  v_valor_max   numeric;
  v_tipo        text;
  v_nota        numeric;
  v_status      text;
  v_pendentes   integer;
BEGIN
  SELECT r.id, r.prova_id, pq.valor, q.tipo
    INTO v_resposta_id, v_prova_id, v_valor_max, v_tipo
  FROM prova_respostas_itens ri
  JOIN prova_respostas r ON r.id = ri.resposta_id
  JOIN questions q       ON q.id = ri.question_id
  JOIN prova_questoes pq ON pq.prova_id = r.prova_id AND pq.question_id = q.id
  WHERE ri.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de resposta não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM provas p WHERE p.id = v_prova_id
      AND (p.criado_por = auth.uid()
           OR public.usuario_tem_papel('COORDENACAO')
           OR public.usuario_tem_papel('GESTAO'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta avaliação.';
  END IF;

  IF v_tipo NOT IN ('DISSERTATIVA', 'REDACAO') THEN
    RAISE EXCEPTION 'Este item é de questão objetiva e é corrigido automaticamente.';
  END IF;

  -- A nota do item não pode passar do peso que a questão tem NESTA prova
  -- (prova_questoes.valor, não um valor global da questão).
  IF p_valor_obtido IS NULL OR p_valor_obtido < 0 OR p_valor_obtido > v_valor_max THEN
    RAISE EXCEPTION 'A nota deve estar entre 0 e % (valor da questão nesta prova).', v_valor_max;
  END IF;

  UPDATE prova_respostas_itens
     SET valor_obtido         = p_valor_obtido,
         observacao_professor = p_observacao,
         corrigido            = true,
         corrigido_por        = auth.uid(),
         corrigido_em         = now(),
         -- "correta" aqui vira um resumo para as telas que já leem esse campo:
         -- pontuação cheia conta como acerto.
         correta              = (v_valor_max > 0 AND p_valor_obtido >= v_valor_max)
   WHERE id = p_item_id;

  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  SELECT r.status_correcao INTO v_status
    FROM prova_respostas r WHERE r.id = v_resposta_id;
  SELECT count(*) INTO v_pendentes
    FROM prova_respostas_itens ri
   WHERE ri.resposta_id = v_resposta_id AND ri.corrigido = false;

  RETURN QUERY SELECT p_item_id, v_resposta_id, p_valor_obtido, v_nota, v_status, v_pendentes;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_item_dissertativo(uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_item_dissertativo(uuid, numeric, text) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 6. RLS e GRANTs
--    As policies de SELECT em prova_respostas / prova_respostas_itens criadas em
--    fix_provas_table_collision.sql já cobrem quem pode LER (aluno dono, staff,
--    dono da prova) e são reafirmadas aqui para o script ser autossuficiente.
--    A escrita continua fechada: nem aluno nem professor dão INSERT/UPDATE direto
--    nessas tabelas — tudo passa pelas RPCs SECURITY DEFINER acima, que é onde a
--    validação de faixa de nota e de permissão mora. Um UPDATE direto permitido
--    deixaria o professor gravar nota acima do valor da questão.
-- ------------------------------------------------------------------------------------
ALTER TABLE public.prova_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_respostas_itens ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.prova_respostas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.prova_respostas_itens FROM authenticated;
GRANT SELECT ON public.prova_respostas, public.prova_respostas_itens TO authenticated;
GRANT ALL ON public.prova_respostas, public.prova_respostas_itens TO service_role;

DROP POLICY IF EXISTS "prova_respostas_select_dono_staff_ou_proprio_aluno" ON public.prova_respostas;
CREATE POLICY "prova_respostas_select_dono_staff_ou_proprio_aluno"
  ON public.prova_respostas FOR SELECT TO authenticated
  USING (
    aluno_id = public.meu_aluno_id()
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = prova_id AND p.criado_por = auth.uid())
  );

DROP POLICY IF EXISTS "prova_respostas_itens_select_dono_staff_ou_proprio_aluno" ON public.prova_respostas_itens;
CREATE POLICY "prova_respostas_itens_select_dono_staff_ou_proprio_aluno"
  ON public.prova_respostas_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prova_respostas r WHERE r.id = resposta_id AND (
      r.aluno_id = public.meu_aluno_id()
      OR public.usuario_tem_papel('GESTAO')
      OR public.usuario_tem_papel('COORDENACAO')
      OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = r.prova_id AND p.criado_por = auth.uid())
    )
  ));

-- ------------------------------------------------------------------------------------
-- 7. Reconstitui nota e status_correcao das respostas que já existiam.
--    Como o passo 1 marcou todos os itens antigos como corrigido = true, o
--    recálculo reproduz exatamente a nota que já estava lá; o efeito real é só
--    preencher status_correcao com 'AUTOMATICA'.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM prova_respostas WHERE finalizado_em IS NOT NULL LOOP
    PERFORM public.recalcular_nota_prova_resposta(r.id);
  END LOOP;
END $$;
