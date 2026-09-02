import { useRef, useState } from 'react';
import { Check, Copy, Loader2, Printer, Save, Send, X } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { NovaAvaliacaoInput } from '../../../types/avaliacoes';
import { PROVA_LAYOUT_CSS, PROVA_QUESTOES_CSS, entraNoCartaoResposta, printProva } from '../../../utils/printProva';
import { criarAvaliacao, linkPublicoSimulado, obterAvaliacao } from '../../../services/avaliacoesService';
import { QuestaoImpressa } from '../QuestaoImpressa';

interface Props {
  config: Omit<NovaAvaliacaoInput, 'questoes'>;
  questoes: Question[];
  valoresPorQuestao: Record<string, number>;
  turmaNomes: string[];
  onVoltar: () => void;
  onSalvo: () => void;
}

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

// Passo 3 do gerador: preview idêntico ao GerarProvaModal (mesmo printProva.ts), mas agora
// persistindo a avaliação no banco antes de imprimir/publicar em vez de ser só um documento
// avulso.
export function AvaliacaoPreviewModal({ config, questoes, valoresPorQuestao, turmaNomes, onVoltar, onSalvo }: Props) {
  const [posicaoCartao, setPosicaoCartao] = useState<'inicio' | 'fim'>('fim');
  const [colunas, setColunas] = useState<1 | 2>(2);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkSimulado, setLinkSimulado] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const conteudos = Array.from(new Set(questoes.map((q) => q.assunto).filter((a): a is string => !!a))).join(', ');
  const dataFormatada = config.dataAplicacao
    ? new Date(config.dataAplicacao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '____/____/______';

  const questoesInput = questoes.map((q, i) => ({ question_id: q.id, ordem: i, valor: valoresPorQuestao[q.id] ?? 0 }));

  async function salvar(status: 'RASCUNHO' | 'PUBLICADA', imprimirDepois: boolean) {
    setSalvando(true);
    setErro(null);
    try {
      const avaliacaoId = await criarAvaliacao({ ...config, questoes: questoesInput }, status);
      if (imprimirDepois) printProva(previewRef.current, config.titulo || 'Avaliação');

      // Simulado publicado: mostra o link público (com o código SGDE) antes de fechar,
      // em vez de já voltar pra lista — é o que o professor precisa copiar/compartilhar.
      if (config.tipo === 'SIMULADO' && status === 'PUBLICADA') {
        const salvo = await obterAvaliacao(avaliacaoId);
        if (salvo) {
          setLinkSimulado(linkPublicoSimulado(salvo.token_publico));
          return;
        }
      }
      onSalvo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null);
      setErro(msg || 'Não foi possível salvar a avaliação.');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarLink() {
    if (!linkSimulado) return;
    await navigator.clipboard.writeText(linkSimulado);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  // Dissertativa/redação não tem bolha; a numeração do cartão segue a da prova.
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

  if (linkSimulado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-ms-main">Simulado publicado!</h2>
          <p className="text-sm text-ms-muted">
            Compartilhe este link com os alunos. Eles vão digitar o código SGDE para ter nome, turma e série
            preenchidos automaticamente — sem precisar fazer login. Este simulado não gera nota no boletim.
          </p>
          <div className="flex items-center gap-2 bg-ms-dark border border-gray-800 rounded-lg px-3 py-2">
            <input readOnly value={linkSimulado} className="flex-1 bg-transparent text-sm text-ms-main outline-none" onFocus={(e) => e.target.select()} />
            <button onClick={copiarLink} className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 shrink-0">
              {linkCopiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {linkCopiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="flex justify-end">
            <button onClick={onSalvo} className="px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
              Concluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <h2 className="text-lg font-bold text-ms-main">Revisar avaliação ({questoes.length} questões)</h2>
          <button onClick={onVoltar} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
            <div>
              <label className="text-xs font-bold text-ms-muted">Cartão resposta</label>
              <select
                className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                value={posicaoCartao}
                onChange={(e) => setPosicaoCartao(e.target.value as 'inicio' | 'fim')}
              >
                <option value="inicio">No início</option>
                <option value="fim">No final</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-ms-muted">Colunas das questões</label>
              <select
                className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                value={colunas}
                onChange={(e) => setColunas(Number(e.target.value) as 1 | 2)}
              >
                <option value={1}>1 coluna</option>
                <option value={2}>2 colunas</option>
              </select>
            </div>
          </div>

          <div className="border border-gray-800 rounded-xl p-4 bg-white overflow-x-auto">
            {/* Mesmo CSS da impressão — ver printProva.ts. Esta cópia já foi um
                bloco solto e divergiu do que saía no papel. */}
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
                  <div className="prova-titulo">{config.titulo || 'Avaliação'}</div>
                  {config.disciplina && <div className="prova-meta">Disciplina: {config.disciplina}</div>}
                  {conteudos && <div className="prova-meta">Conteúdo(s): {conteudos}</div>}
                  <div className="prova-aluno">
                    <span>Nome: ______________________________________________</span>
                    <span>Turma: {turmaNomes.join(', ') || '__________'}</span>
                    <span>Data: {dataFormatada}</span>
                  </div>
                </div>
                <div className="prova-nota-box">
                  <span className="prova-nota-label">Nota</span>
                </div>
              </div>

              {config.instrucoes && <div className="prova-instrucoes">{config.instrucoes}</div>}

              {posicaoCartao === 'inicio' && cartaoResposta}

              <div className={`questoes-coluna${colunas === 2 ? ' duas-colunas' : ''}`}>
                {questoes.map((q, i) => (
                  <QuestaoImpressa key={q.id} questao={q} indice={i} valor={valoresPorQuestao[q.id] ?? 0} />
                ))}
              </div>

              {posicaoCartao === 'fim' && cartaoResposta}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800 no-print">
          <div>
            {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onVoltar} disabled={salvando} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800 disabled:opacity-40">
              Voltar
            </button>
            <button
              onClick={() => salvar('RASCUNHO', false)}
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-40"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar rascunho
            </button>
            {(config.modo === 'IMPRESSA' || config.modo === 'AMBAS') && (
              <button
                onClick={() => salvar(config.modo === 'IMPRESSA' ? 'PUBLICADA' : 'PUBLICADA', true)}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-40"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Salvar e imprimir
              </button>
            )}
            <button
              onClick={() => salvar('PUBLICADA', false)}
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar e publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
