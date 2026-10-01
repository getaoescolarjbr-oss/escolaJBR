// Liga/desliga a confirmação de e-mail no cadastro de novos usuários (Supabase Auth).
//
// O navegador chama esta função com o login normal do portal. Só a GESTAO pode usá-la. A
// alteração é feita na API de gerenciamento do Supabase (PATCH /v1/projects/{ref}/config/auth),
// que exige um token de acesso pessoal. Esse token fica só como segredo desta função
// (MGMT_ACCESS_TOKEN), nunca no navegador. Sem o segredo, a função só informa "não configurado".
//
//   { op: "status" }               -> estado atual
//   { op: "definir", ativo: true } -> exige confirmação por e-mail (só se houver SMTP próprio)
//   { op: "definir", ativo: false } -> cadastro entra direto, sem confirmar
//
// Sem dependências externas (só fetch), para poder ser testada fora do Deno.
// Implantar com verify_jwt = true.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MGMT_TOKEN = Deno.env.get("MGMT_ACCESS_TOKEN") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resp(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function usuarioDoToken(token: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE_KEY } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return typeof u?.id === "string" ? u.id : null;
}

async function ehGestao(userId: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/usuario_papeis?select=papel&usuario_id=eq.${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  if (!r.ok) throw new Error("falha ao ler papéis");
  const linhas = (await r.json()) as { papel: string }[];
  return linhas.some((l) => l.papel === "GESTAO");
}

const refDoProjeto = () => new URL(SUPABASE_URL).hostname.split(".")[0];
const urlConfig = () => `https://api.supabase.com/v1/projects/${refDoProjeto()}/config/auth`;
const cabecalhosMgmt = () => ({ Authorization: `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" });

interface ConfigAuth {
  mailer_autoconfirm?: boolean;
  smtp_host?: string | null;
  site_url?: string | null;
}

async function lerConfig(): Promise<ConfigAuth> {
  const r = await fetch(urlConfig(), { headers: cabecalhosMgmt() });
  if (!r.ok) throw new Error(`API de gerenciamento recusou a leitura (${r.status}). Confira o token.`);
  return (await r.json()) as ConfigAuth;
}

function estado(cfg: ConfigAuth) {
  return {
    tokenConfigurado: true,
    // mailer_autoconfirm = true significa que o cadastro NÃO precisa confirmar o e-mail.
    confirmacaoAtiva: cfg.mailer_autoconfirm === false,
    smtpConfigurado: Boolean(cfg.smtp_host),
    siteUrl: cfg.site_url ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const userId = await usuarioDoToken(token);
    if (!userId) return resp({ erro: "sessão inválida" }, 401);
    if (!(await ehGestao(userId))) return resp({ erro: "somente a Gestão pode alterar esta configuração" }, 403);

    const { op, ativo } = await req.json().catch(() => ({}));
    if (op !== "status" && op !== "definir") return resp({ erro: "operação inválida" }, 400);
    if (!MGMT_TOKEN) return resp({ tokenConfigurado: false });

    const cfg = await lerConfig();
    if (op === "status") return resp(estado(cfg));

    if (typeof ativo !== "boolean") return resp({ erro: "informe ativo: true ou false" }, 400);
    if (ativo && !cfg.smtp_host) {
      return resp({ erro: "Configure um servidor de e-mail (SMTP) no Supabase antes de ligar a confirmação: o envio padrão do Supabase é limitado a poucos e-mails por hora." }, 400);
    }
    const r = await fetch(urlConfig(), { method: "PATCH", headers: cabecalhosMgmt(), body: JSON.stringify({ mailer_autoconfirm: !ativo }) });
    if (!r.ok) throw new Error(`API de gerenciamento recusou a alteração (${r.status}).`);
    console.log(`auth-confirmacao-email: confirmação por e-mail ${ativo ? "LIGADA" : "DESLIGADA"} por ${userId}`);
    return resp(estado(await lerConfig()));
  } catch (e) {
    console.error("auth-confirmacao-email:", e);
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
