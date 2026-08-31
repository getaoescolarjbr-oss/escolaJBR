import type { Question } from '../../types/bancoQuestoes';
import { ehQuestaoEscrita, linhasParaResposta, normalizarTipoQuestao } from '../../types/bancoQuestoes';
import { renderLightMarkup } from '../../lib/questionMarkup';

// entraNoCartaoResposta vive em utils/printProva.ts: este arquivo só pode exportar
// componentes (react-refresh/only-export-components).

// Uma questão no layout de papel. Vive num componente só porque o mesmo bloco é
// montado em três telas (GerarProvaModal, AvaliacaoPreviewModal e
// ReimprimirAvaliacaoModal) e todas precisam sair idênticas na impressão — as
// classes usadas aqui estão definidas em PROVA_QUESTOES_CSS (utils/printProva.ts).

// Acima disto a resposta não cabe numa coluna de A4: a questão passa a ocupar a
// largura inteira e pode quebrar entre páginas.
const LIMITE_LINHAS_COLUNA = 15;

function textoLimpo(texto: string) {
  return texto.replace(/\[\[[^\]]*\]\]|<[^>]+>/g, '').trim();
}

function temImagemAlternativas(q: Question) {
  return q.alternatives.some((a) => a.text.includes('[[IMG:') || a.text.includes('<img') || Boolean(a.image_url));
}

function obterClasseLayoutAlternativas(q: Question): string {
  if (temImagemAlternativas(q)) {
    return 'alternativas-grid-2';
  }
  const comprimentos = q.alternatives.map((a) => textoLimpo(a.text).length);
  const total = comprimentos.reduce((soma, comp) => soma + comp, 0);
  const maxComp = Math.max(...comprimentos, 0);

  // Se todas forem extremamente curtas (ex: números "1", "2") e couberem em 1 só linha
  if (total <= 35 && maxComp <= 8) {
    return 'alternativas-linha';
  }
  // Se forem de tamanho pequeno/médio, distribui em grid simétrico de 2 colunas
  if (maxComp <= 42 && total <= 130) {
    return 'alternativas-grid-2';
  }
  // Texto longo: uma por linha
  return 'alternativas-coluna';
}

interface Props {
  questao: Question;
  indice: number;
  /** Quando informado, imprime "(x,xx pt)" ao lado do enunciado. */
  valor?: number;
}

export function QuestaoImpressa({ questao: q, indice, valor }: Props) {
  const tipo = normalizarTipoQuestao(q.tipo);
  const escrita = ehQuestaoEscrita(tipo);
  const linhas = escrita ? linhasParaResposta(tipo, q.linhas_resposta) : 0;
  const longa = escrita && linhas > LIMITE_LINHAS_COLUNA;

  return (
    <div className={`questao${longa ? ' questao-longa' : ''}`}>
      <div className="questao-enunciado">
        {renderLightMarkup(q.statement, `p-${q.id}`, <span className="questao-num">{indice + 1}. </span>)}
        {valor !== undefined && (
          <>
            {' '}
            <span style={{ fontSize: '0.8em', color: '#666' }}>({valor.toFixed(2)} pt)</span>
          </>
        )}
      </div>
      {q.image_url && <img src={q.image_url} alt="" className="questao-img" />}

      {escrita ? (
        <div className="linhas-resposta">
          {Array.from({ length: linhas }, (_, i) => (
            <div className="linha-resposta" key={i} />
          ))}
        </div>
      ) : (
        <div className={obterClasseLayoutAlternativas(q)}>
          {q.alternatives.map((a) => (
            <div className="alternativa" key={a.letter}>
              <b>{a.letter})</b>
              <div className="alternativa-texto">{renderLightMarkup(a.text, `p-${q.id}-${a.letter}`, undefined, 'left')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
