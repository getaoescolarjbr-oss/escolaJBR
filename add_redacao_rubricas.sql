-- Rubricas por banca na correção de redação.
-- 1. rpc_redacao_obter devolve a banca da questão (a tela escolhe a rubrica ENEM / UFMS / UFGD por ela).
-- 2. As propostas importadas de UFMS e UFGD tinham só "Critérios próprios da banca: ver as instruções...".
--    Troca esse texto-padrão por um resumo do que os editais dizem (as instruções originais seguem abaixo).
--    Só mexe nas linhas importadas (assunto 'Proposta de redação') e só na frase-padrão.
-- Reversão: recriar rpc_redacao_obter de add_redacao_correcao.sql; o resumo é só texto de apoio.

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
    'correcao_ia', v.correcao_ia, 'correcao_prof', v.correcao_prof, 'nota_total', v.nota_total, 'status', v.status);
end;
$$;

update public.questions set criterios_correcao = replace(criterios_correcao,
  'Critérios próprios da banca: ver as instruções originais abaixo e a rubrica configurada para a banca.',
  'Critérios UFMS (PASSE/vestibular): redação de 0 a 1000 pontos em 5 tópicos — adequação temática; organização e progressão textual; estrutura e desenvolvimento do texto dissertativo-argumentativo; coesão e coerência; norma padrão. Os pesos oficiais estão no Anexo IV do edital. Nota zero (e eliminação): gênero não produzido, preconceito/discriminação, marca de identificação, menos de 15 ou mais de 30 linhas, espaçamento excessivo. Nota 100: fuga à adequação temática/estrutura ou muitos trechos copiados.')
where banca = 'UFMS' and assunto = 'Proposta de redação' and criterios_correcao like 'Critérios próprios da banca%';

update public.questions set criterios_correcao = replace(criterios_correcao,
  'Critérios próprios da banca: ver as instruções originais abaixo e a rubrica configurada para a banca.',
  'Critérios UFGD (vestibular): redação de 0 a 50 pontos, de 15 a 30 linhas. O gênero textual muda a cada ano. Nota zero: fuga à temática e ao gênero, desestruturação textual, marca de identificação, letra ilegível ou espaçamento excessivo, texto a lápis. O edital não detalha pesos por critério.')
where banca = 'UFGD' and assunto = 'Proposta de redação' and criterios_correcao like 'Critérios próprios da banca%';
