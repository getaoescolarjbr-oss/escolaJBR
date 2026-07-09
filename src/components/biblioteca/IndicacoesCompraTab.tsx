import { useEffect, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import type { AlunoBusca, IndicacaoCompraDetalhada } from '../../services/bibliotecaService';
import type { StatusIndicacaoCompra } from '../../types/biblioteca';
import { buscarAlunos, criarIndicacaoCompra, listarIndicacoesCompra, atualizarIndicacaoCompra } from '../../services/bibliotecaService';

const STATUS_LABEL: Record<StatusIndicacaoCompra, string> = {
  PENDENTE: 'Pendente',
  ANALISE: 'Em análise',
  COMPRADO: 'Comprado',
  RECUSADO: 'Recusado',
};

const STATUS_COR: Record<StatusIndicacaoCompra, string> = {
  PENDENTE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  ANALISE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPRADO: 'bg-green-500/10 text-green-500 border-green-500/20',
  RECUSADO: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function IndicacoesCompraTab() {
  const [indicacoes, setIndicacoes] = useState<IndicacaoCompraDetalhada[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoBusca | null>(null);
  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setIndicacoes(await listarIndicacoesCompra());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleBuscarAluno(valor: string) {
    setBuscaAluno(valor);
    setAlunoSelecionado(null);
    setAlunosEncontrados(valor.trim().length >= 2 ? await buscarAlunos(valor) : []);
  }

  async function handleCriar() {
    if (!alunoSelecionado || !titulo.trim()) {
      setErro('Selecione o aluno e informe o título sugerido.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarIndicacaoCompra({ aluno_id: alunoSelecionado.id, titulo: titulo.trim(), autor: autor.trim() || null });
      setAlunoSelecionado(null);
      setBuscaAluno('');
      setTitulo('');
      setAutor('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar sugestão.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleStatus(id: string, status: StatusIndicacaoCompra) {
    await atualizarIndicacaoCompra(id, { status });
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Registrar sugestão (balcão)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Aluno que sugeriu..."
                value={alunoSelecionado ? alunoSelecionado.nome : buscaAluno}
                onChange={(e) => handleBuscarAluno(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
            {alunosEncontrados.length > 0 && !alunoSelecionado && (
              <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                {alunosEncontrados.map((a) => (
                  <button key={a.id} onClick={() => { setAlunoSelecionado(a); setAlunosEncontrados([]); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                    {a.nome} {a.turma_nome && <span className="text-[10px] text-gray-500">· {a.turma_nome}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input placeholder="Título sugerido" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Autor (opcional)" value={autor} onChange={(e) => setAutor(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Registrar
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Sugestões ({indicacoes.length})</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : indicacoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma sugestão registrada ainda.</p>
        ) : (
          indicacoes.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{i.titulo} {i.autor && <span className="text-[11px] text-gray-500">({i.autor})</span>}</p>
                <p className="text-[11px] text-gray-500">sugerido por {i.aluno_nome}</p>
              </div>
              <select
                value={i.status}
                onChange={(e) => handleStatus(i.id, e.target.value as StatusIndicacaoCompra)}
                className={`text-[11px] px-2 py-1 rounded-full border uppercase font-black bg-transparent ${STATUS_COR[i.status]}`}
              >
                {Object.entries(STATUS_LABEL).map(([valor, label]) => <option key={valor} value={valor} className="bg-ms-dark text-ms-main">{label}</option>)}
              </select>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
