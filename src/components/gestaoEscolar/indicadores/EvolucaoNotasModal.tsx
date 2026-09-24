import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { GraficoEvolucao } from './charts';
import type { SerieGrafico } from './charts';
import type { DadosNotas } from './notasService';

const PALETA = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#8b5cf6', '#eab308'];
const CATEGORIAS = ['1º Bim', '2º Bim', '3º Bim', '4º Bim'];

interface EvolucaoNotasModalProps {
  dados: DadosNotas;
  bimestreDestaque?: number;
  onClose: () => void;
}

export function EvolucaoNotasModal({ dados, bimestreDestaque, onClose }: EvolucaoNotasModalProps) {
  const [tipo, setTipo] = useState<'linha' | 'barras'>('linha');
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  const alunosDaTurma = useMemo(() => dados.alunos.filter((a) => !turmaId || a.turma_id === turmaId), [dados.alunos, turmaId]);
  const alunosFiltrados = useMemo(() => alunosDaTurma.filter((a) => !alunoId || a.id === alunoId), [alunosDaTurma, alunoId]);

  // Média dos alunos filtrados, por disciplina e bimestre (ignora quem não tem nota naquele bimestre).
  const series: (SerieGrafico & { id: string })[] = useMemo(() => {
    const acum = new Map<string, { soma: number[]; qtd: number[] }>();
    for (const aluno of alunosFiltrados) {
      for (const [disc, linha] of Object.entries(dados.notas[aluno.id] ?? {})) {
        const item = acum.get(disc) ?? { soma: [0, 0, 0, 0], qtd: [0, 0, 0, 0] };
        linha.forEach((v, i) => { if (v !== null) { item.soma[i] += v; item.qtd[i]++; } });
        acum.set(disc, item);
      }
    }
    const nomes = new Map(dados.disciplinas.map((d) => [d.id, d.nome]));
    return [...acum.entries()]
      .map(([id, { soma, qtd }]) => ({ id, nome: nomes.get(id) ?? 'Disciplina', valores: soma.map((s, i) => (qtd[i] ? s / qtd[i] : null)) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((s, i) => ({ ...s, cor: PALETA[i % PALETA.length] }));
  }, [alunosFiltrados, dados.notas, dados.disciplinas]);

  const visiveis = series.filter((s) => !ocultas.has(s.id));

  function alternar(id: string) {
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  const seletor = 'bg-ms-dark border border-gray-700 text-ms-main text-sm rounded-lg px-3 py-1.5';

  return (
    <ModalShell titulo="Evolução das notas por bimestre" onClose={onClose} largura="max-w-5xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filtrar por turma" value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoId(''); }} className={seletor}>
            <option value="">Todas as turmas</option>
            {dados.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select aria-label="Filtrar por aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={seletor}>
            <option value="">Todos os alunos ({alunosDaTurma.length})</option>
            {alunosDaTurma.map((a) => <option key={a.id} value={a.id}>{a.aluno_numero}. {a.nome}</option>)}
          </select>
          <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-700" role="group" aria-label="Tipo de gráfico">
            {(['linha', 'barras'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`px-3 py-1.5 text-xs font-bold ${tipo === t ? 'bg-ms-blue text-white' : 'bg-ms-dark text-gray-400 hover:text-ms-main'}`}
              >
                {t === 'linha' ? 'Linhas' : 'Barras'}
              </button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nenhuma nota lançada para este filtro.</p>
        ) : (
          <>
            <GraficoEvolucao categorias={CATEGORIAS} series={visiveis} tipo={tipo} destaque={bimestreDestaque ? bimestreDestaque - 1 : undefined} />
            <div className="flex flex-wrap gap-1.5">
              {series.map((s) => (
                <button
                  key={s.id}
                  onClick={() => alternar(s.id)}
                  aria-pressed={!ocultas.has(s.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] ${ocultas.has(s.id) ? 'border-gray-700 text-gray-600' : 'border-gray-600 text-ms-main'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ocultas.has(s.id) ? '#4b5563' : s.cor }} />
                  {s.nome}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              Cada ponto é a média das notas dos alunos filtrados naquela disciplina. Bimestres sem nota lançada não aparecem. A linha tracejada marca a média 6,0.
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}
