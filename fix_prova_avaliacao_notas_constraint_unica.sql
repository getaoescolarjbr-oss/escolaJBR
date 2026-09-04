-- Achei a causa real de por que só ALGUNS professores tiveram a nota corrigida: a tabela
-- prova_avaliacao_notas tinha UNIQUE (prova_id, turma_id) — só isso, sem avaliacao_id. Uma
-- avaliação de área cria UM lançamento em `avaliacoes` POR PROFESSOR (mesma turma, mesma
-- prova) dentro do mesmo loop; ao vincular o 2º, 3º professor da mesma turma na tabela de
-- rastreio, cada INSERT colidia com o vínculo do 1º professor (mesmo prova_id+turma_id) e o
-- `ON CONFLICT DO NOTHING` silenciosamente descartava — só o primeiro professor de cada turma
-- ficava de fato vinculado. O fix anterior (fix_rpc_publicar_avaliacao_area_valor_dividido.sql)
-- só conseguiu corrigir o valor de quem tinha esse vínculo; os demais continuaram com o valor
-- antigo (proporcional) porque o UPDATE não achava a linha deles.
--
-- Este script:
-- 1) Troca a constraint pra (prova_id, turma_id, avaliacao_id) — permite um vínculo por
--    professor/turma dentro da mesma prova.
-- 2) Reconstrói os vínculos que ficaram faltando, casando por professor+turma+bimestre+nome
--    (o nome do lançamento é sempre "título da prova (disciplina)", gerado no publicar).
-- 3) Roda de novo a correção de valor_maximo, agora que todo mundo está vinculado.

ALTER TABLE public.prova_avaliacao_notas DROP CONSTRAINT IF EXISTS prova_avaliacao_notas_prova_id_turma_id_key;
ALTER TABLE public.prova_avaliacao_notas
  ADD CONSTRAINT prova_avaliacao_notas_prova_turma_avaliacao_key UNIQUE (prova_id, turma_id, avaliacao_id);

INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
SELECT p.id, pt.turma_id, a.id
FROM public.provas p
JOIN public.prova_turmas pt ON pt.prova_id = p.id
JOIN public.prova_area_cotas pac ON pac.prova_id = p.id
JOIN public.avaliacoes a
  ON a.professor_id = pac.professor_id
 AND a.turma_id = pt.turma_id
 AND a.bimestre_id = p.bimestre_id
 AND a.nome = p.titulo || ' (' || COALESCE(
       (SELECT d.nome FROM public.disciplinas d WHERE d.id = pac.disciplina_id),
       p.area_conhecimento
     ) || ')'
WHERE p.eh_prova_area = true
  AND p.status = 'PUBLICADA'
ON CONFLICT (prova_id, turma_id, avaliacao_id) DO NOTHING;

UPDATE public.avaliacoes a
SET valor_maximo = p.valor_total
FROM public.prova_avaliacao_notas pan
JOIN public.provas p ON p.id = pan.prova_id
WHERE a.id = pan.avaliacao_id
  AND a.valor_maximo IS DISTINCT FROM p.valor_total;
