-- ====================================================================================
-- Avaliação Geral / de Área acompanham a substituição (atestado com substituto)
--
-- Problema: quem recebe a nota e quem insere questões (prova_notas_professores e
-- prova_area_cotas) ficava preso ao professor escolhido na hora. Quando o atestado terminava,
-- a atribuição continuava com o substituto (e as questões que ele já inseriu também), e o
-- titular precisava ser remarcado à mão — sem poder reduzir a cota abaixo do já inserido.
--
-- Regra nova (só provas ainda NÃO publicadas):
--   * começou a substituição (alocação espelhada criada): a atribuição do titular naquela
--     disciplina passa ao substituto — o titular deixa de aparecer na lista;
--   * terminou (espelho removido: encerrar atestado, expiração automática, exclusão): a
--     atribuição volta ao titular, MANTENDO as questões que o substituto já inseriu.
--   * se o substituto também leciona aquela disciplina por conta própria, nada é movido
--     (não dá para saber o que é de quem).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.fn_transferir_atribuicoes_avaliacao(p_de UUID, p_para UUID, p_disciplina_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movidos INTEGER := 0;
  r RECORD;
  v_destino UUID;
BEGIN
  IF p_de IS NULL OR p_para IS NULL OR p_disciplina_id IS NULL OR p_de = p_para THEN
    RETURN 0;
  END IF;

  -- Cotas de questões. Se o destino já tem cota na mesma prova/disciplina, soma e junta
  -- (as questões são reapontadas ANTES de apagar: prova_questoes.cota_id é ON DELETE SET NULL
  -- e virariam "sorteadas").
  FOR r IN
    SELECT c.*
    FROM public.prova_area_cotas c
    JOIN public.provas pr ON pr.id = c.prova_id
    WHERE c.professor_id = p_de
      AND c.disciplina_id = p_disciplina_id
      AND pr.status <> 'PUBLICADA'
  LOOP
    SELECT id INTO v_destino
    FROM public.prova_area_cotas
    WHERE prova_id = r.prova_id AND professor_id = p_para AND disciplina_id = p_disciplina_id;

    IF v_destino IS NULL THEN
      UPDATE public.prova_area_cotas SET professor_id = p_para, atualizado_em = now() WHERE id = r.id;
    ELSE
      UPDATE public.prova_questoes SET cota_id = v_destino WHERE cota_id = r.id;
      UPDATE public.prova_area_cotas
         SET qtd_questoes = qtd_questoes + r.qtd_questoes,
             qtd_inserida = qtd_inserida + r.qtd_inserida,
             atualizado_em = now()
       WHERE id = v_destino;
      DELETE FROM public.prova_area_cotas WHERE id = r.id;
    END IF;
    v_movidos := v_movidos + 1;
  END LOOP;

  -- Quem recebe a nota.
  FOR r IN
    SELECT n.*
    FROM public.prova_notas_professores n
    JOIN public.provas pr ON pr.id = n.prova_id
    WHERE n.professor_id = p_de
      AND n.disciplina_id = p_disciplina_id
      AND pr.status <> 'PUBLICADA'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.prova_notas_professores
      WHERE prova_id = r.prova_id AND professor_id = p_para AND disciplina_id = p_disciplina_id
        AND area_conhecimento IS NOT DISTINCT FROM r.area_conhecimento
    ) THEN
      DELETE FROM public.prova_notas_professores WHERE id = r.id;
    ELSE
      UPDATE public.prova_notas_professores SET professor_id = p_para WHERE id = r.id;
    END IF;
    v_movidos := v_movidos + 1;
  END LOOP;

  RETURN v_movidos;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_transferir_atribuicoes_avaliacao(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------------
-- Gatilhos nas alocações espelhadas (is_espelho): cobrem qualquer caminho que crie ou remova
-- a substituição (cadastro do atestado, encerrar, expiração automática, exclusão).
-- Nunca bloqueiam a operação principal: qualquer erro vira só um aviso no log.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_espelho_assume_avaliacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_espelho AND NEW.professor_original_id IS NOT NULL AND NEW.disciplina_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.alocacoes_v2 a
       WHERE a.professor_id = NEW.professor_id AND a.disciplina_id = NEW.disciplina_id AND NOT a.is_espelho
     )
  THEN
    PERFORM public.fn_transferir_atribuicoes_avaliacao(NEW.professor_original_id, NEW.professor_id, NEW.disciplina_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_espelho_assume_avaliacoes: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_espelho_devolve_avaliacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_espelho AND OLD.professor_original_id IS NOT NULL AND OLD.disciplina_id IS NOT NULL
     -- só quando a substituição daquela disciplina acabou de vez (não restou espelho)
     AND NOT EXISTS (
       SELECT 1 FROM public.alocacoes_v2 a
       WHERE a.is_espelho AND a.professor_id = OLD.professor_id
         AND a.professor_original_id = OLD.professor_original_id AND a.disciplina_id = OLD.disciplina_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.alocacoes_v2 a
       WHERE a.professor_id = OLD.professor_id AND a.disciplina_id = OLD.disciplina_id AND NOT a.is_espelho
     )
  THEN
    PERFORM public.fn_transferir_atribuicoes_avaliacao(OLD.professor_id, OLD.professor_original_id, OLD.disciplina_id);
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_espelho_devolve_avaliacoes: %', SQLERRM;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_espelho_assume_avaliacoes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_espelho_devolve_avaliacoes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_espelho_assume_avaliacoes ON public.alocacoes_v2;
CREATE TRIGGER trg_espelho_assume_avaliacoes
  AFTER INSERT ON public.alocacoes_v2
  FOR EACH ROW WHEN (NEW.is_espelho)
  EXECUTE FUNCTION public.trg_espelho_assume_avaliacoes();

DROP TRIGGER IF EXISTS trg_espelho_devolve_avaliacoes ON public.alocacoes_v2;
CREATE TRIGGER trg_espelho_devolve_avaliacoes
  AFTER DELETE ON public.alocacoes_v2
  FOR EACH ROW WHEN (OLD.is_espelho)
  EXECUTE FUNCTION public.trg_espelho_devolve_avaliacoes();

-- ------------------------------------------------------------------------------------
-- Ajuste pontual (atestado da Elice já encerrado em 02/10/2026, antes dos gatilhos existirem):
-- a Janaina ficou como "recebe a nota" de Biologia no 1º Simulado JBR; devolve à Elice.
-- ------------------------------------------------------------------------------------
-- SELECT public.fn_transferir_atribuicoes_avaliacao(
--   '60f1e03b-5a11-4b83-ad50-1d5f8f72dd18', 'abc75419-c07e-4b16-a2c1-a6227765f98e',
--   (SELECT id FROM public.disciplinas WHERE nome = 'Biologia' LIMIT 1));
