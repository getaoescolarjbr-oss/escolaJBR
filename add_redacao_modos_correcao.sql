-- ====================================================================================
-- MODOS DE CORREÇÃO DE REDAÇÃO (critérios e pesos escolhidos pelo professor)
--
-- O modo de correção é escolha do professor, não da banca da proposta: dá para corrigir um tema da
-- UFMS pelos critérios do ENEM e vice-versa. Por isso as rubricas são DADOS (tabela), não código:
-- novas bancas entram sem mexer no sistema, e o professor duplica um modelo e muda os pesos.
--
-- Precedência do modo de uma redação: (1) escolhido nela, na correção; (2) padrão da avaliação
-- (provas.rubrica_redacao_id); (3) o modelo da banca da proposta (UFMS, UFGD; senão ENEM).
-- Depois de CONFIRMADA, a redação guarda uma cópia da rubrica usada: editar a rubrica depois não
-- muda nota já dada.
--
-- Cada critério: { chave: 'c1', rotulo, max (pontos), passo (notas permitidas = múltiplos do passo
-- até o max), descritores (texto que orienta a IA e o professor) }. De 1 a 10 critérios.
-- Nota total = soma; na prova vale proporcional: nota_total / soma_dos_max * valor da questão.
--
-- Reversão: alter table provas drop column rubrica_redacao_id; alter table redacao_envios drop column
-- rubrica_id, drop column nota_maxima; drop table rubricas_redacao; e recriar as RPCs de
-- add_redacao_correcao.sql / add_redacao_digitada.sql / add_redacao_rubricas.sql.
-- ====================================================================================

create or replace function public.rubrica_criterios_validos(c jsonb)
returns boolean language plpgsql immutable as $$
declare e jsonb; chaves text[] := '{}'; mx int; ps int;
begin
  if jsonb_typeof(c) <> 'array' or jsonb_array_length(c) not between 1 and 10 then return false; end if;
  for e in select * from jsonb_array_elements(c) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if coalesce(e ->> 'chave', '') !~ '^c[0-9]{1,2}$' or (e ->> 'chave') = any (chaves) then return false; end if;
    chaves := chaves || (e ->> 'chave');
    if length(trim(coalesce(e ->> 'rotulo', ''))) = 0 then return false; end if;
    mx := (e ->> 'max')::int; ps := (e ->> 'passo')::int;
    if mx is null or ps is null or mx < 1 or mx > 1000 or ps < 1 or ps > mx or mx % ps <> 0 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create table if not exists public.rubricas_redacao (
  id               uuid primary key default gen_random_uuid(),
  chave            text,                         -- só nos modelos do sistema (ENEM, UFMS, UFGD)
  nome             text not null check (length(trim(nome)) > 0),
  descricao        text,
  sistema          boolean not null default false,
  criterios        jsonb not null check (public.rubrica_criterios_validos(criterios)),
  instrucoes       text,                         -- regras gerais: nota zero, eliminação etc.
  linhas_min       integer not null default 8  check (linhas_min between 0 and 100),
  linhas_max       integer not null default 30 check (linhas_max between 1 and 100),
  aviso_linhas_min text,
  ativa            boolean not null default true,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check (linhas_min <= linhas_max)
);
create unique index if not exists rubricas_redacao_chave_uq on public.rubricas_redacao (chave) where chave is not null;
alter table public.rubricas_redacao enable row level security;

drop policy if exists rubricas_redacao_ler on public.rubricas_redacao;
create policy rubricas_redacao_ler on public.rubricas_redacao for select to authenticated
  using (public.usuario_tem_papel('PROFESSOR') or public.usuario_tem_papel('GESTAO')
         or public.usuario_tem_papel('COORDENACAO') or public.usuario_tem_papel('COORDENACAO_AREA'));
drop policy if exists rubricas_redacao_criar on public.rubricas_redacao;
create policy rubricas_redacao_criar on public.rubricas_redacao for insert to authenticated
  with check (sistema = false and chave is null and criado_por = auth.uid()
              and (public.usuario_tem_papel('PROFESSOR') or public.usuario_tem_papel('GESTAO') or public.usuario_tem_papel('COORDENACAO_AREA')));
drop policy if exists rubricas_redacao_editar on public.rubricas_redacao;
create policy rubricas_redacao_editar on public.rubricas_redacao for update to authenticated
  using (sistema = false and (criado_por = auth.uid() or public.usuario_tem_papel('GESTAO')))
  with check (sistema = false and chave is null);
drop policy if exists rubricas_redacao_apagar on public.rubricas_redacao;
create policy rubricas_redacao_apagar on public.rubricas_redacao for delete to authenticated
  using (sistema = false and (criado_por = auth.uid() or public.usuario_tem_papel('GESTAO')));

-- ---------------------------------------------------------------- modelos do sistema
insert into public.rubricas_redacao (chave, nome, descricao, sistema, criterios, instrucoes, linhas_min, linhas_max, aviso_linhas_min)
values
('ENEM', 'ENEM', 'Cinco competências de 0 a 200 (nota de 0 a 1000).', true,
 $j$[
 {"chave":"c1","rotulo":"C1 — Norma padrão da língua","max":200,"passo":40,"descritores":"200 = excelente domínio, no máximo uma falha de escrita/sintaxe; 160 = bom domínio, até 3 desvios; 120 = domínio mediano, até 5; 80 = domínio insuficiente, muitos desvios; 40 = domínio precário; 0 = desconhecimento."},
 {"chave":"c2","rotulo":"C2 — Tema e tipo textual","max":200,"passo":40,"descritores":"200 = argumentação consistente com repertório sociocultural produtivo e tipo dissertativo-argumentativo completo; 160 = repertório legitimado e pertinente; 120 = repertório baseado nos textos motivadores; 80 = cópia dos motivadores ou tipo incompleto; 40 = tangencia o tema; 0 = fuga ao tema."},
 {"chave":"c3","rotulo":"C3 — Argumentos e projeto de texto","max":200,"passo":40,"descritores":"200 = ideias selecionadas, relacionadas e organizadas de forma consistente, com autoria; 160 = projeto claro, com falhas pontuais; 120 = ideias limitadas aos motivadores, pouco organizadas; 80 = desorganizadas ou contraditórias; 40 = pouco relacionadas ao tema; 0 = desconexas."},
 {"chave":"c4","rotulo":"C4 — Coesão","max":200,"passo":40,"descritores":"200 = articula bem as partes, repertório diversificado de conectivos, sem inadequações; 160 = poucas inadequações; 120 = algumas inadequações e repertório pouco diversificado; 80 = muitas inadequações; 40 = precária; 0 = ausente."},
 {"chave":"c5","rotulo":"C5 — Proposta de intervenção","max":200,"passo":40,"descritores":"Agente, ação, meio/modo, finalidade/efeito e detalhamento, respeitando os direitos humanos: 200 = os 5 elementos, bem detalhada; 160 = 4 elementos; 120 = 3; 80 = 2; 40 = 1; 0 = ausente ou desrespeita os direitos humanos."}
 ]$j$::jsonb,
 'Nota zero na redação inteira: até 7 linhas escritas, fuga total ao tema, não ser dissertativo-argumentativo, parte deliberadamente desconectada do tema, identificação do autor no texto.',
 8, 30, 'Até 7 linhas zera a redação.'),
('UFMS', 'UFMS (PASSE e vestibular)', 'Cinco tópicos do edital. Pesos estimados em 200 cada: os oficiais estão no Anexo IV do edital da UFMS; duplique e ajuste.', true,
 $j$[
 {"chave":"c1","rotulo":"Adequação temática","max":200,"passo":40,"descritores":"200 = trata o tema proposto com pertinência e no gênero pedido (dissertativo-argumentativo); 120 = trata o tema de forma parcial ou genérica; 40 = tangencia o tema; 0 = foge do tema."},
 {"chave":"c2","rotulo":"Organização e progressão textual","max":200,"passo":40,"descritores":"200 = ideias organizadas, com progressão clara e sem repetição ou contradição; 120 = organização razoável, com saltos ou repetições; 40 = ideias soltas; 0 = desorganizado."},
 {"chave":"c3","rotulo":"Estrutura do texto dissertativo-argumentativo","max":200,"passo":40,"descritores":"200 = introdução com tese, desenvolvimento argumentado e conclusão (com proposta, se cabível); 120 = estrutura presente mas argumentação superficial; 40 = estrutura incompleta; 0 = não é dissertativo-argumentativo."},
 {"chave":"c4","rotulo":"Coesão e coerência","max":200,"passo":40,"descritores":"200 = articulação adequada entre frases e parágrafos, conectivos variados e sem contradições; 120 = algumas inadequações; 40 = muitas inadequações; 0 = ausente."},
 {"chave":"c5","rotulo":"Norma padrão","max":200,"passo":40,"descritores":"200 = poucos desvios; 160 = alguns desvios; 120 = desvios frequentes que não impedem a leitura; 40 = muitos desvios; 0 = domínio precário."}
 ]$j$::jsonb,
 'Nota ZERO e eliminação: não produzir o gênero pedido; defender conteúdo preconceituoso ou discriminatório; qualquer marca de identificação; menos de 15 ou mais de 30 linhas (prova presencial) ou menos de 150 / mais de 450 palavras (digitada); espaçamento excessivo; texto desarticulado ou com códigos alheios à língua portuguesa; letra ilegível. Nota 100 (cem): fuga à adequação temática e/ou à estrutura dissertativo-argumentativa, ou muitos trechos de cópia dos textos motivadores.',
 15, 30, 'Menos de 15 linhas zera a redação e elimina o candidato (prova presencial).'),
('UFGD', 'UFGD (vestibular)', 'Redação de 0 a 50 pontos. O edital não detalha pesos: cinco critérios estimados em 200 cada; duplique e ajuste.', true,
 $j$[
 {"chave":"c1","rotulo":"Adequação ao tema e ao gênero","max":200,"passo":40,"descritores":"O gênero muda a cada ano (artigo de opinião, carta etc.): 200 = trata o tema e cumpre o gênero com propriedade; 120 = cumpre em parte; 40 = tangencia; 0 = foge do tema ou do gênero."},
 {"chave":"c2","rotulo":"Organização textual","max":200,"passo":40,"descritores":"200 = estrutura clara e progressão de ideias; 120 = organização razoável; 40 = desestruturado; 0 = desestruturação total."},
 {"chave":"c3","rotulo":"Argumentação e uso das informações","max":200,"passo":40,"descritores":"200 = posicionamento defendido com argumentos e uso produtivo dos textos motivadores e do conhecimento prévio; 120 = argumentos genéricos ou muito presos aos motivadores; 40 = sem argumentação; 0 = cópia."},
 {"chave":"c4","rotulo":"Coesão e coerência","max":200,"passo":40,"descritores":"200 = articulação adequada, sem contradições; 120 = algumas inadequações; 40 = muitas; 0 = ausente."},
 {"chave":"c5","rotulo":"Norma padrão","max":200,"passo":40,"descritores":"200 = poucos desvios; 160 = alguns; 120 = frequentes; 40 = muitos; 0 = precário."}
 ]$j$::jsonb,
 'Nota ZERO: fugir da temática e do gênero propostos; desestruturação na organização textual; marca ou sinal de identificação; letra ilegível, espaçamentos excessivos ou apenas números; texto escrito a lápis. O texto deve ter de 15 a 30 linhas.',
 15, 30, 'O edital pede de 15 a 30 linhas.')
on conflict (chave) where chave is not null do nothing;

-- ---------------------------------------------------------------- escolha do modo
alter table public.provas add column if not exists rubrica_redacao_id uuid references public.rubricas_redacao(id) on delete set null;
alter table public.redacao_envios add column if not exists rubrica_id uuid references public.rubricas_redacao(id) on delete set null;
alter table public.redacao_envios add column if not exists nota_maxima integer;
alter table public.redacao_envios drop constraint if exists redacao_envios_nota_total_check;

-- Rubrica efetiva de uma redação (já em jsonb, pronta para a tela e para a IA).
create or replace function public._redacao_rubrica_efetiva(p_envio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  e redacao_envios; p provas; q questions; r rubricas_redacao; v_id uuid; v_origem text;
begin
  select * into e from redacao_envios where id = p_envio_id;
  if not found then return null; end if;
  if e.status = 'REVISADA' and e.correcao_prof ? 'rubrica' then
    return (e.correcao_prof -> 'rubrica') || jsonb_build_object('origem', 'CONFIRMADA');
  end if;
  select * into p from provas where id = e.prova_id;
  select * into q from questions where id = e.question_id;
  v_id := coalesce(e.rubrica_id, p.rubrica_redacao_id);
  v_origem := case when e.rubrica_id is not null then 'REDACAO' when p.rubrica_redacao_id is not null then 'AVALIACAO' else 'BANCA' end;
  if v_id is not null then
    select * into r from rubricas_redacao where id = v_id;
  end if;
  if r.id is null then
    v_origem := 'BANCA';
    select * into r from rubricas_redacao where sistema and chave = case upper(coalesce(q.banca, ''))
      when 'UFMS' then 'UFMS' when 'UFGD' then 'UFGD' else 'ENEM' end;
  end if;
  return jsonb_build_object('id', r.id, 'nome', r.nome, 'criterios', r.criterios, 'instrucoes', r.instrucoes,
    'linhas_min', r.linhas_min, 'linhas_max', r.linhas_max, 'aviso_linhas_min', r.aviso_linhas_min, 'origem', v_origem);
end;
$$;
revoke all on function public._redacao_rubrica_efetiva(uuid) from public, anon, authenticated;

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
    'turma_nome', v_turma, 'question_id', v.question_id, 'tema', v_q.topico, 'banca', v_q.banca,
    'enunciado', v_q.statement, 'criterios', v_q.criterios_correcao, 'valor', v_valor,
    'origem', v.origem, 'imagem_path', v.imagem_path, 'linhas', v.linhas, 'texto_final', v.texto_final,
    'correcao_ia', v.correcao_ia, 'correcao_prof', v.correcao_prof, 'nota_total', v.nota_total,
    'nota_maxima', v.nota_maxima, 'status', v.status,
    'rubrica', public._redacao_rubrica_efetiva(v.id), 'rubrica_escolhida_id', v.rubrica_id);
end;
$$;

-- ---------------------------------------------------------------- escolher o modo numa redação
-- p_rubrica_id nulo = volta ao padrão (da avaliação / da banca). Em redação já confirmada, reabre a
-- revisão (a nota da prova só muda quando o professor confirmar de novo).
create or replace function public.rpc_redacao_definir_rubrica(p_envio_id uuid, p_rubrica_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v redacao_envios;
begin
  select * into v from redacao_envios where id = p_envio_id for update;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;
  if p_rubrica_id is not null and not exists (select 1 from rubricas_redacao where id = p_rubrica_id and ativa) then
    raise exception 'Modo de correção não encontrado ou desativado.';
  end if;
  update redacao_envios set rubrica_id = p_rubrica_id,
         status = case when status = 'REVISADA' then (case when correcao_ia is not null then 'COM_PREVIA' else 'TRANSCRITA' end) else status end,
         atualizado_em = now()
   where id = p_envio_id;
  return public._redacao_rubrica_efetiva(p_envio_id);
end;
$$;

-- ---------------------------------------------------------------- confirmar
-- p_competencias: { "c1": { "nota": 120, "concorda": true, "comentario": "" }, ... } — as chaves são as
-- da rubrica efetiva (de 1 a 10). Cada nota: múltiplo do passo, de 0 até o max do critério.
create or replace function public.rpc_redacao_confirmar(
  p_envio_id uuid, p_competencias jsonb, p_comentario text default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v redacao_envios; v_rub jsonb; c jsonb; v_item_id uuid; v_valor numeric; v_total integer := 0; v_max integer := 0;
  v_n integer; v_obtido numeric; v_obs text := 'Redação:'; v_res record; v_chave text; v_mx integer; v_ps integer;
begin
  select * into v from redacao_envios where id = p_envio_id for update;
  if not found then raise exception 'Redação não encontrada.'; end if;
  if not public.pode_corrigir_prova(v.prova_id) then raise exception 'Sem permissão para corrigir esta prova.'; end if;

  v_rub := public._redacao_rubrica_efetiva(p_envio_id);
  if v_rub is null then raise exception 'Modo de correção indisponível.'; end if;

  for c in select * from jsonb_array_elements(v_rub -> 'criterios') loop
    v_chave := c ->> 'chave'; v_mx := (c ->> 'max')::int; v_ps := (c ->> 'passo')::int;
    if p_competencias -> v_chave is null then raise exception 'Falta a nota de "%".', c ->> 'rotulo'; end if;
    v_n := (p_competencias -> v_chave ->> 'nota')::integer;
    if v_n is null or v_n < 0 or v_n > v_mx or v_n % v_ps <> 0 then
      raise exception 'Nota inválida em "%": use múltiplos de % até %.', c ->> 'rotulo', v_ps, v_mx;
    end if;
    v_total := v_total + v_n; v_max := v_max + v_mx;
    v_obs := v_obs || ' ' || (c ->> 'rotulo') || '=' || v_n;
  end loop;
  v_obs := v_obs || ' (total ' || v_total || '/' || v_max || ', ' || (v_rub ->> 'nome') || ')';
  if nullif(trim(coalesce(p_comentario, '')), '') is not null then v_obs := v_obs || '. ' || trim(p_comentario); end if;

  select pq.valor into v_valor from prova_questoes pq where pq.prova_id = v.prova_id and pq.question_id = v.question_id;
  select ri.id into v_item_id
    from prova_respostas_itens ri join prova_respostas r on r.id = ri.resposta_id
   where r.prova_id = v.prova_id and r.aluno_id = v.aluno_id and ri.question_id = v.question_id;
  if v_item_id is null then raise exception 'O item da redação não existe na resposta do aluno.'; end if;

  v_obtido := round(v_total::numeric / v_max * coalesce(v_valor, 0), 2);
  select * into v_res from public.rpc_corrigir_item_dissertativo(v_item_id, v_obtido, v_obs);
  update prova_respostas set finalizado_em = coalesce(finalizado_em, now()) where id = v_res.resposta_id;

  update redacao_envios set
    correcao_prof = jsonb_build_object('rubrica', v_rub - 'origem', 'competencias', p_competencias, 'comentario_geral', p_comentario,
                                       'ia_nota_total', (correcao_ia ->> 'nota_total')::integer),
    nota_total = v_total, nota_maxima = v_max, status = 'REVISADA', atualizado_em = now()
  where id = p_envio_id;

  return jsonb_build_object('nota_total', v_total, 'nota_maxima', v_max, 'valor_obtido', v_obtido,
                            'nota_resposta', v_res.nota_resposta, 'status_correcao', v_res.status_correcao,
                            'ainda_pendentes', v_res.ainda_pendentes);
end;
$$;

-- ---------------------------------------------------------------- listar (agora com nota_maxima)
drop function if exists public.rpc_redacao_listar(uuid);
create function public.rpc_redacao_listar(p_prova_id uuid)
returns table (
  aluno_id uuid, aluno_nome text, turma_nome text, numero_chamada integer,
  question_id uuid, tema text, valor numeric,
  envio_id uuid, status text, nota_total integer, nota_maxima integer, tem_imagem boolean, origem text, tem_texto_digitado boolean
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.pode_corrigir_prova(p_prova_id) then
    raise exception 'Sem permissão para corrigir esta prova.';
  end if;
  return query
  select al.id, al.nome, t.nome, al.aluno_numero,
         q.id, q.topico, pq.valor,
         e.id, e.status, e.nota_total, e.nota_maxima, (e.imagem_path is not null), e.origem,
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

revoke all on function public.rpc_redacao_listar(uuid), public.rpc_redacao_definir_rubrica(uuid, uuid) from public, anon;
grant execute on function public.rpc_redacao_listar(uuid), public.rpc_redacao_definir_rubrica(uuid, uuid) to authenticated;
