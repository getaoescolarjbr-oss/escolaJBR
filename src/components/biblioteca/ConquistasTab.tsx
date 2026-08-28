import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Conquista, RegraTipoConquista } from '../../types/biblioteca';
import { listarConquistas, criarConquista, atualizarConquista } from '../../services/bibliotecaService';

const REGRAS: { valor: RegraTipoConquista; label: string }[] = [
  { valor: 'PRIMEIRO_EMPRESTIMO', label: 'Primeiro empréstimo (contagem de empréstimos)' },
  { valor: 'LIVROS_LIDOS', label: 'Livros lidos (empréstimos devolvidos)' },
  { valor: 'METAS_CONCLUIDAS', label: 'Metas concluídas' },
  { valor: 'RESENHAS_PUBLICADAS', label: 'Resenhas publicadas' },
  { valor: 'DUPLAS_FORMADAS', label: 'Duplas de leitura formadas' },
];

// Emoji vem do cadastro (livre) — a cor do badge só gira por posição pra dar
// variedade visual, já que não há uma categoria fixa por conquista.
const CORES_BADGE = [
  'bg-amber-500/10 border-amber-500/20',
  'bg-purple-500/10 border-purple-500/20',
  'bg-teal-500/10 border-teal-500/20',
  'bg-pink-500/10 border-pink-500/20',
  'bg-indigo-500/10 border-indigo-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
];

// A concessão é automática (trigger no banco, ver create_biblioteca_fase5.sql) — esta
// tela só administra o catálogo (o que existe e a partir de quanto é concedido).
export function ConquistasTab() {
  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [icone, setIcone] = useState('');
  const [regraTipo, setRegraTipo] = useState<RegraTipoConquista>('PRIMEIRO_EMPRESTIMO');
  const [regraLimiar, setRegraLimiar] = useState('1');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setConquistas(await listarConquistas());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!nome.trim() || !regraLimiar) {
      setErro('Informe nome e o limiar da regra.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarConquista({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        icone: icone.trim() || null,
        regra_tipo: regraTipo,
        regra_limiar: Number(regraLimiar),
        ativo: true,
      });
      setNome('');
      setDescricao('');
      setIcone('');
      setRegraLimiar('1');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar conquista.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(c: Conquista) {
    await atualizarConquista(c.id, { ativo: !c.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova conquista</p>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
          <input placeholder="🏆" value={icone} onChange={(e) => setIcone(e.target.value)} className="w-16 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue text-center text-xl" />
          <input placeholder="Nome da conquista" value={nome} onChange={(e) => setNome(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <textarea placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={regraTipo} onChange={(e) => setRegraTipo(e.target.value as RegraTipoConquista)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {REGRAS.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
          </select>
          <input type="number" min={1} placeholder="A partir de quantos..." value={regraLimiar} onChange={(e) => setRegraLimiar(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : (
          conquistas.map((c, idx) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${CORES_BADGE[idx % CORES_BADGE.length]}`}>{c.icone || '🏅'}</span>
                <div>
                  <p className="text-sm font-bold text-ms-main">{c.nome}</p>
                  <p className="text-[10px] text-gray-500">{REGRAS.find((r) => r.valor === c.regra_tipo)?.label ?? c.regra_tipo} · a partir de {c.regra_limiar}</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={c.ativo} onChange={() => handleToggleAtivo(c)} /> Ativa
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
