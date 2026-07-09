-- ====================================================================================
-- BIBLIOTECA — Fase 3 (Circulação): RPC de renovação com regras de negócio, e ajuste de
-- RLS para permitir que a BIBLIOTECA registre reserva de título em nome de um aluno
-- (ainda não existe login de aluno — isso só chega na Fase 4 — então até lá, quem
-- coloca um aluno na fila de espera de um título é sempre o balcão).
--
-- REGRAS DE NEGÓCIO DA RENOVAÇÃO (a confirmar/ajustar com você se não for isso que
-- tinha em mente):
--   - +7 dias por renovação (conforme especificado).
--   - Máximo de 2 renovações por empréstimo (constante LIMITE_RENOVACOES abaixo).
--   - Bloqueia se o empréstimo já está atrasado (data_prevista < hoje) — precisa
--     devolver e reemprestar, não renovar.
--   - Bloqueia se existe outro aluno com reserva ATIVA para o mesmo título (livro),
--     dando prioridade a quem está esperando.
-- "Atrasado" não é uma coluna atualizada por job — é calculado on-the-fly comparando
-- data_prevista com a data atual (tanto aqui quanto na tela), para não depender de uma
-- Edge Function agendada só para isso.
-- ====================================================================================

-- Enquanto não existe login de aluno (Fase 4), só a BIBLIOTECA consegue colocar
-- alguém na fila de reserva de um título — por isso passa a ter INSERT aqui também.
DROP POLICY IF EXISTS "reservas_livro_insert" ON reservas_livro;
CREATE POLICY "reservas_livro_insert" ON reservas_livro FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- Mesmo raciocínio para indicação de compra (sugestão em papel/verbal no balcão, até
-- existir autoatendimento do aluno na Fase 4).
DROP POLICY IF EXISTS "indicacoes_compra_insert" ON indicacoes_compra;
CREATE POLICY "indicacoes_compra_insert" ON indicacoes_compra FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

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
    WHERE livro_id = v_livro_id AND status = 'ATIVA' AND aluno_id <> v_emprestimo.aluno_id
  ) THEN
    RAISE EXCEPTION 'Há outro aluno aguardando este título na fila de reserva — não é possível renovar.';
  END IF;

  UPDATE emprestimos
  SET data_prevista = data_prevista + 7, renovacoes = renovacoes + 1
  WHERE id = p_emprestimo_id
  RETURNING * INTO v_emprestimo;

  RETURN v_emprestimo;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_renovar_emprestimo(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_renovar_emprestimo(UUID) TO authenticated;
