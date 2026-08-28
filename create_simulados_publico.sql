-- ====================================================================================
-- SIMULADOS — variação do gerador de provas (provas/prova_*, ver
-- fix_provas_table_collision.sql) para aplicação pública, sem login: o aluno acessa um
-- link com um token e digita o código SGDE; nome, série e turma vêm prontos e as
-- respostas são gravadas nas MESMAS tabelas prova_respostas/prova_respostas_itens
-- (reaproveita rpc_resultados_avaliacao para o professor ver os resultados).
--
-- Diferença central de um Simulado para uma Avaliação comum (provas.tipo):
-- - Nunca é sincronizado com "Notas e Avaliações" (ver sincronizarNotasDaProva em
--   avaliacoesService.ts, que só roda para tipo = 'AVALIACAO').
-- - É respondido por um token público (provas.token_publico) + código SGDE, via RPCs
--   SECURITY DEFINER liberadas para o papel `anon` — não passa pela sessão logada do
--   aluno (meu_aluno_id()) nem pelas RPCs rpc_*_avaliacao_aluno existentes.
-- ====================================================================================

ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'AVALIACAO';
DO $$ BEGIN
  ALTER TABLE public.provas ADD CONSTRAINT provas_tipo_check CHECK (tipo IN ('AVALIACAO', 'SIMULADO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS token_publico uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS provas_token_publico_idx ON public.provas (token_publico);

-- Usado para preencher automaticamente o número da chamada no simulado (quando
-- cadastrado — ver reimportar_01_codigo_sgde.sql para o mesmo padrão do código SGDE).
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS numero_chamada integer;

-- ------------------------------------------------------------------------------------
-- RPCs públicas (anon) — nunca expõem correct_letter/explanation antes da submissão,
-- igual às RPCs autenticadas em fix_provas_table_collision.sql.
-- ------------------------------------------------------------------------------------

-- Ponto de entrada do link público: valida o token + status do simulado, identifica o
-- aluno pelo código SGDE (prefill de nome/turma/série) e devolve as questões sem
-- gabarito. Se o aluno já enviou, devolve ja_enviado=true e a nota (feedback do
-- simulado — não é nota de boletim).
CREATE OR REPLACE FUNCTION public.rpc_simulado_publico_iniciar(p_token uuid, p_codigo_sgde text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_aluno RECORD;
  v_resposta_id uuid;
  v_nota numeric;
  v_questoes jsonb;
BEGIN
  SELECT * INTO v_prova FROM provas WHERE token_publico = p_token AND tipo = 'SIMULADO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado não encontrado.';
  END IF;
  IF v_prova.status NOT IN ('PUBLICADA', 'ENCERRADA') THEN
    RAISE EXCEPTION 'Este simulado não está disponível no momento.';
  END IF;

  SELECT al.id, al.nome, al.numero_chamada, t.nome AS turma_nome, sr.nome AS serie_nome
  INTO v_aluno
  FROM alunos al
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN series_referencia sr ON sr.id = t.serie_id
  WHERE al.codigo_sgde = p_codigo_sgde;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código SGDE não encontrado. Confira o número e tente novamente.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_turmas WHERE prova_id = v_prova.id)
    AND NOT EXISTS (
      SELECT 1 FROM prova_turmas pt JOIN alunos al ON al.turma_id = pt.turma_id
      WHERE pt.prova_id = v_prova.id AND al.id = v_aluno.id
    )
  THEN
    RAISE EXCEPTION 'Este simulado não está disponível para a sua turma.';
  END IF;

  SELECT id, nota INTO v_resposta_id, v_nota
  FROM prova_respostas WHERE prova_id = v_prova.id AND aluno_id = v_aluno.id AND finalizado_em IS NOT NULL;

  SELECT jsonb_agg(jsonb_build_object(
    'question_id', q.id,
    'ordem', pq.ordem,
    'valor', pq.valor,
    'statement', q.statement,
    'image_url', q.image_url,
    'alternatives', q.alternatives,
    'support_text_content', st.content,
    'support_text_image_url', st.image_url
  ) ORDER BY pq.ordem)
  INTO v_questoes
  FROM prova_questoes pq
  JOIN questions q ON q.id = pq.question_id
  LEFT JOIN support_texts st ON st.id = q.support_text_id
  WHERE pq.prova_id = v_prova.id;

  RETURN jsonb_build_object(
    'prova', jsonb_build_object(
      'id', v_prova.id, 'titulo', v_prova.titulo, 'disciplina', v_prova.disciplina,
      'instrucoes', v_prova.instrucoes, 'valor_total', v_prova.valor_total, 'status', v_prova.status
    ),
    'aluno', jsonb_build_object(
      'nome', v_aluno.nome, 'numero_chamada', v_aluno.numero_chamada,
      'turma', v_aluno.turma_nome, 'serie', v_aluno.serie_nome
    ),
    'ja_enviado', v_resposta_id IS NOT NULL,
    'nota', v_nota,
    'questoes', COALESCE(v_questoes, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simulado_publico_iniciar(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_simulado_publico_iniciar(uuid, text) TO anon, authenticated;

-- Submete as respostas do simulado (correção 100% no servidor, igual
-- rpc_submeter_resposta_avaliacao) e devolve o resultado com gabarito. Nunca grava em
-- notas_avaliacoes/avaliacoes — este fluxo só toca prova_respostas/prova_respostas_itens.
CREATE OR REPLACE FUNCTION public.rpc_simulado_publico_submeter(p_token uuid, p_codigo_sgde text, p_respostas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_aluno_id uuid;
  v_resposta_id uuid;
  v_item jsonb;
  v_nota numeric := 0;
  v_itens jsonb;
BEGIN
  SELECT * INTO v_prova FROM provas WHERE token_publico = p_token AND tipo = 'SIMULADO';
  IF NOT FOUND OR v_prova.status <> 'PUBLICADA' THEN
    RAISE EXCEPTION 'Este simulado não está disponível para envio.';
  END IF;
  IF v_prova.prazo_entrega IS NOT NULL AND now() > v_prova.prazo_entrega THEN
    RAISE EXCEPTION 'O prazo de entrega deste simulado já encerrou.';
  END IF;

  SELECT id INTO v_aluno_id FROM alunos WHERE codigo_sgde = p_codigo_sgde;
  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Código SGDE não encontrado.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_turmas WHERE prova_id = v_prova.id)
    AND NOT EXISTS (
      SELECT 1 FROM prova_turmas pt JOIN alunos al ON al.turma_id = pt.turma_id
      WHERE pt.prova_id = v_prova.id AND al.id = v_aluno_id
    )
  THEN
    RAISE EXCEPTION 'Este simulado não está disponível para a sua turma.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_respostas WHERE prova_id = v_prova.id AND aluno_id = v_aluno_id AND finalizado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Você já enviou este simulado.';
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (v_prova.id, v_aluno_id)
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
    WHERE pq.prova_id = v_prova.id AND pq.question_id = (v_item ->> 'question_id')::uuid;
  END LOOP;

  SELECT COALESCE(SUM(valor_obtido), 0) INTO v_nota FROM prova_respostas_itens WHERE resposta_id = v_resposta_id;
  UPDATE prova_respostas SET finalizado_em = now(), nota = v_nota WHERE id = v_resposta_id;

  SELECT jsonb_agg(jsonb_build_object(
    'question_id', ri.question_id,
    'letra_marcada', ri.letra_marcada,
    'correct_letter', q.correct_letter,
    'correta', ri.correta,
    'valor_obtido', ri.valor_obtido
  ))
  INTO v_itens
  FROM prova_respostas_itens ri JOIN questions q ON q.id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;

  RETURN jsonb_build_object('nota_final', v_nota, 'itens', COALESCE(v_itens, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simulado_publico_submeter(uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_simulado_publico_submeter(uuid, text, jsonb) TO anon, authenticated;
