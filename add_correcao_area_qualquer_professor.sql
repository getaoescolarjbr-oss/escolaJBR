-- ====================================================================================
-- QUALQUER PROFESSOR DA ÁREA PODE CORRIGIR A AVALIAÇÃO DE ÁREA PELA CÂMERA
--
-- Como estava: toda RPC de correção (identificar folha, corrigir OMR, ver progresso,
-- lançar no boletim) usa pode_gerir_prova(), que só libera o CRIADOR da prova
-- (normalmente o coordenador de área que montou a avaliação) ou GESTAO/COORDENACAO.
-- Um professor que só contribuiu questões pela própria cota (prova_area_cotas) não
-- conseguia corrigir cartão nenhum — "Sem permissão para corrigir esta prova."
--
-- Isso não bate com o fluxo real: numa avaliação de área, vários professores aplicam a
-- MESMA prova em turmas diferentes (ou dividem a correção da mesma turma), e qualquer um
-- deles deveria poder escanear os cartões da sua parte.
--
-- A nota em si já é compartilhada corretamente entre todos os professores selecionados
-- assim que alguém aciona "lançar no boletim": prova_respostas.nota é ÚNICA por
-- (prova_id, aluno_id) — não pertence a quem corrigiu — e rpc_lancar_notas_boletim já
-- copia essa nota para TODOS os vínculos em prova_avaliacao_notas daquela turma, um por
-- professor da cota (ver fix_prova_avaliacao_notas_constraint_unica.sql). O que faltava
-- era só a PERMISSÃO de chegar a corrigir.
--
-- pode_gerir_prova() continua do jeito que está — ainda é ela quem trava resortear
-- versões (rpc_gerar_versoes_prova) e configurar impressão, que são ações mais
-- sensíveis (invalidam folha já impressa) e continuam restritas ao criador/staff.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.pode_corrigir_prova(p_prova_id uuid)
RETURNS boolean
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
    );
$$;

REVOKE ALL ON FUNCTION public.pode_corrigir_prova(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pode_corrigir_prova(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_identificar_folha: troca a checagem por pode_corrigir_prova.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_identificar_folha(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT
    pa.prova_id, pa.aluno_id, pa.codigo,
    pv.rotulo,
    p.titulo, p.disciplina, p.valor_total, p.modo_nota, p.status,
    al.nome AS aluno_nome, al.aluno_numero AS numero_chamada, al.codigo_sgde,
    t.nome AS turma_nome, sr.nome AS serie_nome,
    (SELECT count(*) FROM unnest(pv.ordem_questoes) AS qid
       JOIN questions q ON q.id = qid
      WHERE q.tipo = 'OBJETIVA' AND jsonb_array_length(q.alternatives) > 0) AS linhas_cartao,
    r.finalizado_em, r.nota, r.nota_ponderada
  INTO v_rec
  FROM prova_alocacoes pa
  JOIN prova_versoes pv ON pv.id = pa.versao_id
  JOIN provas p ON p.id = pa.prova_id
  JOIN alunos al ON al.id = pa.aluno_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN series_referencia sr ON sr.id = t.serie_id
  LEFT JOIN prova_respostas r ON r.prova_id = pa.prova_id AND r.aluno_id = pa.aluno_id
  WHERE pa.codigo = upper(trim(p_codigo));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Confira se o cartão é desta prova.';
  END IF;

  IF NOT public.pode_corrigir_prova(v_rec.prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta prova.';
  END IF;

  RETURN jsonb_build_object(
    'prova_id', v_rec.prova_id,
    'aluno_id', v_rec.aluno_id,
    'codigo', v_rec.codigo,
    'versao', v_rec.rotulo,
    'titulo', v_rec.titulo,
    'disciplina', v_rec.disciplina,
    'valor_total', v_rec.valor_total,
    'modo_nota', v_rec.modo_nota,
    'status', v_rec.status,
    'aluno_nome', v_rec.aluno_nome,
    'numero_chamada', v_rec.numero_chamada,
    'codigo_sgde', v_rec.codigo_sgde,
    'turma_nome', v_rec.turma_nome,
    'serie_nome', v_rec.serie_nome,
    'linhas_cartao', v_rec.linhas_cartao,
    'ja_corrigido', v_rec.finalizado_em IS NOT NULL,
    'nota', v_rec.nota,
    'nota_ponderada', v_rec.nota_ponderada
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_identificar_folha(text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_identificar_folha(text) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_corrigir_omr: mesma troca.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_corrigir_omr(p_codigo text, p_marcacoes jsonb, p_origem text DEFAULT 'CAMERA')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id uuid;
  v_aluno_id uuid;
  v_alocacao_id uuid;
  v_versao prova_versoes;
  v_prova provas;
  v_resposta_id uuid;
  v_acertos integer := 0;
  v_erros integer := 0;
  v_brancos integer := 0;
  v_anuladas integer := 0;
  v_total_linhas integer;
  v_nota numeric;
BEGIN
  IF p_origem NOT IN ('CAMERA', 'MANUAL') THEN
    RAISE EXCEPTION 'Origem inválida.';
  END IF;
  IF jsonb_typeof(p_marcacoes) <> 'array' THEN
    RAISE EXCEPTION 'As marcações devem vir como lista.';
  END IF;

  SELECT pa.id, pa.prova_id, pa.aluno_id INTO v_alocacao_id, v_prova_id, v_aluno_id
  FROM prova_alocacoes pa WHERE pa.codigo = upper(trim(p_codigo));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Confira se o cartão é desta prova.';
  END IF;

  IF NOT public.pode_corrigir_prova(v_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = v_prova_id;
  IF v_prova.status = 'RASCUNHO' THEN
    RAISE EXCEPTION 'Publique a prova antes de corrigir os cartões.';
  END IF;

  SELECT pv.* INTO v_versao FROM prova_versoes pv
  JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pa.id = v_alocacao_id;

  SELECT count(*) INTO v_total_linhas FROM public.linhas_cartao_versao(v_versao.id);

  IF jsonb_array_length(p_marcacoes) <> v_total_linhas THEN
    RAISE EXCEPTION 'A leitura trouxe % linhas, mas o cartão da versão % tem %.',
      jsonb_array_length(p_marcacoes), v_versao.rotulo, v_total_linhas;
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (v_prova_id, v_aluno_id)
  ON CONFLICT (prova_id, aluno_id) DO UPDATE SET prova_id = EXCLUDED.prova_id
  RETURNING id INTO v_resposta_id;

  DELETE FROM prova_respostas_itens ri
  USING public.linhas_cartao_versao(v_versao.id) l
  WHERE ri.resposta_id = v_resposta_id AND ri.question_id = l.question_id;

  WITH lidas AS (
    SELECT
      l.question_id,
      l.correct_letter,
      m.bolha,
      public.bolha_para_alternativa(m.bolha, l.mapa, l.qtd_alternativas) AS letra_original
    FROM public.linhas_cartao_versao(v_versao.id) l
    JOIN LATERAL (
      SELECT upper(trim(COALESCE(x.valor, ''))) AS bolha
      FROM jsonb_array_elements_text(p_marcacoes) WITH ORDINALITY AS x(valor, pos)
      WHERE x.pos = l.linha
    ) m ON true
  )
  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido, corrigido_por, corrigido_em)
  SELECT
    v_resposta_id,
    li.question_id,
    li.bolha,
    li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter,
    CASE WHEN li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter
         THEN COALESCE(pq.valor, 0) ELSE 0 END,
    true,
    auth.uid(),
    now()
  FROM lidas li
  LEFT JOIN prova_questoes pq ON pq.prova_id = v_prova_id AND pq.question_id = li.question_id;

  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido)
  SELECT v_resposta_id, q.id, NULL, false, 0, false
  FROM unnest(v_versao.ordem_questoes) AS qid
  JOIN questions q ON q.id = qid
  WHERE q.tipo IN ('DISSERTATIVA', 'REDACAO')
  ON CONFLICT (resposta_id, question_id) DO NOTHING;

  SELECT
    count(*) FILTER (WHERE ri.correta)::int,
    count(*) FILTER (WHERE NOT ri.correta AND ri.letra_marcada IN ('A','B','C','D','E'))::int,
    count(*) FILTER (WHERE ri.letra_marcada IS NULL OR ri.letra_marcada = '')::int,
    count(*) FILTER (WHERE ri.letra_marcada = '*')::int
  INTO v_acertos, v_erros, v_brancos, v_anuladas
  FROM prova_respostas_itens ri
  JOIN public.linhas_cartao_versao(v_versao.id) l ON l.question_id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;

  UPDATE prova_respostas SET finalizado_em = COALESCE(finalizado_em, now()) WHERE id = v_resposta_id;

  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  INSERT INTO prova_leituras (prova_id, aluno_id, alocacao_id, marcacoes, origem, lido_por)
  VALUES (v_prova_id, v_aluno_id, v_alocacao_id, p_marcacoes, p_origem, auth.uid());

  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(v_prova_id);
    SELECT nota_ponderada INTO v_nota FROM prova_respostas WHERE id = v_resposta_id;
  END IF;

  RETURN jsonb_build_object(
    'aluno_id', v_aluno_id,
    'prova_id', v_prova_id,
    'versao', v_versao.rotulo,
    'acertos', v_acertos,
    'erros', v_erros,
    'em_branco', v_brancos,
    'anuladas', v_anuladas,
    'total_linhas', v_total_linhas,
    'nota', v_nota,
    'valor_total', v_prova.valor_total,
    'modo_nota', v_prova.modo_nota
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_recalcular_ponderada: chamada de dentro de rpc_corrigir_omr a cada cartão lido
-- (modo PONDERADA recalcula a turma toda). Tinha a mesma trava de pode_gerir_prova.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_recalcular_ponderada(p_prova_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_afetadas integer;
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para recalcular as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF v_prova.modo_nota <> 'PONDERADA' THEN
    UPDATE prova_respostas SET nota_ponderada = NULL WHERE prova_id = p_prova_id;
    RETURN 0;
  END IF;

  WITH base AS (
    SELECT
      r.id,
      r.nota AS pontos,
      CASE WHEN v_prova.ponderada_escopo = 'TURMA' THEN al.turma_id ELSE NULL END AS grupo
    FROM prova_respostas r
    JOIN alunos al ON al.id = r.aluno_id
    WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ),
  referencia AS (
    SELECT b.*, max(b.pontos) OVER (PARTITION BY b.grupo) AS topo FROM base b
  )
  UPDATE prova_respostas r
     SET nota_ponderada = CASE
       WHEN ref.topo IS NULL OR ref.topo <= 0 THEN 0
       ELSE round(v_prova.valor_total * ref.pontos / ref.topo, 2)
     END
  FROM referencia ref
  WHERE r.id = ref.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_recalcular_ponderada(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_recalcular_ponderada(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_progresso_correcao: painel de quem já entregou/falta — qualquer professor da área
-- também precisa ver isso pra saber o que falta corrigir.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_progresso_correcao(p_prova_id uuid)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  numero_chamada integer,
  turma_nome text,
  versao text,
  codigo text,
  corrigido boolean,
  acertos integer,
  total_objetivas integer,
  nota numeric,
  nota_ponderada numeric,
  status_correcao text,
  lido_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver o progresso desta prova.';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.nome,
    al.aluno_numero,
    t.nome,
    pv.rotulo,
    pa.codigo,
    r.finalizado_em IS NOT NULL,
    (SELECT count(*)::int FROM prova_respostas_itens ri
       JOIN questions q ON q.id = ri.question_id
      WHERE ri.resposta_id = r.id AND ri.correta AND q.tipo = 'OBJETIVA'),
    (SELECT count(*)::int FROM prova_questoes pq
       JOIN questions q ON q.id = pq.question_id
      WHERE pq.prova_id = p_prova_id AND q.tipo = 'OBJETIVA'),
    r.nota,
    r.nota_ponderada,
    r.status_correcao,
    (SELECT max(pl.lido_em) FROM prova_leituras pl WHERE pl.prova_id = p_prova_id AND pl.aluno_id = al.id)
  FROM prova_alocacoes pa
  JOIN alunos al ON al.id = pa.aluno_id
  JOIN prova_versoes pv ON pv.id = pa.versao_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN prova_respostas r ON r.prova_id = p_prova_id AND r.aluno_id = al.id
  WHERE pa.prova_id = p_prova_id
  ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_progresso_correcao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_progresso_correcao(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_lancar_notas_boletim: qualquer professor da área também pode lançar — a nota já é
-- a mesma pra prova inteira (não pertence a quem corrigiu) e o INSERT abaixo grava em
-- CADA avaliacao_id vinculado (um por professor da cota naquela turma), então lançar já
-- credita todos os professores selecionados, não só quem corrigiu.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_lancar_notas_boletim(p_prova_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_lancadas integer;
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

  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT
    pan.avaliacao_id,
    r.aluno_id,
    CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;
  RETURN v_lancadas;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lancar_notas_boletim(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_notas_boletim(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- rpc_gabarito_versao: usado pela correção manual (sem câmera) pra mostrar a resposta
-- certa de cada linha — mesma extensão de permissão.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_gabarito_versao(p_prova_id uuid, p_rotulo text)
RETURNS TABLE (
  linha integer,
  numero_na_prova integer,
  question_id uuid,
  bolha_correta text,
  qtd_alternativas integer,
  valor numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao_id uuid;
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver o gabarito desta prova.';
  END IF;

  SELECT id INTO v_versao_id FROM prova_versoes WHERE prova_id = p_prova_id AND rotulo = upper(p_rotulo);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão % não encontrada nesta prova.', p_rotulo;
  END IF;

  RETURN QUERY
  SELECT
    l.linha,
    l.numero_na_prova,
    l.question_id,
    CASE
      WHEN l.mapa IS NULL THEN l.correct_letter
      ELSE (
        SELECT chr(64 + m.pos::int)
        FROM jsonb_array_elements_text(l.mapa) WITH ORDINALITY AS m(letra, pos)
        WHERE m.letra = l.correct_letter
        LIMIT 1
      )
    END,
    l.qtd_alternativas,
    COALESCE(pq.valor, 0)
  FROM public.linhas_cartao_versao(v_versao_id) l
  LEFT JOIN prova_questoes pq ON pq.prova_id = p_prova_id AND pq.question_id = l.question_id
  ORDER BY l.linha;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gabarito_versao(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_gabarito_versao(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
