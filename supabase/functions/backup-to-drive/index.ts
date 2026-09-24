// Backup diário do banco (todas as tabelas do schema public) pro Google Drive.
// Disparado por um job do pg_cron dentro do próprio Supabase (ver
// add_agendamento_backup_drive.sql) — não depende de nenhum plano pago de hosting.
//
// Protegido por um segredo compartilhado (header x-backup-secret) em vez de JWT de
// usuário, porque quem chama é o pg_cron/pg_net de dentro do banco, não uma sessão
// logada, e o token anon é público (embutido em todo client do navegador) — não
// serviria pra proteger um endpoint que aciona a exportação inteira do banco.
//
// O projeto tem 130+ tabelas. Processar tudo numa invocação só estourava os
// limites da Edge Function: comprimir (gzip) tudo de uma vez estourava CPU time,
// e sem compressão o payload acumulado estourava memória. A solução é processar
// em LOTES: cada invocação exporta/comprime/envia um lote pequeno e, se sobrar
// tabela, dispara a próxima invocação de si mesma em segundo plano (via
// EdgeRuntime.waitUntil) passando a pasta do Drive e a lista restante — assim
// cada chamada individual fica bem abaixo dos limites de CPU e memória.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_SECRET = Deno.env.get("BACKUP_SECRET")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN")!;
const GOOGLE_DRIVE_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "";
const RETENTION_DIAS = Number(Deno.env.get("BACKUP_RETENTION_DIAS") ?? "30");

// Lote pequeno e sequencial: com 5 tabelas em paralelo, uma tabela pesada (`questions`,
// ~21 mil linhas / 42 MB) estourava o limite de recursos da Edge Function (HTTP 546) e,
// como a continuação só era disparada no fim do lote, a cadeia inteira morria em silêncio
// e as tabelas seguintes ficavam fora do backup.
const TAMANHO_LOTE = 3;
const CONCORRENCIA = 1;
// Tabelas com mais linhas que isso são gravadas em partes (`tabela.parte001.json.gz`...),
// uma parte por item da fila, cada uma pequena o bastante para caber num único lote.
const PARTE_LINHAS = 1500;

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

// Exporta até `limite` linhas a partir de `offset`. `cheio` = veio o limite inteiro, então
// pode haver mais linhas (a próxima parte confirma; se vier vazia, a tabela acabou).
async function exportarParte(
  supabase: SupabaseClientAny,
  nome: string,
  offset: number,
  limite: number,
): Promise<{ linhas: unknown[]; cheio: boolean }> {
  const linhas: unknown[] = [];
  const pageSize = 500;
  let from = offset;
  const fim = offset + limite;
  while (from < fim) {
    const { data, error } = await supabase
      .from(nome)
      .select("*")
      .range(from, Math.min(from + pageSize, fim) - 1);
    if (error) throw new Error(`Falha ao exportar ${nome}: ${error.message}`);
    if (!data || data.length === 0) break;
    linhas.push(...data);
    if (data.length < Math.min(pageSize, fim - from)) break;
    from += data.length;
  }
  return { linhas, cheio: linhas.length === limite };
}

// Item da fila: "tabela" (começa do zero) ou "tabela|offset" (continuação de uma tabela grande).
function lerItem(item: string): { tabela: string; offset: number } {
  const [tabela, offset] = item.split("|");
  return { tabela, offset: Number(offset ?? 0) };
}

async function comprimirGzip(texto: string): Promise<Uint8Array> {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// Cria uma subpasta por execução (nomeada com o carimbo) dentro de
// GOOGLE_DRIVE_FOLDER_ID, pra não acumular uma pasta plana com uma centena de
// arquivos soltos por dia.
async function criarSubpastaExecucao(carimbo: string, accessToken: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name: `backup-jbr-${carimbo}`,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (GOOGLE_DRIVE_FOLDER_ID) metadata.parents = [GOOGLE_DRIVE_FOLDER_ID];

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`Falha ao criar subpasta do backup: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

async function enviarParaDrive(nomeArquivo: string, conteudo: Uint8Array, accessToken: string, pastaId: string) {
  const metadata: Record<string, unknown> = {
    name: nomeArquivo,
    mimeType: "application/gzip",
    parents: [pastaId],
  };

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
  // Limpa as subpastas de execução (backup-jbr-<carimbo>) mais antigas que a
  // retenção — apagar a pasta já leva os arquivos dela junto.
  const filtros = [
    `name contains 'backup-jbr-'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `createdTime < '${dataLimite}'`,
    "trashed = false",
  ];
  if (GOOGLE_DRIVE_FOLDER_ID) filtros.push(`'${GOOGLE_DRIVE_FOLDER_ID}' in parents`);
  const q = encodeURIComponent(filtros.join(" and "));

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200`, {
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

interface EstadoLote {
  carimbo: string;
  pastaId: string;
  restantes: string[];
  totalTabelas: number;
  processadas: number;
  erros: string[];
}

async function processarLote(supabase: SupabaseClientAny, estado: EstadoLote, accessToken: string) {
  const loteAtual = estado.restantes.slice(0, TAMANHO_LOTE);
  const resto = estado.restantes.slice(TAMANHO_LOTE);

  const fila = [...loteAtual];
  const continuacoes: string[] = [];
  async function worker() {
    while (fila.length > 0) {
      const item = fila.shift();
      if (!item) break;
      const { tabela, offset } = lerItem(item);
      try {
        const { linhas, cheio } = await exportarParte(supabase, tabela, offset, PARTE_LINHAS);
        // Tabela que acabou exatamente no limite da parte anterior: nada a gravar.
        if (offset > 0 && linhas.length === 0) {
          estado.processadas++;
          continue;
        }
        const emPartes = offset > 0 || cheio;
        const numeroParte = String(offset / PARTE_LINHAS + 1).padStart(3, "0");
        const nomeArquivo = emPartes ? `${tabela}.parte${numeroParte}.json.gz` : `${tabela}.json.gz`;
        const json = JSON.stringify({ geradoEm: new Date().toISOString(), tabela, offset, linhas });
        const comprimido = await comprimirGzip(json);
        await enviarParaDrive(nomeArquivo, comprimido, accessToken, estado.pastaId);
        if (cheio) continuacoes.push(`${tabela}|${offset + PARTE_LINHAS}`);
        else estado.processadas++;
      } catch (e) {
        estado.erros.push(`${item}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCORRENCIA }, () => worker()));

  // Próxima parte de uma tabela grande vai à frente da fila, pra terminá-la logo.
  estado.restantes = [...continuacoes, ...resto];

  if (estado.restantes.length > 0) {
    // Ainda sobrou trabalho: dispara a continuação em segundo plano (não aguarda
    // a resposta completa) e devolve o estado parcial pro chamador. Se a próxima
    // invocação morrer (ex.: HTTP 546), tenta de novo em vez de deixar a cadeia
    // parar em silêncio com tabelas faltando.
    const corpo = JSON.stringify({
      carimbo: estado.carimbo,
      pastaId: estado.pastaId,
      restantes: estado.restantes,
      totalTabelas: estado.totalTabelas,
      processadas: estado.processadas,
      erros: estado.erros,
    });
    const continuar = (async () => {
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/backup-to-drive`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-backup-secret": BACKUP_SECRET },
            body: corpo,
          });
          if (r.ok) return;
          console.error(`Continuação do backup falhou (HTTP ${r.status}), tentativa ${tentativa}/3`);
        } catch (e) {
          console.error(`Falha ao disparar continuação do backup, tentativa ${tentativa}/3:`, e);
        }
      }
      console.error("BACKUP INCOMPLETO: a cadeia parou. Restantes:", estado.restantes.join(","));
    })();

    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(continuar);
    } else {
      await continuar;
    }
    return { completo: false };
  }

  // Marcador de fim: a pasta do backup só tem este arquivo se a cadeia chegou até o final.
  // Sem ele, o backup daquela pasta está incompleto.
  const resumo = JSON.stringify({
    concluidoEm: new Date().toISOString(),
    carimbo: estado.carimbo,
    totalTabelas: estado.totalTabelas,
    tabelasCompletas: estado.processadas,
    erros: estado.erros,
  });
  try {
    await enviarParaDrive("_CONCLUIDO.json.gz", await comprimirGzip(resumo), accessToken, estado.pastaId);
  } catch (e) {
    console.error("Falha ao gravar o marcador _CONCLUIDO:", e);
  }
  if (estado.erros.length > 0 || estado.processadas !== estado.totalTabelas) {
    console.error("BACKUP COM PROBLEMAS:", resumo);
  }

  await limparBackupsAntigos(accessToken);
  return { completo: true };
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("x-backup-secret");
  if (!BACKUP_SECRET || auth !== BACKUP_SECRET) {
    return new Response("Não autorizado", { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const accessToken = await getAccessToken();

    let estado: EstadoLote;
    if (body.restantes) {
      estado = {
        carimbo: body.carimbo,
        pastaId: body.pastaId,
        restantes: body.restantes,
        totalTabelas: body.totalTabelas,
        processadas: body.processadas ?? 0,
        erros: body.erros ?? [],
      };
    } else {
      const tabelas = await listarTabelas(supabase);
      const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
      const pastaId = await criarSubpastaExecucao(carimbo, accessToken);
      estado = { carimbo, pastaId, restantes: tabelas, totalTabelas: tabelas.length, processadas: 0, erros: [] };
    }

    const { completo } = await processarLote(supabase, estado, accessToken);

    const resultado = {
      sucesso: true,
      completo,
      carimbo: estado.carimbo,
      totalTabelas: estado.totalTabelas,
      processadasAteAgora: estado.processadas,
      restantes: estado.restantes.length,
      erros: estado.erros,
    };
    console.log(completo ? "Backup concluído:" : "Backup em andamento:", JSON.stringify(resultado));
    return new Response(JSON.stringify(resultado), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no backup:", e);
    return new Response(
      JSON.stringify({ sucesso: false, erro: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
