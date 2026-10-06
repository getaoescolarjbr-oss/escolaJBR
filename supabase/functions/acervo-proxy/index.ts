// Ponte segura entre o portal e o ACERVO de questões (projeto jbr-acervo-questoes).
//
// O navegador chama esta função com o login normal do portal. Aqui:
//   1. valida o JWT do usuário (projeto principal) e carrega seus papéis;
//   2. confere se o papel pode fazer aquela operação (mesmas regras que as políticas RLS de
//      questions/support_texts/question_taxonomy_terms tinham no projeto principal);
//   3. repassa para a função `acervo-api` do projeto B com o segredo compartilhado (Vault).
// A operação `importar` copia questões do acervo para `questions` do projeto principal (as
// funções de prova/correção/simulado só conhecem questões que existem aqui, por chave
// estrangeira). Uma prova já publicada/aplicada não muda se a questão for editada depois no
// acervo (cópia travada); enquanto a questão só estiver em rascunhos, a cópia acompanha o acervo.
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
  urlUploadImagem: ESCRITA, // mesma regra do bucket antigo: GESTAO ou PROFESSOR
  usoBanco: ["GESTAO"],
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

// Questões "travadas": já usadas por prova publicada/encerrada, por resposta de aluno ou por redação.
// A cópia delas no principal nunca é sobrescrita, para que uma prova aplicada não mude.
async function idsTravados(): Promise<Set<string>> {
  const travados = new Set<string>();
  const { data: provas, error: e1 } = await supabase.from("provas").select("id").neq("status", "RASCUNHO");
  if (e1) throw new Error(e1.message);
  const idsProvas = (provas ?? []).map((p: { id: string }) => p.id);
  for (let i = 0; i < idsProvas.length; i += 100) {
    const { data, error } = await supabase.from("prova_questoes").select("question_id").in("prova_id", idsProvas.slice(i, i + 100));
    if (error) throw new Error(error.message);
    (data ?? []).forEach((r: { question_id: string }) => travados.add(r.question_id));
  }
  for (const tabela of ["prova_respostas_itens", "redacao_envios", "redacao_rascunhos"]) {
    const { data, error } = await supabase.from(tabela).select("question_id");
    if (error) throw new Error(error.message);
    (data ?? []).forEach((r: { question_id: string | null }) => { if (r.question_id) travados.add(r.question_id); });
  }
  return travados;
}

// Copia do acervo para o projeto principal as questões (e textos de apoio) que ainda não existem aqui
// e atualiza as cópias que só aparecem em provas em rascunho, para acompanharem as edições do acervo.
async function importar(ids: string[], roles: string[], userId: string) {
  const unicos = [...new Set(ids)].slice(0, 500);
  if (!unicos.length) return { importadas: 0, atualizadas: 0, ausentes: [] as string[] };

  const ja = new Set<string>();
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase.from("questions").select("id").in("id", unicos.slice(i, i + 100));
    if (error) throw new Error(error.message);
    (data ?? []).forEach((q: { id: string }) => ja.add(q.id));
  }
  const faltam = unicos.filter((id) => !ja.has(id));
  const travados = ja.size ? await idsTravados() : new Set<string>();
  const atualizar = unicos.filter((id) => ja.has(id) && !travados.has(id));
  const alvo = [...faltam, ...atualizar];
  if (!alvo.length) return { importadas: 0, atualizadas: 0, ausentes: [] as string[] };

  const { status, corpo } = await chamarAcervo("exportarParaPrincipal", { ids: alvo }, roles, userId);
  if (status !== 200) throw new Error(corpo.erro ?? "falha ao ler o acervo");
  // `busca_texto` é coluna gerada só do acervo (índice da busca por aproximação); o principal não tem.
  const semColunasDoAcervo = (linhas: Record<string, unknown>[]) =>
    linhas.map((l) => { const { busca_texto: _descartada, ...resto } = l; return resto; });
  const dados = corpo.data as { questions: Record<string, unknown>[]; support_texts: Record<string, unknown>[] };
  const questions = semColunasDoAcervo(dados.questions);
  const support_texts = semColunasDoAcervo(dados.support_texts);

  if (support_texts.length) {
    // Texto de apoio compartilhado com alguma questão travada não é sobrescrito.
    const travadosLista = [...travados];
    const textosTravados = new Set<string>();
    for (let i = 0; i < travadosLista.length; i += 100) {
      const { data, error } = await supabase.from("questions").select("support_text_id").in("id", travadosLista.slice(i, i + 100));
      if (error) throw new Error(error.message);
      (data ?? []).forEach((q: { support_text_id: string | null }) => { if (q.support_text_id) textosTravados.add(q.support_text_id); });
    }
    const protegidos = support_texts.filter((t) => textosTravados.has(t.id as string));
    const livres = support_texts.filter((t) => !textosTravados.has(t.id as string));
    if (protegidos.length) {
      const { error } = await supabase.from("support_texts").upsert(protegidos, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`textos de apoio: ${error.message}`);
    }
    if (livres.length) {
      const { error } = await supabase.from("support_texts").upsert(livres, { onConflict: "id" });
      if (error) throw new Error(`textos de apoio: ${error.message}`);
    }
  }
  if (questions.length) {
    // Só chegam aqui questões novas ou não travadas. Se criado_por apontar para um usuário que não existe
    // neste projeto (FK para auth.users), grava sem autor em vez de falhar a prova inteira.
    let { error } = await supabase.from("questions").upsert(questions, { onConflict: "id" });
    if (error && error.code === "23503") {
      ({ error } = await supabase.from("questions").upsert(questions.map((q) => ({ ...q, criado_por: null })), { onConflict: "id" }));
    }
    if (error) throw new Error(`questões: ${error.message}`);
  }
  const achadas = new Set(questions.map((q) => q.id as string));
  return {
    importadas: faltam.filter((id) => achadas.has(id)).length,
    atualizadas: atualizar.filter((id) => achadas.has(id)).length,
    ausentes: faltam.filter((id) => !achadas.has(id)),
  };
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
