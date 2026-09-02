-- A pedido: opção "uma versão por aluno da turma" no gerador de provas, além do já
-- existente "1 a 4 versões". Três ajustes:
--
-- 1) provas_qtd_versoes_check travava em 4 — sobe pra 60 (folga confortável acima do
--    tamanho real de qualquer turma da escola).
-- 2) rpc_gerar_versoes_prova rotulava a versão com chr(64+v_i), que só funciona até a
--    versão 26 ('Z'); a partir da 27ª vira caractere fora do alfabeto (chr(91)='['...).
--    Troca pelo rótulo estilo coluna de planilha (A..Z, AA, AB, ...), que não tem teto.
-- 3) Nova rpc_contar_alunos_ativos_turmas: o front usa pra saber quantos alunos ativos
--    (mesmo critério de exclusão de transferido/remanejado já usado na distribuição, só
--    reaproveitado aqui) as turmas escolhidas têm, e sugerir esse número como qtd_versoes
--    quando o professor marcar "uma versão por aluno".

ALTER TABLE public.provas DROP CONSTRAINT IF EXISTS provas_qtd_versoes_check;
ALTER TABLE public.provas ADD CONSTRAINT provas_qtd_versoes_check CHECK (qtd_versoes BETWEEN 1 AND 60);

-- prova_versoes.rotulo tinha CHECK (rotulo IN ('A','B','C','D')), de
-- create_correcao_omr.sql, quando quatro versões eram o teto. Sem soltar esse CHECK
-- junto, subir qtd_versoes para 60 não adianta: o INSERT da 5ª versão estoura em
-- prova_versoes_rotulo_check, no meio de rpc_gerar_versoes_prova, e o professor recebe
-- um erro de banco cru ao tentar sortear. O formato agora é o de coluna de planilha
-- (A..Z, AA, AB, ...), então a restrição vira só de forma.
ALTER TABLE public.prova_versoes DROP CONSTRAINT IF EXISTS prova_versoes_rotulo_check;
ALTER TABLE public.prova_versoes ADD CONSTRAINT prova_versoes_rotulo_check CHECK (rotulo ~ '^[A-Z]{1,2}$');

-- ------------------------------------------------------------------------------------
-- Rótulo estilo coluna de planilha: 1->A, 2->B, ..., 26->Z, 27->AA, 28->AB, ...
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotulo_versao_prova(p_indice integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n integer := p_indice;
  resultado text := '';
  resto integer;
BEGIN
  IF n < 1 THEN
    RETURN '?';
  END IF;
  WHILE n > 0 LOOP
    resto := (n - 1) % 26;
    resultado := chr(65 + resto) || resultado;
    n := (n - 1) / 26;
  END LOOP;
  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_gerar_versoes_prova(p_prova_id uuid)
RETURNS TABLE (rotulo text, alunos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_ordem_original uuid[];
  v_i integer;
  v_rotulo text;
  v_versao_id uuid;
  v_ordem uuid[];
  v_mapa jsonb;
  v_versao_ids uuid[] := '{}';
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar versões desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_respostas WHERE prova_id = p_prova_id AND finalizado_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM prova_leituras WHERE prova_id = p_prova_id)
  THEN
    RAISE EXCEPTION 'Esta prova já tem respostas corrigidas — refazer o sorteio invalidaria as folhas já aplicadas.';
  END IF;

  SELECT array_agg(question_id ORDER BY ordem, question_id)
    INTO v_ordem_original
  FROM prova_questoes WHERE prova_id = p_prova_id;

  IF v_ordem_original IS NULL OR array_length(v_ordem_original, 1) IS NULL THEN
    RAISE EXCEPTION 'A prova não tem questões.';
  END IF;

  -- Sorteio novo: fora o que existia. O CASCADE de prova_versoes leva junto as
  -- alocações antigas (e, com elas, os códigos de QR já impressos).
  DELETE FROM prova_versoes WHERE prova_id = p_prova_id;

  FOR v_i IN 1..v_prova.qtd_versoes LOOP
    v_rotulo := public.rotulo_versao_prova(v_i);

    IF v_i = 1 OR v_prova.embaralhar = 'NENHUM' THEN
      -- Versão A é a cópia de referência: nada é permutado nela.
      v_ordem := v_ordem_original;
      v_mapa := '{}'::jsonb;
    ELSE
      SELECT array_agg(qid ORDER BY random())
        INTO v_ordem
      FROM unnest(v_ordem_original) AS qid;

      IF v_prova.embaralhar = 'QUESTOES_ALTERNATIVAS' THEN
        -- Só questão objetiva com 2+ alternativas entra no mapa: permutar uma lista de
        -- uma alternativa só é ruído, e dissertativa/redação não tem alternativa nenhuma.
        SELECT COALESCE(jsonb_object_agg(q.id::text, p.letras), '{}'::jsonb)
          INTO v_mapa
        FROM questions q
        CROSS JOIN LATERAL (
          SELECT jsonb_agg(alt->>'letter' ORDER BY random()) AS letras
          FROM jsonb_array_elements(q.alternatives) AS alt
        ) p
        WHERE q.id = ANY(v_ordem_original)
          AND q.tipo = 'OBJETIVA'
          AND jsonb_array_length(q.alternatives) > 1;
      ELSE
        v_mapa := '{}'::jsonb;
      END IF;
    END IF;

    INSERT INTO prova_versoes (prova_id, rotulo, ordem_questoes, mapa_alternativas)
    VALUES (p_prova_id, v_rotulo, v_ordem, v_mapa)
    RETURNING id INTO v_versao_id;

    v_versao_ids := v_versao_ids || v_versao_id;
  END LOOP;

  -- Distribuição em rodízio pela ordem de chamada: alunos vizinhos na sala recebem
  -- versões diferentes, que é o ponto inteiro de ter mais de uma versão.
  --
  -- Quem saiu da escola não recebe folha: transferido e remanejado continuam na tabela
  -- (com o nome riscado nas listas) e gerariam prova impressa para aluno que não vai
  -- aparecer. O filtro é uma lista de EXCLUSÃO, não de inclusão, para que um status novo
  -- que apareça amanhã entre na prova por padrão em vez de sumir dela em silêncio —
  -- errar imprimindo uma folha a mais é barato; errar deixando um aluno sem prova, não.
  -- Atestado fica: o aluno segue matriculado e faz a avaliação depois.
  INSERT INTO prova_alocacoes (prova_id, aluno_id, versao_id, codigo)
  SELECT
    p_prova_id,
    a.aluno_id,
    v_versao_ids[1 + (a.pos % v_prova.qtd_versoes)],
    public.gerar_codigo_alocacao()
  FROM (
    SELECT
      al.id AS aluno_id,
      (row_number() OVER (ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome) - 1)::int AS pos
    FROM prova_turmas pt
    JOIN alunos al ON al.turma_id = pt.turma_id
    LEFT JOIN turmas t ON t.id = al.turma_id
    WHERE pt.prova_id = p_prova_id
      AND lower(coalesce(al.status, 'ativo')) NOT IN ('transferido', 'remanejado')
  ) a
  ON CONFLICT (prova_id, aluno_id) DO NOTHING;

  RETURN QUERY
  SELECT pv.rotulo, count(pa.id)::integer
  FROM prova_versoes pv
  LEFT JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pv.prova_id = p_prova_id
  GROUP BY pv.rotulo
  ORDER BY pv.rotulo;
END;
$$;

-- ------------------------------------------------------------------------------------
-- Contagem de alunos ativos das turmas escolhidas, pro front sugerir a qtd_versoes
-- quando o professor marca "uma versão por aluno". Mesmo critério de exclusão que a
-- distribuição acima usa — se um dia esse critério mudar, muda nos dois lugares juntos.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_contar_alunos_ativos_turmas(p_turma_ids uuid[])
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM alunos al
  WHERE al.turma_id = ANY(p_turma_ids)
    AND lower(coalesce(al.status, 'ativo')) NOT IN ('transferido', 'remanejado');
$$;

REVOKE ALL ON FUNCTION public.rpc_contar_alunos_ativos_turmas(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_contar_alunos_ativos_turmas(uuid[]) TO authenticated;
