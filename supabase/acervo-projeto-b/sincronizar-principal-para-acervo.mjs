// Leva para o ACERVO (projeto jbr-acervo-questoes) o que foi criado/editado só no banco PRINCIPAL
// depois da migração — por exemplo, questões mexidas pelo site antigo enquanto o novo não estava no ar.
//
//   node supabase/acervo-projeto-b/sincronizar-principal-para-acervo.mjs            (só confere: NÃO grava)
//   node supabase/acervo-projeto-b/sincronizar-principal-para-acervo.mjs --aplicar  (grava no acervo)
//
// Regras de segurança (o acervo passa a ser a fonte da verdade quando o site novo entra no ar):
//   * NUNCA apaga nada, em nenhum dos dois lados;
//   * linha que só existe no principal  -> vai para o acervo;
//   * linha diferente nos dois lados    -> só vai se a versão do PRINCIPAL for MAIS NOVA (updated_at
//                                          maior por mais de 2 s); se o acervo for mais novo ou igual,
//                                          é IGNORADA e listada como conflito (edição feita no site novo
//                                          nunca é sobrescrita por uma cópia velha);
//   * linha que só existe no acervo     -> intocada (é questão criada no site novo);
//   * imagens enviadas ao Storage do principal são copiadas para o do acervo antes de a linha ir, e a
//     URL é reescrita; se a cópia de uma imagem falhar, a linha NÃO é sincronizada (não cria link morto);
//   * --aplicar exige um backup do acervo feito nas últimas 24 h (backup-acervo.mjs), salvo --sem-backup.
//
// Lê o principal por SUPABASE_DB_URL (.env.local, somente SELECT) e escreve no acervo pela Edge
// Function `acervo-api` com o segredo compartilhado (ACERVO_API_SECRET ou scratch/.acervo-api-secret).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import postgres from 'postgres';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const irmao = path.join(raiz, '..', 'portal-professor-jbr');
for (const dir of [raiz, irmao]) { if (fs.existsSync(path.join(dir, '.env.local'))) { dotenv.config({ path: path.join(dir, '.env.local'), quiet: true }); break; } }

const aplicar = process.argv.includes('--aplicar');
const semBackup = process.argv.includes('--sem-backup');
const API = 'https://cbvrpgwvltmqlmyiabep.supabase.co/functions/v1/acervo-api';
const HOST_A = 'hqonnxnwozfwkpqgabpf', HOST_B = 'cbvrpgwvltmqlmyiabep';
const TABELAS = ['support_texts', 'question_taxonomy_terms', 'questions']; // ordem: questions referencia support_texts
const TOLERANCIA_MS = 2000;

function segredo() {
  if (process.env.ACERVO_API_SECRET) return process.env.ACERVO_API_SECRET.trim();
  for (const p of [path.join(raiz, 'scratch', '.acervo-api-secret'), path.join(irmao, 'scratch', '.acervo-api-secret')]) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('Segredo não encontrado: defina ACERVO_API_SECRET ou crie scratch/.acervo-api-secret');
}
const SEGREDO = segredo();

async function chamar(op, args, tentativas = 4) {
  let ultimo;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-acervo-secret': SEGREDO }, body: JSON.stringify({ op, args }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j.data;
      ultimo = `HTTP ${r.status}: ${j.erro ?? ''}`;
      if (r.status >= 400 && r.status < 500 && r.status !== 429) break; // erro de uso, não adianta repetir
    } catch (e) { ultimo = e.message; }
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
  throw new Error(`${op}: ${ultimo}`);
}

const url = new URL(process.env.SUPABASE_DB_URL ?? '');
const jaPooler = url.hostname.includes('pooler.supabase.com');
const ref = jaPooler ? url.username.split('.')[1] : url.hostname.split('.')[1];
const sql = postgres({
  host: jaPooler ? url.hostname : (process.env.SUPABASE_POOLER_HOST ?? 'aws-1-us-west-2.pooler.supabase.com'),
  port: 5432, database: 'postgres', username: `postgres.${ref}`, password: decodeURIComponent(url.password), ssl: 'require', max: 1, idle_timeout: 0,
});

const canon = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !['created_at', 'updated_at'].includes(k)).sort(([a], [b]) => a.localeCompare(b))));
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const paraB = (o) => JSON.parse(JSON.stringify(o).replaceAll(HOST_A, HOST_B));
// Nomes de imagem citados numa linha JÁ convertida para o host do acervo (paraB troca o host do
// principal pelo do acervo; o nome do arquivo é o mesmo nos dois buckets).
const REF_IMG = new RegExp(String.raw`${HOST_B}\.supabase\.co/storage/v1/object/public/imagens-questoes/([^\]\s"'\\)]+)`, 'g');
const imagensDaLinha = (linha) => [...new Set([...JSON.stringify(linha).matchAll(REF_IMG)].map((m) => decodeURIComponent(m[1])))];
const resumo = (t, l) => (t === 'questions' ? String(l.statement ?? '') : t === 'support_texts' ? String(l.content ?? '') : `${l.field}: ${l.value}`).replace(/\s+/g, ' ').slice(0, 60);

async function linhasDoAcervo(tabela) {
  const todas = [];
  for (let off = 0; ; off += 500) {
    const r = await chamar('exportarTabela', { tabela, offset: off, limite: 500 });
    todas.push(...r.linhas);
    if (off + 500 >= r.total || !r.linhas.length) break;
  }
  return todas;
}

async function planejar() {
  const plano = {};
  for (const tabela of TABELAS) {
    const A = await sql.unsafe(`select * from public.${tabela}`);
    const B = await linhasDoAcervo(tabela);
    const mapaB = new Map(B.map((r) => [r.id, r]));
    const idsA = new Set(A.map((r) => r.id));
    const levar = [], conflitos = [];
    let iguais = 0;
    for (const a of A) {
      const b = mapaB.get(a.id);
      const aB = paraB(a);
      if (!b) { levar.push({ linha: aB, motivo: 'nova (só no principal)' }); continue; }
      if (md5(canon(aB)) === md5(canon(b))) { iguais++; continue; }
      const dif = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (dif > TOLERANCIA_MS) levar.push({ linha: aB, motivo: `editada no principal (${Math.round(dif / 60000)} min mais nova)` });
      else conflitos.push({ linha: aB, motivo: dif < -TOLERANCIA_MS ? 'acervo mais novo' : 'diferente com a mesma data' });
    }
    plano[tabela] = { levar, conflitos, iguais, soNoAcervo: B.filter((r) => !idsA.has(r.id)).length, totalA: A.length, totalB: B.length };
  }
  return plano;
}

function mostrar(plano) {
  for (const [t, p] of Object.entries(plano)) {
    console.log(`\n${t}: principal=${p.totalA} acervo=${p.totalB} | iguais=${p.iguais} | a levar=${p.levar.length} | conflitos ignorados=${p.conflitos.length} | só no acervo=${p.soNoAcervo}`);
    for (const x of p.levar) console.log(`   LEVAR    ${x.linha.id.slice(0, 8)}  ${x.motivo}  «${resumo(t, x.linha)}»`);
    for (const x of p.conflitos) console.log(`   IGNORAR  ${x.linha.id.slice(0, 8)}  ${x.motivo}  «${resumo(t, x.linha)}»`);
  }
}

function conferirBackup() {
  const base = path.resolve(raiz, '..', 'backups-banco');
  const recentes = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('acervo-')).map((d) => ({ d, t: fs.statSync(path.join(base, d)).mtimeMs })).filter((x) => Date.now() - x.t < 24 * 3600 * 1000) : [];
  if (recentes.length === 0 && !semBackup) throw new Error('Sem backup do acervo nas últimas 24 h. Rode antes: node supabase/acervo-projeto-b/backup-acervo.mjs (ou use --sem-backup por sua conta e risco).');
  if (recentes.length) console.log(`\nBackup do acervo encontrado: ${recentes[0].d}`);
}

try {
  console.log(aplicar ? 'MODO APLICAR: vai gravar no acervo.' : 'MODO CONFERÊNCIA: nada será gravado (use --aplicar para gravar).');
  const plano = await planejar();
  mostrar(plano);
  const total = Object.values(plano).reduce((s, p) => s + p.levar.length, 0);
  if (!aplicar) { console.log(`\n${total} linha(s) seriam levadas ao acervo.`); }
  else if (total === 0) { console.log('\nNada a levar: o acervo já está em dia.'); }
  else {
    conferirBackup();
    for (const tabela of TABELAS) {
      const itens = plano[tabela].levar;
      if (!itens.length) continue;
      // 1) imagens: copia as do bucket do principal; linha com imagem que falhou não vai
      const falhouImagem = new Set();
      const nomes = new Map(itens.map((x) => [x.linha.id, imagensDaLinha(x.linha)]));
      const unicas = [...new Set([...nomes.values()].flat())];
      for (let i = 0; i < unicas.length; i += 20) {
        const r = await chamar('copiarImagensDoPrincipal', { caminhos: unicas.slice(i, i + 20) });
        for (const f of r.falhas) { for (const [id, lista] of nomes) if (lista.includes(f.caminho)) falhouImagem.add(id); console.log(`   imagem NÃO copiada: ${f.caminho} (${f.erro})`); }
      }
      if (unicas.length) console.log(`${tabela}: ${unicas.length} imagem(ns) do principal conferida(s)/copiada(s) para o acervo`);
      // 2) grava as linhas em lotes
      const gravaveis = itens.filter((x) => !falhouImagem.has(x.linha.id)).map((x) => x.linha);
      for (let i = 0; i < gravaveis.length; i += 100) await chamar('sincronizarLinhas', { tabela, linhas: gravaveis.slice(i, i + 100) });
      console.log(`${tabela}: ${gravaveis.length} linha(s) gravada(s) no acervo${falhouImagem.size ? `, ${falhouImagem.size} ficou(aram) de fora por imagem` : ''}`);
    }
    console.log('\nConferindo de novo...');
    mostrar(await planejar());
  }
} catch (e) {
  console.error('\nFALHOU:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
