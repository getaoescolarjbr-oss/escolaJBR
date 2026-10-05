-- ====================================================================================
-- REDAÇÃO DIGITADA PELO ALUNO (avaliação online)
--
-- 1. rpc_questoes_avaliacao_aluno / _preview passam a devolver tipo, linhas_resposta, resposta_texto
--    e discipline. O front já os declarava (QuestaoParaAluno), mas a função em produção não os
--    devolvia: o aluno nem via a caixa de texto de uma questão escrita online.
-- 2. Rascunho no servidor (redacao_rascunhos): uma redação é longa e o envio da avaliação é um só.
--    Fica numa tabela à parte de propósito: gravar rascunho em prova_respostas_itens faria a questão
--    aparecer como "respondida" e cairia na fila de correção antes de o aluno enviar.
-- 3. rpc_redacao_listar: passa a listar também os alunos das turmas da prova (online não tem folha
--    sorteada) e a dizer se o aluno digitou texto.
-- 4. rpc_redacao_preparar_aluno: abre a redação de um aluno sem passar pelo QR; se ele digitou, o
--    texto já entra como texto da correção (origem DIGITADA). rpc_redacao_preparar (QR) usa a mesma
--    rotina interna.
--
-- Reversão: recriar as funções pelos arquivos antigos (add_avaliacao_preview_professor.sql e
-- create_avaliacoes_schema.sql) e: drop table redacao_rascunhos; drop function rpc_redacao_rascunho_*,
-- rpc_redacao_preparar_aluno, _redacao_abrir.
-- ====================================================================================

-- ---------------------------------------------------------------- 1. funções do aluno
drop function if exists public.rpc_questoes_avaliacao_aluno(uuid);
create function public.rpc_questoes_avaliacao_aluno(p_avaliacao_id uuid)
returns table(question_id uuid, ordem integer, valor numeric, statement text, image_url text, alternatives jsonb,
              support_text_content text, support_text_image_url text, ja_respondida boolean, letra_marcada text,
              tipo text, linhas_resposta integer, resposta_texto text, discipline text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_aluno_id uuid;
  v_prova provas;
  v_resposta_id uuid;
begin
  v_aluno_id := public.meu_aluno_id();
  if v_aluno_id is null then
    raise exception 'Só alunos podem acessar avaliações.';
  end if;

  select * into v_prova from provas where id = p_avaliacao_id;
  if not found or v_prova.status not in ('PUBLICADA', 'ENCERRADA') then
    raise exception 'Avaliação não encontrada.';
  end if;
  if not exists (
    select 1 from prova_turmas pt join alunos al on al.turma_id = pt.turma_id
    where pt.prova_id = p_avaliacao_id and al.id = v_aluno_id
  ) then
    raise exception 'Esta avaliação não está disponível para a sua turma.';
  end if;

  select id into v_resposta_id from prova_respostas where prova_id = p_avaliacao_id and aluno_id = v_aluno_id;

  return query
  select
    q.id, pq.ordem, pq.valor, q.statement, q.image_url, q.alternatives, st.content, st.image_url,
    (v_resposta_id is not null and exists (select 1 from prova_respostas_itens ri where ri.resposta_id = v_resposta_id and ri.question_id = q.id)),
    (select ri.letra_marcada from prova_respostas_itens ri where ri.resposta_id = v_resposta_id and ri.question_id = q.id),
    q.tipo, q.linhas_resposta,
    (select ri.resposta_texto from prova_respostas_itens ri where ri.resposta_id = v_resposta_id and ri.question_id = q.id),
    q.discipline
  from prova_questoes pq
  join questions q on q.id = pq.question_id
  left join support_texts st on st.id = q.support_text_id
  where pq.prova_id = p_avaliacao_id
  order by pq.ordem;
end;
$$;

drop function if exists public.rpc_questoes_avaliacao_preview(uuid);
create function public.rpc_questoes_avaliacao_preview(p_avaliacao_id uuid)
returns table(question_id uuid, ordem integer, valor numeric, statement text, image_url text, alternatives jsonb,
              support_text_content text, support_text_image_url text, ja_respondida boolean, letra_marcada text,
              tipo text, linhas_resposta integer, resposta_texto text, discipline text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_prova provas;
begin
  select * into v_prova from provas where id = p_avaliacao_id;
  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;
  if not (
    v_prova.criado_por = auth.uid()
    or public.usuario_tem_papel('COORDENACAO')
    or public.usuario_tem_papel('GESTAO')
    or public.usuario_tem_papel('PROFESSOR')
  ) then
    raise exception 'Sem permissão para visualizar esta avaliação.';
  end if;

  return query
  select
    q.id, pq.ordem, pq.valor, q.statement, q.image_url, q.alternatives, st.content, st.image_url,
    false, null::text, q.tipo, q.linhas_resposta, null::text, q.discipline
  from prova_questoes pq
  join questions q on q.id = pq.question_id
  left join support_texts st on st.id = q.support_text_id
  where pq.prova_id = p_avaliacao_id
  order by pq.ordem;
end;
$$;

grant execute on function public.rpc_questoes_avaliacao_aluno(uuid), public.rpc_questoes_avaliacao_preview(uuid) to authenticated;

-- ---------------------------------------------------------------- 2. rascunho da redação
create table if not exists public.redacao_rascunhos (
  prova_id      uuid not null references public.provas(id) on delete cascade,
  aluno_id      uuid not null references public.alunos(id) on delete cascade,
  question_id   uuid not null references public.questions(id) on delete cascade,
  texto         text not null default '',
  atualizado_em timestamptz not null default now(),
  primary key (prova_id, aluno_id, question_id)
);
alter table public.redacao_rascunhos enable row level security;

create or replace function public.rpc_redacao_rascunho_salvar(p_avaliacao_id uuid, p_question_id uuid, p_texto text)
returns timestamptz
language plpgsql security definer set search_path to 'public' as $$
declare
  v_aluno_id uuid := public.meu_aluno_id();
  v_prova provas;
  v_q questions;
  v_quando timestamptz := now();
begin
  if v_aluno_id is null then raise exception 'Só alunos podem salvar rascunho.'; end if;
  select * into v_prova from provas where id = p_avaliacao_id;
  if not found or v_prova.status <> 'PUBLICADA' then raise exception 'Esta avaliação não está disponível para envio.'; end if;
  if v_prova.prazo_entrega is not null and now() > v_prova.prazo_entrega then raise exception 'O prazo de entrega desta avaliação já encerrou.'; end if;
  if not exists (select 1 from prova_turmas pt join alunos al on al.turma_id = pt.turma_id
                  where pt.prova_id = p_avaliacao_id and al.id = v_aluno_id) then
    raise exception 'Esta avaliação não está disponível para a sua turma.';
  end if;
  if exists (select 1 from prova_respostas where prova_id = p_avaliacao_id and aluno_id = v_aluno_id and finalizado_em is not null) then
    raise exception 'Você já enviou esta avaliação.';
  end if;
  select q.* into v_q from prova_questoes pq join questions q on q.id = pq.question_id
   where pq.prova_id = p_avaliacao_id and q.id = p_question_id;
  if not found or not public.questao_eh_redacao(v_q.tipo, v_q.discipline) then
    raise exception 'Esta questão não é uma redação desta avaliação.';
  end if;
  if length(coalesce(p_texto, '')) > 20000 then raise exception 'Texto longo demais.'; end if;

  insert into redacao_rascunhos (prova_id, aluno_id, question_id, texto, atualizado_em)
  values (p_avaliacao_id, v_aluno_id, p_question_id, coalesce(p_texto, ''), v_quando)
  on conflict (prova_id, aluno_id, question_id) do update set texto = excluded.texto, atualizado_em = excluded.atualizado_em;
  return v_quando;
end;
$$;

create or replace function public.rpc_redacao_rascunho_obter(p_avaliacao_id uuid)
returns table(question_id uuid, texto text, atualizado_em timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_aluno_id uuid := public.meu_aluno_id();
begin
  if v_aluno_id is null then raise exception 'Só alunos podem acessar rascunhos.'; end if;
  -- Depois de enviada, a resposta oficial manda: rascunho antigo não volta.
  if exists (select 1 from prova_respostas where prova_id = p_avaliacao_id and aluno_id = v_aluno_id and finalizado_em is not null) then
    return;
  end if;
  return query
  select r.question_id, r.texto, r.atualizado_em from redacao_rascunhos r
   where r.prova_id = p_avaliacao_id and r.aluno_id = v_aluno_id;
end;
$$;

-- ---------------------------------------------------------------- 3. lista do professor (online + impressa)
drop function if exists public.rpc_redacao_listar(uuid);
create function public.rpc_redacao_listar(p_prova_id uuid)
returns table (
  aluno_id uuid, aluno_nome text, turma_nome text, numero_chamada integer,
  question_id uuid, tema text, valor numeric,
  envio_id uuid, status text, nota_total integer, tem_imagem boolean, origem text, tem_texto_digitado boolean
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.pode_corrigir_prova(p_prova_id) then
    raise exception 'Sem permissão para corrigir esta prova.';
  end if;
  return query
  select al.id, al.nome, t.nome, al.aluno_numero,
         q.id, q.topico, pq.valor,
         e.id, e.status, e.nota_total, (e.imagem_path is not null), e.origem,
         exists (select 1 from prova_respostas r join prova_respostas_itens ri on ri.resposta_id = r.id
                  where r.prova_id = p_prova_id and r.aluno_id = al.id and ri.question_id = q.id
                    and nullif(trim(coalesce(ri.resposta_texto, '')), '') is not null)
  from alunos al
  left join turmas t on t.id = al.turma_id
  join prova_questoes pq on pq.prova_id = p_prova_id
  join questions q on q.id = pq.question_id and public.questao_eh_redacao(q.tipo, q.discipline)
  left join redacao_envios e on e.prova_id = p_prova_id and e.aluno_id = al.id and e.question_id = q.id
  where al.id in (
          select a2.id from alunos a2 join prova_turmas pt on pt.turma_id = a2.turma_id
           where pt.prova_id = p_prova_id and a2.status in ('Ativo', 'Atestado')
          union
          select pa.aluno_id from prova_alocacoes pa where pa.prova_id = p_prova_id
          union
          select e2.aluno_id from redacao_envios e2 where e2.prova_id = p_prova_id)
  order by t.nome nulls last, al.aluno_numero nulls last, al.nome, pq.ordem;
end;
$$;

-- ---------------------------------------------------------------- 4. abrir a redação de um aluno
create or replace function public._redacao_abrir(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid, p_alocacao_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_qids uuid[];
  v_qid uuid;
  v_resposta_id uuid;
  v_texto text;
  v_envio redacao_envios;
  v_aluno alunos;
  v_turma text;
  v_q questions;
  v_valor numeric;
begin
  select array_agg(q.id order by pq.ordem) into v_qids
  from prova_questoes pq join questions q on q.id = pq.question_id
  where pq.prova_id = p_prova_id and public.questao_eh_redacao(q.tipo, q.discipline);
  if v_qids is null then raise exception 'Esta prova não tem questão de redação.'; end if;

  if p_question_id is not null then
    if not (p_question_id = any (v_qids)) then raise exception 'A questão informada não é uma redação desta prova.'; end if;
    v_qid := p_question_id;
  elsif array_length(v_qids, 1) = 1 then
    v_qid := v_qids[1];
  else
    return jsonb_build_object('precisa_escolher_questao', true, 'questoes',
      (select jsonb_agg(jsonb_build_object('question_id', q.id, 'tema', q.topico) order by pq.ordem)
         from prova_questoes pq join questions q on q.id = pq.question_id
        where pq.prova_id = p_prova_id and q.id = any (v_qids)));
  end if;

  insert into prova_respostas (prova_id, aluno_id) values (p_prova_id, p_aluno_id)
  on conflict (prova_id, aluno_id) do update set prova_id = excluded.prova_id
  returning id into v_resposta_id;

  insert into prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido)
  values (v_resposta_id, v_qid, null, false, 0, false)
  on conflict (resposta_id, question_id) do nothing;

  select nullif(trim(coalesce(ri.resposta_texto, '')), '') into v_texto
    from prova_respostas_itens ri where ri.resposta_id = v_resposta_id and ri.question_id = v_qid;

  insert into redacao_envios (prova_id, aluno_id, question_id, alocacao_id)
  values (p_prova_id, p_aluno_id, v_qid, p_alocacao_id)
  on conflict (prova_id, aluno_id, question_id) do nothing;

  -- Texto digitado pelo aluno entra como texto da correção (sem transcrição), se ainda não há texto.
  if v_texto is not null then
    update redacao_envios set origem = 'DIGITADA', texto_final = coalesce(texto_final, v_texto),
           status = case when status = 'ENVIADA' then 'TRANSCRITA' else status end, atualizado_em = now()
     where prova_id = p_prova_id and aluno_id = p_aluno_id and question_id = v_qid and texto_final is null;
  end if;

  select * into v_envio from redacao_envios where prova_id = p_prova_id and aluno_id = p_aluno_id and question_id = v_qid;
  select * into v_aluno from alunos where id = p_aluno_id;
  select nome into v_turma from turmas where id = v_aluno.turma_id;
  select * into v_q from questions where id = v_qid;
  select valor into v_valor from prova_questoes where prova_id = p_prova_id and question_id = v_qid;

  return jsonb_build_object(
    'envio_id', v_envio.id, 'prova_id', p_prova_id, 'aluno_id', p_aluno_id,
    'aluno_nome', v_aluno.nome, 'turma_nome', v_turma, 'question_id', v_qid,
    'tema', v_q.topico, 'valor', v_valor, 'status', v_envio.status);
end;
$$;

create or replace function public.rpc_redacao_preparar(p_codigo text, p_question_id uuid default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_aloc prova_alocacoes;
begin
  select * into v_aloc from prova_alocacoes where codigo = upper(trim(p_codigo));
  if not found then raise exception 'Código não encontrado. Confira se a folha é desta prova.'; end if;
  if not public.pode_corrigir_prova(v_aloc.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  return public._redacao_abrir(v_aloc.prova_id, v_aloc.aluno_id, p_question_id, v_aloc.id);
end;
$$;

create or replace function public.rpc_redacao_preparar_aluno(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_aloc uuid;
begin
  if not public.pode_corrigir_prova(p_prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  if not exists (
    select 1 from alunos al where al.id = p_aluno_id and (
      exists (select 1 from prova_turmas pt where pt.prova_id = p_prova_id and pt.turma_id = al.turma_id)
      or exists (select 1 from prova_alocacoes pa where pa.prova_id = p_prova_id and pa.aluno_id = al.id))
  ) then
    raise exception 'Este aluno não faz parte desta prova.';
  end if;
  select id into v_aloc from prova_alocacoes where prova_id = p_prova_id and aluno_id = p_aluno_id;
  return public._redacao_abrir(p_prova_id, p_aluno_id, p_question_id, v_aloc);
end;
$$;

-- ---------------------------------------------------------------- permissões
revoke all on function public._redacao_abrir(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.rpc_redacao_listar(uuid), public.rpc_redacao_preparar(text, uuid),
  public.rpc_redacao_preparar_aluno(uuid, uuid, uuid), public.rpc_redacao_rascunho_salvar(uuid, uuid, text),
  public.rpc_redacao_rascunho_obter(uuid) from public, anon;
grant execute on function public.rpc_redacao_listar(uuid), public.rpc_redacao_preparar(text, uuid),
  public.rpc_redacao_preparar_aluno(uuid, uuid, uuid), public.rpc_redacao_rascunho_salvar(uuid, uuid, text),
  public.rpc_redacao_rascunho_obter(uuid) to authenticated;
