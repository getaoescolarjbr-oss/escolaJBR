import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { BarrasPorTurma } from './BarrasPorTurma';
import { MEDIA_APROVACAO, alunosDaTurma, resumoParcialPorTurma, situacaoDoAluno } from './notasService';
import type { AlunoSituacao, DadosNotas, DisciplinaSituacao } from './notasService';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ROTULO_BIM = ['1º', '2º', '3º', '4º'];

// ---- 3º nível: disciplinas de um aluno ----

function LinhaDisciplina({ d, encerrados }: { d: DisciplinaSituacao; encerrados: number }) {
  return (
    <li className="border border-gray-800 rounded-xl p-3 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-ms-main">{d.nome}</p>
        <p className={`text-sm font-black ${d.aprovada ? 'text-green-500' : 'text-amber-400'}`}>média {fmt(d.media)}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {d.notas.map((n, i) => (
          <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded border ${i >= encerrados ? 'border-dashed border-gray-700 text-gray-500' : 'border-gray-700 text-gray-300'}`}>
            {ROTULO_BIM[i]} bim: {n === null ? '—' : fmt(n)}{i >= encerrados && n !== null ? ' (parcial)' : ''}
          </span>
        ))}
      </div>
      {!d.aprovada && (
        <p className="text-xs text-amber-400">
          Faltam <b>{fmt(d.faltaNaMedia)}</b> ponto(s) na média para chegar a {fmt(MEDIA_APROVACAO)}.
          {d.precisaPorBimestre === null
            ? ' Não há bimestre restante: resta o exame final.'
            : d.precisaPorBimestre > 10
              ? ` Mesmo tirando 10 nos ${d.restantes} bimestre(s) restantes não fecha a média: vai depender do exame final.`
              : ` Precisa de média ${fmt(d.precisaPorBimestre)} em cada um dos ${d.restantes} bimestre(s) restantes.`}
        </p>
      )}
    </li>
  );
}

function SituacaoAlunoModal({ dados, aluno, encerrados, onClose }: { dados: DadosNotas; aluno: AlunoSituacao['aluno']; encerrados: number; onClose: () => void }) {
  const { abaixo, aprovadas } = useMemo(() => situacaoDoAluno(dados, aluno.id, encerrados), [dados, aluno.id, encerrados]);
  return (
    <ModalShell titulo={`${aluno.nome} — disciplinas`} onClose={onClose} largura="max-w-2xl">
      <div className="space-y-5">
        <p className="text-[11px] text-gray-500">
          Média das notas dos {encerrados} bimestre(s) encerrado(s); a média de aprovação é {fmt(MEDIA_APROVACAO)}. Bimestre em andamento aparece como parcial e não entra na média.
        </p>
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">Faltam aprovar ({abaixo.length})</h3>
          {abaixo.length === 0 ? <p className="text-sm text-gray-500">Nenhuma disciplina abaixo da média.</p> : <ul className="space-y-2">{abaixo.map((d) => <LinhaDisciplina key={d.disciplinaId} d={d} encerrados={encerrados} />)}</ul>}
        </section>
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-green-500">Já aprovadas ({aprovadas.length})</h3>
          {aprovadas.length === 0 ? <p className="text-sm text-gray-500">Nenhuma disciplina aprovada ainda.</p> : <ul className="space-y-2">{aprovadas.map((d) => <LinhaDisciplina key={d.disciplinaId} d={d} encerrados={encerrados} />)}</ul>}
        </section>
      </div>
    </ModalShell>
  );
}

// ---- 2º nível: alunos de uma turma ----

function ListaAlunosTurmaModal({ dados, turma, encerrados, onClose }: { dados: DadosNotas; turma: { id: string; nome: string }; encerrados: number; onClose: () => void }) {
  const [aluno, setAluno] = useState<AlunoSituacao['aluno'] | null>(null);
  const lista = useMemo(() => alunosDaTurma(dados, turma.id, encerrados), [dados, turma.id, encerrados]);
  const grupos = [
    { chave: 'abaixo' as const, titulo: 'Faltam aprovar', cor: 'text-amber-400' },
    { chave: 'acima' as const, titulo: 'Já aprovados', cor: 'text-green-500' },
    { chave: 'sem' as const, titulo: 'Sem notas lançadas', cor: 'text-gray-400' },
  ];

  return (
    <ModalShell titulo={`${turma.nome} — situação dos alunos`} onClose={onClose} largura="max-w-2xl">
      <div className="space-y-5">
        <p className="text-[11px] text-gray-500">Clique no nome do aluno para ver as disciplinas que faltam aprovar e quanto falta de nota.</p>
        {grupos.map((g) => {
          const itens = lista.filter((l) => l.situacao === g.chave);
          if (itens.length === 0 && g.chave === 'sem') return null;
          return (
            <section key={g.chave} className="space-y-1.5">
              <h3 className={`text-xs font-black uppercase tracking-wider ${g.cor}`}>{g.titulo} ({itens.length})</h3>
              {itens.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum aluno.</p>
              ) : (
                <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl">
                  {itens.map((l) => (
                    <li key={l.aluno.id}>
                      <button
                        onClick={() => setAluno(l.aluno)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
                      >
                        <span className="text-sm text-ms-main">{l.aluno.aluno_numero}. {l.aluno.nome}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                          {l.situacao === 'abaixo' ? `${l.disciplinasAbaixo} disciplina(s) abaixo` : l.situacao === 'acima' ? `${l.disciplinasAprovadas} aprovadas` : '—'}
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {aluno && <SituacaoAlunoModal dados={dados} aluno={aluno} encerrados={encerrados} onClose={() => setAluno(null)} />}
    </ModalShell>
  );
}

// ---- 1º nível: gráfico por turma ----

export function SituacaoPorTurmaModal({ dados, encerrados, onClose }: { dados: DadosNotas; encerrados: number; onClose: () => void }) {
  const [turma, setTurma] = useState<{ id: string; nome: string } | null>(null);
  const porTurma = useMemo(() => resumoParcialPorTurma(dados, encerrados), [dados, encerrados]);

  return (
    <ModalShell titulo="Situação dos alunos por turma (antes do exame)" onClose={onClose} largura="max-w-2xl">
      <BarrasPorTurma
        itens={porTurma.map(({ turma: t, resumo }) => ({
          id: t.id,
          rotulo: t.nome,
          partes: [
            { nome: 'Já aprovados', valor: resumo.acimaDaMedia, cor: '#22c55e' },
            { nome: 'Faltam aprovar', valor: resumo.abaixoDaMedia, cor: '#f59e0b' },
            { nome: 'Sem notas', valor: resumo.semNotas, cor: '#6b7280' },
          ],
        }))}
        onSelecionar={(item) => { if (item?.id) setTurma({ id: item.id, nome: item.rotulo }); }}
      />
      {turma && <ListaAlunosTurmaModal dados={dados} turma={turma} encerrados={encerrados} onClose={() => setTurma(null)} />}
    </ModalShell>
  );
}
