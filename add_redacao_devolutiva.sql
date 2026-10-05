-- ====================================================================================
-- DEVOLUTIVA DA REDAÇÃO AO ALUNO
--
-- O aluno vê, dentro da avaliação já enviada, a nota por critério e os comentários do professor — SÓ
-- depois que o professor confirma a nota (status REVISADA). A prévia da IA nunca chega ao aluno.
-- "O que se esperava neste tema" (as observações da questão, em boa parte geradas por IA) só aparece
-- se o professor marcar, redação a redação, que quer mostrar (redacao_envios.mostrar_esperado).
--
-- Reversão: alter table redacao_envios drop column mostrar_esperado; drop function
-- rpc_redacao_devolutiva(uuid), rpc_redacao_mostrar_esperado(uuid, boolean); e recriar rpc_redacao_obter
-- de add_redacao_obter_observacoes.sql.
-- ====================================================================================

alter table public.redacao_envios add column if not exists mostrar_esperado boolean not null default false;

-- Professor: liga/desliga mostrar ao aluno o que se esperava no tema.
create or replace function public.rpc_redacao_mostrar_esperado(p_envio_id uuid, p_valor boolean)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare
  v redacao_envios;
begin
  select * into v from redacao_envios where id = p_envio_id for update;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  update redacao_envios set mostrar_esperado = coalesce(p_valor, false) where id = p_envio_id;
  return coalesce(p_valor, false);
end;
$$;

-- rpc_redacao_obter: devolve também mostrar_esperado.
create or replace function public.rpc_redacao_obter(p_envio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v redacao_envios; v_q questions; v_aluno alunos; v_turma text; v_valor numeric;
begin
  select * into v from redacao_envios where id = p_envio_id;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  select * into v_q from questions where id = v.question_id;
  select * into v_aluno from alunos where id = v.aluno_id;
  select nome into v_turma from turmas where id = v_aluno.turma_id;
  select valor into v_valor from prova_questoes where prova_id = v.prova_id and question_id = v.question_id;
  return jsonb_build_object(
    'envio_id', v.id, 'prova_id', v.prova_id, 'aluno_id', v.aluno_id, 'aluno_nome', v_aluno.nome,
    'turma_nome', v_turma, 'question_id', v.question_id, 'tema', v_q.topico, 'banca', v_q.banca,
    'enunciado', v_q.statement, 'criterios', v_q.criterios_correcao, 'observacoes', v_q.explanation, 'valor', v_valor,
    'origem', v.origem, 'imagem_path', v.imagem_path, 'linhas', v.linhas, 'texto_final', v.texto_final,
    'correcao_ia', v.correcao_ia, 'correcao_prof', v.correcao_prof, 'nota_total', v.nota_total,
    'nota_maxima', v.nota_maxima, 'status', v.status, 'mostrar_esperado', v.mostrar_esperado,
    'rubrica', public._redacao_rubrica_efetiva(v.id), 'rubrica_escolhida_id', v.rubrica_id);
end;
$$;

-- Aluno: as devolutivas das próprias redações desta avaliação (só as confirmadas).
create or replace function public.rpc_redacao_devolutiva(p_avaliacao_id uuid)
returns table (
  question_id uuid, tema text, valor numeric, nota_total integer, nota_maxima integer, valor_obtido numeric,
  rubrica_nome text, criterios jsonb, comentario_geral text, texto text, esperado text
)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_aluno_id uuid := public.meu_aluno_id();
begin
  if v_aluno_id is null then raise exception 'Só alunos podem ver a devolutiva.'; end if;
  return query
  select e.question_id, q.topico, pq.valor, e.nota_total, e.nota_maxima,
         round(e.nota_total::numeric / nullif(e.nota_maxima, 0) * coalesce(pq.valor, 0), 2),
         e.correcao_prof -> 'rubrica' ->> 'nome',
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'rotulo', c.item ->> 'rotulo', 'max', (c.item ->> 'max')::int,
                    'nota', (e.correcao_prof -> 'competencias' -> (c.item ->> 'chave') ->> 'nota')::int,
                    'descritores', c.item ->> 'descritores',
                    'comentario', nullif(trim(coalesce(e.correcao_prof -> 'competencias' -> (c.item ->> 'chave') ->> 'comentario', '')), ''))
                  order by c.ord), '[]'::jsonb)
            from jsonb_array_elements(e.correcao_prof -> 'rubrica' -> 'criterios') with ordinality as c(item, ord)),
         nullif(trim(coalesce(e.correcao_prof ->> 'comentario_geral', '')), ''),
         e.texto_final,
         case when e.mostrar_esperado
              then nullif(trim(regexp_replace(coalesce(q.explanation, ''), '^<em>Orientação gerada por IA[^<]*</em>\s*', '')), '')
         end
  from redacao_envios e
  join questions q on q.id = e.question_id
  join prova_questoes pq on pq.prova_id = e.prova_id and pq.question_id = e.question_id
  where e.prova_id = p_avaliacao_id and e.aluno_id = v_aluno_id and e.status = 'REVISADA'
    and e.correcao_prof is not null;
end;
$$;

revoke all on function public.rpc_redacao_mostrar_esperado(uuid, boolean), public.rpc_redacao_devolutiva(uuid) from public, anon;
grant execute on function public.rpc_redacao_mostrar_esperado(uuid, boolean), public.rpc_redacao_devolutiva(uuid) to authenticated;
