import { supabase } from '../lib/supabase';
import type { DocumentoEmitido, TipoDocumentoEmitido } from '../types/secretaria';

export async function emitirDocumento(
  tipo: TipoDocumentoEmitido,
  pessoaId: string,
  matriculaId: string | null,
  dadosSnapshot: Record<string, unknown>
): Promise<DocumentoEmitido> {
  const { data, error } = await supabase.rpc('rpc_emitir_documento', {
    p_tipo: tipo,
    p_pessoa_id: pessoaId,
    p_matricula_id: matriculaId,
    p_dados_snapshot: dadosSnapshot,
  });
  if (error) throw error;
  return data as DocumentoEmitido;
}

export async function listarDocumentosEmitidos(pessoaId: string): Promise<DocumentoEmitido[]> {
  const { data, error } = await supabase
    .from('documentos_emitidos')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('emitido_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const ROTULOS_TIPO: Record<TipoDocumentoEmitido, string> = {
  DECLARACAO_MATRICULA: 'Declaração de Matrícula',
  ATESTADO_FREQUENCIA: 'Atestado de Frequência',
  TRANSFERENCIA: 'Declaração de Transferência',
  HISTORICO_ESCOLAR: 'Histórico Escolar',
};

// Impressão client-side (window.print) — mesmo padrão já usado em printUtils.ts para
// os demais documentos do Portal, em vez de gerar o PDF numa Edge Function. O número
// e o snapshot já foram reservados/gravados no servidor por rpc_emitir_documento antes
// desta função ser chamada; isto aqui só formata o papel para impressão/"salvar como PDF".
export function imprimirDocumentoEmitido(doc: DocumentoEmitido) {
  const snapshot = doc.dados_snapshot as Record<string, string | number | undefined>;
  const now = new Date();
  const dataEmissao = new Date(doc.emitido_em).toLocaleDateString('pt-BR');

  const corpo =
    doc.tipo === 'ATESTADO_FREQUENCIA'
      ? `Atestamos, para os devidos fins, que <strong>${snapshot.pessoa_nome ?? ''}</strong>` +
        (snapshot.pessoa_cpf ? `, CPF ${snapshot.pessoa_cpf},` : '') +
        ` está regularmente matriculado(a) nesta unidade escolar, no ano letivo de ${snapshot.ano_letivo ?? ''}` +
        (snapshot.serie_nome ? `, cursando ${snapshot.serie_nome}` : '') +
        (snapshot.turno ? ` no turno ${snapshot.turno}` : '') +
        `.`
      : `Declaramos, para os devidos fins, que <strong>${snapshot.pessoa_nome ?? ''}</strong>` +
        (snapshot.pessoa_cpf ? `, CPF ${snapshot.pessoa_cpf},` : '') +
        ` encontra-se matriculado(a) nesta unidade escolar, no ano letivo de ${snapshot.ano_letivo ?? ''}` +
        (snapshot.serie_nome ? `, na série/etapa ${snapshot.serie_nome}` : '') +
        (snapshot.turno ? `, turno ${snapshot.turno}` : '') +
        `.`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${ROTULOS_TIPO[doc.tipo]} nº ${doc.numero}/${doc.ano}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 13px; color: #111; padding: 40px; }
  .cabecalho { text-align: center; border-bottom: 2px solid #002677; padding-bottom: 12px; margin-bottom: 30px; }
  .escola { font-size: 15px; font-weight: bold; color: #002677; text-transform: uppercase; }
  .titulo { font-size: 14px; font-weight: bold; margin-top: 20px; text-align: center; text-transform: uppercase; }
  .numero { text-align: center; font-size: 11px; color: #555; margin-top: 4px; }
  .corpo { margin-top: 30px; line-height: 1.8; text-align: justify; }
  .assinatura { margin-top: 80px; text-align: center; }
  .linha-assinatura { border-top: 1px solid #111; width: 300px; margin: 0 auto; padding-top: 6px; }
  .rodape { margin-top: 60px; font-size: 9px; color: #888; text-align: center; }
  @media print { @page { margin: 25mm; size: A4; } }
</style>
</head>
<body>
  <div class="cabecalho">
    <div class="escola">Escola José Barbosa Rodrigues — Rede Estadual SED-MS</div>
    <div>Campo Grande/MS</div>
  </div>

  <div class="titulo">${ROTULOS_TIPO[doc.tipo]}</div>
  <div class="numero">Nº ${doc.numero}/${doc.ano}</div>

  <div class="corpo">${corpo}</div>

  <p style="margin-top: 30px;">Campo Grande/MS, ${dataEmissao}.</p>

  <div class="assinatura">
    <div class="linha-assinatura">Secretaria Escolar</div>
  </div>

  <div class="rodape">
    Documento emitido eletronicamente pelo Portal do Professor JBR em ${now.toLocaleString('pt-BR')}.
    Este documento não substitui os sistemas oficiais da SED-MS/Educacenso.
  </div>

  <script>
    window.onload = function () { window.print(); setTimeout(function () { window.close(); }, 500); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Permita pop-ups para este site para poder imprimir.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
