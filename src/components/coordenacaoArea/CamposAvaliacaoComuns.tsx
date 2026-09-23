import { useEffect, useState } from 'react';
import type { ModoAvaliacao, TipoAvaliacao } from '../../types/avaliacoes';
import type { ModoEmbaralhar } from '../../types/correcaoOmr';
import { MODO_EMBARALHAR_LABEL } from '../../types/correcaoOmr';
import { salvarInstrucoesPadrao } from '../../services/avaliacoesService';
import { contarAlunosAtivosTurmas } from '../../services/correcaoOmrService';

export type ModoVersoes = 'FIXO' | 'POR_ALUNO';
export type PosicaoCartao = 'INICIO' | 'FIM' | 'SEPARADO';

const POSICAO_CARTAO_LABEL: Record<PosicaoCartao, string> = {
  INICIO: 'Junto, antes das questões',
  FIM: 'Junto, no fim da prova',
  SEPARADO: 'Em folha separada',
};

export interface ValoresCamposAvaliacao {
  titulo: string;
  bimestre: number;
  tipo: TipoAvaliacao;
  modo: ModoAvaliacao;
  valorTotal: number;
  dataAplicacao: string;
  prazoEntrega: string;
  instrucoes: string;
  embaralhar: ModoEmbaralhar;
  qtdVersoes: number;
  modoVersoes: ModoVersoes;
  posicaoCartao: PosicaoCartao;
}

// Com embaralhamento, versão além da A sai diferente — então no mínimo 2 versões.
export function versoesEfetivas(v: ValoresCamposAvaliacao): number {
  return v.embaralhar === 'NENHUM' ? v.qtdVersoes : Math.max(2, v.qtdVersoes);
}

interface Props {
  valores: ValoresCamposAvaliacao;
  onChange: (patch: Partial<ValoresCamposAvaliacao>) => void;
  turmasSelecionadas: string[];
  onErro: (msg: string) => void;
  /** A Avaliação Geral troca o seletor "Tipo" pela escolha de modalidade. */
  mostrarTipo?: boolean;
}

// Campos compartilhados entre NovaAvaliacaoAreaModal e NovaAvaliacaoGeralModal.
export function CamposAvaliacaoComuns({ valores, onChange, turmasSelecionadas, onErro, mostrarTipo = true }: Props) {
  const { titulo, bimestre, tipo, modo, valorTotal, dataAplicacao, prazoEntrega, instrucoes, embaralhar, qtdVersoes, modoVersoes, posicaoCartao } = valores;
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [contandoAlunos, setContandoAlunos] = useState(false);

  async function handleSalvarInstrucoesPadrao() {
    setSalvandoPadrao(true);
    try {
      await salvarInstrucoesPadrao(instrucoes.trim());
    } catch (e: any) {
      onErro(e.message || 'Erro ao salvar instruções padrão.');
    } finally {
      setSalvandoPadrao(false);
    }
  }

  // "Uma versão por aluno": mesma regra do gerador de avaliação normal (ConfigAvaliacaoForm) —
  // sem embaralhar, versão além da A sai idêntica à original, então empurra pra QUESTOES ao
  // entrar nesse modo, sem travar o seletor.
  useEffect(() => {
    if (modoVersoes !== 'POR_ALUNO') return;
    if (embaralhar === 'NENHUM') onChange({ embaralhar: 'QUESTOES' });
    if (turmasSelecionadas.length === 0) { onChange({ qtdVersoes: 1 }); return; }
    setContandoAlunos(true);
    contarAlunosAtivosTurmas(turmasSelecionadas)
      .then((n) => onChange({ qtdVersoes: Math.max(1, n) }))
      .catch(() => {})
      .finally(() => setContandoAlunos(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoVersoes, turmasSelecionadas]);

  const versoes = versoesEfetivas(valores);

  return (
    <>
      {/* Informações Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-ms-muted mb-1">Título da Avaliação *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ms-muted mb-1">Bimestre (Vigente Automático)</label>
          <select
            value={bimestre}
            onChange={(e) => onChange({ bimestre: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm font-bold text-ms-main outline-none focus:ring-2 focus:ring-ms-blue cursor-pointer"
          >
            <option value={1}>1º Bimestre</option>
            <option value={2}>2º Bimestre</option>
            <option value={3}>3º Bimestre</option>
            <option value={4}>4º Bimestre</option>
          </select>
        </div>

        {mostrarTipo && (
          <div>
            <label className="block text-xs font-bold text-ms-muted mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => onChange({ tipo: e.target.value as TipoAvaliacao })}
              className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              <option value="AVALIACAO">Avaliação (gera nota no boletim)</option>
              <option value="SIMULADO">Simulado (sem nota no boletim)</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-ms-muted mb-1">Modo de Aplicação</label>
          <select
            value={modo}
            onChange={(e) => onChange({ modo: e.target.value as ModoAvaliacao })}
            className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          >
            <option value="IMPRESSA">Impressa</option>
            <option value="ONLINE">Online</option>
            <option value="AMBAS">Impressa e Online</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-ms-muted mb-1">Valor Total (Pontos)</label>
          <input
            type="number"
            step="0.5"
            value={valorTotal}
            onChange={(e) => onChange({ valorTotal: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ms-muted mb-1">Data de Aplicação</label>
          <input
            type="date"
            value={dataAplicacao}
            onChange={(e) => onChange({ dataAplicacao: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>

        {modo !== 'IMPRESSA' && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-ms-muted mb-1">Prazo de Entrega (Online)</label>
            <input
              type="datetime-local"
              value={prazoEntrega}
              onChange={(e) => onChange({ prazoEntrega: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            />
          </div>
        )}
      </div>

      {/* Instruções */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-ms-muted">Instruções (opcional)</label>
          <button
            type="button"
            onClick={handleSalvarInstrucoesPadrao}
            disabled={salvandoPadrao}
            className="text-[11px] font-bold text-ms-blueText hover:underline disabled:opacity-40"
            title="Usar este texto como padrão para as próximas avaliações"
          >
            {salvandoPadrao ? 'Salvando...' : 'Salvar como padrão'}
          </button>
        </div>
        <textarea
          value={instrucoes}
          onChange={(e) => onChange({ instrucoes: e.target.value })}
          rows={2}
          placeholder="Ex.: Leia atentamente cada questão antes de responder."
          className="w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-y"
        />
      </div>

      {/* Embaralhamento / versões / cartão-resposta (aplicação impressa) */}
      {modo !== 'ONLINE' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
          <div>
            <label className="text-xs font-bold text-ms-muted">Embaralhamento</label>
            <select
              value={embaralhar}
              onChange={(e) => onChange({ embaralhar: e.target.value as ModoEmbaralhar })}
              className="w-full mt-1 px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              {(Object.keys(MODO_EMBARALHAR_LABEL) as ModoEmbaralhar[]).map((m) => (
                <option key={m} value={m}>{MODO_EMBARALHAR_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Versões da prova</label>
            <select
              value={modoVersoes === 'POR_ALUNO' ? 'POR_ALUNO' : versoes}
              onChange={(e) => {
                if (e.target.value === 'POR_ALUNO') { onChange({ modoVersoes: 'POR_ALUNO' }); return; }
                onChange({ modoVersoes: 'FIXO', qtdVersoes: Number(e.target.value) });
              }}
              className="w-full mt-1 px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n} disabled={embaralhar !== 'NENHUM' && n < 2}>
                  {n === 1 ? 'Versão única (A)' : `${n} versões (A–${String.fromCharCode(64 + n)})`}
                </option>
              ))}
              <option value="POR_ALUNO">Uma versão por aluno da turma</option>
            </select>
            {modoVersoes === 'POR_ALUNO' && (
              <p className="text-xs text-ms-muted mt-1">
                {contandoAlunos
                  ? 'Contando alunos ativos...'
                  : turmasSelecionadas.length === 0
                  ? 'Selecione a(s) turma(s) abaixo para calcular.'
                  : `${qtdVersoes} versão(ões) — uma por aluno ativo (transferido/remanejado não conta).`}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Cartão-resposta</label>
            <select
              value={posicaoCartao}
              onChange={(e) => onChange({ posicaoCartao: e.target.value as PosicaoCartao })}
              className="w-full mt-1 px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              {(Object.keys(POSICAO_CARTAO_LABEL) as PosicaoCartao[]).map((p) => (
                <option key={p} value={p}>{POSICAO_CARTAO_LABEL[p]}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
