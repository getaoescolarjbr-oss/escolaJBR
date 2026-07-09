-- ====================================================================================
-- BIBLIOTECA — Professor como tomador de empréstimo/reserva (autoatendimento igual ao
-- aluno: navega o acervo e reserva um título para si mesmo; o empréstimo em si continua
-- sendo lançado pela BIBLIOTECA no balcão, mesma regra que já vale para aluno).
--
-- Reaproveita as tabelas emprestimos/reservas_livro em vez de duplicar em tabelas
-- "de professor" — aluno_id vira opcional, professor_id novo, mutuamente exclusivo.
-- ====================================================================================

-- 1. meu_professor_id(): mesmo espírito de meu_aluno_id() (ver
--    create_biblioteca_helpers.sql). Usa professores.user_id = auth.uid(), mesmo campo
--    já usado no client (agendamentoService.obterMeuProfessorId).
CREATE OR REPLACE FUNCTION public.meu_professor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM professores WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.meu_professor_id() FROM public;
GRANT EXECUTE ON FUNCTION public.meu_professor_id() TO authenticated;

-- 2. emprestimos: aluno_id passa a ser opcional; professor_id novo.
ALTER TABLE emprestimos ALTER COLUMN aluno_id DROP NOT NULL;
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS professor_id UUID REFERENCES professores(id);
ALTER TABLE emprestimos DROP CONSTRAINT IF EXISTS emprestimos_tomador_check;
ALTER TABLE emprestimos ADD CONSTRAINT emprestimos_tomador_check
  CHECK ((aluno_id IS NOT NULL AND professor_id IS NULL) OR (aluno_id IS NULL AND professor_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_emprestimos_professor ON emprestimos (professor_id);

DROP POLICY IF EXISTS "emprestimos_select" ON emprestimos;
CREATE POLICY "emprestimos_select" ON emprestimos FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR professor_id = public.meu_professor_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

-- 3. reservas_livro: mesmo tratamento.
ALTER TABLE reservas_livro ALTER COLUMN aluno_id DROP NOT NULL;
ALTER TABLE reservas_livro ADD COLUMN IF NOT EXISTS professor_id UUID REFERENCES professores(id);
ALTER TABLE reservas_livro DROP CONSTRAINT IF EXISTS reservas_livro_tomador_check;
ALTER TABLE reservas_livro ADD CONSTRAINT reservas_livro_tomador_check
  CHECK ((aluno_id IS NOT NULL AND professor_id IS NULL) OR (aluno_id IS NULL AND professor_id IS NOT NULL));

-- Índice único antigo cobria só aluno_id; agora precisa dos dois casos.
DROP INDEX IF EXISTS reservas_livro_ativa_unica;
CREATE UNIQUE INDEX IF NOT EXISTS reservas_livro_ativa_unica_aluno
  ON reservas_livro (livro_id, aluno_id) WHERE status = 'ATIVA' AND aluno_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reservas_livro_ativa_unica_professor
  ON reservas_livro (livro_id, professor_id) WHERE status = 'ATIVA' AND professor_id IS NOT NULL;

DROP POLICY IF EXISTS "reservas_livro_select" ON reservas_livro;
CREATE POLICY "reservas_livro_select" ON reservas_livro FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR professor_id = public.meu_professor_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "reservas_livro_insert" ON reservas_livro;
CREATE POLICY "reservas_livro_insert" ON reservas_livro FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id() OR professor_id = public.meu_professor_id()
              OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "reservas_livro_update" ON reservas_livro;
CREATE POLICY "reservas_livro_update" ON reservas_livro FOR UPDATE TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR professor_id = public.meu_professor_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (aluno_id = public.meu_aluno_id() OR professor_id = public.meu_professor_id()
              OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- 4. Gamificação (pontos/conquistas) é uma feature só de aluno (BiblioClube) — o
--    trigger disparava para QUALQUER linha de emprestimos, então sem essa guarda o
--    primeiro empréstimo de um professor quebraria (NEW.aluno_id NULL indo pra
--    fn_creditar_pontos/fn_avaliar_conquistas, que esperam um aluno_id de verdade).
CREATE OR REPLACE FUNCTION public.fn_gamificacao_emprestimo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aluno_id IS NULL THEN
    RETURN NEW; -- empréstimo de professor não participa da gamificação do aluno.
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM emprestimos WHERE aluno_id = NEW.aluno_id) = 1 THEN
      PERFORM public.fn_creditar_pontos(NEW.aluno_id, 'PRIMEIRO_EMPRESTIMO', NEW.id);
    END IF;
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_id, 'PRIMEIRO_EMPRESTIMO');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'DEVOLVIDO' AND OLD.status IS DISTINCT FROM 'DEVOLVIDO' THEN
    IF NEW.data_devolucao <= NEW.data_prevista THEN
      PERFORM public.fn_creditar_pontos(NEW.aluno_id, 'DEVOLUCAO_PONTUAL', NEW.id);
    END IF;
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_id, 'LIVROS_LIDOS');
  END IF;
  RETURN NEW;
END;
$$;

-- 5. rpc_renovar_emprestimo: dono pode ser aluno OU professor agora; a checagem de
--    "outra pessoa esperando este título" precisa considerar os dois casos.
CREATE OR REPLACE FUNCTION public.rpc_renovar_emprestimo(p_emprestimo_id UUID)
RETURNS emprestimos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emprestimo emprestimos;
  v_livro_id UUID;
  v_limite_renovacoes CONSTANT INTEGER := 2;
BEGIN
  SELECT * INTO v_emprestimo FROM emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empréstimo não encontrado.';
  END IF;

  IF NOT (v_emprestimo.aluno_id = public.meu_aluno_id()
          OR v_emprestimo.professor_id = public.meu_professor_id()
          OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para renovar este empréstimo.';
  END IF;

  IF v_emprestimo.status <> 'ATIVO' THEN
    RAISE EXCEPTION 'Só é possível renovar um empréstimo ativo.';
  END IF;

  IF v_emprestimo.data_prevista < current_date THEN
    RAISE EXCEPTION 'Empréstimo em atraso — devolva antes de renovar.';
  END IF;

  IF v_emprestimo.renovacoes >= v_limite_renovacoes THEN
    RAISE EXCEPTION 'Limite de % renovações já atingido.', v_limite_renovacoes;
  END IF;

  SELECT livro_id INTO v_livro_id FROM exemplares WHERE id = v_emprestimo.exemplar_id;
  IF EXISTS (
    SELECT 1 FROM reservas_livro
    WHERE livro_id = v_livro_id AND status = 'ATIVA'
      AND (aluno_id IS DISTINCT FROM v_emprestimo.aluno_id OR professor_id IS DISTINCT FROM v_emprestimo.professor_id)
  ) THEN
    RAISE EXCEPTION 'Há outra pessoa aguardando este título na fila de reserva — não é possível renovar.';
  END IF;

  UPDATE emprestimos
  SET data_prevista = data_prevista + 7, renovacoes = renovacoes + 1
  WHERE id = p_emprestimo_id
  RETURNING * INTO v_emprestimo;

  RETURN v_emprestimo;
END;
$$;
