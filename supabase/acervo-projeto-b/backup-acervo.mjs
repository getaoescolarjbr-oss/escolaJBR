// Backup do ACERVO de questões (projeto jbr-acervo-questoes) para o disco. SOMENTE LEITURA.
//
//   node supabase/acervo-projeto-b/backup-acervo.mjs [pasta-de-saida]
//
// O plano gratuito do Supabase não tem backup baixável, e agora questões novas/editadas moram
// só no acervo. Este script lê as 3 tabelas pela Edge Function `acervo-api` (operação
// exportarTabela, protegida pelo segredo compartilhado), grava um .ndjson.gz por tabela e confere
// contagem e checksum relendo os arquivos. Não precisa da senha do banco.
//
// O segredo vem de ACERVO_API_SECRET ou de scratch/.acervo-api-secret (arquivo ignorado pelo git).
// As imagens do bucket não entram aqui: são arquivos estáticos e ainda existem também no bucket do
// projeto principal.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import readline from 'node:readline';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://cbvrpgwvltmqlmyiabep.supabase.co/functions/v1/acervo-api';
const TABELAS = ['support_texts', 'question_taxonomy_terms', 'questions'];
const PAGINA = 500;

function lerSegredo() {
  if (process.env.ACERVO_API_SECRET) return process.env.ACERVO_API_SECRET.trim();
  for (const p of [path.join(raiz, 'scratch', '.acervo-api-secret'), path.join(raiz, '..', 'portal-professor-jbr', 'scratch', '.acervo-api-secret')]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  }
  throw new Error('Segredo não encontrado: defina ACERVO_API_SECRET ou crie scratch/.acervo-api-secret');
}
const SEGREDO = lerSegredo();

async function chamar(op, args, tentativas = 4) {
  let ultimo;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-acervo-secret': SEGREDO }, body: JSON.stringify({ op, args }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j.data;
      ultimo = `HTTP ${r.status}: ${j.erro ?? ''}`;
    } catch (e) { ultimo = e.message; }
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
  throw new Error(ultimo);
}

const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const base = process.argv[2] ?? path.resolve(raiz, '..', 'backups-banco');
const saida = path.join(base, `acervo-${carimbo}`);
fs.mkdirSync(saida, { recursive: true });

const manifesto = { carimbo, projeto: 'cbvrpgwvltmqlmyiabep (jbr-acervo-questoes)', geradoEm: new Date().toISOString(), tabelas: {} };
const sha256 = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
async function contar(f) { let n = 0; for await (const l of readline.createInterface({ input: fs.createReadStream(f).pipe(zlib.createGunzip()), crlfDelay: Infinity })) if (l.trim()) n++; return n; }

for (const tabela of TABELAS) {
  const arquivo = path.join(saida, `${tabela}.ndjson.gz`);
  let total = null, gravadas = 0;
  async function* gerar() {
    for (let off = 0; ; off += PAGINA) {
      const r = await chamar('exportarTabela', { tabela, offset: off, limite: PAGINA });
      total = r.total;
      for (const l of r.linhas) { gravadas++; yield JSON.stringify(l) + '\n'; }
      process.stdout.write(`\r${tabela}: ${gravadas}/${total}   `);
      if (off + PAGINA >= r.total || r.linhas.length === 0) break;
    }
  }
  await pipeline(Readable.from(gerar()), zlib.createGzip({ level: 6 }), fs.createWriteStream(arquivo));
  const relidas = await contar(arquivo);
  manifesto.tabelas[tabela] = { esperado: total, gravado: gravadas, relido: relidas, bytes: fs.statSync(arquivo).size, sha256: await sha256(arquivo), arquivo: path.basename(arquivo) };
  console.log(`\n${tabela}: ${relidas} linhas`);
}

const problemas = Object.entries(manifesto.tabelas).filter(([, t]) => t.esperado !== t.gravado || t.gravado !== t.relido);
manifesto.divergencias = problemas.length;
fs.writeFileSync(path.join(saida, '_manifesto.json'), JSON.stringify(manifesto, null, 2));
console.log(problemas.length === 0 ? `\nBACKUP DO ACERVO OK e verificado: ${saida}` : `\nBACKUP COM DIVERGENCIAS: ${problemas.map(([t]) => t).join(', ')}`);
process.exitCode = problemas.length === 0 ? 0 : 2;
