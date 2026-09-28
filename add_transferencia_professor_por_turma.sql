-- Transferência definitiva ESCOLHENDO A TURMA: quando as aulas de quem saiu são divididas
-- entre dois (ou mais) professores, cada chamada de rpc_transferir_professor agora pode ficar
-- restrita a um subconjunto de turmas (p_turma_ids), em vez de mover tudo de uma vez. Sem esse
-- parâmetro (null), o comportamento é o mesmo de antes — transfere tudo.
--
-- Com p_turma_ids preenchido, ficam de fora (avisado na simulação, nada é movido nem apagado):
-- cotas de questões em avaliações da área, "recebe a nota" em avaliações da área e corretoria de
-- turma — nenhuma dessas é específica de uma turma só dentro da avaliação, então uma transferência
-- parcial não sabe dividir isso; ajuste manualmente em Coordenação de Área se precisar.
--
-- Reverter: recriar a função com o texto anterior (add_transferencia_professor.sql) e rodar
--   drop function public.rpc_transferir_professor(uuid, uuid, boolean, boolean, text, uuid[]);
--   (fica só a versão de 5 parâmetros de antes).

drop function if exists public.rpc_transferir_professor(uuid, uuid, boolean, boolean, text);

create or replace function public.rpc_transferir_professor(
  p_origem uuid,
  p_destino uuid,
  p_simular boolean default true,
  p_incluir_ocorrencias boolean default false,
  p_observacao text default null,
  p_turma_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.professores;
  v_d public.professores;
  v_parcial boolean := p_turma_ids is not null;
  v_aloc uuid[]; v_aloc_dup uuid[]; v_aloc_mov uuid[];
  v_ativ uuid[]; v_aval uuid[]; v_cham uuid[]; v_hor uuid[];
  v_cota uuid[]; v_nprof uuid[]; v_corr uuid[]; v_ocor uuid[];
  v_cota_total int; v_nprof_total int; v_corr_total int;
  v_turmas text[]; v_cfg jsonb; v_cfg_chaves text[] := '{}'; v_t text; v_efetiva jsonb;
  v_conf_cota int; v_conf_nprof int; v_conf_hor int; v_conf_cfg int := 0;
  v_avisos text[] := '{}';
  v_removidas jsonb := '[]'::jsonb;
  v_id uuid;
  v_contagens jsonb; v_conflitos jsonb;
begin
  if not public.usuario_tem_papel('GESTAO') then
    raise exception 'Só a Gestão pode transferir professores.' using errcode = '42501';
  end if;
  if p_origem is null or p_destino is null or p_origem = p_destino then
    raise exception 'Escolha dois professores diferentes.';
  end if;

  select * into v_o from public.professores where id = p_origem;
  if not found then raise exception 'Professor de origem não encontrado.'; end if;
  select * into v_d from public.professores where id = p_destino;
  if not found then raise exception 'Professor de destino não encontrado.'; end if;

  if v_parcial and exists (
    select 1 from unnest(p_turma_ids) t(turma_id)
    where not exists (
      select 1 from public.alocacoes_v2 a
      where a.professor_id = p_origem and not coalesce(a.is_espelho, false) and a.turma_id = t.turma_id
    )
  ) then
    raise exception 'Alguma turma escolhida não é (ou não é mais) uma turma do professor de origem.';
  end if;

  -- Afastamento/substituição em andamento mistura "temporário" com "definitivo": encerrar antes.
  if exists (select 1 from public.atestados_servidores s where s.ativo and (s.professor_id = p_origem or s.substituto_id = p_origem))
     or exists (select 1 from public.alocacoes_v2 a where a.is_espelho and (a.professor_id = p_origem or a.professor_original_id = p_origem)) then
    if p_simular then
      v_avisos := v_avisos || 'O professor de origem tem afastamento/substituição em andamento: encerre antes de transferir.';
    else
      raise exception 'O professor de origem tem afastamento/substituição em andamento. Encerre o atestado (ou a substituição) antes de transferir.';
    end if;
  end if;

  -- O que vai mudar de dono (turma_id: alocacoes_v2/atividades/chamadas/horarios/ocorrências são
  -- uuid; avaliacoes.turma_id é text — por isso o cast p_turma_ids::text[] nessa consulta).
  v_aloc := array(select a.id from public.alocacoes_v2 a where a.professor_id = p_origem and not coalesce(a.is_espelho, false)
                   and (not v_parcial or a.turma_id = any(p_turma_ids)));
  v_aloc_dup := array(
    select a.id from public.alocacoes_v2 a
    where a.id = any(v_aloc)
      and exists (select 1 from public.alocacoes_v2 b
                  where b.professor_id = p_destino and not coalesce(b.is_espelho, false)
                    and b.turma_id = a.turma_id and b.disciplina_id is not distinct from a.disciplina_id));
  v_aloc_mov := array(select x from unnest(v_aloc) x where not (x = any(v_aloc_dup)));
  v_ativ  := array(select id from public."atividades_diárias" where (id_do_professor = p_origem or professor_id = p_origem)
                    and (not v_parcial or turma_id = any(p_turma_ids)));
  v_aval  := array(select id from public.avaliacoes where professor_id = p_origem
                    and (not v_parcial or turma_id = any(p_turma_ids::text[])));
  v_cham  := array(select id from public.chamadas where professor_id = p_origem
                    and (not v_parcial or turma_id = any(p_turma_ids)));
  v_hor   := array(select id from public.horarios where professor_id = p_origem
                    and (not v_parcial or turma_id = any(p_turma_ids)));
  v_ocor  := case when p_incluir_ocorrencias
                  then array(select id from public."ocorrências" where id_do_professor = p_origem
                              and (not v_parcial or turma_id = any(p_turma_ids)))
                  else '{}'::uuid[] end;

  -- Cotas de questões / "recebe a nota" da área / corretoria de turma: nenhuma delas é de uma
  -- turma só dentro da avaliação (cota e "recebe nota" são por disciplina, valem pra todas as
  -- turmas da avaliação). Numa transferência por turma, ficam de fora — avisa se existirem.
  v_cota_total  := (select count(*) from public.prova_area_cotas where professor_id = p_origem);
  v_nprof_total := (select count(*) from public.prova_notas_professores where professor_id = p_origem);
  v_corr_total  := (select count(*) from public.prova_corretores where professor_id = p_origem);
  if v_parcial then
    v_cota := '{}'::uuid[]; v_nprof := '{}'::uuid[]; v_corr := '{}'::uuid[];
    if v_cota_total > 0 or v_nprof_total > 0 or v_corr_total > 0 then
      v_avisos := v_avisos || format(
        'Transferência por turma: %s cota(s) de questões, %s registro(s) de nota de avaliação da área e %s corretoria(s) de turma NÃO foram movidos (não são específicos de uma turma só) — ajuste manualmente em Coordenação de Área, se precisar.',
        v_cota_total, v_nprof_total, v_corr_total);
    end if;
  else
    v_cota  := array(select id from public.prova_area_cotas where professor_id = p_origem);
    v_nprof := array(select id from public.prova_notas_professores where professor_id = p_origem);
    v_corr  := array(select id from public.prova_corretores where professor_id = p_origem);
  end if;

  -- Conflitos com o que o destino já tem.
  select count(*) into v_conf_cota from public.prova_area_cotas c
   where c.id = any(v_cota) and exists (select 1 from public.prova_area_cotas d
         where d.professor_id = p_destino and d.prova_id = c.prova_id and d.disciplina_id is not distinct from c.disciplina_id);
  select count(*) into v_conf_nprof from public.prova_notas_professores c
   where c.id = any(v_nprof) and exists (select 1 from public.prova_notas_professores d
         where d.professor_id = p_destino and d.prova_id = c.prova_id
           and d.disciplina_id is not distinct from c.disciplina_id and d.area_conhecimento is not distinct from c.area_conhecimento);
  select count(*) into v_conf_hor from public.horarios h
   where h.id = any(v_hor) and exists (select 1 from public.horarios g
         where g.professor_id = p_destino and g.dia_semana = h.dia_semana and g.tempo = h.tempo);

  -- Configuração de vistos: preserva o valor com que as notas foram calculadas. v_turmas já sai
  -- restrito às turmas movidas (v_aloc/v_ativ/v_aval já filtrados acima).
  v_turmas := array(
    select t from (
      select a.turma_id::text as t from public.alocacoes_v2 a where a.id = any(v_aloc)
      union select d.turma_id::text from public."atividades_diárias" d where d.id = any(v_ativ)
      union select v.turma_id from public.avaliacoes v where v.id = any(v_aval)
    ) x where t is not null);
  v_cfg := coalesce(v_d.config_turmas, '{}'::jsonb);
  foreach v_t in array v_turmas loop
    v_efetiva := coalesce(v_o.config_turmas -> v_t,
                          jsonb_build_object('config_visto_metodo', v_o.config_visto_metodo,
                                             'config_visto_valor_total', v_o.config_visto_valor_total));
    if jsonb_exists(v_cfg, v_t) then
      if (v_cfg -> v_t) is distinct from v_efetiva then v_conf_cfg := v_conf_cfg + 1; end if;
    else
      v_cfg := v_cfg || jsonb_build_object(v_t, v_efetiva);
      v_cfg_chaves := v_cfg_chaves || v_t;
    end if;
  end loop;
  if v_conf_cfg > 0 then
    v_avisos := v_avisos || format('%s turma(s) em que o destino já tem configuração de vistos própria e diferente: a dele foi mantida (a nota de vistos migrada pode mudar).', v_conf_cfg);
  end if;

  v_contagens := jsonb_build_object(
    'alocacoes', cardinality(v_aloc_mov),
    'alocacoes_que_o_destino_ja_tinha', cardinality(v_aloc_dup),
    'atividades', cardinality(v_ativ),
    'vistos_dos_alunos_nas_atividades', (select count(*) from public.vistos_v2 where atividade_id = any(v_ativ)),
    'avaliacoes', cardinality(v_aval),
    'notas_dos_alunos_nas_avaliacoes', (select count(*) from public.notas_avaliacoes where avaliacao_id = any(v_aval)),
    'chamadas', cardinality(v_cham),
    'horarios', cardinality(v_hor),
    'cotas_de_avaliacao_da_area', cardinality(v_cota),
    'recebe_nota_em_avaliacoes', cardinality(v_nprof),
    'corretor_de_turma', cardinality(v_corr),
    'ocorrencias', cardinality(v_ocor),
    'turmas_com_configuracao_de_vistos_copiada', cardinality(v_cfg_chaves));
  v_conflitos := jsonb_build_object(
    'cotas_de_avaliacao', v_conf_cota,
    'recebe_nota_em_avaliacoes', v_conf_nprof,
    'horarios_no_mesmo_dia_e_tempo', v_conf_hor,
    'configuracao_de_vistos_diferente', v_conf_cfg);

  if p_simular then
    return jsonb_build_object('simulado', true, 'turma_scoped', v_parcial,
      'origem', jsonb_build_object('id', v_o.id, 'nome', v_o.nome),
      'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome),
      'contagens', v_contagens, 'conflitos', v_conflitos, 'avisos', to_jsonb(v_avisos));
  end if;

  -- Conflitos que o banco não aceita (unicidade) impedem a execução; o resto vira aviso.
  if v_conf_cota > 0 or v_conf_nprof > 0 then
    raise exception 'O destino já participa das mesmas avaliações da área que a origem (cotas: %, recebe nota: %). Resolva isso antes de transferir.', v_conf_cota, v_conf_nprof;
  end if;

  insert into public.professor_transferencias (origem_id, destino_id, origem_nome, destino_nome, feito_por, observacao, incluiu_ocorrencias)
  values (p_origem, p_destino, v_o.nome, v_d.nome, auth.uid(), p_observacao, p_incluir_ocorrencias)
  returning id into v_id;

  -- A linha de alocação que o destino já tinha: a da origem sai (guardada para desfazer).
  v_removidas := coalesce((select jsonb_agg(to_jsonb(a)) from public.alocacoes_v2 a where a.id = any(v_aloc_dup)), '[]'::jsonb);
  delete from public.alocacoes_v2 where id = any(v_aloc_dup);

  update public.alocacoes_v2 set professor_id = p_destino where id = any(v_aloc_mov);
  update public."atividades_diárias" set id_do_professor = p_destino, professor_id = p_destino where id = any(v_ativ);
  update public.avaliacoes set professor_id = p_destino where id = any(v_aval);
  update public.chamadas set professor_id = p_destino where id = any(v_cham);
  update public.horarios set professor_id = p_destino where id = any(v_hor);
  update public.prova_area_cotas set professor_id = p_destino where id = any(v_cota);
  update public.prova_notas_professores set professor_id = p_destino where id = any(v_nprof);
  update public.prova_corretores set professor_id = p_destino where id = any(v_corr);
  if cardinality(v_ocor) > 0 then
    update public."ocorrências" set id_do_professor = p_destino where id = any(v_ocor);
  end if;
  if cardinality(v_cfg_chaves) > 0 then
    update public.professores set config_turmas = v_cfg where id = p_destino;
  end if;

  update public.professor_transferencias set detalhes = jsonb_build_object(
    'alocacoes', to_jsonb(v_aloc_mov), 'alocacoes_removidas', v_removidas,
    'atividades', to_jsonb(v_ativ), 'avaliacoes', to_jsonb(v_aval), 'chamadas', to_jsonb(v_cham),
    'horarios', to_jsonb(v_hor), 'cotas', to_jsonb(v_cota), 'notas_professores', to_jsonb(v_nprof),
    'corretores', to_jsonb(v_corr), 'ocorrencias', to_jsonb(v_ocor), 'config_chaves', to_jsonb(v_cfg_chaves))
  where id = v_id;

  return jsonb_build_object('simulado', false, 'transferencia_id', v_id, 'turma_scoped', v_parcial,
    'origem', jsonb_build_object('id', v_o.id, 'nome', v_o.nome),
    'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome),
    'contagens', v_contagens, 'conflitos', v_conflitos, 'avisos', to_jsonb(v_avisos));
end;
$$;

revoke all on function public.rpc_transferir_professor(uuid, uuid, boolean, boolean, text, uuid[]) from public, anon;
grant execute on function public.rpc_transferir_professor(uuid, uuid, boolean, boolean, text, uuid[]) to authenticated;
