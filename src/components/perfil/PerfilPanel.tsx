import { useEffect, useState } from 'react';
import { Loader2, Save, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Pessoa } from '../../types/pessoas';
import { obterMinhaPessoa } from '../../services/pessoasService';
import { atualizarSenha } from '../../services/authService';

const ROTULOS_PAPEL: Record<string, string> = {
  GESTAO: 'Gestão',
  SECRETARIA: 'Secretaria',
  COORDENACAO: 'Coordenação',
  PROFESSOR: 'Professor',
  NUTRICAO: 'Nutrição',
  BIBLIOTECA: 'Biblioteca',
  RESPONSAVEL: 'Responsável',
  INSPETOR: 'Inspetor',
  ALUNO: 'Aluno',
};

export function PerfilPanel() {
  const { usuarioId, papeis, session } = useAuth();
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [loading, setLoading] = useState(true);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!usuarioId) return;
    obterMinhaPessoa(usuarioId)
      .then(setPessoa)
      .finally(() => setLoading(false));
  }, [usuarioId]);

  async function handleTrocarSenha() {
    setErro(null);
    setSucesso(null);
    if (novaSenha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarSenha(novaSenha);
      setSucesso('Senha atualizada com sucesso.');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar senha.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6">
        <p className="text-lg font-black text-ms-main">{pessoa?.nome ?? session?.user?.email}</p>
        <p className="text-xs text-gray-500">{session?.user?.email}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {papeis.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhuma função atribuída ainda — fale com a Gestão.</p>
          ) : (
            papeis.map((p) => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-bold bg-ms-blue/10 text-ms-blue border border-ms-blue/20">
                {ROTULOS_PAPEL[p] ?? p}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Trocar senha
        </p>

        <div className="space-y-2">
          <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nova senha</label>
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Confirmar nova senha</label>
          <input
            type="password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>

        {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}
        {sucesso && <div className="p-3 bg-green-950/20 border border-green-900/50 rounded-lg text-sm text-green-400">{sucesso}</div>}

        <button
          onClick={handleTrocarSenha}
          disabled={salvando}
          className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue focus-visible:ring-offset-2"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar nova senha
        </button>
      </div>
    </div>
  );
}
