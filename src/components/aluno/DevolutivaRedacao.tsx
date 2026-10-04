import { MessageSquareText } from 'lucide-react';
import { renderLightMarkup } from '../../lib/questionMarkup';
import type { DevolutivaRedacao as Dados } from '../../services/redacaoService';

// Devolutiva da redação, como o aluno vê dentro da avaliação já enviada: nota por critério e os
// comentários do professor. Só aparece depois que o professor CONFIRMA a nota; a prévia da IA não chega aqui.
// "O que se esperava neste tema" só vem se o professor liberou (as observações são geradas por IA).

export function DevolutivaRedacao({ dados }: { dados: Dados }) {
  const pontos = Number(dados.valor_obtido);
  const valor = Number(dados.valor);
  return (
    <div className="mt-3 border border-emerald-700/40 bg-emerald-900/10 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
          <MessageSquareText className="w-4 h-4" /> Devolutiva do professor
        </p>
        <p className="text-sm text-ms-main">
          Nota: <strong>{dados.nota_total}/{dados.nota_maxima}</strong>
          <span className="text-ms-muted"> → {pontos.toFixed(2)} de {valor.toFixed(2)} pontos na prova</span>
        </p>
      </div>
      {dados.rubrica_nome && <p className="text-[11px] text-ms-muted">Critérios usados: {dados.rubrica_nome}</p>}

      <ul className="space-y-2">
        {dados.criterios.map((c, i) => (
          <li key={i} className="border border-gray-800 rounded-lg px-3 py-2 bg-ms-dark/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-ms-main">{c.rotulo}</p>
              <p className="text-xs tabular-nums text-ms-main">{c.nota}/{c.max}</p>
            </div>
            <div className="h-1.5 mt-1.5 rounded-full bg-gray-800 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-emerald-500" style={{ width: `${c.max > 0 ? Math.round((c.nota / c.max) * 100) : 0}%` }} />
            </div>
            {c.comentario && <p className="text-xs text-ms-muted mt-1.5 leading-relaxed">{c.comentario}</p>}
            {c.descritores && (
              <details className="text-[11px] text-ms-muted mt-1">
                <summary className="cursor-pointer">O que vale cada nota</summary>
                <p className="mt-1 leading-relaxed">{c.descritores}</p>
              </details>
            )}
          </li>
        ))}
      </ul>

      {dados.comentario_geral && (
        <div>
          <p className="text-xs font-bold text-ms-main">Comentário do professor</p>
          <p className="text-sm text-ms-main leading-relaxed whitespace-pre-line">{dados.comentario_geral}</p>
        </div>
      )}

      {dados.esperado && (
        <details className="text-xs text-ms-main border border-gray-800 rounded-lg bg-ms-dark/40">
          <summary className="cursor-pointer px-3 py-2 font-bold">O que se esperava neste tema</summary>
          <div className="px-3 pb-3 leading-relaxed">{renderLightMarkup(dados.esperado, 'devolutiva-esperado')}</div>
        </details>
      )}
    </div>
  );
}
