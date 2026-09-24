import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ModalShell } from './ModalShell';
import { NovaOcorrenciaForm } from './NovaOcorrenciaForm';
import { BarrasPorTurma } from './BarrasPorTurma';

interface AlunoLinha {
  id: string;
  nome: string;
  aluno_numero: number;
  turma_id: string;
  atestado_inicio: string | null;
  turmas: { nome: string } | null;
}

interface AlunosStatusModalProps {
  status: string;
  onClose: () => void;
  onAlterado: () => void;
}

// Nesta tabela, atestado_inicio também guarda a data de transferência/remanejamento
// (ver admin/StudentManager.tsx).
const STATUS_COM_DATA = ['Remanejado', 'Transferido'];

export function AlunosStatusModal({ status, onClose, onAlterado }: AlunosStatusModalProps) {
  const [alunos, setAlunos] = useState<AlunoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const [ocorrenciaDe, setOcorrenciaDe] = useState<AlunoLinha | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from('alunos')
      .select('id, nome, aluno_numero, turma_id, atestado_inicio, turmas(nome)')
      .eq('status', status)
      .order('nome')
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        setAlunos((data ?? []) as unknown as AlunoLinha[]);
        setLoading(false);
      });
    return () => { ativo = false; };
  }, [status]);

  const turmas = useMemo(() => {
    const mapa = new Map<string, string>();
    alunos.forEach((a) => mapa.set(a.turma_id, a.turmas?.nome ?? '—'));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [alunos]);

  const visiveis = alunos.filter((a) => !turmaFiltro || a.turma_id === turmaFiltro);
  const mostraData = STATUS_COM_DATA.includes(status);

  return (
    <ModalShell titulo={`Alunos — ${status}`} onClose={onClose} largura="max-w-3xl">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <select aria-label="Filtrar por turma" value={turmaFiltro} onChange={(e) => setTurmaFiltro(e.target.value)} className="bg-ms-dark border border-gray-700 text-ms-main text-sm rounded-lg px-3 py-1.5">
            <option value="">Todas as turmas</option>
            {turmas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
          <span className="text-xs text-gray-500">{visiveis.length} aluno(s)</span>
        </div>
        {!loading && (
          <BarrasPorTurma
            itens={turmas.map(([id, nome]) => ({ rotulo: nome, partes: [{ nome: status, valor: alunos.filter((a) => a.turma_id === id).length, cor: '#3b82f6' }] }))}
            vazio="Nenhum aluno com este status."
          />
        )}
        {aviso && <p className="text-sm text-green-500">{aviso}</p>}
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" />
        ) : visiveis.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Nenhum aluno neste filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-500">
                <th className="py-1.5">Aluno</th><th>Turma</th>{mostraData && <th>Data</th>}<th />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr key={a.id} className="border-t border-gray-800">
                  <td className="py-1.5 text-ms-main">{a.nome}</td>
                  <td className="text-gray-400">{a.turmas?.nome ?? '—'}</td>
                  {mostraData && <td className="text-gray-400">{a.atestado_inicio ? new Date(`${a.atestado_inicio}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</td>}
                  <td className="text-right">
                    <button onClick={() => { setAviso(null); setOcorrenciaDe(a); }} className="text-xs font-bold text-red-400 hover:text-red-300">
                      Registrar ocorrência
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ocorrenciaDe && (
        <ModalShell titulo="Registrar ocorrência" onClose={() => setOcorrenciaDe(null)} largura="max-w-lg">
          <NovaOcorrenciaForm
            aluno={ocorrenciaDe}
            onCancelar={() => setOcorrenciaDe(null)}
            onSalvo={() => { setAviso(`Ocorrência registrada para ${ocorrenciaDe.nome}.`); setOcorrenciaDe(null); onAlterado(); }}
          />
        </ModalShell>
      )}
    </ModalShell>
  );
}
