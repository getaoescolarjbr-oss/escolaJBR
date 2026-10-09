import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Chamadas já lançadas, uma linha por aula (data + turma + disciplina + professor), com presentes e faltas.
// O banco só devolve o que a pessoa pode ver (professor: as turmas dele; coordenação/gestão/secretaria: tudo),
// então o mesmo painel serve para os dois usos. Numa substituição, a chamada fica no diário do TITULAR.

interface Props {
  /** Fixa o professor (o do diário aberto). Sem isto, o painel mostra todos os que a pessoa pode ver e oferece o filtro. */
  professorId?: string;
}

interface LinhaChamada {
  aluno_id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string;
  data_aula: string;
  presenca: boolean;
  created_at: string;
}

interface Aula {
  chave: string;
  data: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string;
  presentes: string[];
  faltas: string[];
  lancada_em: string;
}

const TAMANHO_PAGINA = 1000;

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dias(atras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const formatarData = (iso: string) => iso.split('-').reverse().join('/');

export function ChamadasLancadasPanel({ professorId }: Props) {
  const [de, setDe] = useState(dias(30));
  const [ate, setAte] = useState(hojeIso());
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [disciplinaFiltro, setDisciplinaFiltro] = useState('');
  const [professorFiltro, setProfessorFiltro] = useState('');
  const [soComFaltas, setSoComFaltas] = useState(false);
  const [linhas, setLinhas] = useState<LinhaChamada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<Record<string, string>>({});
  const [disciplinas, setDisciplinas] = useState<Record<string, string>>({});
  const [professores, setProfessores] = useState<Record<string, string>>({});
  const [alunos, setAlunos] = useState<Record<string, { nome: string; numero: number | null }>>({});
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLinhas(null);
      setErro(null);
      try {
        const todas: LinhaChamada[] = [];
        for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
          let q = supabase
            .from('chamadas')
            .select('aluno_id, professor_id, turma_id, disciplina_id, data_aula, presenca, created_at')
            .gte('data_aula', de)
            .lte('data_aula', ate)
            .order('data_aula', { ascending: false })
            .order('created_at', { ascending: false })
            .range(inicio, inicio + TAMANHO_PAGINA - 1);
          if (professorId) q = q.eq('professor_id', professorId);
          const { data, error } = await q;
          if (error) throw error;
          todas.push(...((data ?? []) as LinhaChamada[]));
          if (!data || data.length < TAMANHO_PAGINA) break;
        }
        if (cancelado) return;
        setLinhas(todas);

        const ids = (campo: keyof LinhaChamada) => [...new Set(todas.map((l) => l[campo] as string))];
        const [t, d, p] = await Promise.all([
          supabase.from('turmas').select('id, nome').in('id', ids('turma_id')),
          supabase.from('disciplinas').select('id, nome').in('id', ids('disciplina_id')),
          supabase.from('professores').select('id, nome').in('id', ids('professor_id')),
        ]);
        if (cancelado) return;
        const mapa = (r: { data: { id: string; nome: string }[] | null }) => Object.fromEntries((r.data ?? []).map((x) => [x.id, x.nome]));
        setTurmas(mapa(t));
        setDisciplinas(mapa(d));
        setProfessores(mapa(p));
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as chamadas.');
      }
    })();
    return () => { cancelado = true; };
  }, [de, ate, professorId]);

  const aulas = useMemo<Aula[]>(() => {
    const mapa = new Map<string, Aula>();
    for (const l of linhas ?? []) {
      const chave = `${l.data_aula}|${l.professor_id}|${l.turma_id}|${l.disciplina_id}`;
      let a = mapa.get(chave);
      if (!a) {
        a = { chave, data: l.data_aula, professor_id: l.professor_id, turma_id: l.turma_id, disciplina_id: l.disciplina_id, presentes: [], faltas: [], lancada_em: l.created_at };
        mapa.set(chave, a);
      }
      (l.presenca ? a.presentes : a.faltas).push(l.aluno_id);
      if (l.created_at > a.lancada_em) a.lancada_em = l.created_at;
    }
    return [...mapa.values()].sort((x, y) => y.data.localeCompare(x.data) || (turmas[x.turma_id] ?? '').localeCompare(turmas[y.turma_id] ?? '', 'pt-BR'));
  }, [linhas, turmas]);

  const visiveis = aulas.filter(
    (a) =>
      (!turmaFiltro || a.turma_id === turmaFiltro) &&
      (!disciplinaFiltro || a.disciplina_id === disciplinaFiltro) &&
      (!professorFiltro || a.professor_id === professorFiltro) &&
      (!soComFaltas || a.faltas.length > 0)
  );

  async function abrir(a: Aula) {
    if (aberta === a.chave) {
      setAberta(null);
      return;
    }
    setAberta(a.chave);
    const faltam = [...a.faltas, ...a.presentes].filter((id) => !alunos[id]);
    if (faltam.length === 0) return;
    const { data } = await supabase.from('alunos').select('id, nome, aluno_numero').in('id', faltam);
    setAlunos((atual) => ({
      ...atual,
      ...Object.fromEntries((data ?? []).map((x: { id: string; nome: string; aluno_numero: number | null }) => [x.id, { nome: x.nome, numero: x.aluno_numero }])),
    }));
  }

  const nomesOrdenados = (ids: string[]) =>
    ids
      .map((id) => alunos[id])
      .filter(Boolean)
      .sort((x, y) => (x.numero ?? 999) - (y.numero ?? 999) || x.nome.localeCompare(y.nome, 'pt-BR'));

  const opcoes = (mapa: Record<string, string>) => Object.entries(mapa).sort((x, y) => x[1].localeCompare(y[1], 'pt-BR'));
  const campo = 'px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-xs';

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] font-bold text-ms-muted">De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${campo} block mt-0.5`} />
        </label>
        <label className="text-[11px] font-bold text-ms-muted">Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${campo} block mt-0.5`} />
        </label>
        <select value={turmaFiltro} onChange={(e) => setTurmaFiltro(e.target.value)} className={campo}>
          <option value="">Todas as turmas</option>
          {opcoes(turmas).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        <select value={disciplinaFiltro} onChange={(e) => setDisciplinaFiltro(e.target.value)} className={campo}>
          <option value="">Todas as disciplinas</option>
          {opcoes(disciplinas).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        {!professorId && (
          <select value={professorFiltro} onChange={(e) => setProfessorFiltro(e.target.value)} className={campo}>
            <option value="">Todos os professores</option>
            {opcoes(professores).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-xs font-bold text-ms-main cursor-pointer select-none pb-1.5">
          <input type="checkbox" checked={soComFaltas} onChange={(e) => setSoComFaltas(e.target.checked)} className="accent-ms-blue" />
          Só aulas com faltas
        </label>
      </div>

      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
      {!linhas && !erro && <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400 my-8" />}

      {linhas && visiveis.length === 0 && (
        <p className="text-sm text-ms-muted text-center py-8">Nenhuma chamada lançada neste período e filtro.</p>
      )}

      {linhas && visiveis.length > 0 && (
        <>
          <p className="text-[11px] text-ms-muted">
            {visiveis.length} aula(s). Numa substituição, a chamada fica no diário do professor titular.
          </p>
          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-ms-card text-ms-muted">
                <tr>
                  <th className="py-2 px-2 w-6" />
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Turma</th>
                  <th className="py-2 px-3">Disciplina</th>
                  <th className="py-2 px-3">Professor</th>
                  <th className="py-2 px-3 text-center">Presentes</th>
                  <th className="py-2 px-3 text-center">Faltas</th>
                  <th className="py-2 px-3">Lançada em</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((a) => (
                  <Fragment key={a.chave}>
                    <tr onClick={() => void abrir(a)} className="border-t border-gray-800 cursor-pointer hover:bg-ms-dark/60">
                      <td className="py-2 px-2 text-ms-muted">{aberta === a.chave ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                      <td className="py-2 px-3 font-bold text-ms-main whitespace-nowrap">{formatarData(a.data)}</td>
                      <td className="py-2 px-3 text-ms-main">{turmas[a.turma_id] ?? '—'}</td>
                      <td className="py-2 px-3 text-ms-main">{disciplinas[a.disciplina_id] ?? '—'}</td>
                      <td className="py-2 px-3 text-ms-main">{professores[a.professor_id] ?? '—'}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">{a.presentes.length}</td>
                      <td className={`py-2 px-3 text-center font-bold ${a.faltas.length ? 'text-red-400' : 'text-ms-muted'}`}>{a.faltas.length}</td>
                      <td className="py-2 px-3 text-ms-muted whitespace-nowrap">{new Date(a.lancada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                    {aberta === a.chave && (
                      <tr className="bg-ms-dark/40">
                        <td />
                        <td colSpan={7} className="py-3 px-3">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <p className="font-bold text-red-400 mb-1">Faltas ({a.faltas.length})</p>
                              {a.faltas.length === 0 ? <p className="text-ms-muted">Nenhuma.</p> : (
                                <ul className="space-y-0.5">{nomesOrdenados(a.faltas).map((x) => <li key={x.nome} className="text-ms-main">{x.numero ?? '—'} · {x.nome}</li>)}</ul>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-emerald-400 mb-1">Presentes ({a.presentes.length})</p>
                              <ul className="space-y-0.5">{nomesOrdenados(a.presentes).map((x) => <li key={x.nome} className="text-ms-muted">{x.numero ?? '—'} · {x.nome}</li>)}</ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
