-- Estrutura do ACERVO de questões, para o 2º projeto Supabase (jbr-acervo-questoes).
-- Espelha questions / support_texts / question_taxonomy_terms do projeto principal, com
-- duas diferenças propositais:
--   * questions.criado_por é só um uuid (não há auth.users equivalente neste projeto);
--   * RLS ligado SEM nenhuma política e sem GRANT para anon/authenticated: o acervo só é
--     acessível pela chave de serviço, usada pela Edge Function acervo-proxy do projeto
--     principal, que valida o login e o papel do usuário antes de consultar aqui.
-- A restrição questions_tipo_conteudo_check é criada por último, NOT VALID, porque linhas
-- antigas do projeto principal a violam (mesmo estado de lá).
--
-- Ver docs/plano-migracao-banco-questoes.md

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.support_texts (
  id          uuid primary key default gen_random_uuid(),
  discipline  text not null,
  content     text not null,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.question_taxonomy_terms (
  id          uuid primary key default gen_random_uuid(),
  field       text not null,
  value       text not null,
  created_at  timestamptz not null default now(),
  constraint question_taxonomy_terms_field_check check (field = any (array['discipline','difficulty','assunto','banca','orgao','cargo','level','area','topico'])),
  constraint question_taxonomy_terms_field_value_key unique (field, value)
);

create table if not exists public.questions (
  id                 uuid primary key default gen_random_uuid(),
  discipline         text not null,
  area               text,
  level              text,
  banca              text,
  orgao              text,
  cargo              text,
  ano                integer,
  difficulty         text,
  assunto            text,
  statement          text not null,
  image_url          text,
  alternatives       jsonb not null default '[]'::jsonb,
  correct_letter     text,
  explanation        text,
  support_text_id    uuid references public.support_texts(id) on delete set null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  criado_por         uuid,
  tipo               text not null default 'OBJETIVA',
  criterios_correcao text,
  linhas_resposta    integer,
  correct_sum        integer,
  topico             text,
  constraint questions_correct_sum_check check (correct_sum is null or correct_sum >= 0),
  constraint questions_linhas_resposta_check check (linhas_resposta is null or (linhas_resposta > 0 and linhas_resposta <= 100)),
  constraint questions_tipo_check check (tipo = any (array['OBJETIVA','DISSERTATIVA','REDACAO','SOMATORIA']))
);

create index if not exists questions_criado_por_idx          on public.questions (criado_por);
create index if not exists questions_discipline_idx          on public.questions (discipline);
create index if not exists questions_support_text_id_idx     on public.questions (support_text_id);
create index if not exists questions_tipo_nao_objetiva_idx   on public.questions (tipo) where tipo <> 'OBJETIVA';
create index if not exists questions_assunto_idx             on public.questions (assunto);
create index if not exists questions_banca_idx               on public.questions (banca);

drop trigger if exists update_questions_updated_at on public.questions;
create trigger update_questions_updated_at before update on public.questions
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_support_texts_updated_at on public.support_texts;
create trigger update_support_texts_updated_at before update on public.support_texts
  for each row execute function public.update_updated_at_column();

-- Funções de filtro e sorteio, iguais às do projeto principal.
create or replace function public.question_bank_assuntos_by_discipline(p_discipline text)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select array_agg(distinct assunto order by assunto)
  from public.questions
  where discipline = p_discipline and assunto is not null;
$$;

create or replace function public.question_bank_topicos_by_assunto(p_assunto text)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select array_agg(distinct topico order by topico)
  from public.questions
  where assunto = p_assunto and topico is not null;
$$;

create or replace function public.question_bank_filter_options()
returns table(disciplines text[], difficulties text[], orgaos text[], cargos text[], anos integer[], assuntos text[], bancas text[], levels text[], areas text[], topicos text[])
language sql stable security definer set search_path to 'public' as $$
  select
    (select array_agg(distinct v) from (select discipline as v from public.questions where discipline is not null union select value from public.question_taxonomy_terms where field = 'discipline') t),
    (select array_agg(distinct v) from (select difficulty as v from public.questions where difficulty is not null union select value from public.question_taxonomy_terms where field = 'difficulty') t),
    (select array_agg(distinct v) from (select orgao as v from public.questions where orgao is not null union select value from public.question_taxonomy_terms where field = 'orgao') t),
    (select array_agg(distinct v) from (select cargo as v from public.questions where cargo is not null union select value from public.question_taxonomy_terms where field = 'cargo') t),
    (select array_agg(distinct ano) from public.questions where ano is not null),
    (select array_agg(distinct v) from (select assunto as v from public.questions where assunto is not null union select value from public.question_taxonomy_terms where field = 'assunto') t),
    (select array_agg(distinct v) from (select banca as v from public.questions where banca is not null union select value from public.question_taxonomy_terms where field = 'banca') t),
    (select array_agg(distinct v) from (select level as v from public.questions where level is not null union select value from public.question_taxonomy_terms where field = 'level') t),
    (select array_agg(distinct v) from (select area as v from public.questions where area is not null union select value from public.question_taxonomy_terms where field = 'area') t),
    (select array_agg(distinct v) from (select topico as v from public.questions where topico is not null union select value from public.question_taxonomy_terms where field = 'topico') t);
$$;

create or replace function public.rpc_sortear_questoes(
  p_qtd integer, p_disciplinas text[] default null, p_assunto text default null,
  p_topico text default null, p_banca text default null, p_excluir uuid[] default array[]::uuid[]
) returns setof uuid language sql set search_path to 'public' as $$
  select q.id
  from public.questions q
  where q.active = true
    and q.tipo = 'OBJETIVA'
    and (coalesce(array_length(p_disciplinas, 1), 0) = 0 or q.discipline = any(p_disciplinas))
    and (nullif(p_assunto, '') is null or q.assunto = p_assunto)
    and (nullif(p_topico, '') is null or q.topico = p_topico)
    and (nullif(p_banca, '') is null or q.banca = p_banca)
    and not (q.id = any(coalesce(p_excluir, array[]::uuid[])))
  order by random()
  limit least(greatest(coalesce(p_qtd, 0), 0), 200);
$$;

-- Fechado ao público: sem política e sem privilégio para anon/authenticated.
alter table public.questions               enable row level security;
alter table public.support_texts           enable row level security;
alter table public.question_taxonomy_terms enable row level security;
revoke all on public.questions, public.support_texts, public.question_taxonomy_terms from anon, authenticated;
revoke all on function public.question_bank_assuntos_by_discipline(text), public.question_bank_topicos_by_assunto(text),
              public.question_bank_filter_options(), public.rpc_sortear_questoes(integer, text[], text, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.question_bank_assuntos_by_discipline(text), public.question_bank_topicos_by_assunto(text),
                          public.question_bank_filter_options(), public.rpc_sortear_questoes(integer, text[], text, text, text, uuid[])
  to service_role;
