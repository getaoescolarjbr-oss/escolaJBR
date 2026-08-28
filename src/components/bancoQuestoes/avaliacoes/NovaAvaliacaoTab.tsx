import { useMemo, useState } from 'react';
import type { Question } from '../../../types/bancoQuestoes';
import type { NovaAvaliacaoInput } from '../../../types/avaliacoes';
import { QuestionPicker } from '../QuestionPicker';
import { ConfigAvaliacaoForm } from './ConfigAvaliacaoForm';
import { AvaliacaoPreviewModal } from './AvaliacaoPreviewModal';

type Passo = 'questoes' | 'config' | 'preview';

interface Props {
  onAvaliacaoSalva: () => void;
}

// Wizard de 3 passos do gerador: 1. escolher questões no banco (QuestionPicker, com contador
// visível) 2. configurar valor/turma/modo (ConfigAvaliacaoForm) 3. revisar, imprimir e/ou
// publicar (AvaliacaoPreviewModal, que persiste no banco).
export function NovaAvaliacaoTab({ onAvaliacaoSalva }: Props) {
  const [passo, setPasso] = useState<Passo>('questoes');
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [config, setConfig] = useState<Omit<NovaAvaliacaoInput, 'questoes'> | null>(null);
  const [valoresPorQuestao, setValoresPorQuestao] = useState<Record<string, number>>({});
  const [turmaNomes, setTurmaNomes] = useState<string[]>([]);
  const [questoesOrdenadas, setQuestoesOrdenadas] = useState<Question[]>([]);

  function toggleSelecionar(q: Question) {
    setSelecionadas((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  const questoesSelecionadas = useMemo(() => Array.from(selecionadas.values()), [selecionadas]);

  function resetar() {
    setSelecionadas(new Map());
    setConfig(null);
    setValoresPorQuestao({});
    setTurmaNomes([]);
    setPasso('questoes');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {(['questoes', 'config', 'preview'] as Passo[]).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                passo === p ? 'bg-ms-blue text-white' : 'bg-ms-dark border border-gray-800 text-ms-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={passo === p ? 'text-ms-main font-bold' : 'text-ms-muted'}>
              {p === 'questoes' ? 'Questões' : p === 'config' ? 'Configuração' : 'Revisão'}
            </span>
            {i < 2 && <span className="text-ms-muted">→</span>}
          </div>
        ))}
      </div>

      {passo === 'questoes' && (
        <div className="space-y-6">
          <QuestionPicker
            selecionadas={selecionadas}
            onToggleSelecionar={toggleSelecionar}
            onContinuar={() => setPasso('config')}
          />
          <div className="flex justify-end">
            <button
              disabled={questoesSelecionadas.length === 0}
              onClick={() => setPasso('config')}
              className="px-5 py-2.5 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              Continuar com {questoesSelecionadas.length} questão(ões)
            </button>
          </div>
        </div>
      )}

      {passo === 'config' && (
        <ConfigAvaliacaoForm
          questoes={questoesSelecionadas}
          onVoltar={() => setPasso('questoes')}
          onContinuar={(cfg, valores, nomes, ordenadas) => {
            setConfig(cfg);
            setValoresPorQuestao(valores);
            setTurmaNomes(nomes);
            setQuestoesOrdenadas(ordenadas);
            setPasso('preview');
          }}
        />
      )}

      {passo === 'preview' && config && (
        <AvaliacaoPreviewModal
          config={config}
          questoes={questoesOrdenadas}
          valoresPorQuestao={valoresPorQuestao}
          turmaNomes={turmaNomes}
          onVoltar={() => setPasso('config')}
          onSalvo={() => {
            resetar();
            onAvaliacaoSalva();
          }}
        />
      )}
    </div>
  );
}
