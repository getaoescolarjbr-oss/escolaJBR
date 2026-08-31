import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, X, Plus } from 'lucide-react';
import { TODOS_PAPEIS } from '../../types/rbac';
import type { Papel } from '../../types/rbac';
import { listarUsuariosPapeis, atribuirPapel, revogarPapel } from '../../services/authService';

interface UsuarioAgrupado {
  usuarioId: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  papeis: Papel[];
}

const ROTULOS_PAPEL: Record<Papel, string> = {
  GESTAO: 'Gestão',
  SECRETARIA: 'Secretaria',
  COORDENACAO: 'Coordenação Geral',
  COORDENACAO_AREA: 'Coordenador de Área (PCA)',
  PROFESSOR: 'Professor',
  PCPI: 'PCPI (Recursos e Agendamento)',
  NUTRICAO: 'Nutrição',
  BIBLIOTECA: 'Biblioteca',
  RESPONSAVEL: 'Responsável',
  INSPETOR: 'Inspetor',
  ALUNO: 'Aluno',
};

export function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState<UsuarioAgrupado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [novoPapel, setNovoPapel] = useState<Record<string, Papel>>({});

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const linhas = await listarUsuariosPapeis();
      const agrupado = new Map<string, UsuarioAgrupado>();
      for (const linha of linhas) {
        const atual = agrupado.get(linha.usuario_id) ?? {
          usuarioId: linha.usuario_id,
          nome: linha.pessoa_nome,
          email: linha.email,
          ativo: linha.ativo,
          papeis: [],
        };
        if (linha.papel) atual.papeis.push(linha.papel);
        agrupado.set(linha.usuario_id, atual);
      }
      setUsuarios(Array.from(agrupado.values()).sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários. Só GESTAO pode acessar esta tela.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  const filtrados = useMemo(
    () => usuarios.filter((u) => u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email?.toLowerCase().includes(busca.toLowerCase())),
    [usuarios, busca]
  );

  async function handleAdicionar(usuarioId: string) {
    const papel = novoPapel[usuarioId];
    if (!papel) return;
    setProcessando(usuarioId);
    try {
      await atribuirPapel(usuarioId, papel);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atribuir função.');
    } finally {
      setProcessando(null);
    }
  }

  async function handleRemover(usuarioId: string, papel: Papel) {
    if (!confirm(`Remover a função ${ROTULOS_PAPEL[papel]} deste usuário?`)) return;
    setProcessando(usuarioId);
    try {
      await revogarPapel(usuarioId, papel);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover função.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar usuário por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400 max-w-2xl">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((u) => {
            const disponiveis = TODOS_PAPEIS.filter((p) => !u.papeis.includes(p));
            return (
              <div key={u.usuarioId} className="bg-ms-card border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-black text-ms-main">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  {!u.ativo && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {u.papeis.length === 0 && <p className="text-xs text-gray-500">Nenhuma função atribuída.</p>}
                  {u.papeis.map((p) => (
                    <span key={p} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ms-blue/10 text-ms-blueText border border-ms-blueText/20">
                      {ROTULOS_PAPEL[p]}
                      <button
                        onClick={() => handleRemover(u.usuarioId, p)}
                        disabled={processando === u.usuarioId}
                        aria-label={`Remover função ${ROTULOS_PAPEL[p]}`}
                        className="hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {disponiveis.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    <select
                      value={novoPapel[u.usuarioId] ?? disponiveis[0]}
                      onChange={(e) => setNovoPapel({ ...novoPapel, [u.usuarioId]: e.target.value as Papel })}
                      className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                    >
                      {disponiveis.map((p) => (
                        <option key={p} value={p}>{ROTULOS_PAPEL[p]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAdicionar(u.usuarioId)}
                      disabled={processando === u.usuarioId}
                      className="flex items-center gap-1.5 px-3 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue focus-visible:ring-offset-2"
                    >
                      <Plus className="w-4 h-4" /> Adicionar função
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtrados.length === 0 && <p className="text-sm text-gray-500">Nenhum usuário encontrado.</p>}
        </div>
      )}
    </div>
  );
}
