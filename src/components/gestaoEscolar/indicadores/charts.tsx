// Gráficos SVG simples (o projeto não tem biblioteca de gráficos).

export function Donut({ valor, total, cor = '#22c55e' }: { valor: number; total: number; cor?: string }) {
  const raio = 36;
  const circ = 2 * Math.PI * raio;
  const pct = total > 0 ? Math.min(valor / total, 1) : 0;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`${valor} de ${total}`}>
      <circle cx="48" cy="48" r={raio} fill="none" stroke="#374151" strokeWidth="10" />
      <circle
        cx="48" cy="48" r={raio} fill="none" stroke={cor} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${circ * pct} ${circ}`} transform="rotate(-90 48 48)"
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="800" fill="currentColor" className="text-ms-main">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export function BarraProgresso({ valor, total, rotulo, cor = '#22c55e' }: { valor: number; total: number; rotulo: string; cor?: string }) {
  const pct = total > 0 ? Math.min((valor / total) * 100, 100) : 0;
  return (
    <div className="h-2.5 rounded-full bg-gray-700/60 overflow-hidden" role="img" aria-label={rotulo}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
    </div>
  );
}

export interface SerieGrafico {
  nome: string;
  cor: string;
  valores: (number | null)[];
}

interface GraficoEvolucaoProps {
  categorias: string[];
  series: SerieGrafico[];
  tipo: 'linha' | 'barras';
  destaque?: number;
}

const L = 640;
const A = 280;
const M = { e: 36, d: 12, t: 12, b: 28 };

// Escala fixa 0–10 (nota). Valor null = bimestre sem nota lançada (não plota).
export function GraficoEvolucao({ categorias, series, tipo, destaque }: GraficoEvolucaoProps) {
  const larguraUtil = L - M.e - M.d;
  const alturaUtil = A - M.t - M.b;
  const passo = larguraUtil / categorias.length;
  const y = (v: number) => M.t + alturaUtil * (1 - v / 10);
  const xCentro = (i: number) => M.e + passo * (i + 0.5);
  const larguraBarra = Math.max(4, Math.min(28, (passo * 0.8) / Math.max(series.length, 1)));

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img" aria-label="Evolução das notas por bimestre">
      {[0, 2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={M.e} x2={L - M.d} y1={y(v)} y2={y(v)} stroke="#374151" strokeWidth={v === 6 ? 1.5 : 0.5} strokeDasharray={v === 6 ? '4 3' : undefined} />
          <text x={M.e - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
        </g>
      ))}
      {categorias.map((c, i) => (
        <text key={c} x={xCentro(i)} y={A - 8} textAnchor="middle" fontSize="11" fontWeight={destaque === i ? 800 : 500} fill={destaque === i ? '#2563eb' : '#9ca3af'}>{c}</text>
      ))}
      {tipo === 'linha' &&
        series.map((s) => {
          const pontos = s.valores.map((v, i) => (v === null ? null : { x: xCentro(i), y: y(v), v }));
          const trecho = pontos.filter((p): p is { x: number; y: number; v: number } => p !== null);
          return (
            <g key={s.nome}>
              {trecho.length > 1 && <polyline fill="none" stroke={s.cor} strokeWidth="2" points={trecho.map((p) => `${p.x},${p.y}`).join(' ')} />}
              {trecho.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={s.cor}><title>{`${s.nome}: ${p.v.toFixed(1)}`}</title></circle>
              ))}
            </g>
          );
        })}
      {tipo === 'barras' &&
        series.map((s, si) =>
          s.valores.map((v, i) => {
            if (v === null) return null;
            const x = xCentro(i) - (series.length * larguraBarra) / 2 + si * larguraBarra;
            return (
              <rect key={`${s.nome}-${i}`} x={x} y={y(v)} width={larguraBarra - 1} height={y(0) - y(v)} fill={s.cor} rx="1.5">
                <title>{`${s.nome}: ${v.toFixed(1)}`}</title>
              </rect>
            );
          })
        )}
    </svg>
  );
}
