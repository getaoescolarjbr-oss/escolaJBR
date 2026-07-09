-- ====================================================================================
-- BIBLIOTECA — Fase 5 (Gamificação): concessão automática de conquistas + os créditos
-- de pontos que faltavam (a Fase 1 já criava o ledger e a tabela `pontos_regras` com
-- os 5 valores, mas só META_CONCLUIDA tinha trigger; os outros 4 origem
-- (RESENHA_PUBLICADA, DUPLA_FORMADA, PRIMEIRO_EMPRESTIMO, DEVOLUCAO_PONTUAL) ainda não
-- creditavam nada). Os gatilhos em `resenhas`/`duplas` já funcionam mesmo essas telas
-- só chegando na Fase 7 — a tabela e a regra existem desde a Fase 1, então não custa
-- nada deixar o crédito automático pronto agora.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Helper genérico de crédito (DRY): busca o valor em pontos_regras e credita — se
--    não houver regra ativa pra aquela origem, não credita nada (falha segura).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_creditar_pontos(p_aluno_id UUID, p_origem TEXT, p_referencia_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor INTEGER;
BEGIN
  SELECT valor INTO v_valor FROM pontos_regras WHERE origem = p_origem AND ativo = true;
  IF v_valor IS NOT NULL THEN
    INSERT INTO pontos_ledger (aluno_id, delta, origem, referencia_id, criado_por)
    VALUES (p_aluno_id, v_valor, p_origem, p_referencia_id, auth.uid());
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 2. Avaliador genérico de conquistas: dado um aluno e um "regra_tipo", calcula a
--    contagem correspondente e concede toda conquista ativa daquele tipo cujo
--    regra_limiar já foi atingido e que o aluno ainda não tem. `regra_tipo` sem
--    contagem conhecida (ELSE NULL) simplesmente não concede nada — falha segura,
--    igual ao pontos_regras: staff pode cadastrar um regra_tipo novo no catálogo, mas
--    ele só passa a conceder de verdade quando alguém also programa a contagem aqui.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_avaliar_conquistas(p_aluno_id UUID, p_regra_tipo TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contagem INTEGER;
  v_conquista RECORD;
BEGIN
  v_contagem := CASE p_regra_tipo
    WHEN 'PRIMEIRO_EMPRESTIMO'   THEN (SELECT count(*) FROM emprestimos WHERE aluno_id = p_aluno_id)
    WHEN 'LIVROS_LIDOS'          THEN (SELECT count(*) FROM emprestimos WHERE aluno_id = p_aluno_id AND status = 'DEVOLVIDO')
    WHEN 'METAS_CONCLUIDAS'      THEN (SELECT count(*) FROM metas WHERE aluno_id = p_aluno_id AND status = 'CONCLUIDA')
    WHEN 'RESENHAS_PUBLICADAS'   THEN (SELECT count(*) FROM resenhas WHERE aluno_id = p_aluno_id AND status = 'VISIVEL')
    WHEN 'DUPLAS_FORMADAS'       THEN (SELECT count(*) FROM duplas WHERE status = 'ACEITA' AND (aluno_a = p_aluno_id OR aluno_b = p_aluno_id))
    ELSE NULL
  END;

  IF v_contagem IS NULL THEN
    RETURN;
  END IF;

  FOR v_conquista IN
    SELECT * FROM conquistas
    WHERE regra_tipo = p_regra_tipo AND ativo = true AND regra_limiar <= v_contagem
      AND id NOT IN (SELECT conquista_id FROM aluno_conquistas WHERE aluno_id = p_aluno_id)
  LOOP
    INSERT INTO aluno_conquistas (aluno_id, conquista_id)
    VALUES (p_aluno_id, v_conquista.id)
    ON CONFLICT (aluno_id, conquista_id) DO NOTHING;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------------
-- 3. Gatilhos por tabela — cada um só credita pontos/avalia conquistas na transição
--    relevante, nunca em toda linha (ex.: não credita de novo numa 2ª UPDATE que não
--    mudou o status).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_gamificacao_emprestimo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_gamificacao_emprestimo ON emprestimos;
CREATE TRIGGER trg_gamificacao_emprestimo
  AFTER INSERT OR UPDATE ON emprestimos
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamificacao_emprestimo();

CREATE OR REPLACE FUNCTION public.fn_gamificacao_metas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CONCLUIDA' AND OLD.status IS DISTINCT FROM 'CONCLUIDA' THEN
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_id, 'METAS_CONCLUIDAS');
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER (não BEFORE): o crédito de pontos da meta já é feito pelo trigger BEFORE
-- UPDATE trg_meta_concluida_credita_pontos (Fase 1); este aqui só avalia conquista,
-- depois que a linha já está gravada.
DROP TRIGGER IF EXISTS trg_gamificacao_metas ON metas;
CREATE TRIGGER trg_gamificacao_metas
  AFTER UPDATE ON metas
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamificacao_metas();

CREATE OR REPLACE FUNCTION public.fn_gamificacao_resenha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'VISIVEL' THEN
    PERFORM public.fn_creditar_pontos(NEW.aluno_id, 'RESENHA_PUBLICADA', NEW.id);
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_id, 'RESENHAS_PUBLICADAS');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamificacao_resenha ON resenhas;
CREATE TRIGGER trg_gamificacao_resenha
  AFTER INSERT ON resenhas
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamificacao_resenha();

CREATE OR REPLACE FUNCTION public.fn_gamificacao_dupla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACEITA' AND OLD.status IS DISTINCT FROM 'ACEITA' THEN
    PERFORM public.fn_creditar_pontos(NEW.aluno_a, 'DUPLA_FORMADA', NEW.id);
    PERFORM public.fn_creditar_pontos(NEW.aluno_b, 'DUPLA_FORMADA', NEW.id);
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_a, 'DUPLAS_FORMADAS');
    PERFORM public.fn_avaliar_conquistas(NEW.aluno_b, 'DUPLAS_FORMADAS');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gamificacao_dupla ON duplas;
CREATE TRIGGER trg_gamificacao_dupla
  AFTER UPDATE ON duplas
  FOR EACH ROW EXECUTE FUNCTION public.fn_gamificacao_dupla();

-- ------------------------------------------------------------------------------------
-- 4. Catálogo inicial de conquistas (GESTAO/BIBLIOTECA podem editar depois pela tela).
--    Índice único em `nome` só para o ON CONFLICT abaixo tornar este INSERT seguro
--    de rodar de novo (idempotente), sem impedir nomes repetidos por regra de negócio.
-- ------------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS conquistas_nome_unico ON conquistas (nome);

INSERT INTO conquistas (nome, descricao, icone, regra_tipo, regra_limiar) VALUES
  ('Primeira Leitura', 'Pegou o primeiro livro emprestado na biblioteca.', '📖', 'PRIMEIRO_EMPRESTIMO', 1),
  ('Leitor(a) Iniciante', 'Já devolveu 5 livros lidos.', '📚', 'LIVROS_LIDOS', 5),
  ('Maratonista', 'Já devolveu 20 livros lidos.', '🏃', 'LIVROS_LIDOS', 20),
  ('Cumpridor(a) de Metas', 'Concluiu 3 metas de leitura.', '🎯', 'METAS_CONCLUIDAS', 3),
  ('Resenhista', 'Publicou a primeira resenha.', '✍️', 'RESENHAS_PUBLICADAS', 1),
  ('Dupla Leitora', 'Formou a primeira dupla de leitura.', '🤝', 'DUPLAS_FORMADAS', 1)
ON CONFLICT (nome) DO NOTHING;
