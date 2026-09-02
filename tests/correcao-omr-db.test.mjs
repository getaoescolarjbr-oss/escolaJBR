// Teste ponta a ponta da correção óptica CONTRA O BANCO REAL, dentro de uma transação
// que sempre termina em ROLLBACK — nada é gravado.
//
//   node tests/correcao-omr-db.test.mjs
//
// O que ele prova, e que nenhum teste de front-end consegue provar:
// que a permutação gravada em prova_versoes é desfeita corretamente na correção. Esse
// é o ponto onde um erro não aparece como erro: a prova é corrigida, a nota sai, o
// relatório fica bonito — e as respostas foram comparadas com o gabarito da versão
// errada. Por isso o teste marca deliberadamente as bolhas CERTAS de uma versão
// embaralhada e exige 100%.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });

const direta = new URL(process.env.SUPABASE_DB_URL);
const ref = direta.hostname.split('.')[1];
const sql = postgres({
  host: process.env.SUPABASE_POOLER_HOST ?? 'aws-1-us-west-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  username: `postgres.${ref}`,
  password: decodeURIComponent(direta.password),
  ssl: 'require',
  max: 1,
  connect_timeout: 20,
});

let falhas = 0;
const checar = (nome, ok, detalhe = '') => {
  console.log(`${ok ? '  OK  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
};

const ROLLBACK = Symbol('rollback');

try {
  await sql.begin(async (tx) => {
    // O DDL entra na MESMA transação do teste: assim o teste roda contra a versão do
    // arquivo que está em disco agora, e o rollback leva as funções embora junto com os
    // dados de teste. O banco de produção fica exatamente como estava.
    await tx.unsafe(fs.readFileSync(path.join(root, 'create_correcao_omr.sql'), 'utf8'));

    // ---- Dados de apoio, todos vindos do banco real -------------------------------
    const [dono] = await tx`SELECT criado_por FROM provas WHERE criado_por IS NOT NULL LIMIT 1`;
    if (!dono) throw new Error('Não há nenhuma prova no banco para tomar emprestado o dono.');

    // Turma com alunos ativos E pelo menos um transferido/remanejado, para o teste poder
    // provar que quem saiu da escola fica de fora da impressão.
    const [turma] = await tx`
      SELECT t.id, t.nome,
             count(*) FILTER (WHERE lower(coalesce(a.status,'ativo')) NOT IN ('transferido','remanejado')) AS alunos,
             count(*) FILTER (WHERE lower(a.status) IN ('transferido','remanejado')) AS fora
      FROM turmas t JOIN alunos a ON a.turma_id = t.id
      GROUP BY t.id, t.nome
      HAVING count(*) FILTER (WHERE lower(coalesce(a.status,'ativo')) NOT IN ('transferido','remanejado')) >= 4
         AND count(*) FILTER (WHERE lower(a.status) IN ('transferido','remanejado')) >= 1
      ORDER BY count(*) FILTER (WHERE lower(a.status) IN ('transferido','remanejado')) DESC
      LIMIT 1`;
    if (!turma) throw new Error('Nenhuma turma com 4+ ativos e ao menos um transferido.');

    const questoes = await tx`
      SELECT id, correct_letter, jsonb_array_length(alternatives) AS n
      FROM questions
      WHERE tipo = 'OBJETIVA' AND correct_letter IS NOT NULL
        AND jsonb_array_length(alternatives) BETWEEN 4 AND 5
        AND active
      LIMIT 12`;
    if (questoes.length < 12) throw new Error(`Só ${questoes.length} questões objetivas utilizáveis.`);

    console.log(`\nBase: turma "${turma.nome}" — ${turma.alunos} ativos, ${turma.fora} transferidos/remanejados; ${questoes.length} questões\n`);

    // ---- Prova de teste -----------------------------------------------------------
    const [prova] = await tx`
      INSERT INTO provas (titulo, valor_total, modo, tipo, status, criado_por,
                          embaralhar, qtd_versoes, modo_nota, ponderada_escopo, lancar_no_boletim)
      VALUES ('TESTE OMR (rollback)', 10, 'IMPRESSA', 'AVALIACAO', 'PUBLICADA', ${dono.criado_por},
              'QUESTOES_ALTERNATIVAS', 3, 'PONDERADA', 'PROVA', false)
      RETURNING id`;

    for (const [i, q] of questoes.entries()) {
      await tx`INSERT INTO prova_questoes (prova_id, question_id, ordem, valor)
               VALUES (${prova.id}, ${q.id}, ${i}, ${10 / questoes.length})`;
    }
    await tx`INSERT INTO prova_turmas (prova_id, turma_id) VALUES (${prova.id}, ${turma.id})`;

    // Passa a agir como o professor dono: as RPCs conferem auth.uid(), que sai daqui.
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: dono.criado_por, role: 'authenticated' })}, true)`;

    // ---- 1. Sorteio das versões ---------------------------------------------------
    const versoes = await tx`SELECT * FROM rpc_gerar_versoes_prova(${prova.id})`;
    checar(
      'sorteia 3 versões e distribui os alunos',
      versoes.length === 3 && versoes.every((v) => Number(v.alunos) > 0),
      versoes.map((v) => `${v.rotulo}:${v.alunos}`).join(' ')
    );

    const linhasA = await tx`SELECT ordem_questoes, mapa_alternativas FROM prova_versoes WHERE prova_id = ${prova.id} AND rotulo = 'A'`;
    const linhasB = await tx`SELECT ordem_questoes, mapa_alternativas FROM prova_versoes WHERE prova_id = ${prova.id} AND rotulo = 'B'`;

    checar(
      'versão A é a cópia de referência (nada permutado)',
      Object.keys(linhasA[0].mapa_alternativas).length === 0 &&
        linhasA[0].ordem_questoes.join() === questoes.map((q) => q.id).join()
    );
    checar(
      'versão B embaralha questões e alternativas',
      linhasB[0].ordem_questoes.join() !== linhasA[0].ordem_questoes.join() &&
        Object.keys(linhasB[0].mapa_alternativas).length > 0,
      `${Object.keys(linhasB[0].mapa_alternativas).length} questões com alternativas permutadas`
    );

    // ---- 2. Folhas por aluno ------------------------------------------------------
    const alocacoes = await tx`SELECT * FROM rpc_alocacoes_prova(${prova.id})`;
    checar(
      'uma folha por aluno, com código de QR único',
      alocacoes.length === Number(turma.alunos) &&
        new Set(alocacoes.map((a) => a.codigo)).size === alocacoes.length,
      `${alocacoes.length} folhas para ${turma.alunos} ativos`
    );

    const [saiu] = await tx`
      SELECT count(*)::int AS n
      FROM prova_alocacoes pa JOIN alunos al ON al.id = pa.aluno_id
      WHERE pa.prova_id = ${prova.id} AND lower(al.status) IN ('transferido','remanejado')`;
    checar(
      'transferidos e remanejados não recebem folha',
      saiu.n === 0,
      `${turma.fora} fora da lista da turma, ${saiu.n} receberam folha`
    );
    checar(
      'alunos vizinhos na chamada recebem versões diferentes',
      alocacoes[0].rotulo !== alocacoes[1].rotulo,
      `${alocacoes[0].aluno_nome.split(' ')[0]}=${alocacoes[0].rotulo}, ${alocacoes[1].aluno_nome.split(' ')[0]}=${alocacoes[1].rotulo}`
    );

    // ---- 3. Correção: aluno que gabaritou uma versão EMBARALHADA -------------------
    const embaralhado = alocacoes.find((a) => a.rotulo !== 'A') ?? alocacoes[0];
    const gabarito = await tx`SELECT * FROM rpc_gabarito_versao(${prova.id}, ${embaralhado.rotulo})`;

    // Marca exatamente as bolhas corretas DAQUELA versão. Se a tradução bolha ->
    // alternativa estiver errada, isto vira nota baixa em vez de 100%.
    const todasCertas = gabarito.map((g) => g.bolha_correta);
    const r1 = await tx`SELECT rpc_corrigir_omr(${embaralhado.codigo}, ${sql.json(todasCertas)}, 'CAMERA') AS r`;
    const res1 = r1[0].r;

    checar(
      `versão ${embaralhado.rotulo}: marcando as bolhas certas, o aluno gabarita`,
      res1.acertos === gabarito.length && res1.erros === 0,
      `${res1.acertos}/${res1.total_linhas} acertos, nota ${res1.nota}`
    );

    // ---- 4. Um aluno com metade certa, uma em branco e uma anulada -----------------
    const outro = alocacoes.find((a) => a.aluno_id !== embaralhado.aluno_id);
    const gab2 = await tx`SELECT * FROM rpc_gabarito_versao(${prova.id}, ${outro.rotulo})`;
    const metade = gab2.map((g, i) => {
      if (i === 0) return '';                                  // em branco
      if (i === 1) return '*';                                 // marcou duas
      if (i % 2 === 0) return g.bolha_correta;                 // acerto
      return g.bolha_correta === 'A' ? 'B' : 'A';              // erro proposital
    });
    const acertosEsperados = metade.filter((m, i) => i >= 2 && i % 2 === 0).length;

    const r2 = await tx`SELECT rpc_corrigir_omr(${outro.codigo}, ${sql.json(metade)}, 'CAMERA') AS r`;
    const res2 = r2[0].r;

    checar(
      'conta acertos, erros, brancos e anuladas separadamente',
      res2.acertos === acertosEsperados && res2.em_branco === 1 && res2.anuladas === 1,
      `${res2.acertos} acertos (esperado ${acertosEsperados}), ${res2.em_branco} branco, ${res2.anuladas} anulada`
    );

    // ---- 5. Nota ponderada --------------------------------------------------------
    const notas = await tx`
      SELECT al.nome, r.nota, r.nota_ponderada
      FROM prova_respostas r JOIN alunos al ON al.id = r.aluno_id
      WHERE r.prova_id = ${prova.id} AND r.finalizado_em IS NOT NULL
      ORDER BY r.nota DESC`;

    checar(
      'o melhor desempenho recebe o valor total',
      Number(notas[0].nota_ponderada) === 10,
      `${notas[0].nome.split(' ')[0]}: bruta ${notas[0].nota} -> ponderada ${notas[0].nota_ponderada}`
    );

    const esperada = Math.round((10 * Number(notas[1].nota)) / Number(notas[0].nota) * 100) / 100;
    checar(
      'os demais ficam proporcionais ao referencial',
      Math.abs(Number(notas[1].nota_ponderada) - esperada) < 0.02,
      `${notas[1].nome.split(' ')[0]}: bruta ${notas[1].nota} -> ponderada ${notas[1].nota_ponderada} (esperado ${esperada})`
    );

    // ---- 6. Proteções -------------------------------------------------------------
    // Cada verificação que ESPERA um erro vai num savepoint: no Postgres, um comando que
    // falha aborta a transação inteira, e sem o savepoint a primeira checagem derrubaria
    // todas as seguintes.
    const esperaErro = async (padrao) => {
      try {
        await tx.savepoint(async (sp) => { await padrao(sp); });
        return null;
      } catch (e) {
        return e.message;
      }
    };

    const msgLinhas = await esperaErro(
      (sp) => sp`SELECT rpc_corrigir_omr(${embaralhado.codigo}, ${sql.json(todasCertas.slice(0, -1))}, 'CAMERA')`
    );
    checar(
      'recusa leitura com número de linhas diferente do cartão',
      !!msgLinhas && /linhas/.test(msgLinhas),
      msgLinhas ?? 'aceitou, e não deveria'
    );

    const msgResorteio = await esperaErro((sp) => sp`SELECT * FROM rpc_gerar_versoes_prova(${prova.id})`);
    checar(
      'bloqueia resortear depois de haver cartão corrigido',
      !!msgResorteio && /respostas corrigidas/.test(msgResorteio),
      msgResorteio ?? 'resorteou, invalidando as folhas já lidas'
    );

    const msgOutro = await esperaErro(async (sp) => {
      await sp`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: '00000000-0000-0000-0000-000000000000' })}, true)`;
      await sp`SELECT rpc_identificar_folha(${embaralhado.codigo})`;
    });
    checar(
      'outro usuário não consegue nem identificar a folha alheia',
      !!msgOutro && /permissão/.test(msgOutro),
      msgOutro ?? 'identificou, e não deveria'
    );

    // O gabarito não pode vazar por uma função auxiliar: linhas_cartao_versao devolve
    // correct_letter e não checa permissão, então não pode ter EXECUTE para authenticated.
    const [priv] = await tx`
      SELECT has_function_privilege('authenticated', 'public.linhas_cartao_versao(uuid)', 'EXECUTE') AS pode`;
    checar('função interna que expõe o gabarito não é executável por authenticated', priv.pode === false);

    const [priv2] = await tx`
      SELECT has_function_privilege('anon', 'public.linhas_cartao_versao(uuid)', 'EXECUTE') AS pode`;
    checar('nem por anon (o papel do link público de simulado)', priv2.pode === false);

    const [priv3] = await tx`
      SELECT has_function_privilege('authenticated', 'public.gerar_codigo_alocacao()', 'EXECUTE') AS pode`;
    checar('gerador de código de QR não é chamável pelo cliente', priv3.pode === false);

    const err = new Error('rollback proposital');
    err.marcador = ROLLBACK;
    throw err;
  });
} catch (e) {
  if (e.marcador !== ROLLBACK) {
    console.error('\nERRO:', e.message);
    if (e.detail) console.error('  detalhe:', e.detail);
    falhas++;
  }
} finally {
  await sql.end();
}

console.log(falhas === 0 ? '\nTudo passou. Nada foi gravado (rollback).\n' : `\n${falhas} verificação(ões) falharam.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
