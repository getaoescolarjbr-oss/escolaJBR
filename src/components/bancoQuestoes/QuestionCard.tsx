import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import type { Question } from '../../types/bancoQuestoes';
import { TIPO_QUESTAO_LABEL, ehQuestaoEscrita, linhasParaResposta, normalizarTipoQuestao, ordenarAlternativas } from '../../types/bancoQuestoes';
import { buildFonte, renderLightMarkup } from '../../lib/questionMarkup';

interface Props {
  question: Question;
  selecionada?: boolean;
  onToggleSelecionar?: () => void;
  onEditar?: () => void;
}

export function QuestionCard({ question: q, selecionada, onToggleSelecionar, onEditar }: Props) {
  const [mostrarGabarito, setMostrarGabarito] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const tipo = normalizarTipoQuestao(q.tipo);
  const escrita = ehQuestaoEscrita(tipo);
  const alternativas = ordenarAlternativas(q.alternatives);

  return (
    <div className="bg-ms-card border border-ms-border rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-full bg-ms-blue/20 text-ms-blueText">{q.discipline}</span>
          {escrita && <span className="px-2.5 py-1 rounded-full bg-ms-gold/20 text-ms-gold">{TIPO_QUESTAO_LABEL[tipo]}</span>}
          {q.assunto && (
            <span className="px-2.5 py-1 rounded-full bg-ms-border/40 text-ms-muted">
              {q.assunto}{q.topico ? `: ${q.topico}` : ''}
            </span>
          )}
          {q.difficulty && <span className="px-2.5 py-1 rounded-full bg-ms-border/40 text-ms-muted">{q.difficulty}</span>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {onEditar && (
            <button
              onClick={onEditar}
              title="Editar questão"
              className="flex items-center justify-center w-9 h-9 rounded-xl text-ms-muted hover:text-ms-blueText hover:bg-ms-blue/10"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onToggleSelecionar && (
            <button
              type="button"
              onClick={onToggleSelecionar}
              aria-pressed={!!selecionada}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${
                selecionada
                  ? 'bg-ms-blue border-ms-blueText text-white'
                  : 'border-ms-border text-ms-muted hover:border-ms-blueText hover:text-ms-main'
              }`}
            >
              <span
                className={`flex items-center justify-center w-4 h-4 rounded border-2 shrink-0 ${
                  selecionada ? 'bg-white border-white' : 'border-current'
                }`}
              >
                {selecionada && <Check className="w-3 h-3 text-ms-blueText" strokeWidth={3} />}
              </span>
              Selecionar
            </button>
          )}
        </div>
      </div>

      {q.support_texts && (
        <div>
          <button
            onClick={() => setMostrarTexto((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-ms-gold hover:underline"
          >
            <BookOpen className="w-4 h-4" />
            {mostrarTexto ? 'Ocultar texto associado' : 'Ver texto associado'}
            {mostrarTexto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {mostrarTexto && (
            <div className="mt-2 border-l-4 border-ms-gold pl-4 text-sm text-ms-muted space-y-2">
              {renderLightMarkup(q.support_texts.content, `st-${q.support_texts.id}`)}
              {q.support_texts.image_url && (
                <img src={q.support_texts.image_url} alt="" className="max-h-[280px] rounded-lg border border-ms-border" />
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-ms-main space-y-2">{renderLightMarkup(q.statement, `q-${q.id}`)}</div>
      {q.image_url && <img src={q.image_url} alt="" className="max-h-[280px] rounded-lg border border-ms-border" />}

      {/* Dissertativa/redação não tem alternativas (`alternatives` vem `[]`): no lugar
          delas mostramos quantas linhas pautadas a questão ocupa quando impressa. */}
      {escrita ? (
        <div className="rounded-xl border border-dashed border-ms-border px-4 py-3 text-sm text-ms-muted">
          Resposta escrita pelo aluno · {linhasParaResposta(tipo, q.linhas_resposta)} linhas pautadas na impressão
        </div>
      ) : (
        <div className="space-y-2">
          {alternativas.map((alt) => (
            <div
              key={alt.letter}
              className={`flex gap-3 px-4 py-2.5 rounded-xl border text-sm ${
                mostrarGabarito && alt.letter === q.correct_letter
                  ? 'border-ms-green bg-ms-green/10 text-ms-main'
                  : 'border-ms-border text-ms-main'
              }`}
            >
              <span className="font-bold">{alt.letter})</span>
              <div className="flex-1">{renderLightMarkup(alt.text, `${q.id}-${alt.letter}`, undefined, 'left')}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-ms-muted">
        <span>{buildFonte(q)}</span>
        <button
          onClick={() => setMostrarGabarito((v) => !v)}
          className="flex items-center gap-1 font-bold text-ms-blueText hover:underline"
        >
          {escrita
            ? mostrarGabarito
              ? 'Ocultar critérios'
              : 'Ver critérios de correção'
            : mostrarGabarito
            ? 'Ocultar gabarito'
            : 'Ver gabarito'}
          {mostrarGabarito ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {mostrarGabarito && (q.criterios_correcao || q.explanation) && (
        <div className="text-sm text-ms-muted bg-ms-dark/50 rounded-xl p-4 space-y-3">
          {q.criterios_correcao && (
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-ms-gold">
                {tipo === 'REDACAO' ? 'Competências avaliadas' : 'Resposta esperada'}
              </p>
              {renderLightMarkup(q.criterios_correcao, `crit-${q.id}`)}
            </div>
          )}
          {q.explanation && (
            <div className="space-y-1">
              {q.criterios_correcao && (
                <p className="text-xs font-black uppercase tracking-wider text-ms-muted">Explicação</p>
              )}
              {renderLightMarkup(q.explanation, `exp-${q.id}`)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
