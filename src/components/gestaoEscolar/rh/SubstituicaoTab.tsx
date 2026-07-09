import { useEffect, useState } from 'react';
import { Loader2, Plus, Info } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { Substituicao } from '../../../types/rh';
import { listarSubstituicoes, criarSubstituicao, atribuirSubstituto, marcarSubstituicaoFormalizada } from '../../../services/rhService';
import { listarProfessoresParaSelecao, listarTurmas } from '../../../services/agendamentoService';

export function SubstituicaoTab() {
  const { usuarioId } = useAuth();
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [novo, setNovo] = useState({ servidor_ausente_id: '', substituto_id: '', turma_id: '', aula_ref: '', data: today, observacoes: '' });

  async function carregar() {
    setLoading(true);
    try {
      const [listaProfessores, listaTurmas, listaSubstituicoes] = await Promise.all([listarProfessoresParaSelecao(), listarTurmas(), listarSubstituicoes()]);
      setProfessores(listaProfessores);
      setTurmas(listaTurmas);
      setSubstituicoes(listaSubstituicoes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.servidor_ausente_id || (!novo.turma_id && !novo.aula_ref) || !usuarioId) {
      setErro('Selecione o servidor ausente e a turma (ou descreva a aula) coberta.');
      return;
    }
    setErro(null);
    try {
      await criarSubstituicao({
        servidor_ausente_id: novo.servidor_ausente_id,
        substituto_id: novo.substituto_id || null,
        turma_id: novo.turma_id || null,
        aula_ref: novo.aula_ref || null,
        data: novo.data,
        observacoes: novo.observacoes || null,
        registrado_por: usuarioId,
      });
      setNovo({ servidor_ausente_id: '', substituto_id: '', turma_id: '', aula_ref: '', data: today, observacoes: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar substituição.');
    }
  }

  async function handleAtribuirSubstituto(id: string, substitutoId: string) {
    await atribuirSubstituto(id, substitutoId);
    await carregar();
  }

  async function handleToggleFormalizada(s: Substituicao) {
    await marcarSubstituicaoFormalizada(s.id, s.status !== 'FORMALIZADA_SED');
    await carregar();
  }

  function nomeProfessor(id: string | null) {
    return professores.find((p) => p.id === id)?.nome ?? '—';
  }

  function nomeTurma(id: string | null) {
    return turmas.find((t) => t.id === id)?.nome ?? null;
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs text-blue-300 flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Arranjo interno de cobertura — registro informativo, não formaliza nada perante a SED/DRE (isso depende do
        PAS + Diário Oficial). Diferente do espelhamento automático de turmas ao registrar uma licença com substituto.
      </div>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova substituição</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novo.servidor_ausente_id} onChange={(e) => setNovo({ ...novo, servidor_ausente_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Servidor ausente...</option>
            {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={novo.substituto_id} onChange={(e) => setNovo({ ...novo, substituto_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Substituto (opcional, pode ficar em aberto)...</option>
            {professores.filter((p) => p.id !== novo.servidor_ausente_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={novo.turma_id} onChange={(e) => setNovo({ ...novo, turma_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Turma (opcional)...</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <input placeholder="Ou descreva a aula (ex.: Ed. Física 6ºB, 3º horário)" value={novo.aula_ref} onChange={(e) => setNovo({ ...novo, aula_ref: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <button onClick={handleCriar} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </div>

      <div className="space-y-2">
        {substituicoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma substituição registrada.</p>
        ) : (
          substituicoes.map((s) => (
            <div key={s.id} className="px-4 py-3 bg-ms-card border border-gray-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-ms-main">
                    {nomeProfessor(s.servidor_ausente_id)} — {nomeTurma(s.turma_id) ?? s.aula_ref}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border ${
                  s.status === 'FORMALIZADA_SED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {s.status === 'FORMALIZADA_SED' ? 'Formalizada SED' : 'Arranjo interno'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {s.substituto_id ? (
                  <span className="text-xs text-gray-400">Cobertura: <b className="text-ms-main">{nomeProfessor(s.substituto_id)}</b></span>
                ) : (
                  <select
                    onChange={(e) => e.target.value && handleAtribuirSubstituto(s.id, e.target.value)}
                    defaultValue=""
                    className="px-2 py-1.5 bg-ms-dark border border-amber-500/30 rounded-lg text-xs text-amber-400"
                  >
                    <option value="" disabled>Atribuir substituto (pendente)...</option>
                    {professores.filter((p) => p.id !== s.servidor_ausente_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                )}
                <button onClick={() => handleToggleFormalizada(s)} className="text-[11px] font-bold text-gray-400 hover:text-gray-200 underline">
                  {s.status === 'FORMALIZADA_SED' ? 'Marcar como arranjo interno' : 'Marcar como formalizada (rótulo)'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
