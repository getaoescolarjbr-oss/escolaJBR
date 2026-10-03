import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Campo da redação digitada pelo aluno. Difere da caixa de resposta comum em três pontos que
// importam para a correção:
//  * mostra uma estimativa de LINHAS da folha (a regra do ENEM é de 8 a 30 linhas);
//  * não aceita colar nem arrastar texto: a redação precisa ser escrita pelo aluno, não copiada dos
//    textos motivadores;
//  * desliga o corretor ortográfico do navegador, porque os desvios de escrita são justamente o que
//    a Competência 1 avalia.

/** Largura média de uma linha manuscrita da folha, em caracteres. É estimativa, não limite rígido. */
const CARACTERES_POR_LINHA = 75;
const LINHAS_MINIMAS = 8;
const LINHAS_MAXIMAS = 30;
const LIMITE_CARACTERES = 8000;

function estimarLinhas(texto: string): number {
  if (!texto.trim()) return 0;
  return texto
    .split('\n')
    .reduce((soma, paragrafo) => soma + (paragrafo.trim() ? Math.ceil(paragrafo.length / CARACTERES_POR_LINHA) : 0), 0);
}

export type EstadoSalvamento = { tipo: 'salvando' } | { tipo: 'salvo'; hora: string } | { tipo: 'erro'; mensagem: string } | null;

interface Props {
  value: string;
  onChange?: (texto: string) => void;
  somenteLeitura: boolean;
  salvamento?: EstadoSalvamento;
}

export function RedacaoEditor({ value, onChange, somenteLeitura, salvamento }: Props) {
  const [avisoColar, setAvisoColar] = useState(false);
  const timer = useRef<number | null>(null);

  const linhas = estimarLinhas(value);
  const palavras = value.trim() ? value.trim().split(/\s+/).length : 0;
  const poucas = linhas > 0 && linhas < LINHAS_MINIMAS;
  const muitas = linhas > LINHAS_MAXIMAS;

  function bloquear(e: React.SyntheticEvent) {
    e.preventDefault();
    setAvisoColar(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAvisoColar(false), 4000);
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value.slice(0, LIMITE_CARACTERES))}
        onPaste={somenteLeitura ? undefined : bloquear}
        onDrop={somenteLeitura ? undefined : bloquear}
        readOnly={somenteLeitura}
        rows={18}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={somenteLeitura ? 'Sem redação enviada.' : 'Escreva a sua redação aqui. Separe os parágrafos com uma linha em branco.'}
        aria-label="Redação"
        className={`w-full px-3 py-2 bg-ms-dark border rounded-lg text-sm text-ms-main resize-y outline-none focus:ring-2 focus:ring-ms-blue leading-7 ${
          somenteLeitura ? 'border-gray-800 opacity-80' : 'border-gray-700'
        }`}
      />

      {avisoColar && (
        <p className="flex items-center gap-1.5 text-xs text-amber-500 font-medium" role="status">
          <AlertTriangle className="w-3.5 h-3.5" /> Colar texto está desativado na redação: ela precisa ser escrita por você.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ms-muted">
        <span className={muitas ? 'text-amber-500 font-bold' : poucas ? 'text-amber-500 font-bold' : ''}>
          ≈ {linhas} linha(s) da folha · {palavras} palavra(s)
          {poucas && ` — escreva ao menos ${LINHAS_MINIMAS} linhas: até 7 linhas a redação é zerada.`}
          {muitas && ` — a folha tem ${LINHAS_MAXIMAS} linhas; o que passar disso pode não ser considerado.`}
          {!poucas && !muitas && ` (de ${LINHAS_MINIMAS} a ${LINHAS_MAXIMAS})`}
        </span>
        {!somenteLeitura && salvamento !== undefined && (
          <span aria-live="polite">
            {salvamento?.tipo === 'salvando' && 'Salvando rascunho…'}
            {salvamento?.tipo === 'salvo' && `Rascunho salvo às ${salvamento.hora}`}
            {salvamento?.tipo === 'erro' && <span className="text-red-400">Não salvou o rascunho: {salvamento.mensagem}</span>}
            {!salvamento && 'O rascunho é salvo automaticamente.'}
          </span>
        )}
      </div>
      <p className="text-[11px] text-ms-muted">
        Esta redação é corrigida pelo professor — a nota não sai na hora. O estimador de linhas é aproximado.
      </p>
    </div>
  );
}
