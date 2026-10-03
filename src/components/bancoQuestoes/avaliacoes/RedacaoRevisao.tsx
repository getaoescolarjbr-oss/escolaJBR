import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Loader2, Save, Sparkles } from 'lucide-react';
import { renderLightMarkup } from '../../../lib/questionMarkup';
import {
  CHAVES_COMPETENCIA,
  confirmarRedacao,
  corrigirRedacaoComIa,
  obterRedacao,
  salvarRedacao,
  urlImagemRedacao,
  type ChaveCompetencia,
  type CorrecaoIa,
  type RedacaoDetalhe,
  type ResultadoConfirmacao,
} from '../../../services/redacaoService';

// Revisão de UMA redação: imagem recortada, transcrição editável, prévia da IA por competência e a
// decisão do professor (concordo / discordo, com a nota e o comentário dele). A nota que vale é
// sempre a do professor; a da IA é só uma sugestão.

const NOMES: Record<ChaveCompetencia, string> = {
  c1: 'C1 — Norma padrão da língua',
  c2: 'C2 — Tema e tipo textual',
  c3: 'C3 — Argumentos e projeto de texto',
  c4: 'C4 — Coesão',
  c5: 'C5 — Proposta de intervenção',
};
const NOTAS = [0, 40, 80, 120, 160, 200];
const CONFIANCA_BAIXA = 0.85;

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
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [ia, setIa] = useState<CorrecaoIa | null>(null);
  const [notas, setNotas] = useState<Record<ChaveCompetencia, number> | null>(null);
  const [comentarios, setComentarios] = useState<Record<ChaveCompetencia, string>>({ c1: '', c2: '', c3: '', c4: '', c5: '' });
  const [comentarioGeral, setComentarioGeral] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'salvar' | 'ia' | 'confirmar' | null>(null);
  const [resultado, setResultado] = useState<ResultadoConfirmacao | null>(null);
  const [mostrarEnunciado, setMostrarEnunciado] = useState(false);

  useEffect(() => {
    let vivo = true;
    obterRedacao(envioId)
      .then(async (d) => {
        if (!vivo) return;
        setDet(d);
        setTexto(d.texto_final ?? (d.linhas ?? []).map((l) => l.texto).join('\n'));
        setIa(d.correcao_ia);
        const prof = d.correcao_prof?.competencias;
        if (prof) {
          setNotas(Object.fromEntries(CHAVES_COMPETENCIA.map((k) => [k, prof[k].nota])) as Record<ChaveCompetencia, number>);
          setComentarios(Object.fromEntries(CHAVES_COMPETENCIA.map((k) => [k, prof[k].comentario ?? ''])) as Record<ChaveCompetencia, string>);
          setComentarioGeral(d.correcao_prof?.comentario_geral ?? '');
        } else if (d.correcao_ia) {
          setNotas(Object.fromEntries(CHAVES_COMPETENCIA.map((k) => [k, d.correcao_ia!.competencias[k].nota])) as Record<ChaveCompetencia, number>);
        }
        if (d.imagem_path) {
          const url = await urlImagemRedacao(d.imagem_path);
          if (vivo) setImagemUrl(url);
        }
      })
      .catch((e) => vivo && setErro(mensagemErro(e)));
    return () => { vivo = false; };
  }, [envioId]);

  const linhasParaConferir = useMemo(
    () => (det?.linhas ?? []).filter((l) => l.confianca < CONFIANCA_BAIXA && l.texto.trim()).map((l) => l.n),
    [det],
  );
  const total = notas ? CHAVES_COMPETENCIA.reduce((s, k) => s + notas[k], 0) : null;
  const valorProva = det?.valor != null ? Number(det.valor) : null;

  // Critérios próprios da banca vão para a IA; os do ENEM ela já conhece (rubrica completa no servidor).
  const criteriosCustom = det?.criterios && !det.criterios.startsWith('Critérios ENEM') && !det.criterios.startsWith('Critérios próprios')
    ? det.criterios : undefined;

  async function salvarTexto() {
    setOcupado('salvar');
    setErro(null);
    try {
      await salvarRedacao(envioId, { textoFinal: texto });
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  async function corrigirComIa() {
    if (!det) return;
    setOcupado('ia');
    setErro(null);
    try {
      await salvarRedacao(envioId, { textoFinal: texto });
      const r = await corrigirRedacaoComIa(texto.split('\n'), det.tema ?? '', criteriosCustom);
      await salvarRedacao(envioId, { correcaoIa: r });
      setIa(r);
      // Só preenche as notas do professor com as da IA se ele ainda não decidiu nada.
      setNotas((atual) => atual ?? (Object.fromEntries(CHAVES_COMPETENCIA.map((k) => [k, r.competencias[k].nota])) as Record<ChaveCompetencia, number>));
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  async function confirmar() {
    if (!notas) return;
    setOcupado('confirmar');
    setErro(null);
    try {
      const competencias = Object.fromEntries(
        CHAVES_COMPETENCIA.map((k) => [k, { nota: notas[k], concorda: ia ? ia.competencias[k].nota === notas[k] : false, comentario: comentarios[k] }]),
      ) as Parameters<typeof confirmarRedacao>[1];
      await salvarRedacao(envioId, { textoFinal: texto });
      setResultado(await confirmarRedacao(envioId, competencias, comentarioGeral.trim() || null));
      onConfirmada();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  }

  if (!det) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-ms-muted">
        {erro ? <p className="text-sm text-red-400">{erro}</p> : <Loader2 className="w-5 h-5 animate-spin" />}
        <button onClick={onVoltar} className="text-xs underline">Voltar</button>
      </div>
    );
  }

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

      {erro && (
        <div className="flex items-start gap-2 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-300 font-medium">{erro}</p>
        </div>
      )}

      {resultado && (
        <div className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 rounded-lg px-4 py-3 text-sm text-emerald-900 dark:text-emerald-300">
          Nota confirmada: <strong>{resultado.nota_total}/1000</strong> → <strong>{resultado.valor_obtido.toFixed(2)}</strong> pontos na prova
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
              A transcrição mantém os erros do aluno de propósito: eles contam na Competência 1.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={salvarTexto} disabled={ocupado !== null} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-800 rounded-lg text-xs font-bold text-ms-main hover:bg-gray-800 disabled:opacity-40">
                {ocupado === 'salvar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar texto
              </button>
              <button onClick={corrigirComIa} disabled={ocupado !== null || !texto.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 disabled:opacity-40">
                {ocupado === 'ia' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {ia ? 'Corrigir de novo com IA' : 'Gerar correção prévia (IA)'}
              </button>
            </div>
          </div>

          {ia && (
            <div className="space-y-1">
              {ia.alertas.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-900 dark:text-amber-200"><strong>Alertas da IA:</strong> {ia.alertas.join(' · ')}</p>
                </div>
              )}
              {ia.desvios.length > 0 && (
                <details className="text-xs text-ms-main">
                  <summary className="cursor-pointer font-bold">Desvios apontados ({ia.desvios.length})</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">{ia.desvios.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Competências: prévia da IA x decisão do professor */}
      {notas && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ms-main">Competências — a nota final é a sua</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {CHAVES_COMPETENCIA.map((k) => {
              const c = ia?.competencias[k];
              const concorda = c ? c.nota === notas[k] : null;
              return (
                <div key={k} className="border border-gray-800 rounded-xl p-3 space-y-2 bg-ms-dark/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ms-main">{NOMES[k]}</p>
                    {c && <span className="text-[11px] px-2 py-0.5 rounded-full bg-ms-dark border border-gray-800 text-ms-muted">IA: {c.nota}</span>}
                  </div>
                  {c && <p className="text-xs text-ms-muted leading-relaxed">{c.justificativa}</p>}
                  {c && c.trechos.length > 0 && (
                    <ul className="text-[11px] text-ms-muted list-disc pl-4 space-y-0.5">{c.trechos.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={notas[k]}
                      onChange={(e) => setNotas({ ...notas, [k]: Number(e.target.value) })}
                      className={`${inputClass} !w-24`}
                      aria-label={`Nota ${k.toUpperCase()}`}
                    >
                      {NOTAS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {concorda !== null && (
                      <span className={`text-xs font-bold ${concorda ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {concorda ? 'Concordo com a IA' : `Discordo (IA deu ${c!.nota})`}
                      </span>
                    )}
                  </div>
                  <input
                    value={comentarios[k]}
                    onChange={(e) => setComentarios({ ...comentarios, [k]: e.target.value })}
                    placeholder="Seu comentário (opcional)"
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-bold text-ms-muted">Comentário geral para o aluno (opcional)</label>
            <textarea value={comentarioGeral} onChange={(e) => setComentarioGeral(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 border-t border-gray-800 pt-3">
            <p className="text-sm text-ms-main">
              Nota: <strong>{total}/1000</strong>
              {ia && <span className="text-ms-muted"> (IA: {ia.nota_total})</span>}
              {valorProva != null && total != null && (
                <span className="text-ms-muted"> → {((total / 1000) * valorProva).toFixed(2)} de {valorProva.toFixed(2)} pontos na prova</span>
              )}
            </p>
            <button onClick={confirmar} disabled={ocupado !== null} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
              {ocupado === 'confirmar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {det.status === 'REVISADA' ? 'Atualizar nota' : 'Confirmar nota'}
            </button>
          </div>
        </div>
      )}

      {!notas && (
        <p className="text-xs text-ms-muted">
          Confira o texto e peça a correção prévia, ou{' '}
          <button
            onClick={() => setNotas({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 })}
            className="text-ms-blue underline"
          >
            dê as notas sem a IA
          </button>
          .
        </p>
      )}
    </div>
  );
}
