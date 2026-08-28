import { useEffect, useState } from 'react';
import { X, Loader2, Plus, BookCopy } from 'lucide-react';
import type { Livro, Exemplar, EstadoExemplar } from '../../types/biblioteca';
import { listarExemplares, criarExemplar, atualizarExemplar } from '../../services/bibliotecaService';

const ESTADOS: EstadoExemplar[] = ['Novo', 'Bom', 'Regular', 'Danificado'];

const STATUS_LABEL: Record<Exemplar['status'], string> = {
  DISPONIVEL: 'Disponível',
  EMPRESTADO: 'Emprestado',
  RESERVADO: 'Reservado',
  BAIXADO: 'Baixado',
};

const STATUS_COR: Record<Exemplar['status'], string> = {
  DISPONIVEL: 'bg-green-500/10 text-green-500 border-green-500/20',
  EMPRESTADO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  RESERVADO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BAIXADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

interface ExemplaresModalProps {
  livro: Livro;
  onClose: () => void;
}

export function ExemplaresModal({ livro, onClose }: ExemplaresModalProps) {
  const [exemplares, setExemplares] = useState<Exemplar[]>([]);
  const [loading, setLoading] = useState(true);
  const [tombo, setTombo] = useState('');
  const [estado, setEstado] = useState<EstadoExemplar>('Novo');
  const [localizacao, setLocalizacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setExemplares(await listarExemplares(livro.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livro.id]);

  async function handleCriar() {
    if (!tombo.trim()) {
      setErro('Informe o número de tombo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarExemplar({ livro_id: livro.id, tombo: tombo.trim(), estado, localizacao: localizacao.trim() || null });
      setTombo('');
      setLocalizacao('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar exemplar. Verifique se o tombo já existe.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleBaixar(ex: Exemplar) {
    if (ex.status === 'EMPRESTADO') {
      setErro('Não é possível baixar um exemplar emprestado — aguarde a devolução.');
      return;
    }
    await atualizarExemplar(ex.id, { status: 'BAIXADO', ativo: false });
    await carregar();
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-ms-card max-w-2xl w-full rounded-2xl shadow-2xl relative my-auto border border-gray-800">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookCopy className="w-5 h-5 text-ms-blueText" />
            <div>
              <p className="text-sm font-black text-ms-main">Exemplares — {livro.titulo}</p>
              <p className="text-[10px] text-gray-500">{exemplares.length} exemplar(es) cadastrado(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-ms-dark rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Nº de tombo" value={tombo} onChange={(e) => setTombo(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoExemplar)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input placeholder="Localização (estante/prateleira)" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar exemplar
          </button>

          <div className="space-y-2">
            {loading ? (
              <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
            ) : exemplares.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum exemplar cadastrado ainda.</p>
            ) : (
              exemplares.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-ms-main">Tombo {ex.tombo}</p>
                    <p className="text-[10px] text-gray-500">{ex.estado} · {ex.localizacao || 'sem localização definida'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${STATUS_COR[ex.status]}`}>{STATUS_LABEL[ex.status]}</span>
                    {ex.status !== 'BAIXADO' && (
                      <button onClick={() => handleBaixar(ex)} className="text-[10px] text-red-400 hover:underline font-bold">Baixar</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
