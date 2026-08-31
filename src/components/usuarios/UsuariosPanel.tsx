import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, X, Plus, Link, AlertTriangle } from 'lucide-react';
import { TODOS_PAPEIS } from '../../types/rbac';
import type { Papel } from '../../types/rbac';
import {
  listarUsuariosPapeis,
  atribuirPapel,
  revogarPapel,
  vincularServidor,
  listarUsuariosSemServidor,
} from '../../services/authService';

interface UsuarioAgrupado {
  usuarioId: string | null;
  servidorId: string | null;
  nome: string;
  email: string | null;
  ativo: boolean;
  papeis: Papel[];
  vinculado: boolean;
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

  // Estado para vincular servidor
  const [vinculandoId, setVinculandoId] = useState<string | null>(null); // servidorId sendo vinculado
  const [usuariosSemServidor, setUsuariosSemServidor] = useState<{ usuario_id: string; nome: string; email: string }[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Record<string, string>>({});

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const linhas = await listarUsuariosPapeis();
      const agrupado = new Map<string, UsuarioAgrupado>();

      for (const linha of linhas) {
        // Chave única: usuarioId se vinculado, servidorId se não vinculado
        const chave = linha.usuario_id ?? `srv_${linha.servidor_id}`;
        const atual = agrupado.get(chave) ?? {
          usuarioId: linha.usuario_id,
          servidorId: linha.servidor_id,
          nome: linha.pessoa_nome,
          email: linha.email,
          ativo: linha.ativo,
          papeis: [],
          vinculado: linha.vinculado,
        };
        if (linha.papel) atual.papeis.push(linha.papel);
        agrupado.set(chave, atual);
      }

      setUsuarios(
        Array.from(agrupado.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  const filtrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.nome.toLowerCase().includes(busca.toLowerCase()) ||
          u.email?.toLowerCase().includes(busca.toLowerCase())
      ),
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

  async function abrirVincular(servidorId: string) {
    setVinculandoId(servidorId);
    try {
      const lista = await listarUsuariosSemServidor();
      setUsuariosSemServidor(lista);
    } catch {
      setUsuariosSemServidor([]);
    }
  }

  async function handleVincular(servidorId: string) {
    const uid = usuarioSelecionado[servidorId];
    if (!uid) return;
    setProcessando(servidorId);
    try {
      await vincularServidor(servidorId, uid);
      setVinculandoId(null);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao vincular.');
    } finally {
      setProcessando(null);
    }
  }

  const naoVinculados = filtrados.filter((u) => !u.vinculado);
  const vinculados = filtrados.filter((u) => u.vinculado);

  return (
    <div className="space-y-6">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar usuário por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-300 dark:border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-400 max-w-2xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Servidores NÃO vinculados */}
          {naoVinculados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Servidores sem acesso vinculado ({naoVinculados.length})
                </h3>
              </div>
              {naoVinculados.map((u) => (
                <div
                  key={`srv_${u.servidorId}`}
                  className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/40 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-black text-ms-main">{u.nome}</p>
                      <p className="text-xs text-gray-500">{u.email ?? 'Sem e-mail cadastrado'}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Não vinculado — sem acesso ao sistema
                      </p>
                    </div>
                    {vinculandoId !== u.servidorId ? (
                      <button
                        onClick={() => abrirVincular(u.servidorId!)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-all"
                      >
                        <Link className="w-4 h-4" />
                        Vincular conta
                      </button>
                    ) : (
                      <div className="flex gap-2 flex-wrap items-center">
                        <select
                          value={usuarioSelecionado[u.servidorId!] ?? ''}
                          onChange={(e) =>
                            setUsuarioSelecionado((prev) => ({ ...prev, [u.servidorId!]: e.target.value }))
                          }
                          className="px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                        >
                          <option value="">— Selecione a conta —</option>
                          {usuariosSemServidor.map((usr) => (
                            <option key={usr.usuario_id} value={usr.usuario_id}>
                              {usr.nome} ({usr.email})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleVincular(u.servidorId!)}
                          disabled={!usuarioSelecionado[u.servidorId!] || processando === u.servidorId}
                          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setVinculandoId(null)}
                          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usuários vinculados */}
          <div className="space-y-3">
            {naoVinculados.length > 0 && (
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider">
                Usuários com acesso ({vinculados.length})
              </h3>
            )}
            {vinculados.map((u) => {
              const disponiveis = TODOS_PAPEIS.filter((p) => !u.papeis.includes(p));
              const key = u.usuarioId!;
              return (
                <div key={key} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-black text-ms-main">{u.nome}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    {!u.ativo && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-400/20">
                        Inativo
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {u.papeis.length === 0 && (
                      <p className="text-xs text-gray-500">Nenhuma função atribuída.</p>
                    )}
                    {u.papeis.map((p) => (
                      <span
                        key={p}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ms-blue/10 text-ms-blueText border border-ms-blueText/20"
                      >
                        {ROTULOS_PAPEL[p]}
                        <button
                          onClick={() => handleRemover(key, p)}
                          disabled={processando === key}
                          aria-label={`Remover função ${ROTULOS_PAPEL[p]}`}
                          className="hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {disponiveis.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      <select
                        value={novoPapel[key] ?? disponiveis[0]}
                        onChange={(e) =>
                          setNovoPapel({ ...novoPapel, [key]: e.target.value as Papel })
                        }
                        className="px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      >
                        {disponiveis.map((p) => (
                          <option key={p} value={p}>
                            {ROTULOS_PAPEL[p]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAdicionar(key)}
                        disabled={processando === key}
                        className="flex items-center gap-1.5 px-3 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue focus-visible:ring-offset-2"
                      >
                        <Plus className="w-4 h-4" /> Adicionar função
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtrados.length === 0 && (
              <p className="text-sm text-gray-500">Nenhum usuário encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
