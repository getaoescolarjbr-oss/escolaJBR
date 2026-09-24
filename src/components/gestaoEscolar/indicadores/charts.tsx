import { useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

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
  // Torna pontos/barras clicáveis: recebe o índice da série e da categoria clicada.
  onSelecionar?: (serie: number, categoria: number) => void;
}

const nota = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const L = 640;
const A = 280;
const M = { e: 36, d: 12, t: 12, b: 28 };

interface Dica { x: number; y: number; largura: number; nome: string; detalhe?: string; serie: number }

// Escala fixa 0–10 (nota). Valor null = bimestre sem nota lançada (não plota).
// Passar o mouse mostra o nome da disciplina (e a nota, no ponto/barra) e destaca a série.
export function GraficoEvolucao({ categorias, series, tipo, destaque, onSelecionar }: GraficoEvolucaoProps) {
  const [dica, setDica] = useState<Dica | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const larguraUtil = L - M.e - M.d;
  const alturaUtil = A - M.t - M.b;
  const passo = larguraUtil / categorias.length;
  const y = (v: number) => M.t + alturaUtil * (1 - v / 10);
  const xCentro = (i: number) => M.e + passo * (i + 0.5);
  const larguraBarra = Math.max(4, Math.min(28, (passo * 0.8) / Math.max(series.length, 1)));

  function mostrar(e: MouseEvent, serie: number, detalhe?: string) {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    setDica({ x: e.clientX - r.left, y: e.clientY - r.top, largura: r.width, nome: series[serie].nome, detalhe, serie });
  }
  const opacidade = (s: number) => (dica && dica.serie !== s ? 0.3 : 1);
  const teclado = (acao: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); acao(); } };

  return (
    <div ref={caixa} className="relative" onMouseLeave={() => setDica(null)}>
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
          series.map((s, si) => {
            const pontos = s.valores.map((v, i) => (v === null ? null : { x: xCentro(i), y: y(v), v, i }));
            const trecho = pontos.filter((p): p is { x: number; y: number; v: number; i: number } => p !== null);
            const caminho = trecho.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g key={s.nome} opacity={opacidade(si)}>
                {trecho.length > 1 && <polyline fill="none" stroke={s.cor} strokeWidth={dica?.serie === si ? 3 : 2} points={caminho} />}
                {trecho.length > 1 && (
                  <polyline fill="none" stroke="transparent" strokeWidth="14" points={caminho} onMouseMove={(e) => mostrar(e, si)} onMouseEnter={(e) => mostrar(e, si)} />
                )}
                {trecho.map((p) => (
                  <g key={p.i}>
                    <circle cx={p.x} cy={p.y} r="4" fill={s.cor} />
                    <circle
                      cx={p.x} cy={p.y} r="10" fill="transparent"
                      style={{ cursor: onSelecionar ? 'pointer' : 'default' }}
                      tabIndex={onSelecionar ? 0 : undefined}
                      role={onSelecionar ? 'button' : undefined}
                      aria-label={`${s.nome}, ${categorias[p.i]}: ${nota(p.v)}`}
                      onMouseMove={(e) => mostrar(e, si, `${categorias[p.i]}: ${nota(p.v)}`)}
                      onMouseEnter={(e) => mostrar(e, si, `${categorias[p.i]}: ${nota(p.v)}`)}
                      onClick={() => onSelecionar?.(si, p.i)}
                      onKeyDown={teclado(() => onSelecionar?.(si, p.i))}
                    />
                  </g>
                ))}
              </g>
            );
          })}

        {tipo === 'barras' &&
          series.map((s, si) =>
            s.valores.map((v, i) => {
              if (v === null) return null;
              const x = xCentro(i) - (series.length * larguraBarra) / 2 + si * larguraBarra;
              const detalhe = `${categorias[i]}: ${nota(v)}`;
              return (
                <rect
                  key={`${s.nome}-${i}`}
                  x={x} y={y(v)} width={larguraBarra - 1} height={Math.max(y(0) - y(v), 1)} fill={s.cor} rx="1.5"
                  opacity={opacidade(si)}
                  style={{ cursor: onSelecionar ? 'pointer' : 'default' }}
                  tabIndex={onSelecionar ? 0 : undefined}
                  role={onSelecionar ? 'button' : undefined}
                  aria-label={`${s.nome}, ${detalhe}`}
                  onMouseMove={(e) => mostrar(e, si, detalhe)}
                  onMouseEnter={(e) => mostrar(e, si, detalhe)}
                  onClick={() => onSelecionar?.(si, i)}
                  onKeyDown={teclado(() => onSelecionar?.(si, i))}
                />
              );
            })
          )}
      </svg>

      {dica && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{ left: Math.max(0, Math.min(dica.x + 12, dica.largura - 170)), top: Math.max(dica.y - 40, 0), background: '#111827', color: '#ffffff' }}
        >
          <p className="font-black">{dica.nome}</p>
          {dica.detalhe && <p style={{ color: '#e5e7eb' }}>{dica.detalhe}</p>}
        </div>
      )}
    </div>
  );
}
