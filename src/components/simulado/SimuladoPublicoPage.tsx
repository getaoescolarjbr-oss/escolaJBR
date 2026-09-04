import { useMemo, useState } from 'react';
import { ClipboardList, Loader2, Send } from 'lucide-react';
import type { SimuladoPublicoIniciarResposta, SimuladoPublicoItemResultado } from '../../types/avaliacoes';
import { iniciarSimuladoPublico, submeterSimuladoPublico } from '../../services/avaliacoesService';
import { renderLightMarkup } from '../../lib/questionMarkup';

interface Props {
  token: string;
}

// Tela pública do link de simulado (?simulado=<token>) — sem login: o aluno digita o
// código SGDE, o servidor confere e devolve nome/turma/série já preenchidos (ver
// rpc_simulado_publico_iniciar em create_simulados_publico.sql). O simulado nunca gera
// nota em "Notas e Avaliações", só um resultado de feedback para o próprio aluno.
export function SimuladoPublicoPage({ token }: Props) {
  const [codigoSgde, setCodigoSgde] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<SimuladoPublicoIniciarResposta | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ nota_final: number; itens: SimuladoPublicoItemResultado[] } | null>(null);

  async function buscar() {
    if (!codigoSgde.trim()) return;
    setBuscando(true);
    setErro(null);
    try {
      const resp = await iniciarSimuladoPublico(token, codigoSgde);
      setDados(resp);
      if (resp.ja_enviado && resp.nota !== null) {
        setResultado({ nota_final: resp.nota, itens: [] });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível localizar o código SGDE.');
    } finally {
      setBuscando(false);
    }
  }

  const respondidas = useMemo(() => Object.keys(respostas).length, [respostas]);
  const resultadoPorQuestao = useMemo(() => new Map((resultado?.itens ?? []).map((r) => [r.question_id, r])), [resultado]);

  function marcar(questionId: string, letra: string) {
    if (resultado) return;
    setRespostas((prev) => ({ ...prev, [questionId]: letra }));
  }

  async function enviar() {
    if (!dados) return;
    if (!confirm(`Enviar simulado com ${respondidas} de ${dados.questoes.length} questão(ões) respondida(s)?`)) return;
    setEnviando(true);
    setErro(null);
    try {
      const resp = await submeterSimuladoPublico(
        token,
        codigoSgde,
        Object.entries(respostas).map(([question_id, letra]) => ({ question_id, letra }))
      );
      setResultado(resp);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o simulado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-ms-dark flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-3xl bg-ms-card border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-blue-400 shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-ms-main">{dados?.prova.titulo ?? 'Simulado'}</h1>
            <p className="text-xs text-ms-muted">Escola José Barbosa Rodrigues · Este simulado não gera nota no boletim.</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

          {!dados && (
            <div className="max-w-sm mx-auto space-y-4 py-8">
              <p className="text-sm text-ms-main text-center font-bold">Digite seu código SGDE para começar</p>
              <input
                autoFocus
                inputMode="numeric"
                className="w-full text-center text-lg px-4 py-3 bg-ms-dark border border-gray-800 rounded-lg text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                placeholder="Código SGDE"
                value={codigoSgde}
                onChange={(e) => setCodigoSgde(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                disabled={buscando}
              />
              <button
                onClick={buscar}
                disabled={buscando || !codigoSgde.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
              >
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Entrar
              </button>
            </div>
          )}

          {dados && (
            <>
              <div className="bg-ms-dark border border-gray-800 rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-ms-muted">Nome</p>
                  <p className="font-bold text-ms-main truncate">{dados.aluno.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-ms-muted">Nº chamada</p>
                  <p className="font-bold text-ms-main">{dados.aluno.numero_chamada ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-ms-muted">Série</p>
                  <p className="font-bold text-ms-main">{dados.aluno.serie ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-ms-muted">Turma</p>
                  <p className="font-bold text-ms-main">{dados.aluno.turma ?? '—'}</p>
                </div>
              </div>

              {dados.prova.instrucoes && (
                <p className="text-xs text-ms-muted bg-ms-dark border border-gray-800 rounded-lg px-4 py-3 whitespace-pre-wrap">{dados.prova.instrucoes}</p>
              )}

              {resultado && (
                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-4 text-center">
                  <p className="text-sm text-ms-muted">Simulado enviado!</p>
                  <p className="text-2xl font-bold text-emerald-300">Nota do simulado: {resultado.nota_final.toFixed(2)}</p>
                  <p className="text-xs text-ms-muted mt-1">Este resultado é só para seu estudo — não entra no boletim.</p>
                </div>
              )}

              <div className="space-y-5">
                {dados.questoes.map((q, i) => {
                  const item = resultadoPorQuestao.get(q.question_id);
                  return (
                    <div key={q.question_id} className="border-b border-gray-800 pb-4 last:border-0">
                      <div className="text-sm text-ms-main">
                        {renderLightMarkup(
                          q.statement,
                          `sp-${q.question_id}`,
                          <span className="font-bold text-blue-400">
                            {i + 1}. <span className="font-normal text-ms-muted text-xs">({Number(q.valor).toFixed(2)} pt)</span>{' '}
                          </span>
                        )}
                      </div>
                      {q.image_url && <img src={q.image_url} alt="" className="max-w-full rounded-lg my-2" />}
                      <div className="space-y-2 mt-2">
                        {q.alternatives.map((a) => {
                          const marcada = respostas[q.question_id] === a.letter;
                          const correta = item && a.letter === item.correct_letter;
                          const errouEssa = item && marcada && !item.correta;
                          return (
                            <label
                              key={a.letter}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                                item
                                  ? correta
                                    ? 'border-emerald-600 bg-emerald-900/20'
                                    : errouEssa
                                    ? 'border-red-600 bg-red-900/20'
                                    : 'border-gray-800'
                                  : marcada
                                  ? 'border-blue-400 bg-blue-400/10'
                                  : 'border-gray-800 hover:border-gray-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.question_id}
                                checked={marcada}
                                disabled={!!resultado}
                                onChange={() => marcar(q.question_id, a.letter)}
                              />
                              <span className={`font-bold ${item ? (correta ? 'text-emerald-400' : errouEssa ? 'text-red-400' : '') : ''}`}>{a.letter})</span>
                              <span className={`flex-1 ${item ? (correta ? 'text-emerald-300' : errouEssa ? 'text-red-300' : 'text-ms-main') : 'text-ms-main'}`}>
                                {renderLightMarkup(a.text, `sp-${q.question_id}-${a.letter}`, undefined, 'left')}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!resultado && !dados.ja_enviado && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-ms-muted">{respondidas} de {dados.questoes.length} respondida(s)</p>
                  <button
                    onClick={enviar}
                    disabled={enviando}
                    className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
