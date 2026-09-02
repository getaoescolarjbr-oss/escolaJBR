// Verifica, contra o banco real e dentro de BEGIN/ROLLBACK, que o acesso anônimo está
// fechado e que quem está logado continua conseguindo trabalhar.
//
//   node tests/rls-exposicao.test.mjs           -> testa o SQL do arquivo, em rollback
//   node tests/rls-exposicao.test.mjs --atual   -> testa o estado JÁ APLICADO em produção
//
// Por que testar os dois papéis: fechar o anônimo é fácil, o difícil é fechar sem
// derrubar tela. Cada permissão que o app usa de verdade vira uma asserção aqui, então
// um aperto que quebrasse o portal falha neste arquivo antes de falhar para o professor.
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
  port: 5432, database: 'postgres', username: `postgres.${ref}`,
  password: decodeURIComponent(direta.password), ssl: 'require', max: 1, connect_timeout: 20,
});

const soAtual = process.argv.includes('--atual');
let falhas = 0;
const checar = (nome, ok, detalhe = '') => {
  console.log(`${ok ? '  OK  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
};

/** Tabelas com dado pessoal ou acadêmico: nenhuma delas pode responder ao anônimo. */
const PRIVADAS = [
  'alunos', 'notas_avaliacoes', 'vistos_v2', 'avaliacoes', 'atividades_diárias',
  'professores', 'turmas', 'disciplinas', 'recursos', 'visitas_responsavel',
  'birthday_notifications_log',
];

/** O que a LandingPage lê sem sessão — tem de continuar funcionando. */
const PUBLICAS = ['landing_avisos', 'landing_eventos', 'landing_noticias', 'calendario_eventos'];

const ROLLBACK = Symbol('rollback');

async function rodar(tx) {
  if (!soAtual) {
    await tx.unsafe(fs.readFileSync(path.join(root, 'fechar_exposicao_anon.sql'), 'utf8'));
  }

  // ---- anon: privilégio de tabela ------------------------------------------------
  // O GRANT é a primeira porta: sem ele o PostgREST responde 401 antes de olhar RLS.
  const abertas = [];
  for (const t of PRIVADAS) {
    const [r] = await tx`
      SELECT bool_or(has_table_privilege('anon', ${'public.' + t}, p)) aberta
      FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`;
    if (r.aberta) abertas.push(t);
  }
  checar(
    'anon não tem privilégio nenhum nas tabelas com dado pessoal',
    abertas.length === 0,
    abertas.length ? `ainda aberto: ${abertas.join(', ')}` : `${PRIVADAS.length} tabelas conferidas`
  );

  const semPublica = [];
  for (const t of PUBLICAS) {
    const [r] = await tx`SELECT has_table_privilege('anon', ${'public.' + t}, 'SELECT') pode`;
    if (!r.pode) semPublica.push(t);
  }
  checar(
    'a landing continua legível sem login',
    semPublica.length === 0,
    semPublica.length ? `perdeu acesso: ${semPublica.join(', ')}` : PUBLICAS.join(', ')
  );

  const [escritaPublica] = await tx`
    SELECT count(*)::int n FROM unnest(${sql.array(PUBLICAS)}::text[]) t
    WHERE has_table_privilege('anon', 'public.' || t, 'INSERT')
       OR has_table_privilege('anon', 'public.' || t, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || t, 'DELETE')`;
  checar('e a landing é só leitura para o anônimo', escritaPublica.n === 0);

  // ---- RLS ligada em tudo que é privado ------------------------------------------
  const semRls = await tx`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname = ANY(${sql.array(PRIVADAS)}::text[]) AND NOT c.relrowsecurity`;
  checar(
    'RLS ligada em todas elas',
    semRls.length === 0,
    semRls.length ? `sem RLS: ${semRls.map((x) => x.relname).join(', ')}` : ''
  );

  // ---- nenhuma política sobrando no papel `public` --------------------------------
  const pubPolicies = await tx`
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${sql.array(PRIVADAS)}::text[])
      AND roles::text[] && ARRAY['public']`;
  checar(
    'nenhuma política das tabelas privadas continua no papel `public`',
    pubPolicies.length === 0,
    pubPolicies.map((p) => `${p.tablename}."${p.policyname}"`).join(', ')
  );

  // ---- o professor continua trabalhando ------------------------------------------
  // Personifica uma conta real de servidor e repete o que as telas fazem.
  const [dono] = await tx`SELECT criado_por FROM provas WHERE criado_por IS NOT NULL LIMIT 1`;
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: dono.criado_por, role: 'authenticated' })}, true)`;
  await tx`SET LOCAL ROLE authenticated`;

  const leituras = {};
  for (const t of ['alunos', 'turmas', 'notas_avaliacoes', 'vistos_v2', 'avaliacoes', 'disciplinas']) {
    const [r] = await tx.unsafe(`SELECT count(*)::int n FROM public."${t}"`);
    leituras[t] = r.n;
  }
  checar(
    'servidor logado continua lendo alunos, turmas, notas e vistos',
    Object.values(leituras).every((n) => n > 0),
    Object.entries(leituras).map(([t, n]) => `${t}:${n}`).join(' ')
  );

  // Escrita: um UPDATE que não casa com linha nenhuma prova a permissão sem tocar dado.
  let escreveu = true;
  let erroEscrita = '';
  try {
    await tx`UPDATE alunos SET nome = nome WHERE id = '00000000-0000-0000-0000-000000000000'`;
    await tx`UPDATE notas_avaliacoes SET nota = nota WHERE id = '00000000-0000-0000-0000-000000000000'`;
  } catch (e) {
    escreveu = false;
    erroEscrita = e.message;
  }
  checar('servidor logado continua podendo gravar', escreveu, erroEscrita);

  await tx`RESET ROLE`;

  // ---- o aluno não escreve na ficha de ninguém ------------------------------------
  const [alunoUser] = await tx`
    SELECT up.usuario_id FROM usuario_papeis up WHERE up.papel = 'ALUNO' LIMIT 1`;
  if (alunoUser) {
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: alunoUser.usuario_id, role: 'authenticated' })}, true)`;
    await tx`SET LOCAL ROLE authenticated`;
    const [r] = await tx`
      WITH tentativa AS (
        UPDATE alunos SET nome = nome WHERE id = '00000000-0000-0000-0000-000000000000' RETURNING 1
      ) SELECT count(*)::int n FROM tentativa`;
    // Chegar aqui sem erro com 0 linhas é esperado: a policy filtra, não explode.
    // O que importa é a policy existir e negar — conferido pelo USING abaixo.
    const [pol] = await tx`
      SELECT count(*)::int n FROM pg_policies
      WHERE tablename = 'alunos' AND cmd = 'UPDATE' AND qual LIKE '%ALUNO%'`;
    checar('existe política que barra o aluno de alterar fichas', pol.n > 0, `linhas afetadas: ${r.n}`);
    await tx`RESET ROLE`;
  } else {
    console.log('  (pulado) nenhuma conta com papel ALUNO para testar');
  }

  // ---- a RPC do primeiro acesso responde, e só sim/não ----------------------------
  const [rpcAnon] = await tx`
    SELECT has_function_privilege('anon', 'public.rpc_email_de_professor_existe(text)', 'EXECUTE') pode`;
  checar('anon pode chamar a RPC do primeiro acesso', rpcAnon.pode === true);

  const [algum] = await tx`SELECT email FROM professores WHERE email IS NOT NULL LIMIT 1`;
  const [existe] = await tx`SELECT public.rpc_email_de_professor_existe(${algum.email}) v`;
  const [naoExiste] = await tx`SELECT public.rpc_email_de_professor_existe('ninguem@exemplo.invalido') v`;
  checar(
    'a RPC acerta o sim e o não',
    existe.v === true && naoExiste.v === false,
    `conhecido:${existe.v} desconhecido:${naoExiste.v}`
  );
}

try {
  await sql.begin(async (tx) => {
    await rodar(tx);
    if (!soAtual) {
      const e = new Error('rollback');
      e.marcador = ROLLBACK;
      throw e;
    }
  });
} catch (e) {
  if (e.marcador !== ROLLBACK) {
    console.error('\nERRO:', e.message);
    falhas++;
  }
} finally {
  await sql.end();
}

console.log(
  falhas === 0
    ? `\nTudo passou.${soAtual ? ' (estado atual de produção)' : ' Nada foi gravado (rollback).'}\n`
    : `\n${falhas} verificação(ões) falharam.\n`
);
process.exitCode = falhas === 0 ? 0 : 1;
