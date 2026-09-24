export interface ParteBarra { nome: string; valor: number; cor: string }
export interface ItemBarra { rotulo: string; partes: ParteBarra[]; id?: string }

interface BarrasPorTurmaProps {
  itens: ItemBarra[];
  vazio?: string;
  rotuloTotal?: string;
  // Torna as linhas clicáveis. `item` é null quando clicam na linha TOTAL.
  onSelecionar?: (item: ItemBarra | null) => void;
  // Rótulo (ItemBarra.rotulo) atualmente selecionado: os demais ficam esmaecidos.
  selecionado?: string | null;
}

function porcentagem(valor: number, total: number): string {
  return `${((valor / total) * 100).toFixed(1).replace('.', ',')}%`;
}

// Barras horizontais, uma linha por item (turma). A primeira linha é o TOTAL (referência,
// 100% da largura) e cada item é dimensionado em relação a ele, com "quantidade · % do total".
// Itens com várias partes ficam empilhados; a linha de total soma cada parte.
export function BarrasPorTurma({ itens, vazio = 'Sem dados.', rotuloTotal = 'Total', onSelecionar, selecionado }: BarrasPorTurmaProps) {
  const somaItem = (i: ItemBarra) => i.partes.reduce((a, p) => a + p.valor, 0);
  const total = itens.reduce((a, i) => a + somaItem(i), 0);

  if (itens.length === 0 || total === 0) {
    return <p className="text-xs text-gray-600 py-2">{vazio}</p>;
  }

  const legenda = itens[0].partes;
  const linhaTotal: ItemBarra = {
    rotulo: rotuloTotal,
    partes: legenda.map((p, idx) => ({ ...p, valor: itens.reduce((a, i) => a + (i.partes[idx]?.valor ?? 0), 0) })),
  };

  const linha = (item: ItemBarra, destaque: boolean) => {
    const soma = somaItem(item);
    const esmaecida = !destaque && selecionado != null && selecionado !== item.rotulo;
    const conteudo = (
      <>
        <span className={`w-28 flex-shrink-0 truncate text-left ${destaque ? 'font-black text-ms-main uppercase' : 'text-gray-400'}`} title={item.rotulo}>{item.rotulo}</span>
        <div className="flex-1 h-4 flex rounded overflow-hidden bg-gray-700/30">
          {item.partes.map((p) => (
            p.valor > 0 && <div key={p.nome} title={`${p.nome}: ${p.valor} (${porcentagem(p.valor, total)} do total)`} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />
          ))}
        </div>
        <span className="w-24 text-right whitespace-nowrap">
          <b className="text-ms-main">{soma}</b>
          <span className="text-gray-500"> · {destaque ? '100%' : porcentagem(soma, total)}</span>
        </span>
      </>
    );
    const classes = `w-full flex items-center gap-2 text-xs ${destaque ? 'pb-1 mb-1 border-b border-gray-700' : ''} ${esmaecida ? 'opacity-40' : ''}`;
    if (!onSelecionar) return <div key={item.rotulo} className={classes}>{conteudo}</div>;
    return (
      <button
        key={item.rotulo}
        type="button"
        onClick={() => onSelecionar(destaque ? null : item)}
        aria-pressed={!destaque && selecionado === item.rotulo}
        aria-label={destaque ? `Ver todos (${soma})` : `${item.rotulo}: ${soma}. Ver dados`}
        className={`${classes} rounded hover:bg-gray-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue`}
      >
        {conteudo}
      </button>
    );
  };

  return (
    <div className="space-y-1" role={onSelecionar ? 'group' : 'img'} aria-label={`${rotuloTotal}: ${total}. ${itens.map((i) => `${i.rotulo}: ${somaItem(i)}`).join('; ')}`}>
      {linha(linhaTotal, true)}
      {itens.map((item) => linha(item, false))}
      {legenda.length > 1 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {legenda.map((p) => (
            <span key={p.nome} className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.cor }} /> {p.nome}
            </span>
          ))}
        </div>
      )}
      {onSelecionar && <p className="text-[10px] text-gray-600 pt-1">Clique em uma linha para ver os dados.</p>}
    </div>
  );
}
