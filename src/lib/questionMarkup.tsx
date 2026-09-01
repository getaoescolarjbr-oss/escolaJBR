import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import katex from 'katex';

// Referências bibliográficas e imagens embutidas no meio do texto vêm marcadas pelo
// importador como [[REF:texto]] / [[IMG:url]] / [[TABLE:json]] — mesmo formato usado
// pelo banco de questões de origem (aprova-prime), preservado aqui pra reaproveitar as
// ~12k questões importadas sem reprocessar o conteúdo.
const BLOCK_MARKER_RE = /\[\[(REF|IMG|TABLE):([\s\S]*?)\]\]/g;

function parseImageEntry(raw: string): { url: string; width: number | null } {
  const m = raw.trim().match(/^(.*)\|(\d+)$/);
  if (m) return { url: m[1].trim(), width: Number(m[2]) };
  return { url: raw.trim(), width: null };
}

const INLINE_TAG_RE = /<(strong|em|u|mark|sub|sup)>([\s\S]*?)<\/\1>|\[\[EQ:([\s\S]*?)\]\]/g;

// Fórmulas digitadas no editor (botão Σ da barra de marcação) ficam gravadas como
// [[EQ:latex]] em meio ao texto e são renderizadas aqui com KaTeX — mesma engine usada
// no editor pra pré-visualizar, então o que o professor viu ao montar é o que sai na prova.
function renderizarEquacao(latex: string, key: string): ReactNode {
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, output: 'html' });
  } catch {
    html = latex;
  }
  return <span key={key} className="katex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function decodeEntities(str: string) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(INLINE_TAG_RE.source, INLINE_TAG_RE.flags);
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(decodeEntities(text.slice(lastIndex, match.index)));
    const key = `${keyPrefix}-${i++}`;
    if (match[3] !== undefined) {
      nodes.push(renderizarEquacao(match[3], key));
    } else {
      const inner = parseInline(match[2], key);
      if (match[1] === 'strong') nodes.push(<strong key={key}>{inner}</strong>);
      else if (match[1] === 'em') nodes.push(<em key={key}>{inner}</em>);
      else if (match[1] === 'u') nodes.push(<u key={key}>{inner}</u>);
      else if (match[1] === 'sub') nodes.push(<sub key={key}>{inner}</sub>);
      else if (match[1] === 'sup') nodes.push(<sup key={key}>{inner}</sup>);
      else
        nodes.push(
          <mark key={key} className="bg-ms-gold/30 text-inherit">
            {inner}
          </mark>
        );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(decodeEntities(text.slice(lastIndex)));
  return nodes;
}

// Quebras de linha simples no conteúdo importado costumam ser apenas quebras
// manuais de largura de coluna do material de origem, não parágrafos novos —
// viram espaço para o texto fluir e o justify funcionar de fato.
function renderWithBreaks(text: string, keyPrefix: string): ReactNode[] {
  return parseInline(text.replace(/\n+/g, ' ').replace(/ {2,}/g, ' '), keyPrefix);
}

function normalizeHtmlArtifacts(content: string): string {
  return content
    .replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '[[IMG:$1]]')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<b>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>');
}

export function renderLightMarkup(content: string, keyPrefix: string, leadingPrefix?: ReactNode, imageAlign: 'center' | 'left' = 'center') {
  content = normalizeHtmlArtifacts(content);
  const isAlt = imageAlign === 'left';
  const blocks: { type: 'text' | 'ref' | 'img' | 'table'; content: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BLOCK_MARKER_RE.lastIndex = 0;
  while ((match = BLOCK_MARKER_RE.exec(content))) {
    if (match.index > lastIndex) blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    const type = match[1] === 'REF' ? 'ref' : match[1] === 'TABLE' ? 'table' : 'img';
    blocks.push({ type, content: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) blocks.push({ type: 'text', content: content.slice(lastIndex) });

  const merged: Array<{ type: 'text' | 'ref' | 'table' | 'imggroup'; content: string; images?: string[] }> = [];
  for (const block of blocks) {
    if (block.type === 'img') {
      const last = merged[merged.length - 1];
      if (last && last.type === 'imggroup') {
        last.images!.push(block.content);
        continue;
      }
      merged.push({ type: 'imggroup', content: '', images: [block.content] });
      continue;
    }
    if (block.type === 'text' && block.content.trim() === '') {
      const last = merged[merged.length - 1];
      if (last && last.type === 'imggroup') continue;
    }
    merged.push({ type: block.type, content: block.content });
  }

  const nodes: ReactNode[] = [];
  let i = 0;
  for (const block of merged) {
    if (block.type === 'imggroup') {
      const key = `${keyPrefix}-${i++}`;
      nodes.push(
        // As classes qm-* não mudam nada na tela — o Tailwind ao lado é que
        // estiliza. Existem porque a impressão monta um documento novo, sem
        // Tailwind, e precisa de um seletor estável pra limitar a imagem. Sem
        // isso a figura sai no tamanho natural e estoura a margem. Ver
        // printProva.ts.
        <div key={key} className={`qm-img-group flex flex-wrap items-start gap-2.5 ${isAlt ? 'justify-start my-1' : 'justify-center my-2'}`}>
          {block.images!.map((raw, imgIdx) => {
            const { url, width } = parseImageEntry(raw);
            return (
              <img
                key={`${key}-${imgIdx}`}
                src={url}
                alt=""
                style={!isAlt && width ? { width: `${Math.min(width, 900)}px` } : undefined}
                // O teto é RELATIVO À JANELA (vh), não fixo em px. Valor fixo não
                // sabe o tamanho da tela: 420px cabe num monitor grande mas obriga
                // a rolar num notebook, onde a área útil do card tem ~390px. Com
                // 42vh a figura sempre cabe na dobra, em qualquer resolução, e
                // ainda sobra espaço para o enunciado.
                // (Medido nas 926 figuras da UNESP: altura mediana 350px, p75 468px.)
                className={`qm-img block w-auto max-w-full rounded-lg border border-ms-border object-contain ${
                  isAlt
                    ? 'max-h-[14vh] max-w-[260px] sm:max-h-[16vh] sm:max-w-[310px]'
                    : width
                    ? 'max-h-[42vh]'
                    : 'max-h-[42vh]'
                }`}
              />
            );
          })}
        </div>
      );
    } else if (block.type === 'table') {
      if (block.content.trim() === '') continue;
      const key = `${keyPrefix}-${i++}`;
      let rows: string[][];
      try {
        rows = JSON.parse(decodeURIComponent(block.content));
      } catch {
        rows = [];
      }
      nodes.push(
        <div key={key} className="qm-table-wrap overflow-x-auto">
          <table className="qm-table my-2 w-auto border-collapse border border-ms-border text-sm">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={`${key}-r${ri}`}>
                  {row.map((cell, ci) => (
                    <td key={`${key}-r${ri}-c${ci}`} className="border border-ms-border px-3 py-1.5">
                      {parseInline(cell, `${key}-r${ri}-c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (block.type === 'ref') {
      if (block.content.trim() === '') continue;
      const key = `${keyPrefix}-${i++}`;
      nodes.push(
        <p key={key} className="qm-ref text-right text-sm italic text-ms-muted">
          {renderWithBreaks(block.content.trim(), key)}
        </p>
      );
    } else {
      for (const para of block.content.split(/\n{2,}/)) {
        if (para.trim() === '') continue;
        const key = `${keyPrefix}-${i++}`;
        nodes.push(
          <p key={key} className="text-justify">
            {renderWithBreaks(para.trim(), key)}
          </p>
        );
      }
    }
  }

  if (leadingPrefix) {
    const idx = nodes.findIndex((n) => isValidElement(n) && n.type === 'p');
    if (idx !== -1) {
      const p = nodes[idx] as ReactElement<{ children?: ReactNode }>;
      const prevChildren = Array.isArray(p.props.children) ? p.props.children : [p.props.children];
      nodes[idx] = cloneElement(p, {}, leadingPrefix, ...prevChildren);
    } else {
      nodes.unshift(<p key={`${keyPrefix}-prefix`}>{leadingPrefix}</p>);
    }
  }

  return nodes;
}

export function buildFonte(q: { banca: string | null; ano: number | null; orgao: string | null; cargo: string | null }): string {
  const bancaAno = [q.banca, q.ano].filter(Boolean).join(' ');
  const withOrgao = [bancaAno, q.orgao].filter(Boolean).join(', ');
  const withCargo = [withOrgao, q.cargo].filter(Boolean).join(' — ');
  return withCargo || 'não identificada';
}
