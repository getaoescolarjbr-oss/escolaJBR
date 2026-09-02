import { useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import { PROVA_LAYOUT_CSS, PROVA_QUESTOES_CSS, entraNoCartaoResposta, printProva } from '../../utils/printProva';
import { QuestaoImpressa } from './QuestaoImpressa';

interface Props {
  questoes: Question[];
  onClose: () => void;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

export function GerarProvaModal({ questoes, onClose }: Props) {
  const [titulo, setTitulo] = useState('Prova');
  const [disciplina, setDisciplina] = useState(() =>
    Array.from(new Set(questoes.map((q) => q.discipline))).join(', ')
  );
  const [turma, setTurma] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [instrucoes, setInstrucoes] = useState('Leia atentamente cada questão antes de responder. Use caneta azul ou preta.');
  const [posicaoCartao, setPosicaoCartao] = useState<'inicio' | 'fim'>('fim');
  const [colunas, setColunas] = useState<1 | 2>(2);
  const previewRef = useRef<HTMLDivElement>(null);

  const conteudos = Array.from(new Set(questoes.map((q) => q.assunto).filter((a): a is string => !!a))).join(', ');

  const dataFormatada = data
    ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  function imprimir() {
    printProva(previewRef.current, titulo || 'Prova');
  }

  // Dissertativa/redação não tem bolha pra marcar, mas a numeração do cartão
  // continua sendo a da prova (por isso o número vem do índice original).
  const itensCartao = questoes.map((q, i) => ({ q, numero: i + 1 })).filter(({ q }) => entraNoCartaoResposta(q));

  const cartaoResposta = itensCartao.length === 0 ? null : (
    <div className="cartao-resposta">
      <div className="cartao-titulo">Cartão resposta</div>
      <div className="cartao-grid">
        {itensCartao.map(({ q, numero }) => (
          <div className="cartao-item" key={q.id}>
            <span className="cartao-num">{numero}.</span>
            <div className="cartao-bolhas">
              {LETRAS.slice(0, q.alternatives.length).map((letra) => (
                <span className="bolha" key={letra}>{letra}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <h2 className="text-lg font-bold text-ms-main">Gerar prova/simulado ({questoes.length} questões)</h2>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
            <div>
              <label className="text-xs font-bold text-ms-muted">Título</label>
              <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Prova / Simulado" />
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Disciplina</label>
              <input className={inputClass} value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="Ex: Matemática" />
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Turma</label>
              <input className={inputClass} value={turma} onChange={(e) => setTurma(e.target.value)} placeholder="Ex: 9º ano B" />
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Data</label>
              <input type="date" className={inputClass} value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Cartão resposta</label>
              <select className={inputClass} value={posicaoCartao} onChange={(e) => setPosicaoCartao(e.target.value as 'inicio' | 'fim')}>
                <option value="inicio">No início</option>
                <option value="fim">No final</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Colunas das questões</label>
              <select className={inputClass} value={colunas} onChange={(e) => setColunas(Number(e.target.value) as 1 | 2)}>
                <option value={1}>1 coluna</option>
                <option value={2}>2 colunas</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold text-ms-muted">Instruções (opcional)</label>
              <textarea className={inputClass} rows={2} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} />
            </div>
          </div>

          <div className="border border-gray-800 rounded-xl p-4 bg-white overflow-x-auto">
            {/* Mesmo CSS da impressão, pra este preview mostrar o que de fato
                sai no papel — inclusive o limite de tamanho das figuras. */}
            <style>{PROVA_LAYOUT_CSS}</style>
            <style>{PROVA_QUESTOES_CSS}</style>
            <div ref={previewRef} style={{ color: '#1a1a2e', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11pt' }}>
              <div className="prova-header" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', gap: 12 }}>
                <img
                  src={`${window.location.origin}/logo.png.png`}
                  alt="Logo da escola"
                  className="prova-logo"
                  style={{ height: '100%', width: 'auto', maxWidth: 110, objectFit: 'contain', flexShrink: 0 }}
                />
                <div className="prova-header-info">
                  <div className="prova-escola">E.E. José Barbosa Rodrigues</div>
                  <div className="prova-titulo">{titulo || 'Prova'}</div>
                  {disciplina && <div className="prova-meta">Disciplina: {disciplina}</div>}
                  {conteudos && <div className="prova-meta">Conteúdo(s): {conteudos}</div>}
                  <div className="prova-aluno">
                    <span>Nome: ______________________________________________</span>
                    <span>Turma: {turma || '__________'}</span>
                    <span>Data: {dataFormatada}</span>
                  </div>
                </div>
                <div className="prova-nota-box">
                  <span className="prova-nota-label">Nota</span>
                </div>
              </div>

              {instrucoes && <div className="prova-instrucoes">{instrucoes}</div>}

              {posicaoCartao === 'inicio' && cartaoResposta}

              <div className={`questoes-coluna${colunas === 2 ? ' duas-colunas' : ''}`}>
                {questoes.map((q, i) => (
                  <QuestaoImpressa key={q.id} questao={q} indice={i} />
                ))}
              </div>

              {posicaoCartao === 'fim' && cartaoResposta}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 no-print">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800">
            Fechar
          </button>
          <button onClick={imprimir} className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
