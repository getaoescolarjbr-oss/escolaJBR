-- PASSO 7 da migração do banco de questões — PROPOSTA, NÃO EXECUTADA.
-- Ver docs/plano-migracao-banco-questoes.md.
--
-- Libera espaço no projeto PRINCIPAL removendo do banco as questões que nenhuma prova usa
-- (o acervo completo mora no projeto jbr-acervo-questoes).
--
-- SÓ RODAR DEPOIS DE:
--   1. o portal ter ficado dias com VITE_ACERVO_EXTERNO=true, sem problemas;
--   2. um NOVO backup completo verificado (scratch/backup-completo-local.mjs) do principal;
--   3. conferir que o acervo tem TODAS as questões (contagem e checksum iguais aos do backup).
--
-- Mantém: questões referenciadas por prova_questoes ou prova_respostas_itens (as funções de
-- prova, correção OMR e simulado dependem delas por chave estrangeira) e os textos de apoio
-- que essas questões usam. As chaves estrangeiras impedem apagar uma questão em uso; se algo
-- estiver em uso, o DELETE falha e a transação inteira é desfeita.
--
-- ATENÇÃO — Storage: apagar linhas de storage.objects por SQL NÃO remove os arquivos do
-- armazenamento (a cota continua ocupada). As imagens do bucket `imagens-questoes` que não são
-- de questões mantidas têm de ser removidas pela API de Storage (script à parte).
--
-- Reverter: restaurar as linhas a partir do backup (public__questions.ndjson.gz etc.).

begin;

create temp table _questoes_em_uso on commit drop as
  select question_id as id from public.prova_questoes
  union
  select question_id from public.prova_respostas_itens;

select count(*) as questoes_em_uso from _questoes_em_uso;

delete from public.questions q
 where not exists (select 1 from _questoes_em_uso u where u.id = q.id);

delete from public.support_texts s
 where not exists (select 1 from public.questions q where q.support_text_id = s.id);

-- Conferir antes de confirmar: deve sobrar só o que provas usam.
select (select count(*) from public.questions) as questoes_restantes,
       (select count(*) from public.support_texts) as textos_restantes;

-- Se o resultado estiver certo:  commit;   Se não:  rollback;
rollback;
