import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { GraficoEvolucao } from './charts';
import type { SerieGrafico } from './charts';
import { MEDIA_APROVACAO } from './notasService';
import type { AlunoResumo, DadosNotas } from './notasService';

const PALETA = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#8b5cf6', '#eab308'];
const CATEGORIAS = ['1º Bim', '2º Bim', '3º Bim', '4º Bim'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface EvolucaoNotasModalProps {
  dados: DadosNotas;
  bimestreDestaque?: number;
  onClose: () => void;
}

type SerieComId = SerieGrafico & { id: string };

// Dados por trás de um ponto/barra: nota de cada aluno (dos filtros ativos) numa disciplina e bimestre.
function NotasDisciplinaModal({ dados, alunos, disciplinaId, disciplina, bimestre, onClose }: {
  dados: DadosNotas; alunos: AlunoResumo[]; disciplinaId: string; disciplina: string; bimestre: number; onClose: () => void;
}) {
  const turmas = new Map(dados.turmas.map((t) => [t.id, t.nome]));
  const linhas = alunos
    .map((a) => ({ aluno: a, nota: dados.notas[a.id]?.[disciplinaId]?.[bimestre - 1] ?? null }))
    .filter((l): l is { aluno: AlunoResumo; nota: number } => l.nota !== null)
    .sort((a, b) => a.nota - b.nota || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
  const abaixo = linhas.filter((l) => l.nota < MEDIA_APROVACAO).length;
  const media = linhas.length ? linhas.reduce((s, l) => s + l.nota, 0) / linhas.length : 0;

  return (
    <ModalShell titulo={`${disciplina} — ${bimestre}º bimestre`} onClose={onClose} largura="max-w-2xl">
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Nenhuma nota lançada para este filtro.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            {linhas.length} aluno(s) · média <b className="text-ms-main">{fmt(media)}</b> · <b className="text-amber-400">{abaixo}</b> abaixo de {fmt(MEDIA_APROVACAO)} · <b className="text-green-500">{linhas.length - abaixo}</b> na média ou acima
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-500"><th className="py-1.5">Aluno</th><th>Turma</th><th className="text-right">Nota</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.aluno.id} className="border-t border-gray-800">
                  <td className="py-1.5 text-ms-main">{l.aluno.nome}</td>
                  <td className="text-gray-400">{turmas.get(l.aluno.turma_id) ?? '—'}</td>
                  <td className={`text-right font-bold ${l.nota < MEDIA_APROVACAO ? 'text-amber-400' : 'text-green-500'}`}>{fmt(l.nota)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}

export function EvolucaoNotasModal({ dados, bimestreDestaque, onClose }: EvolucaoNotasModalProps) {
  const [tipo, setTipo] = useState<'linha' | 'barras'>('barras');
  const [bimestre, setBimestre] = useState(bimestreDestaque ?? 0); // 0 = todos
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<{ disciplinaId: string; disciplina: string; bimestre: number } | null>(null);

  const alunosDaTurma = useMemo(() => dados.alunos.filter((a) => !turmaId || a.turma_id === turmaId), [dados.alunos, turmaId]);
  const alunosFiltrados = useMemo(() => alunosDaTurma.filter((a) => !alunoId || a.id === alunoId), [alunosDaTurma, alunoId]);

  // Índices dos bimestres exibidos: todos (0–3) ou só o escolhido.
  const indices = useMemo(() => (bimestre === 0 ? [0, 1, 2, 3] : [bimestre - 1]), [bimestre]);

  // Média dos alunos filtrados, por disciplina e bimestre (ignora quem não tem nota naquele bimestre).
  const series: SerieComId[] = useMemo(() => {
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
      .map(([id, { soma, qtd }]) => ({
        id,
        nome: nomes.get(id) ?? 'Disciplina',
        valores: indices.map((i) => (qtd[i] ? soma[i] / qtd[i] : null)),
      }))
      .filter((s) => s.valores.some((v) => v !== null)) // some do gráfico disciplina sem nota no bimestre escolhido
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((s, i) => ({ ...s, cor: PALETA[i % PALETA.length] }));
  }, [alunosFiltrados, dados.notas, dados.disciplinas, indices]);

  const visiveis = series.filter((s) => !ocultas.has(s.id));
  const categorias = indices.map((i) => CATEGORIAS[i]);

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
          <select aria-label="Filtrar por bimestre" value={bimestre} onChange={(e) => setBimestre(Number(e.target.value))} className={seletor}>
            <option value={0}>Todos os bimestres</option>
            {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b}º Bimestre</option>)}
          </select>
          <select aria-label="Filtrar por turma" value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoId(''); }} className={seletor}>
            <option value="">Todas as turmas</option>
            {dados.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select aria-label="Filtrar por aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={seletor}>
            <option value="">Todos os alunos ({alunosDaTurma.length})</option>
            {alunosDaTurma.map((a) => <option key={a.id} value={a.id}>{a.aluno_numero}. {a.nome}</option>)}
          </select>
          <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-700" role="group" aria-label="Tipo de gráfico">
            {(['barras', 'linha'] as const).map((t) => (
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
            <GraficoEvolucao
              categorias={categorias}
              series={visiveis}
              tipo={tipo}
              destaque={bimestre === 0 && bimestreDestaque ? bimestreDestaque - 1 : undefined}
              onSelecionar={(s, c) => setDetalhe({ disciplinaId: visiveis[s].id, disciplina: visiveis[s].nome, bimestre: indices[c] + 1 })}
            />
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
              Passe o mouse para ver a disciplina; clique em uma barra ou ponto para ver as notas dos alunos. Cada valor é a média dos alunos filtrados naquela disciplina. Bimestres sem nota lançada não aparecem. A linha tracejada marca a média 6,0.
            </p>
          </>
        )}
      </div>

      {detalhe && (
        <NotasDisciplinaModal
          dados={dados}
          alunos={alunosFiltrados}
          disciplinaId={detalhe.disciplinaId}
          disciplina={detalhe.disciplina}
          bimestre={detalhe.bimestre}
          onClose={() => setDetalhe(null)}
        />
      )}
    </ModalShell>
  );
}
