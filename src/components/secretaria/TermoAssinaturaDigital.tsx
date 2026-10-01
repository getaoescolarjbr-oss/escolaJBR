import { useRef, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { enviarDocumento } from '../../services/documentosPessoaService';

interface Props {
  pessoaId: string;
  onEnviado: () => void;
}

// SHA-256 do arquivo em hexadecimal: prova de que o PDF guardado é o mesmo que foi assinado.
async function sha256(arquivo: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Assinatura digital gratuita do termo: o servidor assina o PDF com a conta gov.br (assinatura
// eletrônica avançada) e a Secretaria guarda o PDF assinado na ficha, com o hash SHA-256 e a
// data da conferência no validador do ITI. O papel continua disponível como alternativa.
export function TermoAssinaturaDigital({ pessoaId, onEnviado }: Props) {
  const { usuarioId } = useAuth();
  const [conferido, setConferido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo || !usuarioId) return;
    if (arquivo.type !== 'application/pdf') { setErro('Anexe o PDF assinado (não foto nem imagem).'); return; }
    setEnviando(true);
    setErro(null);
    try {
      const hash = await sha256(arquivo);
      const hoje = new Date().toLocaleDateString('pt-BR');
      await enviarDocumento(pessoaId, 'TERMO_CONVOCACAO_ASSINADO', arquivo, usuarioId,
        `Assinado digitalmente (gov.br) — conferido no validador do ITI em ${hoje} — SHA-256: ${hash}`);
      setConferido(false);
      onEnviado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar o termo assinado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-ms-card border border-gray-800 rounded-2xl p-4 space-y-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ms-main"><ShieldCheck className="w-4 h-4 text-ms-blueText" /> Assinatura digital (gov.br)</p>
      <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-300">
        <li>Clique em <b>Imprimir termo</b> e, na janela de impressão, escolha <b>Salvar como PDF</b>.</li>
        <li>Envie o PDF ao servidor. Ele assina com a conta gov.br (nível prata ou ouro) em{' '}
          <a href="https://www.gov.br/pt-br/servicos/assinatura-eletronica" target="_blank" rel="noreferrer" className="text-ms-blueText underline inline-flex items-center gap-0.5">assinatura eletrônica gov.br<ExternalLink className="w-3 h-3" /></a>.</li>
        <li>Confira o PDF assinado em{' '}
          <a href="https://validar.iti.gov.br" target="_blank" rel="noreferrer" className="text-ms-blueText underline inline-flex items-center gap-0.5">validar.iti.gov.br<ExternalLink className="w-3 h-3" /></a>{' '}
          e anexe aqui.</li>
      </ol>
      <p className="text-[11px] text-amber-400">
        Confirme com a SED/DRE se a assinatura gov.br é aceita neste termo antes de dispensar o papel. Em dúvida, use a assinatura em papel.
      </p>
      <label className="flex items-start gap-2 text-xs text-ms-main cursor-pointer">
        <input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)} className="mt-0.5 accent-green-600" />
        Conferi a assinatura do PDF no validador do ITI e ela é válida.
      </label>
      <button onClick={() => arquivoRef.current?.click()} disabled={!conferido || enviando}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40">
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Anexar PDF assinado
      </button>
      <input ref={arquivoRef} type="file" accept="application/pdf" className="hidden" onChange={aoEscolher} />
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
