# Plano: banco de questões em um 2º projeto Supabase

Preparado em 2026-09-24 a partir de consultas somente-leitura ao banco. **Nada disto foi executado.**

## O que a análise mostrou

| Item | Valor |
|---|---|
| Questões (`questions`) | 21.091 linhas, ~44 MB |
| Textos de apoio (`support_texts`) + taxonomia | 1.632 + 6.581 linhas, ~3,8 MB |
| Imagens (bucket `imagens-questoes`, Storage) | **481 MB** em 3.767 arquivos (458 MB em uso, 24 MB órfãos) |
| Questões usadas por provas | **55 de 21.091** (80 kB); 2 de 1.632 textos de apoio |
| Uso atual | banco 112 MB de 500 MB (22%); **Storage 481 MB de 1 GB (47%)** |

Duas conclusões que mudam o desenho:

1. **O maior consumo é o Storage, não o banco.** Mover o acervo alivia os dois medidores.
2. **`questions` não é isolada.** Duas tabelas têm chave estrangeira para ela (`prova_questoes`,
   `prova_respostas_itens`) e **19 funções** a leem: `rpc_corrigir_omr`, `rpc_gerar_versoes_prova`,
   `rpc_questoes_avaliacao_aluno`, `rpc_submeter_resposta_avaliacao`, `rpc_simulado_publico_*`,
   `rpc_sortear_questoes`, `rpc_inserir_questoes_cota_area`, `linhas_cartao_versao`,
   `recalcular_nota_prova_resposta` etc. Mover a tabela inteira para outro projeto quebraria correção
   de provas, simulado público e entrega de avaliações (não existe JOIN entre projetos).
3. **O login de um projeto não vale no outro** (JWTs diferentes).

## Desenho recomendado: acervo "frio" no projeto B, "quente" no A

- **Projeto A (atual)** mantém `questions` e `support_texts`, mas só com o que provas e avaliações
  usam (hoje 55 + 2). As 19 funções e as chaves estrangeiras continuam **sem nenhuma alteração**.
- **Projeto B (novo)** guarda o catálogo completo (questões, textos de apoio, taxonomia e o bucket
  de imagens). O portal só lê dele; não há JOIN com provas.
- **Ponte segura:** uma Edge Function `acervo-proxy` no projeto A valida o login do usuário (A),
  confere o papel (PROFESSOR / COORDENACAO / GESTAO) e consulta o B com a chave de serviço do B,
  guardada como *secret* no A. O navegador nunca fala com o B direto, então não há usuários para
  sincronizar nem chave exposta.
- **Usar uma questão:** ao adicionar/sortear para uma prova, uma segunda função (`importar-questao`)
  copia aquela questão (e seu texto de apoio) do B para o A, **com o mesmo `id`**. A prova passa a
  depender só de dados do A.
- **Filtros e sorteio** (`question_bank_*`, `rpc_sortear_questoes`) passam a rodar no B, via proxy.

Ganho esperado: banco A 112 → ~65 MB; Storage A 481 MB → poucos MB. O B fica com ~46 MB de banco e
~458 MB de imagens, dentro dos limites gratuitos.

## Riscos e como tratar

- **Projeto gratuito pausa após 7 dias sem uso.** Como o acervo é pouco usado, é o risco mais
  provável: o professor abriria o banco e ele estaria pausado (restauração manual, alguns minutos).
  Mitigação: job semanal no `pg_cron` do A chamando o B via `pg_net` (uma requisição conta como
  atividade).
- **Se o B cair:** provas já montadas seguem funcionando (dados no A); só a busca de questões novas
  fica indisponível.
- **URLs de imagem:** as questões guardam `[[IMG:https://hqonnxnwozfwkpqgabpf.supabase.co/storage/...]]`
  no texto (2.524 questões, 144 textos de apoio, mais 22 com `image_url`). Ao mover o bucket é preciso
  reescrever essas URLs (regex nos textos) e manter no A as imagens das 55 questões em uso.
- **Backup:** o backup diário do Drive só cobre o A. O B precisa do seu: o script
  `scratch/backup-completo-local.mjs` serve, bastando apontar `SUPABASE_DB_URL` para o banco do B.
- **Latência:** um salto extra (~100–300 ms) por consulta ao acervo. Aceitável para busca.

## Passos, em ordem (cada um reversível até o passo 7)

1. Criar o projeto B (plano gratuito, mesma região `us-west-2`).
2. Recriar no B as tabelas `questions`, `support_texts`, `question_taxonomy_terms` (mesmo esquema) e o
   bucket público `imagens-questoes`.
3. Copiar os dados A → B por script direto entre bancos (não passa por chat) e as 3.767 imagens
   (download + upload por script). Conferir contagens e checksums, como no backup local.
4. Reescrever as URLs `[[IMG:...]]` no B para o host do B.
5. Criar `acervo-proxy` e `importar-questao` no A; trocar `bancoQuestoesService.ts` e os painéis que
   consultam `questions` (sorteio, gerar prova, editor) para usar o proxy, atrás de uma chave
   (`VITE_ACERVO_EXTERNO`) — desligada, o portal continua lendo do A como hoje.
6. Testar com a chave ligada em homologação: buscar, sortear, montar prova, imprimir, corrigir OMR.
7. **Só depois de alguns dias estável:** apagar do A as questões que não estão em uso e o bucket
   antigo. Antes disso o A mantém a cópia completa, então voltar atrás é só desligar a chave.

## O que preciso de você para executar

- Aprovar este desenho (ou preferir outro, ex.: deixar o B com leitura pública por anon, que é mais
  simples mas expõe o acervo).
- Criar o projeto B, ou me autorizar a criá-lo pelo conector (o custo é zero no plano gratuito, mas
  o conector pede confirmação).
- A URL de conexão do banco do B, para os scripts de cópia.
- Escolher onde rodar o job semanal anti-pausa (recomendo o `pg_cron` do A).

Estimativa: uma sessão supervisionada, com o passo 7 separado, dias depois.
