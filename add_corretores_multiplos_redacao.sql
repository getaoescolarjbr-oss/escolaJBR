-- ====================================================================================
-- VÁRIOS CORRETORES POR TURMA + REDAÇÃO ATRIBUÍDA POR ALUNO
--
-- 1. prova_corretores passa a aceitar mais de um professor por turma (a regra de quem edita a nota
--    em pode_editar_nota_vinculada já era "é um dos corretores da turma", então não muda).
-- 2. Redação: cada corretor assume as suas (redacao_atribuicoes). Quem não é o responsável vê a
--    redação mas não grava nada nela. Dono/coordenação (pode_gerir_prova / eh_staff_avaliacao)
--    passam por cima. Turma SEM corretor definido continua como antes (qualquer professor com
--    permissão corrige), só que agora também pode assumir.
--
-- As funções de redação já existentes são ajustadas por substituição de texto sobre a definição
-- que está no banco (pg_get_functiondef), para não regravar à mão o que está em produção.
--
-- Reversão (nesta ordem):
--   restaurar as funções alteradas a partir de add_redacao_*.sql / add_corretores_e_avaliacao_somente_nota.sql;
--   drop function public.rpc_redacao_assumir(uuid,uuid,uuid), public.rpc_redacao_liberar(uuid,uuid,uuid),
--     public.rpc_redacao_dividir(uuid,boolean), public.exigir_corretor_redacao(uuid,uuid,uuid),
--     public._redacao_motivo_bloqueio(uuid,uuid,uuid);
--   drop table public.redacao_atribuicoes;
--   -- só se NENHUMA turma tiver 2+ corretores: alter table public.prova_corretores
--   --   drop constraint uq_prova_corretor_turma_professor, add constraint uq_prova_corretor_turma unique (prova_id, turma_id);
-- ====================================================================================

-- ------------------------------------------------------------------ 1. vários corretores por turma
alter table public.prova_corretores drop constraint if exists uq_prova_corretor_turma;
alter table public.prova_corretores
  add constraint uq_prova_corretor_turma_professor unique (prova_id, turma_id, professor_id);

-- rpc_notas_bloqueadas devolvia uma linha por corretor; agora uma por avaliação, com os nomes juntos.
create or replace function public.rpc_notas_bloqueadas(p_avaliacao_ids uuid[])
returns table (avaliacao_id uuid, corretor_nome text)
language sql stable security definer set search_path = public as $$
  select pan.avaliacao_id, string_agg(prof.nome, ', ' order by prof.nome)
  from public.prova_avaliacao_notas pan
  join public.prova_corretores pc on pc.prova_id = pan.prova_id and pc.turma_id = pan.turma_id
  join public.professores prof on prof.id = pc.professor_id
  where pan.avaliacao_id = any (p_avaliacao_ids)
    and not public.pode_editar_nota_vinculada(pan.avaliacao_id)
  group by pan.avaliacao_id;
$$;

-- rpc_definir_corretores: o payload [{turma_id, professor_id}] já aceita repetir a turma; só o
-- DISTINCT ON limitava a um por turma.
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.rpc_definir_corretores(uuid,jsonb)'::regprocedure);
  novo := replace(d, 'SELECT DISTINCT ON (x.turma_id) p_prova_id', 'SELECT DISTINCT ON (x.turma_id, x.professor_id) p_prova_id');
  if novo = d then raise exception 'rpc_definir_corretores: trecho não encontrado (a função mudou?)'; end if;
  execute novo;
end $$;

-- ------------------------------------------------------------------ 2. redação por aluno
create table if not exists public.redacao_atribuicoes (
  prova_id     uuid not null references public.provas(id) on delete cascade,
  aluno_id     uuid not null references public.alunos(id) on delete cascade,
  question_id  uuid not null references public.questions(id) on delete cascade,
  professor_id uuid not null references public.professores(id),
  atribuido_em timestamptz not null default now(),
  primary key (prova_id, aluno_id, question_id)
);
create index if not exists idx_redacao_atrib_prof on public.redacao_atribuicoes (professor_id);
-- Sem políticas: tudo passa pelas funções SECURITY DEFINER abaixo.
alter table public.redacao_atribuicoes enable row level security;

create or replace function public._redacao_meu_professor() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.professores where user_id = auth.uid() limit 1;
$$;

-- Texto do motivo pelo qual o usuário NÃO pode gravar nesta redação; nulo = pode.
create or replace function public._redacao_motivo_bloqueio(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_turma uuid; v_resp record;
begin
  if not public.pode_corrigir_prova(p_prova_id) then return 'Sem permissão para corrigir esta prova.'; end if;
  if public.pode_gerir_prova(p_prova_id) or public.eh_staff_avaliacao() then return null; end if;

  select turma_id into v_turma from public.alunos where id = p_aluno_id;
  if exists (select 1 from public.prova_corretores where prova_id = p_prova_id and turma_id = v_turma)
     and not exists (select 1 from public.prova_corretores pc join public.professores pr on pr.id = pc.professor_id
                      where pc.prova_id = p_prova_id and pc.turma_id = v_turma and pr.user_id = auth.uid()) then
    return 'Você não é corretor desta turma nesta avaliação.';
  end if;

  select pr.nome, pr.user_id into v_resp
    from public.redacao_atribuicoes a join public.professores pr on pr.id = a.professor_id
   where a.prova_id = p_prova_id and a.aluno_id = p_aluno_id and a.question_id = p_question_id;
  if found and v_resp.user_id is distinct from auth.uid() then
    return 'Esta redação está com ' || v_resp.nome || '. Peça a essa pessoa para liberá-la.';
  end if;
  return null;
end;
$$;

create or replace function public.exigir_corretor_redacao(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare v_msg text;
begin
  v_msg := public._redacao_motivo_bloqueio(p_prova_id, p_aluno_id, p_question_id);
  if v_msg is not null then raise exception '%', v_msg; end if;
end;
$$;

revoke all on function public._redacao_meu_professor(), public._redacao_motivo_bloqueio(uuid, uuid, uuid),
  public.exigir_corretor_redacao(uuid, uuid, uuid) from public, anon, authenticated;

-- Funções de escrita que já existiam: a checagem "pode corrigir a prova" vira "pode corrigir ESTA redação".
do $$
declare
  f text; d text; novo text;
  velho constant text := 'if not public.pode_corrigir_prova(v.prova_id) then raise exception ''Sem permissão para corrigir esta prova.''; end if;';
  nova  constant text := 'perform public.exigir_corretor_redacao(v.prova_id, v.aluno_id, v.question_id);';
begin
  foreach f in array array[
    'public.rpc_redacao_salvar(uuid,text,jsonb,text,jsonb)',
    'public.rpc_redacao_confirmar(uuid,jsonb,text)',
    'public.rpc_redacao_definir_rubrica(uuid,uuid)',
    'public.rpc_redacao_mostrar_esperado(uuid,boolean)'
  ] loop
    d := pg_get_functiondef(f::regprocedure);
    novo := replace(d, velho, nova);
    if novo = d then raise exception '%: trecho de permissão não encontrado (a função mudou?)', f; end if;
    execute novo;
  end loop;

  -- Abrir/criar o registro da redação (leitura do QR ou "Digitar"): vale a mesma trava.
  d := pg_get_functiondef('public._redacao_abrir(uuid,uuid,uuid,uuid)'::regprocedure);
  novo := replace(d, E'  insert into prova_respostas (prova_id, aluno_id) values (p_prova_id, p_aluno_id)',
                     E'  perform public.exigir_corretor_redacao(p_prova_id, p_aluno_id, v_qid);\n  insert into prova_respostas (prova_id, aluno_id) values (p_prova_id, p_aluno_id)');
  if novo = d then raise exception '_redacao_abrir: ponto de inserção não encontrado (a função mudou?)'; end if;
  execute novo;
end $$;

-- ------------------------------------------------------------------ assumir / liberar / dividir
create or replace function public.rpc_redacao_assumir(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_prof uuid := public._redacao_meu_professor();
begin
  if v_prof is null then raise exception 'Só um professor cadastrado pode assumir uma redação.'; end if;
  if not exists (select 1 from public.prova_questoes pq join public.questions q on q.id = pq.question_id
                  where pq.prova_id = p_prova_id and q.id = p_question_id and public.questao_eh_redacao(q.tipo, q.discipline)) then
    raise exception 'A questão informada não é uma redação desta prova.';
  end if;
  -- Quem pode gravar nela (inclui "não está com outro corretor"); gestor pode tomar para si.
  perform public.exigir_corretor_redacao(p_prova_id, p_aluno_id, p_question_id);
  insert into public.redacao_atribuicoes (prova_id, aluno_id, question_id, professor_id)
  values (p_prova_id, p_aluno_id, p_question_id, v_prof)
  on conflict (prova_id, aluno_id, question_id) do update set professor_id = excluded.professor_id, atribuido_em = now();
  return (select nome from public.professores where id = v_prof);
end;
$$;

create or replace function public.rpc_redacao_liberar(p_prova_id uuid, p_aluno_id uuid, p_question_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_dono uuid;
begin
  if not public.pode_corrigir_prova(p_prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  select pr.user_id into v_dono from public.redacao_atribuicoes a join public.professores pr on pr.id = a.professor_id
   where a.prova_id = p_prova_id and a.aluno_id = p_aluno_id and a.question_id = p_question_id;
  if not found then return; end if;
  if v_dono is distinct from auth.uid() and not (public.pode_gerir_prova(p_prova_id) or public.eh_staff_avaliacao()) then
    raise exception 'Só quem assumiu a redação, o dono da avaliação ou a coordenação pode liberá-la.';
  end if;
  delete from public.redacao_atribuicoes where prova_id = p_prova_id and aluno_id = p_aluno_id and question_id = p_question_id;
end;
$$;

-- Reparte as redações ainda não corrigidas entre os corretores de cada turma (rodízio por nº de chamada).
-- p_refazer = false: só as que ainda não têm responsável. Turma sem corretor é ignorada e contada.
create or replace function public.rpc_redacao_dividir(p_prova_id uuid, p_refazer boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_atribuidas integer; v_sem_corretor integer;
begin
  if not (public.pode_gerir_prova(p_prova_id) or public.eh_staff_avaliacao()) then
    raise exception 'Só o dono da avaliação ou a coordenação divide as redações.';
  end if;
  if not public.pode_corrigir_prova(p_prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;

  -- Uma só instrução: o "alvo" é lido antes do insert, então a contagem de turmas sem corretor é coerente.
  with alvo as (
    select al.id as aluno_id, al.turma_id, q.id as question_id,
           row_number() over (partition by al.turma_id, q.id order by al.aluno_numero nulls last, al.nome) as rn
    from public.alunos al
    join public.prova_turmas pt on pt.turma_id = al.turma_id and pt.prova_id = p_prova_id
    join public.prova_questoes pq on pq.prova_id = p_prova_id
    join public.questions q on q.id = pq.question_id and public.questao_eh_redacao(q.tipo, q.discipline)
    where al.status in ('Ativo', 'Atestado')
      and not exists (select 1 from public.redacao_envios e where e.prova_id = p_prova_id and e.aluno_id = al.id
                         and e.question_id = q.id and e.status = 'REVISADA')
      and (p_refazer or not exists (select 1 from public.redacao_atribuicoes a where a.prova_id = p_prova_id
                         and a.aluno_id = al.id and a.question_id = q.id))
  ), carga as (
    -- Quem já tem mais redações assumidas entra por último no rodízio, para o total ficar parelho.
    select pc.turma_id, pc.professor_id, pr.nome,
           case when p_refazer then 0 else (select count(*) from public.redacao_atribuicoes x
                                             where x.prova_id = p_prova_id and x.professor_id = pc.professor_id) end as ja
    from public.prova_corretores pc join public.professores pr on pr.id = pc.professor_id
    where pc.prova_id = p_prova_id
  ), cor as (
    select turma_id, professor_id,
           row_number() over (partition by turma_id order by ja, nome, professor_id) - 1 as idx,
           count(*) over (partition by turma_id) as n
    from carga
  ), ins as (
    insert into public.redacao_atribuicoes (prova_id, aluno_id, question_id, professor_id)
    select p_prova_id, a.aluno_id, a.question_id, c.professor_id
    from alvo a join cor c on c.turma_id = a.turma_id and c.idx = (a.rn - 1) % c.n
    on conflict (prova_id, aluno_id, question_id) do update set professor_id = excluded.professor_id, atribuido_em = now()
    returning 1
  )
  select (select count(*) from ins),
         (select count(*) from alvo a where not exists (select 1 from cor c where c.turma_id = a.turma_id))
    into v_atribuidas, v_sem_corretor;

  return jsonb_build_object('atribuidas', v_atribuidas, 'sem_corretor', v_sem_corretor);
end;
$$;

-- ------------------------------------------------------------------ listagem com responsável
drop function if exists public.rpc_redacao_listar(uuid);
create function public.rpc_redacao_listar(p_prova_id uuid)
returns table (
  aluno_id uuid, aluno_nome text, turma_nome text, numero_chamada integer,
  question_id uuid, tema text, valor numeric,
  envio_id uuid, status text, nota_total integer, nota_maxima integer, tem_imagem boolean, origem text, tem_texto_digitado boolean,
  responsavel_nome text, sou_responsavel boolean, bloqueio text, sou_gestor boolean, n_corretores integer
)
language plpgsql stable security definer set search_path = public as $$
declare v_gestor boolean;
begin
  if not public.pode_corrigir_prova(p_prova_id) then
    raise exception 'Sem permissão para corrigir esta prova.';
  end if;
  v_gestor := public.pode_gerir_prova(p_prova_id) or public.eh_staff_avaliacao();
  return query
  select al.id, al.nome, t.nome, al.aluno_numero,
         q.id, q.topico, pq.valor,
         e.id, e.status, e.nota_total, e.nota_maxima, (e.imagem_path is not null), e.origem,
         exists (select 1 from prova_respostas r join prova_respostas_itens ri on ri.resposta_id = r.id
                  where r.prova_id = p_prova_id and r.aluno_id = al.id and ri.question_id = q.id
                    and nullif(trim(coalesce(ri.resposta_texto, '')), '') is not null),
         pr.nome, (pr.user_id is not distinct from auth.uid() and pr.id is not null),
         public._redacao_motivo_bloqueio(p_prova_id, al.id, q.id), v_gestor,
         (select count(*)::integer from prova_corretores pc where pc.prova_id = p_prova_id and pc.turma_id = al.turma_id)
  from alunos al
  left join turmas t on t.id = al.turma_id
  join prova_questoes pq on pq.prova_id = p_prova_id
  join questions q on q.id = pq.question_id and public.questao_eh_redacao(q.tipo, q.discipline)
  left join redacao_envios e on e.prova_id = p_prova_id and e.aluno_id = al.id and e.question_id = q.id
  left join redacao_atribuicoes atr on atr.prova_id = p_prova_id and atr.aluno_id = al.id and atr.question_id = q.id
  left join professores pr on pr.id = atr.professor_id
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

revoke all on function public.rpc_redacao_assumir(uuid, uuid, uuid), public.rpc_redacao_liberar(uuid, uuid, uuid),
  public.rpc_redacao_dividir(uuid, boolean), public.rpc_redacao_listar(uuid) from public, anon;
grant execute on function public.rpc_redacao_assumir(uuid, uuid, uuid), public.rpc_redacao_liberar(uuid, uuid, uuid),
  public.rpc_redacao_dividir(uuid, boolean), public.rpc_redacao_listar(uuid) to authenticated;
