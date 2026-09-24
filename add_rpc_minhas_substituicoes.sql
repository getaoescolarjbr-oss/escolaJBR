-- Substituições vigentes do professor logado (como SUBSTITUTO).
--
-- O substituto precisa saber de quem ele assumiu as turmas para trabalhar sobre o diário do
-- titular (atividades, vistos, notas, chamadas). Mas a política de leitura de
-- atestados_servidores só libera Gestão, Secretaria e o próprio titular — e a linha do
-- atestado traz observações que podem ter dado de saúde (LGPD). Então esta função devolve só
-- o estritamente necessário: turma, disciplina, quem é o titular, o período e a configuração
-- de vistos do titular. Nenhum detalhe do atestado (tipo, observações, documento).
--
-- Só enxerga o que é do próprio chamador (meu_professor_id()); vigente = atestado ativo com
-- hoje (horário de Campo Grande) dentro do período.
--
-- Reverter: drop function public.rpc_minhas_substituicoes();
create or replace function public.rpc_minhas_substituicoes()
returns table (
  turma_id uuid,
  disciplina_id uuid,
  atestado_id uuid,
  titular_id uuid,
  titular_nome text,
  data_inicio date,
  data_fim date,
  config_visto_metodo text,
  config_visto_valor_total double precision,
  config_turmas jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.turma_id, a.disciplina_id, a.atestado_id, a.professor_original_id, p.nome,
         s.data_inicio, s.data_fim, p.config_visto_metodo, p.config_visto_valor_total, p.config_turmas
  from alocacoes_v2 a
  join atestados_servidores s on s.id = a.atestado_id
  join professores p on p.id = a.professor_original_id
  where a.professor_id = (select public.meu_professor_id())
    and a.is_espelho
    and s.ativo
    and s.substituto_id = a.professor_id
    and (now() at time zone 'America/Campo_Grande')::date between s.data_inicio and s.data_fim;
$$;

revoke all on function public.rpc_minhas_substituicoes() from public, anon;
grant execute on function public.rpc_minhas_substituicoes() to authenticated;
