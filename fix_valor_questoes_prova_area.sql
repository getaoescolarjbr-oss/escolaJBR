-- Corrige o valor das questões já inseridas em avaliações de área (eh_prova_area = true)
-- pra somar certinho com o valor_total da prova. Antes do ajuste no app, toda questão
-- inserida sem valor próprio caía pra 1.0 fixo (não havia como mudar pela tela), então
-- qualquer prova de área com N questões acabava valendo N pontos em vez do valor_total
-- configurado (ex.: 9 questões × 1,00 = 9, quando devia valer 4).
--
-- Só toca provas onde a soma atual dos valores diverge do valor_total (evita mexer em
-- alguma que já esteja certa por coincidência) e distribui o valor_total igualmente pelas
-- questões REALMENTE inseridas naquela prova (o que a impressão/tela online mostra de
-- verdade — diferente do "total planejado nas cotas" usado como valor padrão ao inserir
-- questão nova, que pode não bater se ainda faltar gente inserir a própria cota).

DO $$
DECLARE
  r RECORD;
  total_provas int := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.titulo, p.valor_total, count(pq.id) AS qtd_questoes, sum(pq.valor) AS soma_atual
    FROM public.provas p
    JOIN public.prova_questoes pq ON pq.prova_id = p.id
    WHERE p.eh_prova_area = true
    GROUP BY p.id, p.titulo, p.valor_total
    HAVING abs(sum(pq.valor) - p.valor_total) > 0.01
  LOOP
    UPDATE public.prova_questoes
    SET valor = round(r.valor_total / r.qtd_questoes, 2)
    WHERE prova_id = r.id;
    total_provas := total_provas + 1;
    RAISE NOTICE 'Prova "%" (%): % questões, valor_total %, somava % antes, agora % cada (soma %).',
      r.titulo, r.id, r.qtd_questoes, r.valor_total, r.soma_atual,
      round(r.valor_total / r.qtd_questoes, 2), round(r.valor_total / r.qtd_questoes, 2) * r.qtd_questoes;
  END LOOP;
  RAISE NOTICE '% prova(s) de área corrigida(s).', total_provas;
END $$;
