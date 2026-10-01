import { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { CadastroServidorPendente } from '../../services/cadastroServidorService';
import { gerarHtmlTermoConvocado } from '../../utils/termoConvocado';
import { dadosTermoDoCadastro } from '../../utils/termoDoCadastro';

interface Props {
  cadastro: CadastroServidorPendente;
  onFechar: () => void;
}

// Termo de convocado montado com os dados do cadastro em análise, para conferir e imprimir (ou
// salvar em PDF) antes mesmo de aprovar. Igual ao termo da aba Termos: mesma formatação em A4.
export function TermoCadastroModal({ cadastro, onFechar }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => gerarHtmlTermoConvocado(dadosTermoDoCadastro(cadastro)), [cadastro]);

  function imprimir() {
    const janela = iframeRef.current?.contentWindow;
    janela?.focus();
    janela?.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-800">
          <p className="text-sm font-bold text-ms-main truncate">Termo de convocado — {cadastro.nome}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={imprimir} className="flex items-center gap-2 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600">
              <Printer className="w-4 h-4" /> Imprimir / salvar PDF
            </button>
            <button onClick={onFechar} className="p-1.5 text-gray-400 hover:text-gray-200" aria-label="Fechar"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <p className="px-5 pt-3 text-[11px] text-gray-500">
          Campos em branco são da convocação e ainda não foram preenchidos: complete em "Dados da convocação" e salve para atualizar o termo.
        </p>
        <div className="overflow-auto p-4 bg-gray-300 m-4 rounded-xl" style={{ height: 'min(70vh, 800px)' }}>
          <div style={{ width: 794 * 0.78, height: 2290 * 0.78, margin: '0 auto' }}>
            <iframe
              ref={iframeRef}
              title="Prévia do termo"
              srcDoc={html}
              style={{ width: '794px', height: '2290px', border: 0, display: 'block', transform: 'scale(0.78)', transformOrigin: 'top left' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
