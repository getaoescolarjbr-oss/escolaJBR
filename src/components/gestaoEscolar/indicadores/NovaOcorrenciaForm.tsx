import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface AlunoFixo { id: string; nome: string; turma_id: string }

interface NovaOcorrenciaFormProps {
  // Com aluno fixo, não mostra os seletores de turma/aluno.
  aluno?: AlunoFixo;
  onSalvo: () => void;
  onCancelar: () => void;
}

const campo = 'w-full bg-ms-dark border border-gray-700 text-ms-main text-sm rounded-lg px-3 py-2';

// Registro de ocorrência pela direção: grava já com visto do coordenador (mesmo
// comportamento de OcorrenciaModal quando isCoordinator), em nome do usuário logado.
export function NovaOcorrenciaForm({ aluno, onSalvo, onCancelar }: NovaOcorrenciaFormProps) {
  const { usuarioId } = useAuth();
  const [autor, setAutor] = useState<{ id: string; nome: string; cargo: string } | null | undefined>(undefined);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [alunos, setAlunos] = useState<AlunoFixo[]>([]);
  const [turmaId, setTurmaId] = useState(aluno?.turma_id ?? '');
  const [alunoId, setAlunoId] = useState(aluno?.id ?? '');
  const [data, setData] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuarioId) return;
    supabase.from('professores').select('id, nome, cargo').eq('user_id', usuarioId).maybeSingle()
      .then(({ data: p }) => setAutor(p ?? null));
  }, [usuarioId]);

  useEffect(() => {
    if (aluno) return;
    supabase.from('turmas').select('id, nome').order('nome').then(({ data: t }) => setTurmas(t ?? []));
  }, [aluno]);

  useEffect(() => {
    if (aluno || !turmaId) return;
    supabase.from('alunos').select('id, nome, turma_id').eq('turma_id', turmaId).eq('status', 'Ativo').order('aluno_numero')
      .then(({ data: a }) => setAlunos(a ?? []));
  }, [aluno, turmaId]);

  async function salvar() {
    if (!autor) return;
    if (!alunoId || !turmaId || !descricao.trim()) {
      setErro('Escolha a turma, o aluno e descreva a ocorrência.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const agora = new Date().toISOString();
    const { error } = await supabase.from('ocorrências').insert({
      aluno_id: alunoId,
      id_do_professor: autor.id,
      turma_id: turmaId,
      disciplina_id: null,
      descricao: descricao.trim(),
      data,
      data_registro: agora,
      visto_coordenador: true,
      data_visualizacao_coordenador: agora,
      registrado_por: autor.nome,
      registrado_por_cargo: autor.cargo,
    });
    setSalvando(false);
    if (error) {
      setErro(`Erro ao salvar: ${error.message}`);
      return;
    }
    onSalvo();
  }

  if (autor === undefined) return <Loader2 className="w-5 h-5 animate-spin text-gray-500" />;
  if (autor === null) {
    return <p className="text-sm text-amber-400">Seu usuário não tem cadastro em Professores/Servidores, então não é possível registrar ocorrência por aqui.</p>;
  }

  return (
    <div className="space-y-3">
      {aluno ? (
        <p className="text-sm text-ms-main">Aluno: <b>{aluno.nome}</b></p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select aria-label="Turma" value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setAlunoId(''); setAlunos([]); }} className={campo}>
            <option value="">Turma…</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select aria-label="Aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} disabled={!turmaId} className={campo}>
            <option value="">Aluno…</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      )}
      <input type="date" aria-label="Data do ocorrido" value={data} max={new Date().toLocaleDateString('sv-SE')} onChange={(e) => setData(e.target.value)} className={campo} />
      <textarea aria-label="Descrição" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva a ocorrência…" className={campo} />
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar} className="px-3 py-1.5 text-sm text-gray-400 hover:text-ms-main">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="px-4 py-1.5 bg-ms-blue text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Registrar
        </button>
      </div>
    </div>
  );
}
