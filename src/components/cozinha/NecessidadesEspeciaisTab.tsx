import { useEffect, useState } from 'react';
import { Loader2, Plus, Upload, FileText, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import type { NecessidadeEspecial, TipoNecessidadeEspecial } from '../../types/cozinha';
import {
  listarNecessidadesEspeciais,
  criarNecessidadeEspecial,
  atualizarNecessidadeEspecial,
  enviarLaudoNecessidadeEspecial,
  obterUrlLaudoNecessidadeEspecial,
} from '../../services/cozinhaService';

interface AlunoOpcao {
  id: string;
  nome: string;
}

const ROTULOS_TIPO: Record<TipoNecessidadeEspecial, string> = {
  ALERGIA: 'Alergia',
  INTOLERANCIA: 'Intolerância',
  CELIACO: 'Celíaco',
  DIABETES: 'Diabetes',
  SELETIVIDADE: 'Seletividade alimentar',
  OUTRO: 'Outro',
};

export function NecessidadesEspeciaisTab() {
  const { usuarioId } = useAuth();
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [necessidades, setNecessidades] = useState<NecessidadeEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoLaudo, setEnviandoLaudo] = useState<string | null>(null);
  const [novo, setNovo] = useState({ aluno_id: '', tipo: 'ALERGIA' as TipoNecessidadeEspecial, descricao: '', adaptacao: '' });

  async function carregar() {
    setLoading(true);
    try {
      const [{ data: listaAlunos }, listaNecessidades] = await Promise.all([
        supabase.from('alunos').select('id, nome').order('nome'),
        listarNecessidadesEspeciais(),
      ]);
      setAlunos(listaAlunos ?? []);
      setNecessidades(listaNecessidades);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.aluno_id || !usuarioId) {
      setErro('Selecione o aluno.');
      return;
    }
    setErro(null);
    try {
      await criarNecessidadeEspecial({
        aluno_id: novo.aluno_id,
        tipo: novo.tipo,
        descricao: novo.descricao || null,
        adaptacao: novo.adaptacao || null,
        criado_por: usuarioId,
      });
      setNovo({ aluno_id: '', tipo: 'ALERGIA', descricao: '', adaptacao: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar (verifique se há consentimento de dados sensíveis aceito para esta pessoa).');
    }
  }

  async function handleToggleAtivo(n: NecessidadeEspecial) {
    await atualizarNecessidadeEspecial(n.id, { ativo: !n.ativo });
    await carregar();
  }

  async function handleEnviarLaudo(necessidadeId: string, arquivo: File) {
    setEnviandoLaudo(necessidadeId);
    setErro(null);
    try {
      await enviarLaudoNecessidadeEspecial(necessidadeId, arquivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar laudo.');
    } finally {
      setEnviandoLaudo(null);
    }
  }

  async function handleVerLaudo(n: NecessidadeEspecial) {
    try {
      const url = await obterUrlLaudoNecessidadeEspecial(n);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir laudo.');
    }
  }

  function nomeAluno(alunoId: string) {
    return alunos.find((a) => a.id === alunoId)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="p-3 bg-amber-950/20 border border-amber-900/50 rounded-lg text-xs text-amber-400 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Dado sensível de saúde (LGPD). Visível apenas a Nutrição e Gestão. O cadastro exige consentimento de dados
        sensíveis aceito pelo responsável — sem ele, o servidor recusa o registro.
      </div>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova necessidade alimentar especial</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novo.aluno_id} onChange={(e) => setNovo({ ...novo, aluno_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Aluno...</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoNecessidadeEspecial })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <textarea placeholder="Descrição" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-20" />
        <textarea placeholder="Adaptação de cardápio" value={novo.adaptacao} onChange={(e) => setNovo({ ...novo, adaptacao: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-20" />
        <button onClick={handleCriar} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Cadastrar
        </button>
      </div>

      <div className="space-y-2">
        {necessidades.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma necessidade especial cadastrada.</p>
        ) : (
          necessidades.map((n) => (
            <div key={n.id} className={`px-4 py-3 rounded-xl border space-y-2 ${n.ativo ? 'bg-ms-card border-gray-800' : 'bg-ms-dark border-gray-800 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-ms-main">{nomeAluno(n.aluno_id)} — {ROTULOS_TIPO[n.tipo]}</p>
                  {n.descricao && <p className="text-xs text-gray-500">{n.descricao}</p>}
                  {n.adaptacao && <p className="text-xs text-gray-400 mt-1">Adaptação: {n.adaptacao}</p>}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
                  <input type="checkbox" checked={n.ativo} onChange={() => handleToggleAtivo(n)} /> Ativo
                </label>
              </div>
              <div className="flex items-center gap-3">
                {n.laudo_arquivo_path ? (
                  <button onClick={() => handleVerLaudo(n)} className="flex items-center gap-1.5 text-xs font-bold text-ms-blue hover:text-blue-400">
                    <FileText className="w-3.5 h-3.5" /> Ver laudo anexado
                  </button>
                ) : (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer">
                    {enviandoLaudo === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Anexar laudo
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleEnviarLaudo(n.id, file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
