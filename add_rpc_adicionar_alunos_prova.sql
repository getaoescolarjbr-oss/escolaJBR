-- ====================================================================================
-- ADICIONAR ALUNOS NOVOS A UMA PROVA JÁ SORTEADA (sem invalidar folhas já impressas)
--
-- Depende de create_correcao_omr.sql e permitir_versao_por_aluno_avaliacao.sql.
--
-- rpc_gerar_versoes_prova é destrutiva de propósito: ela APAGA prova_versoes (e, em
-- cascata, prova_alocacoes) para resortear do zero. Isso é correto na primeira geração,
-- mas fica errado quando o professor já imprimiu as folhas e só matriculou um aluno novo
-- na turma depois — resortear trocaria o código do QR de todo mundo, inclusive de quem
-- já recebeu e talvez já tenha respondido a folha impressa.
--
-- Esta RPC faz só o incremento: acha quem está nas turmas da prova mas ainda não tem
-- prova_alocacoes, e insere cada um numa versão JÁ EXISTENTE (rodízio, mesmo critério de
-- exclusão de transferido/remanejado da geração original) — sem tocar em prova_versoes
-- nem nas alocações que já existiam.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_adicionar_alunos_prova(p_prova_id uuid)
RETURNS TABLE (aluno_id uuid, aluno_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao_ids uuid[];
  v_qtd_versoes integer;
  v_total_atual integer;
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar as folhas desta prova.';
  END IF;

  SELECT array_agg(id ORDER BY rotulo) INTO v_versao_ids
  FROM prova_versoes WHERE prova_id = p_prova_id;

  v_qtd_versoes := COALESCE(array_length(v_versao_ids, 1), 0);
  IF v_qtd_versoes = 0 THEN
    RAISE EXCEPTION 'Gere as versões da prova antes de adicionar alunos novos.';
  END IF;

  SELECT count(*) INTO v_total_atual FROM prova_alocacoes WHERE prova_id = p_prova_id;

  RETURN QUERY
  WITH novos AS (
    SELECT
      al.id AS aluno_id,
      al.nome AS aluno_nome,
      (v_total_atual + row_number() OVER (
        ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome
      ) - 1)::int AS pos
    FROM prova_turmas pt
    JOIN alunos al ON al.turma_id = pt.turma_id
    LEFT JOIN turmas t ON t.id = al.turma_id
    WHERE pt.prova_id = p_prova_id
      AND lower(coalesce(al.status, 'ativo')) NOT IN ('transferido', 'remanejado')
      AND NOT EXISTS (
        SELECT 1 FROM prova_alocacoes pa
        WHERE pa.prova_id = p_prova_id AND pa.aluno_id = al.id
      )
  ),
  inseridos AS (
    INSERT INTO prova_alocacoes (prova_id, aluno_id, versao_id, codigo)
    SELECT
      p_prova_id,
      n.aluno_id,
      v_versao_ids[1 + (n.pos % v_qtd_versoes)],
      public.gerar_codigo_alocacao()
    FROM novos n
    ON CONFLICT (prova_id, aluno_id) DO NOTHING
    RETURNING prova_alocacoes.aluno_id
  )
  SELECT n.aluno_id, n.aluno_nome
  FROM novos n
  JOIN inseridos i ON i.aluno_id = n.aluno_id
  ORDER BY n.pos;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_adicionar_alunos_prova(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_adicionar_alunos_prova(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
