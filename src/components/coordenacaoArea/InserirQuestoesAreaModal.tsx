import { useEffect, useState } from 'react';
import { Loader2, X, Check, AlertCircle } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import type { AvaliacaoArea, ProvaAreaCota } from '../../types/avaliacoes';
import { QuestionPicker } from '../bancoQuestoes/QuestionPicker';
import { inserirQuestoesCotaArea, obterQuestoesCotaArea } from '../../services/avaliacoesService';
import { buscarQuestoesPorIds } from '../../services/bancoQuestoesService';

interface Props {
  avaliacao: AvaliacaoArea;
  cota: ProvaAreaCota;
  onClose: () => void;
  onSalvo: () => void;
}

export function InserirQuestoesAreaModal({ avaliacao, cota, onClose, onSalvo }: Props) {
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [valores, setValores] = useState<Record<string, number>>({});
  const [carregandoAtuais, setCarregandoAtuais] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pré-carrega o que este professor (ou o coordenador em nome dele) já gravou pra essa
  // disciplina — sem isso o modal sempre abria vazio e reenviar apagava o que já tinha,
  // porque salvar substitui por completo a seleção da disciplina.
  useEffect(() => {
    let cancelado = false;
    obterQuestoesCotaArea(avaliacao.id, cota.disciplina_id)
      .then(async (linhas) => {
        if (linhas.length === 0) return;
        const questoes = await buscarQuestoesPorIds(linhas.map((l) => l.question_id));
        if (cancelado) return;
        const porId = new Map(questoes.map((q) => [q.id, q]));
        const mapa = new Map<string, Question>();
        const valoresIniciais: Record<string, number> = {};
        for (const l of linhas) {
          const q = porId.get(l.question_id);
          if (!q) continue;
          mapa.set(q.id, q);
          valoresIniciais[q.id] = Number(l.valor) || 1.0;
        }
        setSelecionadas(mapa);
        setValores(valoresIniciais);
      })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCarregandoAtuais(false); });
    return () => { cancelado = true; };
  }, [avaliacao.id, cota.disciplina_id]);

  function toggleSelecionar(q: Question) {
    setSelecionadas((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) {
        next.delete(q.id);
      } else {
        if (next.size >= cota.qtd_questoes) {
          alert(`Você já atingiu a cota de ${cota.qtd_questoes} questão(ões) estipulada para esta disciplina.`);
          return prev;
        }
        next.set(q.id, q);
      }
      return next;
    });
  }

  const qtdSelecionada = selecionadas.size;
  const cotaAtingida = qtdSelecionada === cota.qtd_questoes;

  const bloqueada = avaliacao.edicao_permitida === false;

  // A cota só guarda quantas questões cada disciplina contribui (qtd_questoes) — nada divide
  // o valor_total da avaliação entre elas, então toda questão inserida sem valor próprio caía
  // pra 1.0 fixo e a prova acabava valendo "nº de questões" pontos em vez do valor_total
  // configurado. Divide o valor_total igualmente pelo total de questões PLANEJADO em todas as
  // cotas da área (soma de qtd_questoes) — estável entre disciplinas, independente da ordem em
  // que cada professor insere as suas.
  const totalQuestoesPlanejado = (avaliacao.cotas ?? []).reduce((soma, c) => soma + c.qtd_questoes, 0);
  const valorPorQuestaoPadrao = totalQuestoesPlanejado > 0 ? avaliacao.valor_total / totalQuestoesPlanejado : 1.0;

  async function handleSalvar() {
    if (bloqueada) return;
    if (qtdSelecionada === 0) {
      setErro('Selecione pelo menos uma questão.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const questoesPayload = Array.from(selecionadas.values()).map((q) => ({
        question_id: q.id,
        valor: valores[q.id] ?? valorPorQuestaoPadrao,
      }));

      await inserirQuestoesCotaArea(avaliacao.id, cota.disciplina_id, questoesPayload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message || 'Erro ao inserir questões na avaliação da área.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">
              {cota.qtd_inserida > 0 ? 'Editar Questões' : 'Inserir Questões'} — {cota.disciplina_nome || 'Disciplina'}
            </h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.titulo} · Cota estipulada pelo coordenador:{' '}
              <strong className="text-ms-blueText">{cota.qtd_questoes} questão(ões)</strong> ({qtdSelecionada} selecionada(s))
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {bloqueada && (
            <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800 text-amber-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                A edição de questões desta avaliação está bloqueada pelo coordenador
                {avaliacao.prazo_edicao_area ? ` (prazo: ${new Date(avaliacao.prazo_edicao_area).toLocaleString('pt-BR')})` : ''}.
                Você pode conferir a seleção, mas não é possível salvar.
              </span>
            </div>
          )}
          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
          {carregandoAtuais && (
            <div className="flex items-center gap-2 text-xs text-ms-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando questões já salvas...
            </div>
          )}

          <div className="flex items-center justify-between bg-ms-dark p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ms-muted">Progresso da cota:</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  cotaAtingida
                    ? 'bg-emerald-700/30 text-emerald-300'
                    : 'bg-amber-700/30 text-amber-300'
                }`}
              >
                {qtdSelecionada} de {cota.qtd_questoes} selecionadas
              </span>
              <span className="text-xs text-ms-muted">
                · vale {valorPorQuestaoPadrao.toFixed(2)} pt cada (avaliação vale {avaliacao.valor_total.toFixed(2)} ÷{' '}
                {totalQuestoesPlanejado} questões no total)
              </span>
            </div>
            {cotaAtingida && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Cota preenchida!
              </span>
            )}
          </div>

          <QuestionPicker
            selecionadas={selecionadas}
            onToggleSelecionar={toggleSelecionar}
            disciplinaPadrao={cota.disciplina_nome}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-ms-card">
          <div className="text-xs text-ms-muted">
            {qtdSelecionada} de {cota.qtd_questoes} questão(ões) selecionada(s)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando || qtdSelecionada === 0 || bloqueada}
              onClick={handleSalvar}
              title={bloqueada ? 'Edição bloqueada pelo coordenador' : undefined}
              className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Gravar Questões na Avaliação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
