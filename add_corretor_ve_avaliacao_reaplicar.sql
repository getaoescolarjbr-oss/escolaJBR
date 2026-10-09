-- Reaplica em rpc_listar_avaliacoes_area o que a migração fix_avaliacao_geral_visibilidade (2026-10-07) apagou ao
-- recriar a função: (1) quem foi indicado corretor de uma turma volta a ver a avaliação na lista (sem isso o
-- botão "Corrigir redações" só aparecia para quem criou a prova ou tinha cota de questões) e (2) a chave
-- 'sou_corretor' que o front usa para listar a avaliação em "Suas cotas e correções".
-- Idempotente. Reversão: restaurar a definição anterior da função.
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.rpc_listar_avaliacoes_area(text)'::regprocedure);
  novo := d;

  if position('prova_corretores pcv' in novo) = 0 then
    if (select count(*) from regexp_matches(novo, 'AND pac\.professor_id = v_prof_id\s*\)', 'g')) <> 1 then
      raise exception 'rpc_listar_avaliacoes_area: filtro de cotas não encontrado (a função mudou?)';
    end if;
    novo := regexp_replace(novo, '(AND pac\.professor_id = v_prof_id\s*\))',
      E'\\1\n          OR EXISTS (\n            SELECT 1 FROM public.prova_corretores pcv JOIN public.professores prv ON prv.id = pcv.professor_id\n            WHERE pcv.prova_id = p.id AND prv.user_id = auth.uid()\n          )');
  end if;

  if position('''sou_corretor''' in novo) = 0 then
    if position(E'      ''corretores'', (' in novo) = 0 then
      raise exception 'rpc_listar_avaliacoes_area: chave corretores não encontrada';
    end if;
    novo := replace(novo, E'      ''corretores'', (',
      E'      ''sou_corretor'', EXISTS (SELECT 1 FROM public.prova_corretores pcs JOIN public.professores prs ON prs.id = pcs.professor_id\n                              WHERE pcs.prova_id = p.id AND prs.user_id = auth.uid()),\n      ''corretores'', (');
  end if;

  if novo <> d then execute novo; end if;
end $$;
