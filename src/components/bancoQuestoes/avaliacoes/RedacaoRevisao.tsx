import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Loader2, Save, Settings2, Sparkles } from 'lucide-react';
import { renderLightMarkup } from '../../../lib/questionMarkup';
import {
  confirmarRedacao,
  corrigirRedacaoComIa,
  definirMostrarEsperado,
  definirRubricaRedacao,
  listarRubricas,
  obterRedacao,
  salvarRedacao,
  urlImagemRedacao,
  valoresPermitidos,
  type CorrecaoIa,
  type RedacaoDetalhe,
  type ResultadoConfirmacao,
  type RubricaRedacao,
} from '../../../services/redacaoService';
import { RubricasModal } from './RubricasModal';

// Revisão de UMA redação: imagem recortada, transcrição editável, prévia da IA por critério e a
// decisão do professor (concordo / discordo, com a nota e o comentário dele). A nota que vale é
// sempre a do professor; a da IA é só uma sugestão.
//
// O MODO de correção (critérios e pesos) é escolha do professor: o padrão vem da avaliação ou da banca
// da proposta, mas aqui ele pode trocar — por exemplo, corrigir um tema da UFMS pelos critérios do ENEM.

const CONFIANCA_BAIXA = 0.85;
const ORIGEM_ROTULO = {
  REDACAO: 'escolhido nesta redação',
  AVALIACAO: 'padrão da avaliação',
  BANCA: 'modelo da banca da proposta',
  CONFIRMADA: 'usado na nota confirmada',
} as const;

const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

interface Props {
  envioId: string;
  onVoltar: () => void;
  /** Chamado depois de confirmar a nota, para a lista recarregar. */
  onConfirmada: () => void;
}

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Algo deu errado. Tente de novo.';
}

export function RedacaoRevisao({ envioId, onVoltar, onConfirmada }: Props) {
  const [det, setDet] = useState<RedacaoDetalhe | null>(null);
  const [rubricas, setRubricas] = useState<RubricaRedacao[]>([]);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [ia, setIa] = useState<CorrecaoIa | null>(null);
  const [notas, setNotas] = useState<Record<string, number> | null>(null);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [comentarioGeral, setComentarioGeral] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'salvar' | 'ia' | 'confirmar' | 'modo' | null>(null);
  const [resultado, setResultado] = useState<ResultadoConfirmacao | null>(null);
  const [mostrarEnunciado, setMostrarEnunciado] = useState(false);
  const [gerenciando, setGerenciando] = useState(false);
  const [mostrarEsperado, setMostrarEsperado] = useState(false);

  async function alternarEsperado(valor: boolean) {
    setMostrarEsperado(valor);
    try {
      await definirMostrarEsperado(envioId, valor);
    } catch (e) {
      setMostrarEsperado(!valor);
      setErro(mensagemErro(e));
    }
  }

  const carregar = useCallback(async () => {
    const d = await obterRedacao(envioId);
    setDet(d);
    setTexto((atual) => atual || (d.texto_final ?? (d.linhas ?? []).map((l) => l.texto).join('\n')));
    setIa(d.correcao_ia);
    setMostrarEsperado(d.mostrar_esperado ?? false);
    const prof = d.correcao_prof?.competencias;
    const iaValida = d.correcao_ia?.rubrica?.id === d.rubrica?.id ? d.correcao_ia : null;
    if (prof && d.status === 'REVISADA') {
      setNotas(Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, v.nota])));
      setComentarios(Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, v.comentario ?? ''])));
      setComentarioGeral(d.correcao_prof?.comentario_geral ?? '');
    } else if (iaValida && d.rubrica) {
      setNotas(Object.fromEntries(d.rubrica.criterios.map((c) => [c.chave, Math.min(c.max, iaValida.competencias[c.chave]?.nota ?? 0)])));
    } else {
      setNotas(null);
    }
    if (d.imagem_path) setImagemUrl(await urlImagemRedacao(d.imagem_path));
  }, [envioId]);

  useEffect(() => {
    let vivo = true;
    // Busca inicial: os setState acontecem depois do await dentro de carregar().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar().catch((e) => vivo && setErro(mensagemErro(e)));
    listarRubricas().then((l) => vivo && setRubricas(l.filter((r) => r.ativa))).catch(() => { /* seletor fica só com o padrão */ });
    return () => { vivo = false; };
  }, [carregar]);

  const rubrica = det?.rubrica ?? null;
  const iaDesatualizada = !!ia && !!rubrica && ia.rubrica?.id !== rubrica.id;
  const iaAtual = iaDesatualizada ? null : ia;

  const linhasParaConferir = useMemo(
    () => (det?.linhas ?? []).filter((l) => l.confianca < CONFIANCA_BAIXA && l.texto.trim()).map((l) => l.n),
    [det],
  );
  const maximo = rubrica ? rubrica.criterios.reduce((s, c) => s + c.max, 0) : 0;
  const total = notas && rubrica ? rubrica.criterios.reduce((s, c) => s + (notas[c.chave] ?? 0), 0) : null;
  const valorProva = det?.valor != null ? Number(det.valor) : null;

  async function trocarModo(valor: string) {
    setOcupado('modo');
    setErro(null);
    try {
      await definirRubricaRedacao(envioId, valor || null);
      setResultado(null);
      await carregar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  async function salvarTexto() {
    setOcupado('salvar');
    setErro(null);
    try {
      await salvarRedacao(envioId, { textoFinal: texto });
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  async function corrigirComIa() {
    if (!det || !rubrica) return;
    setOcupado('ia');
    setErro(null);
    try {
      await salvarRedacao(envioId, { textoFinal: texto });
      const r = await corrigirRedacaoComIa(texto.split('\n'), det.tema ?? '', rubrica, det.observacoes);
      await salvarRedacao(envioId, { correcaoIa: r });
      setIa(r);
      // Preenche as notas do professor com as da IA só se ele ainda não decidiu nada neste modo.
      setNotas((atual) => atual ?? Object.fromEntries(rubrica.criterios.map((c) => [c.chave, Math.min(c.max, r.competencias[c.chave]?.nota ?? 0)])));
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  async function confirmar() {
    if (!notas || !rubrica) return;
    setOcupado('confirmar');
    setErro(null);
    try {
      const competencias = Object.fromEntries(
        rubrica.criterios.map((c) => [c.chave, { nota: notas[c.chave] ?? 0, concorda: iaAtual ? iaAtual.competencias[c.chave]?.nota === notas[c.chave] : false, comentario: comentarios[c.chave] ?? '' }]),
      );
      await salvarRedacao(envioId, { textoFinal: texto });
      setResultado(await confirmarRedacao(envioId, competencias, comentarioGeral.trim() || null));
      await carregar();
      onConfirmada();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  if (!det || !rubrica) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-ms-muted">
        {erro ? <p className="text-sm text-red-400">{erro}</p> : <Loader2 className="w-5 h-5 animate-spin" />}
        <button onClick={onVoltar} className="text-xs underline">Voltar</button>
      </div>
    );
  }

  const confirmada = det.status === 'REVISADA';

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-ms-muted hover:text-ms-main">
          <ArrowLeft className="w-4 h-4" /> Voltar à lista
        </button>
        <div className="text-right">
          <p className="text-sm font-bold text-ms-main">{det.aluno_nome} <span className="font-normal text-ms-muted">· {det.turma_nome ?? '—'}</span></p>
          {det.tema && <p className="text-xs text-ms-muted">Tema: {det.tema}</p>}
        </div>
      </div>

      {/* Modo de correção: critérios e pesos */}
      <div className="flex flex-wrap items-center gap-2 border border-gray-800 rounded-xl px-3 py-2 bg-ms-dark/40">
        <label className="text-xs font-bold text-ms-muted" htmlFor="modo-correcao">Modo de correção:</label>
        <select
          id="modo-correcao"
          value={det.rubrica_escolhida_id ?? ''}
          disabled={ocupado !== null}
          onChange={(e) => void trocarModo(e.target.value)}
          className={`${inputClass} !w-auto min-w-56`}
        >
          <option value="">Padrão {det.rubrica_escolhida_id ? '(da avaliação ou da banca)' : `— ${rubrica.nome}`}</option>
          {rubricas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <span className="text-[11px] text-ms-muted">{rubrica.nome} — {ORIGEM_ROTULO[rubrica.origem]} · {maximo} pontos</span>
        <button onClick={() => setGerenciando(true)} className="ml-auto flex items-center gap-1 text-xs text-ms-blue underline">
          <Settings2 className="w-3.5 h-3.5" /> Gerenciar critérios
        </button>
        {ocupado === 'modo' && <Loader2 className="w-3.5 h-3.5 animate-spin text-ms-muted" />}
        {confirmada && (
          <p className="basis-full text-[11px] text-amber-600 dark:text-amber-400">
            Esta redação já tem nota confirmada. Trocar o modo reabre a revisão: a nota da prova só muda quando você confirmar de novo.
          </p>
        )}
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-300 font-medium">{erro}</p>
        </div>
      )}

      {resultado && (
        <div className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 rounded-lg px-4 py-3 text-sm text-emerald-900 dark:text-emerald-300">
          Nota confirmada: <strong>{resultado.nota_total}/{resultado.nota_maxima}</strong> → <strong>{resultado.valor_obtido.toFixed(2)}</strong> pontos na prova
          (nota da prova agora: {Number(resultado.nota_resposta).toFixed(2)}).
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Esquerda: a folha e o enunciado */}
        <div className="space-y-3">
          {imagemUrl ? (
            <a href={imagemUrl} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
              <img src={imagemUrl} alt="Folha de redação do aluno" className="w-full rounded-lg border border-gray-800 bg-white" />
            </a>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-700 p-6 text-center text-xs text-ms-muted">
              Sem imagem da folha (texto digitado ou colado).
            </div>
          )}
          <button onClick={() => setMostrarEnunciado((v) => !v)} className="text-xs text-ms-blue underline">
            {mostrarEnunciado ? 'Ocultar a proposta' : 'Ver a proposta de redação'}
          </button>
          {mostrarEnunciado && (
            <div className="text-xs text-ms-main bg-white dark:bg-ms-dark border border-gray-800 rounded-lg p-3 max-h-80 overflow-y-auto leading-relaxed">
              {renderLightMarkup(det.enunciado, 'redacao-enunciado')}
            </div>
          )}
          {det.observacoes?.trim() && (
            <details className="text-xs text-ms-main border border-gray-800 rounded-lg bg-ms-dark/40">
              <summary className="cursor-pointer px-3 py-2 font-bold">O que se espera neste tema (observações para o professor)</summary>
              <div className="px-3 pb-3 leading-relaxed max-h-80 overflow-y-auto">{renderLightMarkup(det.observacoes, 'redacao-observacoes')}</div>
            </details>
          )}
          {det.observacoes?.trim() && (
            <label className="flex items-start gap-2 text-xs text-ms-main cursor-pointer">
              <input type="checkbox" checked={mostrarEsperado} onChange={(e) => void alternarEsperado(e.target.checked)} className="mt-0.5 accent-ms-blue" />
              <span>
                Mostrar ao aluno, na devolutiva, o que se esperava neste tema
                <span className="block text-[11px] text-ms-muted">Revise o texto antes: boa parte das observações é gerada por IA. A prévia da IA nunca aparece para o aluno.</span>
              </span>
            </label>
          )}
        </div>

        {/* Direita: transcrição, prévia da IA e decisão */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-ms-muted">Texto do aluno (uma linha da folha por linha aqui)</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={12}
              className={`${inputClass} font-mono leading-relaxed`}
              placeholder="A transcrição aparece aqui. Confira com a imagem, corrija o que a leitura errou e só então peça a correção."
            />
            {linhasParaConferir.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Linhas com leitura incerta, vale conferir: {linhasParaConferir.join(', ')}.
              </p>
            )}
            <p className="text-[11px] text-ms-muted mt-1">
              A transcrição mantém os erros do aluno de propósito: eles contam nos critérios de norma padrão.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={salvarTexto} disabled={ocupado !== null} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold text-ms-main hover:bg-gray-800 disabled:opacity-40">
                {ocupado === 'salvar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar texto
              </button>
              <button onClick={corrigirComIa} disabled={ocupado !== null || !texto.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 disabled:opacity-40">
                {ocupado === 'ia' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {iaAtual ? 'Corrigir de novo com IA' : 'Gerar correção prévia (IA)'}
              </button>
              {ocupado === 'ia' && <span className="self-center text-[11px] text-ms-muted">A IA pode levar de alguns segundos a 1–2 minutos quando o serviço está cheio.</span>}
            </div>
          </div>

          {iaDesatualizada && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-2">
              A prévia da IA foi gerada no modo “{ia?.rubrica?.nome ?? 'anterior'}”. Gere de novo para ver a prévia no modo “{rubrica.nome}”.
            </p>
          )}

          {iaAtual && (
            <div className="space-y-1">
              {iaAtual.alertas.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-900 dark:text-amber-200"><strong>Alertas da IA:</strong> {iaAtual.alertas.join(' · ')}</p>
                </div>
              )}
              {iaAtual.desvios.length > 0 && (
                <details className="text-xs text-ms-main">
                  <summary className="cursor-pointer font-bold">Desvios apontados ({iaAtual.desvios.length})</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">{iaAtual.desvios.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Critérios: prévia da IA x decisão do professor */}
      {notas && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ms-main">Critérios ({rubrica.nome}) — a nota final é a sua</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {rubrica.criterios.map((c) => {
              const k = c.chave;
              const prev = iaAtual?.competencias[k];
              const concorda = prev ? prev.nota === notas[k] : null;
              return (
                <div key={k} className="border border-gray-800 rounded-xl p-3 space-y-2 bg-ms-dark/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ms-main">{c.rotulo}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-ms-dark border border-gray-800 text-ms-muted">
                      {prev ? `IA: ${prev.nota} · ` : ''}máx. {c.max}
                    </span>
                  </div>
                  {prev && <p className="text-xs text-ms-muted leading-relaxed">{prev.justificativa}</p>}
                  {prev && prev.trechos.length > 0 && (
                    <ul className="text-[11px] text-ms-muted list-disc pl-4 space-y-0.5">{prev.trechos.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
                  )}
                  {c.descritores && (
                    <details className="text-[11px] text-ms-muted">
                      <summary className="cursor-pointer">O que vale cada nota</summary>
                      <p className="mt-1 leading-relaxed">{c.descritores}</p>
                    </details>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={notas[k] ?? 0}
                      onChange={(e) => setNotas({ ...notas, [k]: Number(e.target.value) })}
                      className={`${inputClass} !w-24`}
                      aria-label={`Nota — ${c.rotulo}`}
                    >
                      {valoresPermitidos(c).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {concorda !== null && (
                      <span className={`text-xs font-bold ${concorda ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {concorda ? 'Concordo com a IA' : `Discordo (IA deu ${prev!.nota})`}
                      </span>
                    )}
                  </div>
                  <input
                    value={comentarios[k] ?? ''}
                    onChange={(e) => setComentarios({ ...comentarios, [k]: e.target.value })}
                    placeholder="Seu comentário (opcional)"
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>

          {rubrica.instrucoes && (
            <details className="text-xs text-ms-muted">
              <summary className="cursor-pointer font-bold">Regras deste modo (nota zero etc.)</summary>
              <p className="mt-1 leading-relaxed whitespace-pre-line">{rubrica.instrucoes}</p>
            </details>
          )}

          <div>
            <label className="text-xs font-bold text-ms-muted">Comentário geral para o aluno (opcional)</label>
            <textarea value={comentarioGeral} onChange={(e) => setComentarioGeral(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 border-t border-gray-800 pt-3">
            <p className="text-sm text-ms-main">
              Nota: <strong>{total}/{maximo}</strong>
              {iaAtual && <span className="text-ms-muted"> (IA: {iaAtual.nota_total})</span>}
              {valorProva != null && total != null && maximo > 0 && (
                <span className="text-ms-muted"> → {((total / maximo) * valorProva).toFixed(2)} de {valorProva.toFixed(2)} pontos na prova</span>
              )}
            </p>
            <button onClick={confirmar} disabled={ocupado !== null} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
              {ocupado === 'confirmar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {confirmada ? 'Atualizar nota' : 'Confirmar nota'}
            </button>
          </div>
        </div>
      )}

      {!notas && (
        <p className="text-xs text-ms-muted">
          Confira o texto e peça a correção prévia, ou{' '}
          <button
            onClick={() => setNotas(Object.fromEntries(rubrica.criterios.map((c) => [c.chave, 0])))}
            className="text-ms-blue underline"
          >
            dê as notas sem a IA
          </button>
          .
        </p>
      )}

      {gerenciando && (
        <RubricasModal
          onClose={() => setGerenciando(false)}
          onMudou={() => { listarRubricas().then((l) => setRubricas(l.filter((r) => r.ativa))).catch(() => undefined); void carregar(); }}
        />
      )}
    </div>
  );
}
