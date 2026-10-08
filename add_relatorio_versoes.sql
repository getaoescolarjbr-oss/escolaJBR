-- Relatório de resultados de provas com versões embaralhadas: gabarito de CADA versão e a versão de cada aluno.
--
-- Numa prova embaralhada a letra marcada (prova_respostas_itens.letra_marcada) é a BOLHA da folha do próprio
-- aluno, e a mesma questão tem outro número e outra bolha correta em cada versão. O relatório mostrava um
-- gabarito único (a letra do banco) para todos; com isto ele agrupa os alunos por versão e mostra, para cada
-- versão, o número da questão na folha e a bolha correta.
--
-- Só lê dados. Reaproveita rpc_gabarito_versao (mesma regra de permissão: pode_corrigir_prova).
-- Reversão: drop function public.rpc_relatorio_versoes(uuid);
create or replace function public.rpc_relatorio_versoes(p_prova_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_versoes jsonb; v_alunos jsonb;
begin
  if not (public.pode_gerir_prova(p_prova_id) or public.pode_corrigir_prova(p_prova_id)) then
    raise exception 'Sem permissão para ver o gabarito desta prova.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rotulo', pv.rotulo,
           'linhas', (select coalesce(jsonb_agg(jsonb_build_object(
                         'question_id', g.question_id,
                         'numero_na_prova', g.numero_na_prova,
                         'bolha_correta', g.bolha_correta,
                         'qtd_alternativas', g.qtd_alternativas) order by g.numero_na_prova), '[]'::jsonb)
                      from public.rpc_gabarito_versao(p_prova_id, pv.rotulo) g)
         ) order by pv.rotulo), '[]'::jsonb)
    into v_versoes
    from public.prova_versoes pv where pv.prova_id = p_prova_id;

  select coalesce(jsonb_agg(jsonb_build_object('aluno_id', pa.aluno_id, 'rotulo', pv.rotulo)), '[]'::jsonb)
    into v_alunos
    from public.prova_alocacoes pa join public.prova_versoes pv on pv.id = pa.versao_id
   where pa.prova_id = p_prova_id;

  return jsonb_build_object('versoes', v_versoes, 'alunos', v_alunos);
end;
$$;
revoke all on function public.rpc_relatorio_versoes(uuid) from public, anon;
grant execute on function public.rpc_relatorio_versoes(uuid) to authenticated;
