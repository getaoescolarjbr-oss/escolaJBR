import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Avaliacao, NovaAvaliacaoInput } from '../../../types/avaliacoes';
import type { Question } from '../../../types/bancoQuestoes';
import { QuestionPicker } from '../QuestionPicker';
import { ConfigAvaliacaoForm } from './ConfigAvaliacaoForm';
import { atualizarAvaliacao, contarFolhasGeradas, contarRespostasEnviadas, obterQuestoesCompletasDaAvaliacao } from '../../../services/avaliacoesService';

type Passo = 'questoes' | 'config';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
  onSalvo: () => void;
}

// Edita uma avaliação/simulado já salvo (rascunho, publicado ou até encerrado): reabre o
// mesmo wizard de questões + configuração do fluxo de criação (NovaAvaliacaoTab), só que
// pré-preenchido e persistindo com atualizarAvaliacao (update) em vez de criarAvaliacao
// (insert). Se algum aluno já enviou resposta, mostra um aviso antes de deixar salvar —
// mudar questão/gabarito depois de respostas registradas pode deixar o resultado já
// calculado fora de sincronia com a nova versão.
export function EditarAvaliacaoModal({ avaliacao, onClose, onSalvo }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [passo, setPasso] = useState<Passo>('questoes');
  const [selecionadas, setSelecionadas] = useState<Map<string, Question>>(new Map());
  const [valoresIniciais, setValoresIniciais] = useState<Record<string, number>>({});
  const [respostasEnviadas, setRespostasEnviadas] = useState(0);
  const [folhasGeradas, setFolhasGeradas] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      obterQuestoesCompletasDaAvaliacao(avaliacao.id),
      contarRespostasEnviadas(avaliacao.id),
      contarFolhasGeradas(avaliacao.id),
    ])
      .then(([{ questoes, valoresPorQuestao }, respostas, folhas]) => {
        setSelecionadas(new Map(questoes.map((q) => [q.id, q])));
        setValoresIniciais(valoresPorQuestao);
        setRespostasEnviadas(respostas);
        setFolhasGeradas(folhas);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar a avaliação.'))
      .finally(() => setCarregando(false));
  }, [avaliacao.id]);

  function toggleSelecionar(q: Question) {
    setSelecionadas((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  const questoesSelecionadas = useMemo(() => Array.from(selecionadas.values()), [selecionadas]);
  const rotulo = avaliacao.tipo === 'SIMULADO' ? 'simulado' : 'avaliação';

  async function salvar(config: Omit<NovaAvaliacaoInput, 'questoes'>, valoresPorQuestao: Record<string, number>, questoesOrdenadas: Question[]) {
    if (respostasEnviadas > 0) {
      const ok = confirm(
        `${respostasEnviadas} aluno(s) já enviaram resposta para este(a) ${rotulo}. ` +
        'Alterar as questões, a ordem, o gabarito ou os valores agora pode deixar os resultados já registrados fora de sincronia com a nova versão. Deseja salvar mesmo assim?'
      );
      if (!ok) return;
    }
    if (folhasGeradas > 0 && respostasEnviadas === 0) {
      const ok = confirm(
        `Já existem ${folhasGeradas} folha(s) com QR Code geradas para este(a) ${rotulo}. ` +
        'Salvar descarta as versões sorteadas: quem já tiver a folha impressa em mãos vai precisar de uma nova, ' +
        'porque a ordem das questões e o código do QR mudam. Continuar?'
      );
      if (!ok) return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      const questoesInput = questoesOrdenadas.map((q, i) => ({ question_id: q.id, ordem: i, valor: valoresPorQuestao[q.id] ?? 0 }));
      await atualizarAvaliacao(avaliacao.id, { ...config, questoes: questoesInput }, avaliacao.status);
      onSalvo();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Editar — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.status === 'PUBLICADA' ? 'Publicada' : avaliacao.status === 'ENCERRADA' ? 'Encerrada' : 'Rascunho'}
              {' · '}Passo {passo === 'questoes' ? '1' : '2'} de 2
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {carregando && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 my-12" />}

          {!carregando && !erro && respostasEnviadas > 0 && (
            <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                <strong>{respostasEnviadas} aluno(s)</strong> já enviaram resposta para {rotulo === 'simulado' ? 'este simulado' : 'esta avaliação'}.
                Alterar questões, gabarito ou valores agora pode deixar os resultados já registrados fora de sincronia com a nova versão.
              </p>
            </div>
          )}

          {!carregando && !erro && passo === 'questoes' && (
            <div className="space-y-6">
              <QuestionPicker selecionadas={selecionadas} onToggleSelecionar={toggleSelecionar} onContinuar={() => setPasso('config')} />
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

          {!carregando && !erro && passo === 'config' && (
            <>
              {erroSalvar && <p className="text-sm text-red-400 font-bold">{erroSalvar}</p>}
              <ConfigAvaliacaoForm
                questoes={questoesSelecionadas}
                inicial={{
                  titulo: avaliacao.titulo,
                  disciplinaId: avaliacao.disciplina_id,
                  bimestreId: avaliacao.bimestre_id,
                  instrucoes: avaliacao.instrucoes ?? '',
                  valorTotal: avaliacao.valor_total,
                  valoresPorQuestao: valoresIniciais,
                  tipo: avaliacao.tipo,
                  modo: avaliacao.modo,
                  dataAplicacao: avaliacao.data_aplicacao,
                  prazoEntrega: avaliacao.prazo_entrega,
                  turmaIds: avaliacao.turma_ids ?? [],
                  embaralhar: avaliacao.embaralhar,
                  qtdVersoes: avaliacao.qtd_versoes,
                  cartaoSeparado: avaliacao.cartao_separado,
                  modoNota: avaliacao.modo_nota,
                  ponderadaEscopo: avaliacao.ponderada_escopo,
                  lancarNoBoletim: avaliacao.lancar_no_boletim,
                }}
                salvando={salvando}
                textoBotaoContinuar="Salvar alterações"
                onVoltar={() => setPasso('questoes')}
                onContinuar={(cfg, valores, _nomes, ordenadas) => salvar(cfg, valores, ordenadas)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
