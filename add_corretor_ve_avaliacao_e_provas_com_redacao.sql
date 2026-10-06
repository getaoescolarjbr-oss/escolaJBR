-- (aplicado em produção como migração add_corretor_ve_avaliacao_e_provas_com_redacao)
-- 1. O corretor de uma turma passa a ver a avaliação de área/geral na lista dele, mesmo sem cota e sem ser
--    coordenação (antes só enxergava quem era staff ou tinha cota de questões).
-- 2. rpc_provas_com_redacao: ids das provas com questão de redação que o usuário pode corrigir. O front lia
--    prova_questoes direto, que o RLS não libera ao corretor.
-- 3. rpc_listar_avaliacoes_area devolve 'sou_corretor' (add_listar_area_sou_corretor).
-- Reversão: drop function public.rpc_provas_com_redacao(); restaurar a definição anterior de rpc_listar_avaliacoes_area.
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.rpc_listar_avaliacoes_area(text)'::regprocedure);
  if position('prova_corretores pcv' in d) > 0 then return; end if;
  novo := replace(d,
    E'          AND pac.professor_id = v_prof_id\n      )\n    );',
    E'          AND pac.professor_id = v_prof_id\n      )\n      OR EXISTS (\n        SELECT 1 FROM public.prova_corretores pcv JOIN public.professores prv ON prv.id = pcv.professor_id\n        WHERE pcv.prova_id = p.id AND prv.user_id = auth.uid()\n      )\n    );');
  if novo = d then raise exception 'rpc_listar_avaliacoes_area: trecho do filtro não encontrado (a função mudou?)'; end if;
  execute novo;
end $$;

create or replace function public.rpc_provas_com_redacao()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct pq.prova_id
  from public.prova_questoes pq
  join public.questions q on q.id = pq.question_id and public.questao_eh_redacao(q.tipo, q.discipline)
  where public.pode_corrigir_prova(pq.prova_id);
$$;
revoke all on function public.rpc_provas_com_redacao() from public, anon;
grant execute on function public.rpc_provas_com_redacao() to authenticated;

-- rpc_listar_avaliacoes_area: chave 'sou_corretor' (usuário logado é corretor de alguma turma da avaliação)
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.rpc_listar_avaliacoes_area(text)'::regprocedure);
  if position('''sou_corretor''' in d) > 0 then return; end if;
  novo := replace(d, E'      ''corretores'', (',
    E'      ''sou_corretor'', EXISTS (SELECT 1 FROM public.prova_corretores pcs JOIN public.professores prs ON prs.id = pcs.professor_id\n                              WHERE pcs.prova_id = p.id AND prs.user_id = auth.uid()),\n      ''corretores'', (');
  if novo = d then raise exception 'rpc_listar_avaliacoes_area: chave corretores não encontrada'; end if;
  execute novo;
end $$;
