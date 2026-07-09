import { useEffect, useState } from 'react';
import { Loader2, Search, CalendarPlus, X, CheckCircle2 } from 'lucide-react';
import type { AlunoBusca } from '../../services/bibliotecaService';
import type { Livro } from '../../types/biblioteca';
import type { ReservaLivroDetalhada } from '../../services/bibliotecaService';
import { buscarAlunos, listarLivros, criarReservaLivro, atualizarReservaLivro, listarReservasAtivas } from '../../services/bibliotecaService';

// Enquanto não existe login de aluno (chega na Fase 4), é sempre a BIBLIOTECA quem
// coloca alguém na fila de espera de um título, a pedido do próprio aluno no balcão.
export function ReservasTab() {
  const [reservas, setReservas] = useState<ReservaLivroDetalhada[]>([]);
  const [loading, setLoading] = useState(true);

  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunosEncontrados, setAlunosEncontrados] = useState<AlunoBusca[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoBusca | null>(null);

  const [buscaLivro, setBuscaLivro] = useState('');
  const [livrosEncontrados, setLivrosEncontrados] = useState<Livro[]>([]);
  const [livroSelecionado, setLivroSelecionado] = useState<Livro | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setReservas(await listarReservasAtivas());
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

  async function handleBuscarLivro(valor: string) {
    setBuscaLivro(valor);
    setLivroSelecionado(null);
    setLivrosEncontrados(valor.trim().length >= 2 ? await listarLivros({ busca: valor, somenteAtivos: true }) : []);
  }

  async function handleCriar() {
    if (!alunoSelecionado || !livroSelecionado) {
      setErro('Selecione o aluno e o livro.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarReservaLivro(livroSelecionado.id, alunoSelecionado.id);
      setAlunoSelecionado(null);
      setBuscaAluno('');
      setLivroSelecionado(null);
      setBuscaLivro('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar reserva. O aluno já pode ter uma reserva ativa para este título.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleCancelar(id: string) {
    await atualizarReservaLivro(id, 'CANCELADA');
    await carregar();
  }

  async function handleAtender(id: string) {
    await atualizarReservaLivro(id, 'ATENDIDA');
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Colocar aluno na fila de reserva</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Buscar aluno pelo nome..."
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

          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Buscar livro por título..."
                value={livroSelecionado ? livroSelecionado.titulo : buscaLivro}
                onChange={(e) => handleBuscarLivro(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
            {livrosEncontrados.length > 0 && !livroSelecionado && (
              <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                {livrosEncontrados.map((l) => (
                  <button key={l.id} onClick={() => { setLivroSelecionado(l); setLivrosEncontrados([]); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                    {l.titulo} <span className="text-[10px] text-gray-500">({l.autor})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
          Reservar
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Fila de reserva ({reservas.length})</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma reserva ativa.</p>
        ) : (
          reservas.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{r.livro_titulo}</p>
                <p className="text-[11px] text-gray-500">{r.tomador_nome}{r.tomador_tipo === 'PROFESSOR' && <span className="text-[9px] text-ms-blue font-bold uppercase ml-1">(professor)</span>} · desde {new Date(r.data).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAtender(r.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-500 hover:bg-green-500/20 transition-colors">
                  <CheckCircle2 className="w-3 h-3" /> Atendida
                </button>
                <button onClick={() => handleCancelar(r.id)} className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" /> Cancelar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
