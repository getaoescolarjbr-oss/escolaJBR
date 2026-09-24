// Ponte segura entre o portal e o ACERVO de questões (projeto jbr-acervo-questoes).
//
// O navegador chama esta função com o login normal do portal. Aqui:
//   1. valida o JWT do usuário (projeto principal) e carrega seus papéis;
//   2. confere se o papel pode fazer aquela operação (mesmas regras que as políticas RLS de
//      questions/support_texts/question_taxonomy_terms tinham no projeto principal);
//   3. repassa para a função `acervo-api` do projeto B com o segredo compartilhado (Vault).
// A operação `importar` copia questões do acervo para `questions` do projeto principal (as
// funções de prova/correção/simulado só conhecem questões que existem aqui, por chave
// estrangeira). Nunca sobrescreve: uma prova já aplicada não muda se a questão for editada
// depois no acervo.
//
// Implantar com verify_jwt = true. Ver docs/plano-migracao-banco-questoes.md
import { createClient } from "jsr:@supabase/supabase-js@2";

const ACERVO_URL = "https://cbvrpgwvltmqlmyiabep.supabase.co/functions/v1/acervo-api";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LEITURA = ["PROFESSOR", "COORDENACAO", "COORDENACAO_AREA", "GESTAO"];
const ESCRITA = ["GESTAO", "PROFESSOR"];
const EDICAO = ["GESTAO", "PROFESSOR", "COORDENACAO_AREA"];
const TAXONOMIA = ["GESTAO", "COORDENACAO_AREA"]; // o acervo confere o campo (assunto/tópico)

const PERMISSOES: Record<string, string[]> = {
  filterOptions: LEITURA,
  assuntosPorDisciplina: LEITURA,
  topicosPorAssunto: LEITURA,
  listarQuestoes: LEITURA,
  buscarPorIds: LEITURA,
  sortear: LEITURA,
  listarTermos: LEITURA,
  contarPorDisciplina: LEITURA,
  salvarTextoApoio: ESCRITA,
  criarQuestao: ESCRITA,
  atualizarQuestao: EDICAO,
  excluirQuestao: EDICAO,
  criarTermo: TAXONOMIA,
  excluirTermo: TAXONOMIA,
  renomearTermo: TAXONOMIA,
  excluirDisciplina: ["GESTAO"],
  importar: LEITURA,
  ping: LEITURA,
};

function resp(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

let segredoCache: string | null = null;
async function segredo(): Promise<string> {
  if (segredoCache) return segredoCache;
  const { data, error } = await supabase.rpc("acervo_segredo");
  if (error || !data) throw new Error("Segredo do acervo indisponível");
  segredoCache = data as string;
  return segredoCache;
}

async function chamarAcervo(op: string, args: unknown, roles: string[], userId: string) {
  const r = await fetch(ACERVO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-acervo-secret": await segredo() },
    body: JSON.stringify({ op, args, roles, userId }),
  });
  const corpo = await r.json().catch(() => ({ erro: "resposta inválida do acervo" }));
  return { status: r.status, corpo };
}

// Copia do acervo para o projeto principal as questões (e textos de apoio) que ainda não existem aqui.
async function importar(ids: string[], roles: string[], userId: string) {
  const unicos = [...new Set(ids)].slice(0, 500);
  if (!unicos.length) return { importadas: 0, ausentes: [] as string[] };

  const { data: existentes, error: e0 } = await supabase.from("questions").select("id").in("id", unicos);
  if (e0) throw new Error(e0.message);
  const ja = new Set((existentes ?? []).map((q: { id: string }) => q.id));
  const faltam = unicos.filter((id) => !ja.has(id));
  if (!faltam.length) return { importadas: 0, ausentes: [] as string[] };

  const { status, corpo } = await chamarAcervo("exportarParaPrincipal", { ids: faltam }, roles, userId);
  if (status !== 200) throw new Error(corpo.erro ?? "falha ao ler o acervo");
  const { questions, support_texts } = corpo.data as { questions: Record<string, unknown>[]; support_texts: Record<string, unknown>[] };

  if (support_texts.length) {
    const { error } = await supabase.from("support_texts").upsert(support_texts, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`textos de apoio: ${error.message}`);
  }
  if (questions.length) {
    // Nunca sobrescreve (ignoreDuplicates). Se criado_por apontar para um usuário que não existe
    // neste projeto (FK para auth.users), grava sem autor em vez de falhar a prova inteira.
    let { error } = await supabase.from("questions").upsert(questions, { onConflict: "id", ignoreDuplicates: true });
    if (error && error.code === "23503") {
      ({ error } = await supabase.from("questions").upsert(questions.map((q) => ({ ...q, criado_por: null })), { onConflict: "id", ignoreDuplicates: true }));
    }
    if (error) throw new Error(`questões: ${error.message}`);
  }
  const achadas = new Set(questions.map((q) => q.id as string));
  return { importadas: questions.length, ausentes: faltam.filter((id) => !achadas.has(id)) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: eAuth } = await supabase.auth.getUser(token);
    if (eAuth || !auth?.user) return resp({ erro: "sessão inválida" }, 401);
    const userId = auth.user.id;

    const { op, args } = await req.json();
    const permitidos = PERMISSOES[op as string];
    if (!permitidos) return resp({ erro: "operação inválida" }, 400);

    const { data: papeis, error: eRoles } = await supabase.from("usuario_papeis").select("papel").eq("usuario_id", userId);
    if (eRoles) return resp({ erro: "falha ao ler papéis" }, 500);
    const roles = (papeis ?? []).map((p: { papel: string }) => p.papel);
    if (!roles.some((r) => permitidos.includes(r))) return resp({ erro: "sem permissão" }, 403);

    if (op === "importar") return resp({ data: await importar(args?.ids ?? [], roles, userId) });

    const { status, corpo } = await chamarAcervo(op, args ?? {}, roles, userId);
    return resp(corpo, status);
  } catch (e) {
    console.error("acervo-proxy:", e);
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
