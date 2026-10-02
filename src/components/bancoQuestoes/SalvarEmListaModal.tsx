import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { adicionarQuestoesNaLista, criarListaQuestoes, listarListasQuestoes, type ListaQuestoes } from '../../services/listasQuestoesService';

interface Props {
  questionIds: string[];
  onClose: () => void;
  onSalvo: (mensagem: string) => void;
}

// Guarda as questões selecionadas numa lista pessoal (existente ou nova) para usar depois.
export function SalvarEmListaModal({ questionIds, onClose, onSalvo }: Props) {
  const [listas, setListas] = useState<ListaQuestoes[] | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarListasQuestoes()
      .then(setListas)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar suas listas.'));
  }, []);

  async function salvarEm(listaId: string, nomeLista: string) {
    setSalvando(true);
    setErro(null);
    try {
      await adicionarQuestoesNaLista(listaId, questionIds);
      onSalvo(`${questionIds.length} ${questionIds.length === 1 ? 'questão salva' : 'questões salvas'} em “${nomeLista}”.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar na lista.');
      setSalvando(false);
    }
  }

  async function criarESalvar() {
    const nome = novoNome.trim();
    if (!nome) return;
    setSalvando(true);
    setErro(null);
    try {
      const id = await criarListaQuestoes(nome);
      await adicionarQuestoesNaLista(id, questionIds);
      onSalvo(`${questionIds.length} ${questionIds.length === 1 ? 'questão salva' : 'questões salvas'} na nova lista “${nome}”.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a lista.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Salvar em lista</h2>
            <p className="text-xs text-ms-muted">{questionIds.length} {questionIds.length === 1 ? 'questão selecionada' : 'questões selecionadas'}</p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ms-muted">Nova lista</p>
            <div className="flex gap-2">
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarESalvar()}
                maxLength={80}
                placeholder="Ex.: Genética — 3º ano"
                className="flex-1 min-w-0 px-3 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
              />
              <button
                disabled={salvando || !novoNome.trim()}
                onClick={criarESalvar}
                className="flex items-center gap-1 px-4 py-2.5 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Criar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ms-muted">Suas listas</p>
            {listas === null && !erro && <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-400" />}
            {listas?.length === 0 && <p className="text-sm text-ms-muted">Você ainda não tem listas. Crie a primeira acima.</p>}
            {listas?.map((l) => (
              <button
                key={l.id}
                disabled={salvando}
                onClick={() => salvarEm(l.id, l.nome)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-left hover:border-ms-blue disabled:opacity-50"
              >
                <span className="text-sm font-bold text-ms-main truncate">{l.nome}</span>
                <span className="text-xs text-ms-muted shrink-0">{l.total} {l.total === 1 ? 'questão' : 'questões'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
