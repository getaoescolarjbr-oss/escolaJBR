-- rpc_redacao_obter passa a devolver as "Observações para o professor" da questão (questions.explanation):
-- o que se espera que o aluno aborde no tema. A tela mostra ao professor e a IA usa como referência.
-- (Mesma função de add_redacao_modos_correcao.sql, com a chave 'observacoes' a mais.) Aplicada em 2026-10-03.
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
    'nota_maxima', v.nota_maxima, 'status', v.status,
    'rubrica', public._redacao_rubrica_efetiva(v.id), 'rubrica_escolhida_id', v.rubrica_id);
end;
$$;
