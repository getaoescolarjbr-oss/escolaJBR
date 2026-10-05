-- Relatório das redações de uma prova: uma linha por redação com nota confirmada, trazendo as notas por
-- critério (do professor e da prévia da IA) e o modo de correção usado. A agregação por turma/critério é feita
-- no navegador. Somente leitura; mesma regra de acesso da correção (pode_corrigir_prova).
-- Reversão: drop function public.rpc_redacao_relatorio(uuid);

create or replace function public.rpc_redacao_relatorio(p_prova_id uuid)
returns table (
  envio_id uuid, aluno_id uuid, aluno_nome text, turma_nome text,
  question_id uuid, tema text, valor numeric,
  nota_total integer, nota_maxima integer,
  rubrica_nome text, criterios jsonb,
  notas_prof jsonb, notas_ia jsonb, ia_nota_total integer
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_corrigir_prova(p_prova_id) then
    raise exception 'Sem permissão para ver o relatório desta prova.';
  end if;
  return query
  select e.id, al.id, al.nome, t.nome,
         q.id, q.topico, pq.valor,
         e.nota_total, e.nota_maxima,
         e.correcao_prof -> 'rubrica' ->> 'nome',
         e.correcao_prof -> 'rubrica' -> 'criterios',
         e.correcao_prof -> 'competencias',
         e.correcao_ia -> 'competencias',
         nullif(e.correcao_prof ->> 'ia_nota_total', '')::integer
  from redacao_envios e
  join alunos al on al.id = e.aluno_id
  left join turmas t on t.id = al.turma_id
  join questions q on q.id = e.question_id
  left join prova_questoes pq on pq.prova_id = e.prova_id and pq.question_id = e.question_id
  where e.prova_id = p_prova_id and e.status = 'REVISADA' and e.nota_total is not null
  order by t.nome nulls last, al.nome;
end;
$$;

revoke all on function public.rpc_redacao_relatorio(uuid) from public, anon;
grant execute on function public.rpc_redacao_relatorio(uuid) to authenticated;
