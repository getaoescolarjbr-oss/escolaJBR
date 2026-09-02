-- ====================================================================================
-- O PROFESSOR PASSA A VER SÓ AS PRÓPRIAS TURMAS
--
-- Terceira etapa. As duas anteriores (fechar_exposicao_anon.sql e
-- endurecer_professores_e_funcoes.sql) tiraram a escola da internet; esta trata da
-- compartimentação interna, que é outro problema: hoje qualquer conta de servidor
-- logada lê os 506 alunos, as 16.092 notas e os 4.227 vistos da escola inteira.
--
-- O QUE MUDA, E PARA QUEM
--
-- Só para quem é PROFESSOR e nada mais. Ele passa a enxergar os alunos das turmas em
-- que tem alocação (alocacoes_v2), e as avaliações, notas, atividades e vistos ligados
-- a essas turmas ou a ele. Nenhum outro papel muda: gestão, secretaria, coordenação,
-- coordenação de área, biblioteca, inspetoria, nutrição e PCPI continuam vendo a escola
-- toda, porque é disso que as telas deles vivem.
--
-- Políticas permissivas se somam, então um professor que também é coordenador continua
-- com a visão ampla — o papel mais largo vence, que é o comportamento certo.
--
-- A BIBLIOTECA, QUE QUASE QUEBROU
--
-- O módulo Biblioteca é aberto a PROFESSOR, e bibliotecaService.buscarAlunos procura
-- QUALQUER aluno ativo pelo nome para registrar um empréstimo. Com o professor restrito
-- às próprias turmas, essa busca pararia de achar a maioria dos alunos e o empréstimo
-- quebraria em silêncio — o campo simplesmente não encontraria ninguém.
--
-- A saída não é abrir a tabela de volta: é a busca deixar de precisar dela. Entra
-- rpc_buscar_alunos_biblioteca, SECURITY DEFINER, que devolve id, nome e turma — e nada
-- mais. O professor continua emprestando livro para a escola inteira sem ganhar acesso
-- a foto, atestado, CID ou código SGDE de aluno que não é dele. É o mesmo padrão que
-- rpc_buscar_alunos_matricula já usa no autocadastro.
--
-- ESCRITA CONTINUA COMO ESTAVA
--
-- Isto restringe o VER. Gravar segue liberado a qualquer servidor, como antes: apertar
-- a escrita mexe em GradesPanel, StudentList, diário e lançamento de notas de uma vez
-- só, e merece a sua própria rodada com as telas na mão.
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- 1. Helpers
--
-- Ambos STABLE — mas STABLE sozinho NÃO basta dentro de uma política: o Postgres
-- reavalia a função linha a linha mesmo assim. Medido neste banco, o boletim do
-- professor (notas + avaliações) passou de 1,5s para 10s com a chamada direta.
--
-- O que resolve é envolver cada chamada num (SELECT ...) nas políticas abaixo: isso
-- vira um InitPlan, calculado uma vez por consulta e reaproveitado em todas as linhas.
-- Para o array de turmas a forma é `IN (SELECT unnest(...))`: `= ANY (subconsulta)`
-- pede um conjunto de escalares, não um array, e estoura com "operator does not exist:
-- uuid = uuid[]". O IN também resolve como subplano único.
--
-- É por isso que as políticas dizem `(SELECT public.enxerga_escola_inteira())` e não
-- simplesmente `public.enxerga_escola_inteira()`.
-- ------------------------------------------------------------------------------------

-- Índice que faltava: a política de aluno consulta alocacoes_v2 por professor a cada
-- consulta, e a tabela só tinha índice por id e pelos campos de espelho/atestado.
CREATE INDEX IF NOT EXISTS alocacoes_v2_professor_turma_idx
  ON public.alocacoes_v2 (professor_id, turma_id);

/**
 * Papéis que precisam da escola inteira para as próprias telas funcionarem:
 * secretaria e gestão administram todo mundo; coordenação e coordenação de área
 * acompanham qualquer turma; biblioteca empresta a qualquer aluno; inspetoria controla
 * entrada e saída; nutrição conta refeição; PCPI agenda recurso para qualquer turma.
 *
 * PROFESSOR fica fora de propósito — é justamente ele que esta migração restringe.
 */
CREATE OR REPLACE FUNCTION public.enxerga_escola_inteira()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_tem_papel('GESTAO')
      OR public.usuario_tem_papel('SECRETARIA')
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('COORDENACAO_AREA')
      OR public.usuario_tem_papel('BIBLIOTECA')
      OR public.usuario_tem_papel('INSPETOR')
      OR public.usuario_tem_papel('NUTRICAO')
      OR public.usuario_tem_papel('PCPI');
$$;

REVOKE ALL ON FUNCTION public.enxerga_escola_inteira() FROM public;
REVOKE ALL ON FUNCTION public.enxerga_escola_inteira() FROM anon;
GRANT EXECUTE ON FUNCTION public.enxerga_escola_inteira() TO authenticated;

/**
 * As turmas em que a conta logada tem alocação. Devolve array (e não uma tabela) para
 * o `= ANY (...)` da política resolver com uma única leitura.
 *
 * Inclui alocação de espelho — a que cobre um professor de atestado. Quem está
 * substituindo precisa ver a turma que assumiu, senão a substituição não funciona.
 */
CREATE OR REPLACE FUNCTION public.minhas_turmas_de_professor()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT a.turma_id), ARRAY[]::uuid[])
  FROM alocacoes_v2 a
  WHERE a.professor_id = (SELECT public.meu_professor_id());
$$;

REVOKE ALL ON FUNCTION public.minhas_turmas_de_professor() FROM public;
REVOKE ALL ON FUNCTION public.minhas_turmas_de_professor() FROM anon;
GRANT EXECUTE ON FUNCTION public.minhas_turmas_de_professor() TO authenticated;


-- ------------------------------------------------------------------------------------
-- 2. alunos
--
-- O `id = meu_aluno_id()` no fim mantém o BiblioClube: o aluno logado continua lendo a
-- própria ficha.
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "alunos_select_autenticado" ON public.alunos;
DROP POLICY IF EXISTS "alunos_select_por_alcance" ON public.alunos;
CREATE POLICY "alunos_select_por_alcance" ON public.alunos
  FOR SELECT TO authenticated
  USING (
    (SELECT public.enxerga_escola_inteira())
    OR turma_id IN (SELECT unnest(public.minhas_turmas_de_professor()))
    OR id = (SELECT public.meu_aluno_id())
  );


-- ------------------------------------------------------------------------------------
-- 3. Avaliações de nota e as notas lançadas nelas
--
-- `avaliacoes` guarda professor_id e turma_id, então dá para casar pelos dois: a
-- avaliação que o professor criou, e a de qualquer colega numa turma dele — que é o que
-- o boletim mostra quando várias disciplinas dividem a mesma turma.
--
-- Atenção ao ::text[]: `avaliacoes.turma_id` é TEXT nesta tabela, enquanto em
-- alocacoes_v2 e alunos é UUID. É uma inconsistência que já existia no schema. A
-- conversão vai no ARRAY, e não na coluna: converter uuid[] para text[] nunca falha, ao
-- passo que `turma_id::uuid` estouraria a consulta inteira no dia em que uma linha
-- tivesse texto que não é UUID.
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated select avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_select_por_alcance" ON public.avaliacoes;
CREATE POLICY "avaliacoes_select_por_alcance" ON public.avaliacoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.enxerga_escola_inteira())
    OR professor_id = (SELECT public.meu_professor_id())
    OR turma_id IN (SELECT unnest(public.minhas_turmas_de_professor()::text[]))
  );

DROP POLICY IF EXISTS "Allow authenticated select notas" ON public.notas_avaliacoes;
DROP POLICY IF EXISTS "notas_avaliacoes_select_por_alcance" ON public.notas_avaliacoes;
CREATE POLICY "notas_avaliacoes_select_por_alcance" ON public.notas_avaliacoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.enxerga_escola_inteira())
    OR EXISTS (
      SELECT 1 FROM avaliacoes a
      WHERE a.id = notas_avaliacoes.avaliacao_id
        AND (a.professor_id = (SELECT public.meu_professor_id())
             OR a.turma_id IN (SELECT unnest(public.minhas_turmas_de_professor()::text[])))
    )
  );


-- ------------------------------------------------------------------------------------
-- 4. Atividades diárias e os vistos lançados nelas
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "atividades_diarias_autenticado" ON public."atividades_diárias";
DROP POLICY IF EXISTS "atividades_diarias_select_por_alcance" ON public."atividades_diárias";
CREATE POLICY "atividades_diarias_select_por_alcance" ON public."atividades_diárias"
  FOR SELECT TO authenticated
  USING (
    (SELECT public.enxerga_escola_inteira())
    OR professor_id = (SELECT public.meu_professor_id())
    OR turma_id IN (SELECT unnest(public.minhas_turmas_de_professor()))
  );

-- A política antiga era FOR ALL e cobria a escrita; recriada aqui para a escrita não
-- desaparecer junto com o DROP acima. Continua ampla de propósito — esta migração
-- restringe o ver, não o gravar.
--
-- E é escrita por comando, NUNCA FOR ALL: no Postgres as políticas permissivas se
-- somam, e um FOR ALL amplo concede SELECT junto com o resto — reabrindo, pela porta da
-- escrita, a leitura que a política de cima acabou de fechar. Foi exatamente o que
-- aconteceu na primeira versão deste arquivo, e o teste pegou.
DROP POLICY IF EXISTS "atividades_diarias_escrita_autenticado" ON public."atividades_diárias";
DROP POLICY IF EXISTS "atividades_diarias_insert_servidor" ON public."atividades_diárias";
DROP POLICY IF EXISTS "atividades_diarias_update_servidor" ON public."atividades_diárias";
DROP POLICY IF EXISTS "atividades_diarias_delete_servidor" ON public."atividades_diárias";
CREATE POLICY "atividades_diarias_insert_servidor" ON public."atividades_diárias"
  FOR INSERT TO authenticated WITH CHECK (NOT (SELECT public.usuario_tem_papel('ALUNO')));
CREATE POLICY "atividades_diarias_update_servidor" ON public."atividades_diárias"
  FOR UPDATE TO authenticated
  USING (NOT (SELECT public.usuario_tem_papel('ALUNO')))
  WITH CHECK (NOT (SELECT public.usuario_tem_papel('ALUNO')));
CREATE POLICY "atividades_diarias_delete_servidor" ON public."atividades_diárias"
  FOR DELETE TO authenticated USING (NOT (SELECT public.usuario_tem_papel('ALUNO')));

DROP POLICY IF EXISTS "vistos_v2_autenticado" ON public.vistos_v2;
DROP POLICY IF EXISTS "vistos_v2_select_por_alcance" ON public.vistos_v2;
CREATE POLICY "vistos_v2_select_por_alcance" ON public.vistos_v2
  FOR SELECT TO authenticated
  USING (
    (SELECT public.enxerga_escola_inteira())
    OR EXISTS (
      SELECT 1 FROM "atividades_diárias" ad
      WHERE ad.id = vistos_v2.atividade_id
        AND (ad.professor_id = (SELECT public.meu_professor_id())
             OR ad.turma_id IN (SELECT unnest(public.minhas_turmas_de_professor())))
    )
  );

DROP POLICY IF EXISTS "vistos_v2_escrita_autenticado" ON public.vistos_v2;
DROP POLICY IF EXISTS "vistos_v2_insert_servidor" ON public.vistos_v2;
DROP POLICY IF EXISTS "vistos_v2_update_servidor" ON public.vistos_v2;
DROP POLICY IF EXISTS "vistos_v2_delete_servidor" ON public.vistos_v2;
CREATE POLICY "vistos_v2_insert_servidor" ON public.vistos_v2
  FOR INSERT TO authenticated WITH CHECK (NOT (SELECT public.usuario_tem_papel('ALUNO')));
CREATE POLICY "vistos_v2_update_servidor" ON public.vistos_v2
  FOR UPDATE TO authenticated
  USING (NOT (SELECT public.usuario_tem_papel('ALUNO')))
  WITH CHECK (NOT (SELECT public.usuario_tem_papel('ALUNO')));
CREATE POLICY "vistos_v2_delete_servidor" ON public.vistos_v2
  FOR DELETE TO authenticated USING (NOT (SELECT public.usuario_tem_papel('ALUNO')));


-- ------------------------------------------------------------------------------------
-- 5. Busca de alunos da Biblioteca
--
-- Substitui o SELECT direto de bibliotecaService.buscarAlunos. Devolve o mínimo para
-- identificar o aluno no balcão — id, nome e turma — e nada da ficha.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_buscar_alunos_biblioteca(p_busca text)
RETURNS TABLE (id uuid, nome text, turma_nome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem papel de servidor não há empréstimo a registrar; e sem esta checagem a função
  -- viraria justamente o buraco que a política de alunos acabou de fechar.
  IF public.usuario_tem_papel('ALUNO') OR public.meu_professor_id() IS NULL THEN
    IF NOT public.enxerga_escola_inteira() THEN
      RAISE EXCEPTION 'Sem permissão para buscar alunos.';
    END IF;
  END IF;

  IF length(trim(p_busca)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT al.id, al.nome, t.nome
  FROM alunos al
  LEFT JOIN turmas t ON t.id = al.turma_id
  WHERE al.status = 'Ativo'
    AND al.nome ILIKE '%' || trim(p_busca) || '%'
  ORDER BY al.nome
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_buscar_alunos_biblioteca(text) FROM public;
REVOKE ALL ON FUNCTION public.rpc_buscar_alunos_biblioteca(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_alunos_biblioteca(text) TO authenticated;
