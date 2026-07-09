import { useEffect, useState } from 'react';
import { Loader2, Search, BookPlus, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { EmprestimoDetalhado, AlunoBusca, ProfessorBusca, ExemplarComLivro } from '../../services/bibliotecaService';
import {
  buscarAlunos,
  buscarProfessores,
  buscarExemplaresDisponiveis,
  criarEmprestimo,
  listarEmprestimosAtivos,
  registrarDevolucao,
  renovarEmprestimo,
  contarReservasAtivas,
} from '../../services/bibliotecaService';

type TipoTomador = 'ALUNO' | 'PROFESSOR';

const PRAZO_PADRAO_DIAS = 14;

function dataPrevistaPadrao(): string {
  const d = new Date();
  d.setDate(d.getDate() + PRAZO_PADRAO_DIAS);
  return d.toISOString().slice(0, 10);
}

function estaAtrasado(e: EmprestimoDetalhado): boolean {
  return e.data_prevista < new Date().toISOString().slice(0, 10);
}

export function EmprestimosTab() {
  const { usuarioId } = useAuth();

  const [emprestimos, setEmprestimos] = useState<EmprestimoDetalhado[]>([]);
  const [loading, setLoading] = useState(true);

  const [tipoTomador, setTipoTomador] = useState<TipoTomador>('ALUNO');
  const [buscaTomador, setBuscaTomador] = useState('');
  const [tomadoresEncontrados, setTomadoresEncontrados] = useState<(AlunoBusca | ProfessorBusca)[]>([]);
  const [tomadorSelecionado, setTomadorSelecionado] = useState<(AlunoBusca | ProfessorBusca) | null>(null);

  const [buscaExemplar, setBuscaExemplar] = useState('');
  const [exemplaresEncontrados, setExemplaresEncontrados] = useState<ExemplarComLivro[]>([]);
  const [exemplarSelecionado, setExemplarSelecionado] = useState<ExemplarComLivro | null>(null);

  const [dataPrevista, setDataPrevista] = useState(dataPrevistaPadrao());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setEmprestimos(await listarEmprestimosAtivos());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleBuscarTomador(valor: string) {
    setBuscaTomador(valor);
    setTomadorSelecionado(null);
    if (valor.trim().length < 2) {
      setTomadoresEncontrados([]);
      return;
    }
    setTomadoresEncontrados(tipoTomador === 'ALUNO' ? await buscarAlunos(valor) : await buscarProfessores(valor));
  }

  function handleTrocarTipoTomador(tipo: TipoTomador) {
    setTipoTomador(tipo);
    setBuscaTomador('');
    setTomadoresEncontrados([]);
    setTomadorSelecionado(null);
  }

  async function handleBuscarExemplar(valor: string) {
    setBuscaExemplar(valor);
    setExemplarSelecionado(null);
    setExemplaresEncontrados(valor.trim().length >= 2 ? await buscarExemplaresDisponiveis(valor) : []);
  }

  async function handleRegistrarEmprestimo() {
    if (!tomadorSelecionado || !exemplarSelecionado) {
      setErro(`Selecione o(a) ${tipoTomador === 'ALUNO' ? 'aluno' : 'professor'} e o exemplar.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarEmprestimo({
        exemplar_id: exemplarSelecionado.id,
        aluno_id: tipoTomador === 'ALUNO' ? tomadorSelecionado.id : null,
        professor_id: tipoTomador === 'PROFESSOR' ? tomadorSelecionado.id : null,
        data_prevista: dataPrevista,
        criado_por: usuarioId,
      });
      setTomadorSelecionado(null);
      setBuscaTomador('');
      setExemplarSelecionado(null);
      setBuscaExemplar('');
      setDataPrevista(dataPrevistaPadrao());
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar empréstimo. O exemplar pode já estar emprestado.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleDevolver(e: EmprestimoDetalhado) {
    setErro(null);
    setAviso(null);
    try {
      await registrarDevolucao(e.id);
      const reservas = await contarReservasAtivas(e.livro_id);
      if (reservas > 0) setAviso(`"${e.livro_titulo}" devolvido — há ${reservas} reserva(s) esperando por este título.`);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar devolução.');
    }
  }

  async function handleRenovar(e: EmprestimoDetalhado) {
    setErro(null);
    try {
      await renovarEmprestimo(e.id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao renovar empréstimo.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Registrar empréstimo</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleTrocarTipoTomador('ALUNO')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tipoTomador === 'ALUNO' ? 'bg-ms-blue text-white' : 'bg-ms-dark border border-gray-800 text-gray-400'}`}
          >
            Aluno
          </button>
          <button
            onClick={() => handleTrocarTipoTomador('PROFESSOR')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${tipoTomador === 'PROFESSOR' ? 'bg-ms-blue text-white' : 'bg-ms-dark border border-gray-800 text-gray-400'}`}
          >
            Professor
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder={tipoTomador === 'ALUNO' ? 'Buscar aluno pelo nome...' : 'Buscar professor pelo nome...'}
                value={tomadorSelecionado ? tomadorSelecionado.nome : buscaTomador}
                onChange={(e) => handleBuscarTomador(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
            {tomadoresEncontrados.length > 0 && !tomadorSelecionado && (
              <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                {tomadoresEncontrados.map((t) => (
                  <button key={t.id} onClick={() => { setTomadorSelecionado(t); setTomadoresEncontrados([]); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                    {t.nome} {'turma_nome' in t && t.turma_nome && <span className="text-[10px] text-gray-500">· {t.turma_nome}</span>}
                    {'cargo' in t && t.cargo && <span className="text-[10px] text-gray-500">· {t.cargo}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Buscar exemplar por tombo ou título..."
                value={exemplarSelecionado ? `${exemplarSelecionado.tombo} — ${exemplarSelecionado.livro_titulo}` : buscaExemplar}
                onChange={(e) => handleBuscarExemplar(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              />
            </div>
            {exemplaresEncontrados.length > 0 && !exemplarSelecionado && (
              <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                {exemplaresEncontrados.map((ex) => (
                  <button key={ex.id} onClick={() => { setExemplarSelecionado(ex); setExemplaresEncontrados([]); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                    {ex.tombo} — {ex.livro_titulo} <span className="text-[10px] text-gray-500">({ex.livro_autor})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Devolução prevista</label>
            <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} className="px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          <button onClick={handleRegistrarEmprestimo} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookPlus className="w-4 h-4" />}
            Emprestar
          </button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        {aviso && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {aviso}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Empréstimos ativos ({emprestimos.length})</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : emprestimos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum empréstimo ativo.</p>
        ) : (
          emprestimos.map((e) => {
            const atrasado = estaAtrasado(e);
            return (
              <div key={e.id} className={`flex items-center justify-between px-4 py-3 bg-ms-card border rounded-xl ${atrasado ? 'border-red-500/30' : 'border-gray-800'}`}>
                <div>
                  <p className="text-sm font-bold text-ms-main">{e.livro_titulo} <span className="text-[10px] text-gray-500">({e.tombo})</span></p>
                  <p className="text-[11px] text-gray-500">
                    {e.tomador_nome}{e.tomador_tipo === 'PROFESSOR' && <span className="text-[9px] text-ms-blue font-bold uppercase ml-1">(professor)</span>} · prevista para {new Date(e.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {e.renovacoes > 0 && ` · ${e.renovacoes}x renovado`}
                    {atrasado && <span className="ml-2 text-red-400 font-bold">ATRASADO</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRenovar(e)} className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blue transition-colors">
                    <RotateCw className="w-3 h-3" /> Renovar
                  </button>
                  <button onClick={() => handleDevolver(e)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-500 hover:bg-green-500/20 transition-colors">
                    <CheckCircle2 className="w-3 h-3" /> Devolver
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
