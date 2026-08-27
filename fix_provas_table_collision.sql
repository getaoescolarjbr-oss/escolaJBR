-- ====================================================================================
-- CORREÇÃO DE INCIDENTE: create_avaliacoes_schema.sql usou o nome de tabela `avaliacoes`
-- sem saber que esse nome já pertencia ao módulo "Notas e Avaliações" (GradesPanel.tsx —
-- professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao,
-- publicada). O script "curou" a tabela adicionando colunas do gerador de provas
-- (titulo, criado_por, modo, status...) e, ao forçar NOT NULL nessas colunas, rodou
-- `DELETE FROM avaliacoes WHERE titulo IS NULL` / `WHERE criado_por IS NULL` — isso
-- apagou TODAS as avaliações de notas já cadastradas (confirmado: count = 0 depois).
-- Não há backup (plano Free, sem PITR): esses dados não são recuperáveis por aqui.
--
-- Este script:
-- 1. Remove da tabela `avaliacoes` (notas) tudo que create_avaliacoes_schema.sql
--    adicionou indevidamente (colunas, constraints, índice, trigger, policies) e
--    desliga o RLS que foi ligado nela (a tabela nunca teve RLS — GradesPanel.tsx não
--    seta criado_por nem depende de usuario_tem_papel aqui).
-- 2. Recria o gerador de provas num namespace próprio (`provas` + `prova_*`), sem
--    colidir com nada do módulo de notas. As tabelas antigas (avaliacao_questoes,
--    avaliacao_turmas, avaliacao_respostas, avaliacao_respostas_itens) estavam vazias
--    (cascata do DELETE acima) — podem ser descartadas com segurança.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Descartar as tabelas do gerador de provas criadas com o nome errado (vazias) —
--    precisa vir antes da limpeza de `avaliacoes`, porque as policies dessas tabelas
--    dependem da coluna avaliacoes.criado_por que será removida a seguir.
-- ------------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.avaliacao_respostas_itens CASCADE;
DROP TABLE IF EXISTS public.avaliacao_respostas CASCADE;
DROP TABLE IF EXISTS public.avaliacao_turmas CASCADE;
DROP TABLE IF EXISTS public.avaliacao_questoes CASCADE;
-- (public.avaliacoes NÃO é descartada — é a tabela de notas, tratada a seguir)

-- ------------------------------------------------------------------------------------
-- 2. Devolver `public.avaliacoes` (notas) ao estado original
-- ------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_avaliacoes_updated_at ON public.avaliacoes;
DROP INDEX IF EXISTS public.avaliacoes_criado_por_idx;

DROP POLICY IF EXISTS "avaliacoes_select_dono_ou_staff" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_insert_professor_coordenacao_gestao" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_update_dono_ou_gestao" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_delete_dono_ou_gestao" ON public.avaliacoes;
ALTER TABLE public.avaliacoes DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_modo_check;
ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_status_check;

ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS titulo;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS disciplina;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS instrucoes;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS valor_total;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS modo;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS data_aplicacao;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS prazo_entrega;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS status;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS criado_por;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.avaliacoes DROP COLUMN IF EXISTS updated_at;

-- ------------------------------------------------------------------------------------
-- 3. Recriar o gerador de provas em namespace próprio: provas / prova_*
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  disciplina text,
  instrucoes text,
  valor_total numeric(5,2) NOT NULL DEFAULT 10,
  modo text NOT NULL DEFAULT 'IMPRESSA' CHECK (modo IN ('IMPRESSA', 'ONLINE', 'AMBAS')),
  data_aplicacao date,
  prazo_entrega timestamptz,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'PUBLICADA', 'ENCERRADA')),
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prova_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  ordem integer NOT NULL DEFAULT 0,
  valor numeric(5,2) NOT NULL DEFAULT 0,
  UNIQUE (prova_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.prova_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  UNIQUE (prova_id, turma_id)
);

CREATE TABLE IF NOT EXISTS public.prova_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  nota numeric(5,2),
  UNIQUE (prova_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS public.prova_respostas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.prova_respostas(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  letra_marcada text,
  correta boolean NOT NULL DEFAULT false,
  valor_obtido numeric(5,2) NOT NULL DEFAULT 0,
  UNIQUE (resposta_id, question_id)
);

CREATE INDEX IF NOT EXISTS provas_criado_por_idx ON public.provas (criado_por);
CREATE INDEX IF NOT EXISTS prova_questoes_prova_id_idx ON public.prova_questoes (prova_id);
CREATE INDEX IF NOT EXISTS prova_turmas_prova_id_idx ON public.prova_turmas (prova_id);
CREATE INDEX IF NOT EXISTS prova_turmas_turma_id_idx ON public.prova_turmas (turma_id);
CREATE INDEX IF NOT EXISTS prova_respostas_aluno_id_idx ON public.prova_respostas (aluno_id);
CREATE INDEX IF NOT EXISTS prova_respostas_itens_resposta_id_idx ON public.prova_respostas_itens (resposta_id);

DROP TRIGGER IF EXISTS trg_provas_updated_at ON public.provas;
CREATE TRIGGER trg_provas_updated_at
  BEFORE UPDATE ON public.provas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provas, public.prova_questoes, public.prova_turmas TO authenticated;
GRANT SELECT ON public.prova_respostas, public.prova_respostas_itens TO authenticated;
GRANT ALL ON public.provas, public.prova_questoes, public.prova_turmas, public.prova_respostas, public.prova_respostas_itens TO service_role;

ALTER TABLE public.provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_respostas_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provas_select_dono_ou_staff" ON public.provas;
CREATE POLICY "provas_select_dono_ou_staff"
  ON public.provas FOR SELECT TO authenticated
  USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP POLICY IF EXISTS "provas_insert_professor_coordenacao_gestao" ON public.provas;
CREATE POLICY "provas_insert_professor_coordenacao_gestao"
  ON public.provas FOR INSERT TO authenticated
  WITH CHECK (
    criado_por = auth.uid()
    AND (public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  );

DROP POLICY IF EXISTS "provas_update_dono_ou_gestao" ON public.provas;
CREATE POLICY "provas_update_dono_ou_gestao"
  ON public.provas FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "provas_delete_dono_ou_gestao" ON public.provas;
CREATE POLICY "provas_delete_dono_ou_gestao"
  ON public.provas FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "prova_questoes_all_dono_ou_staff" ON public.prova_questoes;
CREATE POLICY "prova_questoes_all_dono_ou_staff"
  ON public.prova_questoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

DROP POLICY IF EXISTS "prova_turmas_all_dono_ou_staff" ON public.prova_turmas;
CREATE POLICY "prova_turmas_all_dono_ou_staff"
  ON public.prova_turmas FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

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
-- 4. RPCs do gerador de provas, apontando para provas/prova_* (substitui as versões
--    anteriores que apontavam para avaliacoes/avaliacao_*)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_minhas_avaliacoes_aluno()
RETURNS TABLE (
  avaliacao_id uuid,
  titulo text,
  disciplina text,
  valor_total numeric,
  status text,
  prazo_entrega timestamptz,
  data_aplicacao date,
  resposta_status text,
  nota numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.titulo,
    p.disciplina,
    p.valor_total,
    p.status,
    p.prazo_entrega,
    p.data_aplicacao,
    CASE WHEN r.finalizado_em IS NOT NULL THEN 'ENVIADA' ELSE 'PENDENTE' END,
    r.nota
  FROM provas p
  JOIN prova_turmas pt ON pt.prova_id = p.id
  JOIN alunos al ON al.id = public.meu_aluno_id() AND al.turma_id = pt.turma_id
  LEFT JOIN prova_respostas r ON r.prova_id = p.id AND r.aluno_id = al.id
  WHERE p.status IN ('PUBLICADA', 'ENCERRADA')
  ORDER BY p.data_aplicacao DESC NULLS LAST, p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.rpc_minhas_avaliacoes_aluno() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_minhas_avaliacoes_aluno() TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_questoes_avaliacao_aluno(p_avaliacao_id uuid)
RETURNS TABLE (
  question_id uuid,
  ordem integer,
  valor numeric,
  statement text,
  image_url text,
  alternatives jsonb,
  support_text_content text,
  support_text_image_url text,
  ja_respondida boolean,
  letra_marcada text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id uuid;
  v_prova provas;
  v_resposta_id uuid;
BEGIN
  v_aluno_id := public.meu_aluno_id();
  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Só alunos podem acessar avaliações.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_avaliacao_id;
  IF NOT FOUND OR v_prova.status NOT IN ('PUBLICADA', 'ENCERRADA') THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM prova_turmas pt JOIN alunos al ON al.turma_id = pt.turma_id
    WHERE pt.prova_id = p_avaliacao_id AND al.id = v_aluno_id
  ) THEN
    RAISE EXCEPTION 'Esta avaliação não está disponível para a sua turma.';
  END IF;

  SELECT id INTO v_resposta_id FROM prova_respostas WHERE prova_id = p_avaliacao_id AND aluno_id = v_aluno_id;

  RETURN QUERY
  SELECT
    q.id,
    pq.ordem,
    pq.valor,
    q.statement,
    q.image_url,
    q.alternatives,
    st.content,
    st.image_url,
    (v_resposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM prova_respostas_itens ri WHERE ri.resposta_id = v_resposta_id AND ri.question_id = q.id)),
    (SELECT ri.letra_marcada FROM prova_respostas_itens ri WHERE ri.resposta_id = v_resposta_id AND ri.question_id = q.id)
  FROM prova_questoes pq
  JOIN questions q ON q.id = pq.question_id
  LEFT JOIN support_texts st ON st.id = q.support_text_id
  WHERE pq.prova_id = p_avaliacao_id
  ORDER BY pq.ordem;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_questoes_avaliacao_aluno(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_questoes_avaliacao_aluno(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_submeter_resposta_avaliacao(p_avaliacao_id uuid, p_respostas jsonb)
RETURNS TABLE (
  question_id uuid,
  letra_marcada text,
  correct_letter text,
  correta boolean,
  valor_obtido numeric,
  nota_final numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id uuid;
  v_prova provas;
  v_resposta_id uuid;
  v_item jsonb;
  v_nota numeric := 0;
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
  IF EXISTS (SELECT 1 FROM prova_respostas WHERE prova_id = p_avaliacao_id AND aluno_id = v_aluno_id AND finalizado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Você já enviou esta avaliação.';
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (p_avaliacao_id, v_aluno_id)
  ON CONFLICT (prova_id, aluno_id) DO UPDATE SET prova_id = EXCLUDED.prova_id
  RETURNING id INTO v_resposta_id;

  DELETE FROM prova_respostas_itens WHERE resposta_id = v_resposta_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_respostas)
  LOOP
    INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido)
    SELECT
      v_resposta_id,
      (v_item ->> 'question_id')::uuid,
      v_item ->> 'letra',
      q.correct_letter = (v_item ->> 'letra'),
      CASE WHEN q.correct_letter = (v_item ->> 'letra') THEN pq.valor ELSE 0 END
    FROM prova_questoes pq
    JOIN questions q ON q.id = pq.question_id
    WHERE pq.prova_id = p_avaliacao_id AND pq.question_id = (v_item ->> 'question_id')::uuid;
  END LOOP;

  SELECT COALESCE(SUM(valor_obtido), 0) INTO v_nota FROM prova_respostas_itens WHERE resposta_id = v_resposta_id;

  UPDATE prova_respostas SET finalizado_em = now(), nota = v_nota WHERE id = v_resposta_id;

  RETURN QUERY
  SELECT ri.question_id, ri.letra_marcada, q.correct_letter, ri.correta, ri.valor_obtido, v_nota
  FROM prova_respostas_itens ri
  JOIN questions q ON q.id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_resultados_avaliacao(p_avaliacao_id uuid)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  turma_nome text,
  nota numeric,
  finalizado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM provas p WHERE p.id = p_avaliacao_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver os resultados desta avaliação.';
  END IF;

  RETURN QUERY
  SELECT al.id, al.nome, t.nome, r.nota, r.finalizado_em
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  WHERE r.prova_id = p_avaliacao_id
  ORDER BY t.nome, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resultados_avaliacao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_resultados_avaliacao(uuid) TO authenticated;
