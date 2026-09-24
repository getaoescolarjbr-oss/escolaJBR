// Edge Function do projeto B (jbr-acervo-questoes): API do acervo de questões.
//
// Só é chamada pela Edge Function `acervo-proxy` do projeto principal, que já validou o login
// e os papéis do usuário. Aqui a autenticação é um segredo compartilhado (header
// x-acervo-secret, guardado no Vault dos dois projetos). O navegador nunca chama esta função.
//
// Implanta com verify_jwt = false (a proteção é o segredo). Ver docs/plano-migracao-banco-questoes.md
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CAMPOS =
  "id, discipline, area, level, banca, orgao, cargo, ano, difficulty, assunto, topico, statement, image_url, tipo, alternatives, correct_letter, criterios_correcao, linhas_resposta, explanation, support_text_id, active, criado_por, support_texts:support_text_id(id, discipline, content, image_url)";

// Colunas que o cliente pode gravar em `questions` (nada de id/datas/criado_por vindos de fora).
const COLUNAS_GRAVAVEIS = [
  "discipline", "area", "level", "banca", "orgao", "cargo", "ano", "difficulty", "assunto", "topico",
  "statement", "image_url", "tipo", "alternatives", "correct_letter", "criterios_correcao",
  "linhas_resposta", "correct_sum", "explanation", "support_text_id", "active",
];
const CAMPOS_TAXONOMIA = ["discipline", "difficulty", "assunto", "topico", "banca", "orgao", "cargo", "level", "area"];

class ErroHttp extends Error {
  constructor(public status: number, mensagem: string, public codigo?: string) { super(mensagem); }
}

function resp(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function limpar(dados: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const c of COLUNAS_GRAVAVEIS) if (c in dados) out[c] = dados[c];
  return out;
}

function comparar(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let segredoCache: string | null = null;
async function segredo(): Promise<string> {
  if (segredoCache) return segredoCache;
  const { data, error } = await supabase.rpc("acervo_segredo");
  if (error || !data) throw new Error("Segredo do acervo indisponível");
  segredoCache = data as string;
  return segredoCache;
}

function falha(error: { message: string; code?: string } | null): never {
  throw new ErroHttp(500, error?.message ?? "erro", error?.code);
}

// Termos de taxonomia: GESTAO gerencia tudo; COORDENACAO_AREA só assunto e tópico (mesma regra
// que existia nas políticas do projeto principal).
function podeGerirCampo(roles: string[], campo: string) {
  if (roles.includes("GESTAO")) return true;
  return roles.includes("COORDENACAO_AREA") && (campo === "assunto" || campo === "topico");
}

async function buscarPorIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("questions").select(CAMPOS).in("id", ids);
  if (error) falha(error);
  return data ?? [];
}

// deno-lint-ignore no-explicit-any
type Args = any;

const OPS: Record<string, (a: Args, roles: string[], userId: string | null) => Promise<unknown>> = {
  async filterOptions() {
    const { data, error } = await supabase.rpc("question_bank_filter_options").single();
    if (error) falha(error);
    return data;
  },
  async assuntosPorDisciplina(a) {
    const { data, error } = await supabase.rpc("question_bank_assuntos_by_discipline", { p_discipline: a.discipline });
    if (error) falha(error);
    return data ?? [];
  },
  async topicosPorAssunto(a) {
    const { data, error } = await supabase.rpc("question_bank_topicos_by_assunto", { p_assunto: a.assunto });
    if (error) falha(error);
    return data ?? [];
  },

  async listarQuestoes(a) {
    const f = a.filtro ?? {};
    const page = f.page ?? 0;
    const pageSize = Math.min(f.pageSize ?? 20, 100);

    let idsTextoApoio: string[] = [];
    if (f.busca) {
      const { data } = await supabase.from("support_texts").select("id").ilike("content", `%${f.busca}%`);
      idsTextoApoio = (data ?? []).map((t: { id: string }) => t.id);
    }
    let q = supabase.from("questions").select(CAMPOS, { count: "exact" })
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (f.discipline) q = q.eq("discipline", f.discipline);
    if (f.level) q = q.eq("level", f.level);
    if (f.area) q = q.eq("area", f.area);
    if (f.banca) q = q.eq("banca", f.banca);
    if (f.ano) q = q.eq("ano", f.ano);
    if (f.difficulty) q = q.eq("difficulty", f.difficulty);
    if (f.assunto) q = q.eq("assunto", f.assunto);
    if (f.topico) q = q.eq("topico", f.topico);
    if (f.tipo) q = q.eq("tipo", f.tipo);
    if (f.busca) {
      const b = String(f.busca).replace(/[,()]/g, "_");
      const cond = [`statement.ilike.%${b}%`];
      if (idsTextoApoio.length) cond.push(`support_text_id.in.(${idsTextoApoio.join(",")})`);
      q = q.or(cond.join(","));
    }
    if (f.apenasMinhas) q = q.eq("criado_por", f.apenasMinhas);
    const { data, error, count } = await q;
    if (error) falha(error);
    return { questoes: data ?? [], total: count ?? 0 };
  },

  async buscarPorIds(a) { return await buscarPorIds(a.ids ?? []); },

  async sortear(a) {
    const f = a.filtro ?? {};
    const { data, error } = await supabase.rpc("rpc_sortear_questoes", {
      p_qtd: f.qtd,
      p_disciplinas: f.disciplinas?.length ? f.disciplinas : null,
      p_assunto: f.assunto || null,
      p_topico: f.topico || null,
      p_banca: f.banca || null,
      p_excluir: f.excluir ?? [],
    });
    if (error) falha(error);
    const ids = (data ?? []) as string[];
    const questoes = await buscarPorIds(ids);
    const porId = new Map(questoes.map((q: { id: string }) => [q.id, q]));
    return ids.map((id) => porId.get(id)).filter(Boolean);
  },

  async salvarTextoApoio(a) {
    if (a.id) {
      const { data, error } = await supabase.from("support_texts").update({ discipline: a.discipline, content: a.content }).eq("id", a.id).select("id");
      if (error) falha(error);
      if (!data?.length) throw new ErroHttp(404, "Nenhum texto associado foi atualizado.");
      return a.id;
    }
    const { data: existente, error: e1 } = await supabase.from("support_texts").select("id").eq("content", a.content).limit(1);
    if (e1) falha(e1);
    if (existente?.length) return existente[0].id;
    const { data, error } = await supabase.from("support_texts").insert([{ discipline: a.discipline, content: a.content }]).select("id");
    if (error) falha(error);
    if (!data?.length) throw new ErroHttp(500, "Falha ao criar o texto associado.");
    return data[0].id;
  },

  async criarQuestao(a, _r, userId) {
    const { data, error } = await supabase.from("questions")
      .insert([{ ...limpar(a.dados ?? {}), criado_por: userId }]).select(CAMPOS).single();
    if (error) falha(error);
    return data;
  },
  async atualizarQuestao(a) {
    const { data, error } = await supabase.from("questions").update(limpar(a.dados ?? {})).eq("id", a.id).select("id");
    if (error) falha(error);
    if (!data?.length) throw new ErroHttp(404, "Nenhuma questão foi atualizada.");
    return true;
  },
  async excluirQuestao(a) {
    const { error } = await supabase.from("questions").delete().eq("id", a.id);
    if (error) falha(error);
    return true;
  },

  async listarTermos(a) {
    let q = supabase.from("question_taxonomy_terms").select("*").order("value");
    if (a.field) q = q.eq("field", a.field);
    const { data, error } = await q;
    if (error) falha(error);
    return data ?? [];
  },
  async criarTermo(a, roles) {
    if (!CAMPOS_TAXONOMIA.includes(a.field)) throw new ErroHttp(400, "Campo inválido");
    if (!podeGerirCampo(roles, a.field)) throw new ErroHttp(403, "Sem permissão para este campo");
    const { data, error } = await supabase.from("question_taxonomy_terms").insert([{ field: a.field, value: a.value }]).select().single();
    if (error) falha(error);
    return data;
  },
  async excluirTermo(a, roles) {
    const { data: termo } = await supabase.from("question_taxonomy_terms").select("field").eq("id", a.id).maybeSingle();
    if (!termo) return true;
    if (!podeGerirCampo(roles, termo.field)) throw new ErroHttp(403, "Sem permissão para este campo");
    const { error } = await supabase.from("question_taxonomy_terms").delete().eq("id", a.id);
    if (error) falha(error);
    return true;
  },
  async renomearTermo(a, roles) {
    if (!CAMPOS_TAXONOMIA.includes(a.field)) throw new ErroHttp(400, "Campo inválido");
    if (!podeGerirCampo(roles, a.field)) throw new ErroHttp(403, "Sem permissão para este campo");
    const { error: e1 } = await supabase.from("questions").update({ [a.field]: a.newValue }).eq(a.field, a.oldValue);
    if (e1) falha(e1);
    const { error } = await supabase.from("question_taxonomy_terms").update({ value: a.newValue }).eq("id", a.id);
    if (error) {
      // Já existe termo com o novo valor (UNIQUE): as questões já foram movidas; só some o duplicado.
      if (error.code === "23505") {
        await supabase.from("question_taxonomy_terms").delete().eq("id", a.id);
        return true;
      }
      falha(error);
    }
    return true;
  },
  async contarPorDisciplina(a) {
    const { count, error } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("discipline", a.discipline);
    if (error) falha(error);
    return count ?? 0;
  },
  async excluirDisciplina(a, roles) {
    if (!roles.includes("GESTAO")) throw new ErroHttp(403, "Somente a gestão remove disciplinas");
    const { error: e1 } = await supabase.from("questions").delete().eq("discipline", a.discipline);
    if (e1) falha(e1);
    const { error: e2 } = await supabase.from("support_texts").delete().eq("discipline", a.discipline);
    if (e2) falha(e2);
    const t = supabase.from("question_taxonomy_terms").delete();
    const { error: e3 } = a.termoId ? await t.eq("id", a.termoId) : await t.eq("field", "discipline").eq("value", a.discipline);
    if (e3) falha(e3);
    return true;
  },

  // Linhas completas (questão + texto de apoio) para o proxy copiar ao projeto principal.
  async exportarParaPrincipal(a) {
    const ids: string[] = a.ids ?? [];
    if (!ids.length) return { questions: [], support_texts: [] };
    const { data: questions, error } = await supabase.from("questions").select("*").in("id", ids);
    if (error) falha(error);
    const stIds = [...new Set((questions ?? []).map((q: { support_text_id: string | null }) => q.support_text_id).filter(Boolean))] as string[];
    let textos: unknown[] = [];
    if (stIds.length) {
      const { data, error: e2 } = await supabase.from("support_texts").select("*").in("id", stIds);
      if (e2) falha(e2);
      textos = data ?? [];
    }
    return { questions: questions ?? [], support_texts: textos };
  },

  // Medidor de uso do projeto do acervo (Portal do Administrador). Só leitura.
  async usoBanco(_a, roles) {
    if (!roles.includes("GESTAO")) throw new ErroHttp(403, "Somente a gestão consulta o uso do banco");
    const { data, error } = await supabase.rpc("rpc_uso_banco_dados");
    if (error) falha(error);
    return data;
  },

  // Backup: uma página de uma das três tabelas, em ordem estável por id. NÃO existe na lista do
  // acervo-proxy (o navegador não alcança); só quem tem o segredo compartilhado chama, como o
  // script supabase/acervo-projeto-b/backup-acervo.mjs.
  async exportarTabela(a) {
    const TABELAS = ["questions", "support_texts", "question_taxonomy_terms"];
    if (!TABELAS.includes(a.tabela)) throw new ErroHttp(400, "Tabela inválida");
    const de = Math.max(0, Number(a.offset) || 0);
    const n = Math.min(Math.max(1, Number(a.limite) || 500), 500);
    const { data, error, count } = await supabase.from(a.tabela).select("*", { count: "exact" }).order("id").range(de, de + n - 1);
    if (error) falha(error);
    return { linhas: data ?? [], total: count ?? 0 };
  },

  async ping() { return new Date().toISOString(); },
};

Deno.serve(async (req: Request) => {
  try {
    const enviado = req.headers.get("x-acervo-secret") ?? "";
    if (!enviado || !comparar(enviado, await segredo())) return resp({ erro: "não autorizado" }, 401);
    const body = await req.json();
    const op = OPS[body.op as string];
    if (!op) return resp({ erro: "operação inválida" }, 400);
    const data = await op(body.args ?? {}, body.roles ?? [], body.userId ?? null);
    return resp({ data });
  } catch (e) {
    if (e instanceof ErroHttp) return resp({ erro: e.message, codigo: e.codigo }, e.status);
    console.error("acervo-api:", e);
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
