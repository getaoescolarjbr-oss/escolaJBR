import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Link as LinkIcon, Trash2, Loader2 } from 'lucide-react';
import type { Pessoa } from '../../types/pessoas';
import { listarPessoas, excluirPessoa } from '../../services/pessoasService';
import { PessoaFormModal } from './PessoaFormModal';
import { PessoaVinculosModal } from './PessoaVinculosModal';

export function PessoasPanel() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Pessoa | null | 'novo'>(null);
  const [verVinculos, setVerVinculos] = useState<Pessoa | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setPessoas(await listarPessoas(busca));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function handleExcluir(p: Pessoa) {
    if (!confirm(`Excluir o cadastro de ${p.nome}? Isso não remove matrícula/dados funcionais já vinculados.`)) return;
    try {
      await excluirPessoa(p.id);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
        </div>

        <button
          onClick={() => setEditando('novo')}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue focus-visible:ring-offset-2"
        >
          <Plus className="w-5 h-5" />
          Nova Pessoa
        </button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-[#003366] border-b border-blue-900 shadow-lg">
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Nome</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">CPF</th>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Contato</th>
              <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText mb-4" />
                </td>
              </tr>
            ) : pessoas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                  Nenhuma pessoa encontrada.
                </td>
              </tr>
            ) : (
              pessoas.map((p, idx) => (
                <tr key={p.id} className={idx % 2 === 0 ? 'bg-ms-dark/20' : 'bg-transparent'}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-ms-blue/10 flex items-center justify-center text-[10px] font-black text-ms-blueText border border-ms-blueText/20">
                        {p.nome.charAt(0)}
                      </div>
                      <p className="text-sm font-black text-[#003366] uppercase tracking-tight">{p.nome}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{p.cpf || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {p.email || p.telefone || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setVerVinculos(p)}
                        className="p-2 hover:bg-ms-blue/20 text-ms-blueText rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
                        title="Ver vínculos"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditando(p)}
                        className="p-2 hover:bg-ms-blue/20 text-ms-blueText rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(p)}
                        className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <PessoaFormModal
          pessoa={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      {verVinculos && <PessoaVinculosModal pessoa={verVinculos} onClose={() => setVerVinculos(null)} />}
    </div>
  );
}
