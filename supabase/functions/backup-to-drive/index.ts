// Backup diário do banco (todas as tabelas do schema public) pro Google Drive.
// Disparado por um job do pg_cron dentro do próprio Supabase (ver
// add_agendamento_backup_drive.sql) — não depende de nenhum plano pago de hosting.
//
// Protegido por um segredo compartilhado (header x-backup-secret) em vez de JWT de
// usuário, porque quem chama é o pg_cron/pg_net de dentro do banco, não uma sessão
// logada, e o token anon é público (embutido em todo client do navegador) — não
// serviria pra proteger um endpoint que aciona a exportação inteira do banco.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_SECRET = Deno.env.get("BACKUP_SECRET")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN")!;
const GOOGLE_DRIVE_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "";
const RETENTION_DIAS = Number(Deno.env.get("BACKUP_RETENTION_DIAS") ?? "30");

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

type SupabaseClientAny = ReturnType<typeof createClient>;

async function listarTabelas(supabase: SupabaseClientAny): Promise<string[]> {
  const { data, error } = await supabase.rpc("rpc_listar_tabelas_backup");
  if (error) throw new Error(`Falha ao listar tabelas: ${error.message}`);
  return (data as { tablename: string }[]).map((r) => r.tablename);
}

async function exportarTabela(supabase: SupabaseClientAny, nome: string): Promise<unknown[]> {
  const linhas: unknown[] = [];
  const pageSize = 1000;
  let from = 0;
  // deno-lint-ignore no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(nome)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao exportar ${nome}: ${error.message}`);
    if (!data || data.length === 0) break;
    linhas.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return linhas;
}

async function comprimirGzip(texto: string): Promise<Uint8Array> {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function enviarParaDrive(nomeArquivo: string, conteudo: Uint8Array, accessToken: string) {
  const metadata: Record<string, unknown> = {
    name: nomeArquivo,
    mimeType: "application/gzip",
  };
  if (GOOGLE_DRIVE_FOLDER_ID) metadata.parents = [GOOGLE_DRIVE_FOLDER_ID];

  const boundary = "backupjbr" + crypto.randomUUID();
  const encoder = new TextEncoder();
  const parteMetadata = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  );
  const parteArquivoHeader = encoder.encode(`--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`);
  const fechamento = encoder.encode(`\r\n--${boundary}--`);

  const corpo = new Uint8Array(parteMetadata.length + parteArquivoHeader.length + conteudo.length + fechamento.length);
  let offset = 0;
  corpo.set(parteMetadata, offset);
  offset += parteMetadata.length;
  corpo.set(parteArquivoHeader, offset);
  offset += parteArquivoHeader.length;
  corpo.set(conteudo, offset);
  offset += conteudo.length;
  corpo.set(fechamento, offset);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: corpo,
  });
  if (!res.ok) throw new Error(`Falha ao enviar pro Drive: ${await res.text()}`);
  return await res.json();
}

async function limparBackupsAntigos(accessToken: string) {
  if (RETENTION_DIAS <= 0) return;
  const dataLimite = new Date(Date.now() - RETENTION_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const filtros = [`name contains 'backup-jbr-'`, `createdTime < '${dataLimite}'`, "trashed = false"];
  if (GOOGLE_DRIVE_FOLDER_ID) filtros.push(`'${GOOGLE_DRIVE_FOLDER_ID}' in parents`);
  const q = encodeURIComponent(filtros.join(" and "));

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return; // não trava o backup por causa da limpeza de antigos
  const { files } = await res.json();
  for (const f of files ?? []) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("x-backup-secret");
  if (!BACKUP_SECRET || auth !== BACKUP_SECRET) {
    return new Response("Não autorizado", { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const tabelas = await listarTabelas(supabase);

    const backup: Record<string, unknown[]> = {};
    const erros: string[] = [];
    for (const tabela of tabelas) {
      try {
        backup[tabela] = await exportarTabela(supabase, tabela);
      } catch (e) {
        erros.push(`${tabela}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const agora = new Date();
    const carimbo = agora.toISOString().replace(/[:.]/g, "-");
    const nomeArquivo = `backup-jbr-${carimbo}.json.gz`;

    const json = JSON.stringify({ geradoEm: agora.toISOString(), tabelas: backup, erros });
    const comprimido = await comprimirGzip(json);

    const accessToken = await getAccessToken();
    const arquivoDrive = await enviarParaDrive(nomeArquivo, comprimido, accessToken);
    await limparBackupsAntigos(accessToken);

    const resultado = {
      sucesso: true,
      arquivo: nomeArquivo,
      driveFileId: arquivoDrive.id,
      tamanhoBytesComprimido: comprimido.length,
      tabelasExportadas: Object.keys(backup).length,
      erros,
    };
    console.log("Backup concluído:", JSON.stringify(resultado));
    return new Response(JSON.stringify(resultado), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no backup:", e);
    return new Response(
      JSON.stringify({ sucesso: false, erro: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
