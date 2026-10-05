import { useState } from 'react';
import { X } from 'lucide-react';
import type { NovaAvaliacaoInput } from '../../../types/avaliacoes';
import { criarAvaliacao } from '../../../services/avaliacoesService';
import { ConfigAvaliacaoForm } from './ConfigAvaliacaoForm';

interface Props {
  onClose: () => void;
  onCriada: () => void;
}

// Avaliação individual: primeiro cadastra e configura (título, valor, turmas, modo...) e salva
// como rascunho SEM questões; as questões entram depois, pelo botão "Inserir questões" da
// própria avaliação em Minhas Avaliações — mesmo modelo das avaliações de área.
export function NovaAvaliacaoModal({ onClose, onCriada }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(config: Omit<NovaAvaliacaoInput, 'questoes'>) {
    setSalvando(true);
    setErro(null);
    try {
      await criarAvaliacao({ ...config, questoes: [] }, 'RASCUNHO');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a avaliação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Nova avaliação individual</h2>
            <p className="text-xs text-ms-muted">Configure e salve. Depois é só clicar em “Inserir questões” na avaliação.</p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          <ConfigAvaliacaoForm
            questoes={[]}
            salvando={salvando}
            textoBotaoContinuar="Salvar avaliação"
            textoBotaoVoltar="Cancelar"
            onVoltar={onClose}
            onContinuar={(cfg) => salvar(cfg)}
          />
        </div>
      </div>
    </div>
  );
}
