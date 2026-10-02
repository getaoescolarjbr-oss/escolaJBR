import { useMemo, useState } from 'react';
import { Copy, Check, FileText, ListPlus, ClipboardPlus } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import { ordenarAlternativas } from '../../types/bancoQuestoes';
import type { Avaliacao } from '../../types/avaliacoes';
import { QuestionPicker } from './QuestionPicker';
import { buildFonte } from '../../lib/questionMarkup';
import { GerarProvaModal } from './GerarProvaModal';
import { SalvarEmListaModal } from './SalvarEmListaModal';
import { AdicionarAAvaliacaoModal } from './AdicionarAAvaliacaoModal';
import { MinhasListasView } from './MinhasListasView';
import { EditarAvaliacaoModal } from './avaliacoes/EditarAvaliacaoModal';

type Modo = 'banco' | 'listas';

// Banco de questões (consulta). Marcar questões aqui não monta avaliação sozinho: a seleção
// alimenta ações — adicionar a uma avaliação em rascunho, guardar numa lista pessoal para usar
// depois, copiar o texto ou gerar uma prova/simulado impresso. As listas ficam em "Minhas listas".
export function QuestoesTab() {
  const [modo, setModo] = useState<Modo>('banco');
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [copiado, setCopiado] = useState(false);
  const [gerarProvaAberto, setGerarProvaAberto] = useState(false);
  const [salvarListaAberto, setSalvarListaAberto] = useState(false);
  const [escolhendoAvaliacao, setEscolhendoAvaliacao] = useState(false);
  const [avaliacaoDestino, setAvaliacaoDestino] = useState<Avaliacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [versaoListas, setVersaoListas] = useState(0);

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
        const alternativas = ordenarAlternativas(q.alternatives).map((a) => `${a.letter}) ${a.text.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}`).join('\n');
        return `${i + 1}. ${q.statement.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '')}\n${alternativas}\n(Fonte: ${buildFonte(q)})\n`;
      })
      .join('\n');
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const botaoSecundario = 'flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800';

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-ms-dark border border-gray-800 rounded-xl w-fit">
        {([['banco', 'Todas as questões'], ['listas', 'Minhas listas']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setModo(id)}
            aria-pressed={modo === id}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold ${modo === id ? 'bg-ms-blue text-white' : 'text-ms-muted hover:text-ms-main'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold">{aviso}</p>}

      {selecionadas.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-ms-blue/10 border border-ms-blueText/40 rounded-xl px-5 py-3">
          <p className="text-sm font-bold text-ms-main">
            {selecionadas.size} {selecionadas.size === 1 ? 'questão selecionada' : 'questões selecionadas'}
            <button onClick={() => setSelecionadas(new Map())} className="ml-3 text-xs font-bold text-ms-muted hover:text-ms-main underline">Limpar</button>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setAviso(null); setEscolhendoAvaliacao(true); }} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
              <ClipboardPlus className="w-4 h-4" />
              Adicionar a uma avaliação
            </button>
            <button onClick={() => { setAviso(null); setSalvarListaAberto(true); }} className={botaoSecundario}>
              <ListPlus className="w-4 h-4" />
              Salvar em lista
            </button>
            <button onClick={copiarSelecionadas} className={botaoSecundario}>
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={() => setGerarProvaAberto(true)} className={botaoSecundario}>
              <FileText className="w-4 h-4" />
              Gerar prova/simulado
            </button>
          </div>
        </div>
      )}

      {modo === 'banco' ? (
        <QuestionPicker selecionadas={selecionadas} onToggleSelecionar={toggleSelecionar} />
      ) : (
        <MinhasListasView selecionadas={selecionadas} onToggleSelecionar={toggleSelecionar} versao={versaoListas} />
      )}

      {gerarProvaAberto && (
        <GerarProvaModal questoes={questoesSelecionadas} onClose={() => setGerarProvaAberto(false)} />
      )}

      {salvarListaAberto && (
        <SalvarEmListaModal
          questionIds={questoesSelecionadas.map((q) => q.id)}
          onClose={() => setSalvarListaAberto(false)}
          onSalvo={(mensagem) => {
            setSalvarListaAberto(false);
            setSelecionadas(new Map());
            setVersaoListas((v) => v + 1);
            setAviso(mensagem);
          }}
        />
      )}

      {escolhendoAvaliacao && (
        <AdicionarAAvaliacaoModal
          quantidade={questoesSelecionadas.length}
          onClose={() => setEscolhendoAvaliacao(false)}
          onEscolher={(a) => { setEscolhendoAvaliacao(false); setAvaliacaoDestino(a); }}
        />
      )}

      {avaliacaoDestino && (
        <EditarAvaliacaoModal
          avaliacao={avaliacaoDestino}
          questoesExtras={questoesSelecionadas}
          onClose={() => setAvaliacaoDestino(null)}
          onSalvo={() => {
            setAvaliacaoDestino(null);
            setSelecionadas(new Map());
            setAviso(`Questões adicionadas à avaliação “${avaliacaoDestino.titulo}”.`);
          }}
        />
      )}
    </div>
  );
}
