-- ====================================================================================
-- REMANEJAMENTO: o aluno novo herda o código SGDE e as folhas (alocações) das avaliações
--
-- O remanejamento (StudentManager) marca o cadastro antigo como 'Remanejado' e cria um cadastro NOVO
-- (id novo) na turma de destino. Avaliações já sorteadas só tinham `prova_alocacoes` para o id antigo,
-- então o aluno não aparecia na turma nova (folhas/QR, correção pela câmera) até alguém clicar em
-- "Adicionar alunos novos", que ainda gerava um QR diferente do da folha já impressa.
--
-- rpc_remanejar_herdar(antigo, novo), chamada pelo StudentManager logo depois de criar o cadastro novo:
--   1. o código SGDE é do aluno e o acompanha: passa do cadastro antigo (que fica desativado na turma de
--      origem) para o novo. O índice alunos_codigo_sgde_idx é único em qualquer situação, então o antigo
--      o libera primeiro. É o que já se fazia à mão nos remanejamentos anteriores.
--   2. nas avaliações em que a TURMA NOVA participa, o antigo tem alocação, não respondeu nada e o novo
--      ainda não tem alocação, passa a alocação (mesmo QR, mesma versão) para o novo.
-- Onde o antigo já respondeu, ou a turma nova não participa, nada muda (a nota segue no cadastro em que foi feita).
--
-- Reversão: voltar o codigo_sgde e prova_alocacoes.aluno_id ao cadastro antigo nas linhas afetadas; drop function
--   public.rpc_remanejar_herdar(uuid, uuid);
-- ====================================================================================
create or replace function public.rpc_remanejar_herdar(p_antigo uuid, p_novo uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_old public.alunos; v_new public.alunos; v_movidas integer := 0; v_sgde boolean := false;
begin
  if not (public.usuario_tem_papel('GESTAO') or public.usuario_tem_papel('COORDENACAO')
          or public.usuario_tem_papel('SECRETARIA') or public.usuario_tem_papel('SECRETARIA_GERAL')) then
    raise exception 'Sem permissão para remanejar alunos.';
  end if;
  select * into v_old from public.alunos where id = p_antigo;
  select * into v_new from public.alunos where id = p_novo;
  if v_old.id is null or v_new.id is null then raise exception 'Aluno não encontrado.'; end if;
  if v_old.status <> 'Remanejado' or v_new.status not in ('Ativo', 'Atestado')
     or v_old.nome <> v_new.nome or v_old.turma_id is not distinct from v_new.turma_id then
    raise exception 'Estes cadastros não são um remanejamento (antigo Remanejado, novo ativo, mesmo nome, turmas diferentes).';
  end if;

  if v_old.codigo_sgde is not null and v_new.codigo_sgde is null then
    update public.alunos set codigo_sgde = null where id = p_antigo;
    update public.alunos set codigo_sgde = v_old.codigo_sgde where id = p_novo;
    v_sgde := true;
  end if;

  with mov as (
    update public.prova_alocacoes pa set aluno_id = p_novo
     where pa.aluno_id = p_antigo
       and exists (select 1 from public.prova_turmas pt where pt.prova_id = pa.prova_id and pt.turma_id = v_new.turma_id)
       and not exists (select 1 from public.prova_alocacoes x where x.prova_id = pa.prova_id and x.aluno_id = p_novo)
       and not exists (select 1 from public.prova_respostas r where r.prova_id = pa.prova_id and r.aluno_id = p_antigo)
    returning 1)
  select count(*) into v_movidas from mov;

  return jsonb_build_object('alocacoes_movidas', v_movidas, 'sgde_passado', v_sgde);
end;
$$;
revoke all on function public.rpc_remanejar_herdar(uuid, uuid) from public, anon;
grant execute on function public.rpc_remanejar_herdar(uuid, uuid) to authenticated;
