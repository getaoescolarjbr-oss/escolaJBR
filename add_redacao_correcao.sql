-- ====================================================================================
-- CORREÇÃO DE REDAÇÃO: folha escaneada/digitada -> transcrição -> prévia da IA -> nota do professor
--
-- A nota NÃO tem caminho próprio: a redação é uma questão escrita da prova (disciplina "Redação",
-- tipo DISSERTATIVA) e a nota entra por rpc_corrigir_item_dissertativo, a mesma RPC que a
-- correção manual de dissertativas já usa — ela recalcula a nota da prova e o status_correcao.
-- rpc_corrigir_omr já cria o item pendente de questão escrita; aqui rpc_redacao_preparar faz o
-- mesmo para quem corrige só a redação (sem cartão-resposta).
--
-- Esta tabela guarda o que o resto do portal não tem onde guardar: a imagem recortada, a
-- transcrição por linha, a prévia da IA e as 5 competências do professor (concordo/discordo).
--
-- Acesso: RLS ligada e SEM política de leitura/escrita direta. Tudo passa por RPC SECURITY DEFINER
-- que confere pode_corrigir_prova() — mesmo desenho da correção óptica.
--
-- Reversão (nada aqui altera tabelas existentes):
--   drop function rpc_redacao_listar(uuid), rpc_redacao_preparar(text, uuid), rpc_redacao_obter(uuid),
--     rpc_redacao_salvar(uuid, text, jsonb, text, jsonb), rpc_redacao_confirmar(uuid, jsonb, text);
--   drop table redacao_envios;  -- e o bucket redacoes-scans pela API de Storage
-- ====================================================================================

-- ---------------------------------------------------------------- tabela
create table if not exists public.redacao_envios (
  id            uuid primary key default gen_random_uuid(),
  prova_id      uuid not null references public.provas(id) on delete cascade,
  aluno_id      uuid not null references public.alunos(id) on delete cascade,
  question_id   uuid not null references public.questions(id) on delete cascade,
  alocacao_id   uuid references public.prova_alocacoes(id) on delete set null,
  origem        text not null default 'SCAN' check (origem in ('SCAN', 'DIGITADA')),
  imagem_path   text,          -- bucket redacoes-scans: <prova_id>/<aluno_id>/<envio_id>.jpg
  linhas        jsonb,         -- transcrição: [{ n, texto, confianca }]
  texto_final   text,          -- texto confirmado pelo professor (é ele que a IA corrige)
  correcao_ia   jsonb,         -- resposta da função redacao-ia (prévia)
  correcao_prof jsonb,         -- { c1..c5: { nota, concorda, comentario }, comentario_geral, ia_nota_total }
  nota_total    integer check (nota_total is null or (nota_total between 0 and 1000)),
  status        text not null default 'ENVIADA' check (status in ('ENVIADA', 'TRANSCRITA', 'COM_PREVIA', 'REVISADA')),
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (prova_id, aluno_id, question_id)
);
create index if not exists redacao_envios_prova_idx on public.redacao_envios (prova_id);
alter table public.redacao_envios enable row level security;

-- ---------------------------------------------------------------- bucket privado das imagens
insert into storage.buckets (id, name, public)
values ('redacoes-scans', 'redacoes-scans', false)
on conflict (id) do nothing;

-- A pasta de topo do caminho é o prova_id: quem pode corrigir a prova pode ler/gravar/apagar.
drop policy if exists redacoes_scans_acesso on storage.objects;
create policy redacoes_scans_acesso on storage.objects
  for all to authenticated
  using (
    bucket_id = 'redacoes-scans'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.pode_corrigir_prova(((storage.foldername(name))[1])::uuid) else false end
  )
  with check (
    bucket_id = 'redacoes-scans'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.pode_corrigir_prova(((storage.foldername(name))[1])::uuid) else false end
  );

-- ---------------------------------------------------------------- helpers
-- Redação = questão escrita da disciplina "Redação" (ou linha antiga com tipo REDACAO).
create or replace function public.questao_eh_redacao(p_tipo text, p_disciplina text)
returns boolean language sql immutable as $$
  select p_tipo = 'REDACAO' or (p_tipo = 'DISSERTATIVA' and lower(trim(coalesce(p_disciplina, ''))) = 'redação');
$$;

-- ---------------------------------------------------------------- listar
-- Um registro por (aluno alocado, questão de redação) da prova, com o envio quando existe.
create or replace function public.rpc_redacao_listar(p_prova_id uuid)
returns table (
  aluno_id uuid, aluno_nome text, turma_nome text, numero_chamada integer,
  question_id uuid, tema text, valor numeric,
  envio_id uuid, status text, nota_total integer, tem_imagem boolean, origem text
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.pode_corrigir_prova(p_prova_id) then
    raise exception 'Sem permissão para corrigir esta prova.';
  end if;
  return query
  select al.id, al.nome, t.nome, al.aluno_numero,
         q.id, q.topico, pq.valor,
         e.id, e.status, e.nota_total, (e.imagem_path is not null), e.origem
  from prova_alocacoes pa
  join alunos al on al.id = pa.aluno_id
  left join turmas t on t.id = al.turma_id
  join prova_questoes pq on pq.prova_id = pa.prova_id
  join questions q on q.id = pq.question_id and public.questao_eh_redacao(q.tipo, q.discipline)
  left join redacao_envios e on e.prova_id = pa.prova_id and e.aluno_id = pa.aluno_id and e.question_id = q.id
  where pa.prova_id = p_prova_id
  order by t.nome nulls last, al.aluno_numero nulls last, al.nome, pq.ordem;
end;
$$;

-- ---------------------------------------------------------------- preparar (a partir do QR)
-- Recebe o código do QR da folha, confere a permissão, garante a resposta do aluno e o item
-- pendente da redação (sem sobrescrever nada) e o registro do envio. Se a prova tiver mais de uma
-- redação e a questão não for informada, devolve a lista para a tela perguntar.
create or replace function public.rpc_redacao_preparar(p_codigo text, p_question_id uuid default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_aloc prova_alocacoes;
  v_qids uuid[];
  v_qid uuid;
  v_resposta_id uuid;
  v_envio redacao_envios;
  v_aluno alunos;
  v_turma text;
  v_q questions;
  v_valor numeric;
begin
  select * into v_aloc from prova_alocacoes where codigo = upper(trim(p_codigo));
  if not found then
    raise exception 'Código não encontrado. Confira se a folha é desta prova.';
  end if;
  if not public.pode_corrigir_prova(v_aloc.prova_id) then
    raise exception 'Sem permissão para corrigir esta prova.';
  end if;

  select array_agg(q.id order by pq.ordem) into v_qids
  from prova_questoes pq join questions q on q.id = pq.question_id
  where pq.prova_id = v_aloc.prova_id and public.questao_eh_redacao(q.tipo, q.discipline);

  if v_qids is null then
    raise exception 'Esta prova não tem questão de redação.';
  end if;
  if p_question_id is not null then
    if not (p_question_id = any (v_qids)) then
      raise exception 'A questão informada não é uma redação desta prova.';
    end if;
    v_qid := p_question_id;
  elsif array_length(v_qids, 1) = 1 then
    v_qid := v_qids[1];
  else
    return jsonb_build_object('precisa_escolher_questao', true, 'questoes',
      (select jsonb_agg(jsonb_build_object('question_id', q.id, 'tema', q.topico) order by pq.ordem)
         from prova_questoes pq join questions q on q.id = pq.question_id
        where pq.prova_id = v_aloc.prova_id and q.id = any (v_qids)));
  end if;

  insert into prova_respostas (prova_id, aluno_id) values (v_aloc.prova_id, v_aloc.aluno_id)
  on conflict (prova_id, aluno_id) do update set prova_id = excluded.prova_id
  returning id into v_resposta_id;

  insert into prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido)
  values (v_resposta_id, v_qid, null, false, 0, false)
  on conflict (resposta_id, question_id) do nothing;

  insert into redacao_envios (prova_id, aluno_id, question_id, alocacao_id)
  values (v_aloc.prova_id, v_aloc.aluno_id, v_qid, v_aloc.id)
  on conflict (prova_id, aluno_id, question_id) do nothing;

  select * into v_envio from redacao_envios
   where prova_id = v_aloc.prova_id and aluno_id = v_aloc.aluno_id and question_id = v_qid;
  select * into v_aluno from alunos where id = v_aloc.aluno_id;
  select nome into v_turma from turmas where id = v_aluno.turma_id;
  select * into v_q from questions where id = v_qid;
  select valor into v_valor from prova_questoes where prova_id = v_aloc.prova_id and question_id = v_qid;

  return jsonb_build_object(
    'envio_id', v_envio.id, 'prova_id', v_aloc.prova_id, 'aluno_id', v_aloc.aluno_id,
    'aluno_nome', v_aluno.nome, 'turma_nome', v_turma, 'question_id', v_qid,
    'tema', v_q.topico, 'valor', v_valor, 'status', v_envio.status);
end;
$$;

-- ---------------------------------------------------------------- obter
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
    'turma_nome', v_turma, 'question_id', v.question_id, 'tema', v_q.topico,
    'enunciado', v_q.statement, 'criterios', v_q.criterios_correcao, 'valor', v_valor,
    'origem', v.origem, 'imagem_path', v.imagem_path, 'linhas', v.linhas, 'texto_final', v.texto_final,
    'correcao_ia', v.correcao_ia, 'correcao_prof', v.correcao_prof, 'nota_total', v.nota_total, 'status', v.status);
end;
$$;

-- ---------------------------------------------------------------- salvar (etapas do fluxo)
-- Cada parâmetro nulo = "não mexe". Só avança o status: ENVIADA < TRANSCRITA < COM_PREVIA < REVISADA.
-- Depois de REVISADA, mudar o texto ou a prévia exige confirmar de novo (a nota do professor não é
-- sobrescrita por aqui).
create or replace function public.rpc_redacao_salvar(
  p_envio_id uuid, p_imagem_path text default null, p_linhas jsonb default null,
  p_texto_final text default null, p_correcao_ia jsonb default null)
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  v redacao_envios; v_status text;
begin
  select * into v from redacao_envios where id = p_envio_id for update;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;

  v_status := v.status;
  if p_correcao_ia is not null and v_status <> 'REVISADA' then v_status := 'COM_PREVIA';
  elsif (p_linhas is not null or p_texto_final is not null) and v_status = 'ENVIADA' then v_status := 'TRANSCRITA';
  end if;

  update redacao_envios set
    imagem_path = coalesce(p_imagem_path, imagem_path),
    linhas = coalesce(p_linhas, linhas),
    texto_final = coalesce(p_texto_final, texto_final),
    correcao_ia = coalesce(p_correcao_ia, correcao_ia),
    status = v_status,
    atualizado_em = now()
  where id = p_envio_id;
  return v_status;
end;
$$;

-- ---------------------------------------------------------------- confirmar (nota do professor)
-- p_competencias: { "c1": { "nota": 120, "concorda": true, "comentario": "" }, ... "c5": {...} }
-- A nota 0..1000 é a soma das 5 (cada uma 0,40,...,200). Na prova, vale proporcionalmente ao valor
-- da questão: valor_obtido = nota_total / 1000 * valor. Quem grava é rpc_corrigir_item_dissertativo.
create or replace function public.rpc_redacao_confirmar(
  p_envio_id uuid, p_competencias jsonb, p_comentario text default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v redacao_envios; v_item_id uuid; v_valor numeric; v_total integer := 0; v_n integer; k text;
  v_obtido numeric; v_obs text := 'Redação ENEM:'; v_res record;
begin
  select * into v from redacao_envios where id = p_envio_id for update;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;

  foreach k in array array['c1','c2','c3','c4','c5'] loop
    if p_competencias -> k is null then raise exception 'Falta a nota da competência %.', upper(k); end if;
    v_n := (p_competencias -> k ->> 'nota')::integer;
    if v_n is null or v_n < 0 or v_n > 200 or v_n % 40 <> 0 then
      raise exception 'Nota inválida em %: use 0, 40, 80, 120, 160 ou 200.', upper(k);
    end if;
    v_total := v_total + v_n;
    v_obs := v_obs || ' ' || upper(k) || '=' || v_n;
  end loop;
  v_obs := v_obs || ' (total ' || v_total || '/1000)';
  if nullif(trim(coalesce(p_comentario, '')), '') is not null then v_obs := v_obs || '. ' || trim(p_comentario); end if;

  select pq.valor into v_valor from prova_questoes pq where pq.prova_id = v.prova_id and pq.question_id = v.question_id;
  select ri.id into v_item_id
    from prova_respostas_itens ri join prova_respostas r on r.id = ri.resposta_id
   where r.prova_id = v.prova_id and r.aluno_id = v.aluno_id and ri.question_id = v.question_id;
  if v_item_id is null then raise exception 'O item da redação não existe na resposta do aluno.'; end if;

  v_obtido := round(v_total / 1000.0 * coalesce(v_valor, 0), 2);
  select * into v_res from public.rpc_corrigir_item_dissertativo(v_item_id, v_obtido, v_obs);

  update prova_respostas set finalizado_em = coalesce(finalizado_em, now()) where id = v_res.resposta_id;

  update redacao_envios set
    correcao_prof = jsonb_build_object('competencias', p_competencias, 'comentario_geral', p_comentario,
                                       'ia_nota_total', (correcao_ia ->> 'nota_total')::integer),
    nota_total = v_total, status = 'REVISADA', atualizado_em = now()
  where id = p_envio_id;

  return jsonb_build_object('nota_total', v_total, 'valor_obtido', v_obtido, 'nota_resposta', v_res.nota_resposta,
                            'status_correcao', v_res.status_correcao, 'ainda_pendentes', v_res.ainda_pendentes);
end;
$$;

-- ---------------------------------------------------------------- permissões
revoke all on function public.rpc_redacao_listar(uuid), public.rpc_redacao_preparar(text, uuid),
  public.rpc_redacao_obter(uuid), public.rpc_redacao_salvar(uuid, text, jsonb, text, jsonb),
  public.rpc_redacao_confirmar(uuid, jsonb, text) from public, anon;
grant execute on function public.rpc_redacao_listar(uuid), public.rpc_redacao_preparar(text, uuid),
  public.rpc_redacao_obter(uuid), public.rpc_redacao_salvar(uuid, text, jsonb, text, jsonb),
  public.rpc_redacao_confirmar(uuid, jsonb, text) to authenticated;
