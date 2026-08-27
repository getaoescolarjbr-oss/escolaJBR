import { useMemo, useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import { QuestionPicker } from './QuestionPicker';
import { buildFonte } from '../../lib/questionMarkup';
import { GerarProvaModal } from './GerarProvaModal';

export function QuestoesTab() {
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [copiado, setCopiado] = useState(false);
  const [gerarProvaAberto, setGerarProvaAberto] = useState(false);

  function toggleSelecionar(q: Question) {
    setSelecionadas((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  const questoesSelecionadas = useMemo(() => Array.from(selecionadas.values()), [selecionadas]);

  async function copiarSelecionadas() {
    const texto = questoesSelecionadas
      .map((q, i) => {
        const alternativas = q.alternatives.map((a) => `${a.letter}) ${a.text.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}`).join('\n');
        return `${i + 1}. ${q.statement.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}\n${alternativas}\n(Fonte: ${buildFonte(q)})\n`;
      })
      .join('\n');
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-6">
      {selecionadas.size > 0 && (
        <div className="flex items-center justify-end bg-ms-blue/10 border border-ms-blue/40 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={copiarSelecionadas} className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800">
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar selecionadas'}
            </button>
            <button onClick={() => setGerarProvaAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
              <FileText className="w-4 h-4" />
              Gerar prova/simulado
            </button>
          </div>
        </div>
      )}

      <QuestionPicker selecionadas={selecionadas} onToggleSelecionar={toggleSelecionar} />

      {gerarProvaAberto && (
        <GerarProvaModal questoes={questoesSelecionadas} onClose={() => setGerarProvaAberto(false)} />
      )}
    </div>
  );
}
