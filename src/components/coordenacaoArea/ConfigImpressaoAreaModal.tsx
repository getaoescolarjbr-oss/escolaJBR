import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { AvaliacaoArea } from '../../types/avaliacoes';
import type { ModoEmbaralhar } from '../../types/correcaoOmr';
import { MODO_EMBARALHAR_LABEL } from '../../types/correcaoOmr';
import { definirImpressaoAvaliacaoArea } from '../../services/avaliacoesService';

interface Props {
  avaliacao: AvaliacaoArea;
  onClose: () => void;
  onSalvo: () => void;
}

const inputClass =
  'w-full mt-1 px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

// Separado da edição completa da avaliação porque embaralhamento/versões/cartão-resposta são
// só configuração de impressão — não mexem em cota, valor ou turma — então continuam
// ajustáveis mesmo depois de publicada (ver rpc_definir_impressao_avaliacao_area).
export function ConfigImpressaoAreaModal({ avaliacao, onClose, onSalvo }: Props) {
  const [embaralhar, setEmbaralhar] = useState<ModoEmbaralhar>((avaliacao.embaralhar as ModoEmbaralhar) ?? 'NENHUM');
  const [qtdVersoes, setQtdVersoes] = useState(avaliacao.qtd_versoes ?? 1);
  const [cartaoSeparado, setCartaoSeparado] = useState(avaliacao.cartao_separado ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      await definirImpressaoAvaliacaoArea(avaliacao.id, embaralhar, qtdVersoes, cartaoSeparado);
      onSalvo();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar configuração de impressão.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ms-main">Configurar impressão</h2>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-ms-muted">
          {avaliacao.titulo}. Depois de salvar, abra "Folhas com QR" e clique em "Sortear de novo" pra gerar as versões.
        </p>

        {erro && <p className="text-xs text-red-400 font-bold">{erro}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-ms-muted">Embaralhamento</label>
            <select className={inputClass} value={embaralhar} onChange={(e) => setEmbaralhar(e.target.value as ModoEmbaralhar)}>
              {(Object.keys(MODO_EMBARALHAR_LABEL) as ModoEmbaralhar[]).map((m) => (
                <option key={m} value={m}>{MODO_EMBARALHAR_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Versões da prova</label>
            <select className={inputClass} value={qtdVersoes} onChange={(e) => setQtdVersoes(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n} disabled={embaralhar !== 'NENHUM' && n < 2}>
                  {n === 1 ? 'Versão única (A)' : `${n} versões (A–${String.fromCharCode(64 + n)})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Cartão-resposta</label>
            <select className={inputClass} value={cartaoSeparado ? 'SEPARADO' : 'JUNTO'} onChange={(e) => setCartaoSeparado(e.target.value === 'SEPARADO')}>
              <option value="JUNTO">Junto, no fim da prova</option>
              <option value="SEPARADO">Em folha separada</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
