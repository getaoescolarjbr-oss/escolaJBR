import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { Fornecedor, GrupoPrioritario } from '../../types/cozinha';
import { listarFornecedores, criarFornecedor, atualizarFornecedor } from '../../services/cozinhaService';

const ROTULOS_GRUPO_PRIORITARIO: Record<GrupoPrioritario, string> = {
  ASSENTAMENTO: 'Assentamento',
  INDIGENA: 'Indígena',
  QUILOMBOLA: 'Quilombola',
  MULHERES: 'Mulheres',
  JOVENS: 'Jovens',
};

export function FornecedoresTab() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ nome: '', cnpj_cpf: '', agricultura_familiar: false, dap_caf_numero: '', contato: '', grupo_prioritario: '' as GrupoPrioritario | '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setFornecedores(await listarFornecedores());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!novo.nome) {
      setErro('Informe o nome do fornecedor.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarFornecedor({
        nome: novo.nome,
        cnpj_cpf: novo.cnpj_cpf || null,
        agricultura_familiar: novo.agricultura_familiar,
        dap_caf_numero: novo.dap_caf_numero || null,
        contato: novo.contato || null,
        grupo_prioritario: novo.grupo_prioritario || null,
      });
      setNovo({ nome: '', cnpj_cpf: '', agricultura_familiar: false, dap_caf_numero: '', contato: '', grupo_prioritario: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar fornecedor.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(f: Fornecedor) {
    await atualizarFornecedor(f.id, { ativo: !f.ativo });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo fornecedor</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="CNPJ/CPF" value={novo.cnpj_cpf} onChange={(e) => setNovo({ ...novo, cnpj_cpf: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Contato" value={novo.contato} onChange={(e) => setNovo({ ...novo, contato: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Nº DAP/CAF (se agricultura familiar)" value={novo.dap_caf_numero} onChange={(e) => setNovo({ ...novo, dap_caf_numero: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ms-main">
          <input type="checkbox" checked={novo.agricultura_familiar} onChange={(e) => setNovo({ ...novo, agricultura_familiar: e.target.checked })} />
          Agricultura familiar
        </label>
        {novo.agricultura_familiar && (
          <select value={novo.grupo_prioritario} onChange={(e) => setNovo({ ...novo, grupo_prioritario: e.target.value as GrupoPrioritario })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Grupo prioritário (opcional)...</option>
            {Object.entries(ROTULOS_GRUPO_PRIORITARIO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        )}
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : (
          fornecedores.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">
                  {f.nome} {f.agricultura_familiar && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 uppercase font-black">Agric. Familiar</span>}
                </p>
                <p className="text-[10px] text-gray-500">{f.cnpj_cpf || 'sem CNPJ/CPF'} · {f.contato || 'sem contato'}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={f.ativo} onChange={() => handleToggleAtivo(f)} /> Ativo
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
