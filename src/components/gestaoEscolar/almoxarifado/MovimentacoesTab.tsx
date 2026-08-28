import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { MaterialComSaldo, MovimentacaoMaterial, TipoMovimentacaoMaterial } from '../../../types/almoxarifado';
import { listarMateriaisComSaldo, listarMovimentacoes, registrarMovimentacao } from '../../../services/almoxarifadoService';

const TIPO_LABEL: Record<TipoMovimentacaoMaterial, string> = { ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste' };
const TIPO_COR: Record<TipoMovimentacaoMaterial, string> = {
  ENTRADA: 'text-green-500',
  SAIDA: 'text-red-400',
  AJUSTE: 'text-blue-400',
};

export function MovimentacoesTab() {
  const [materiais, setMateriais] = useState<MaterialComSaldo[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const [materialId, setMaterialId] = useState('');
  const [tipo, setTipo] = useState<TipoMovimentacaoMaterial>('ENTRADA');
  const [quantidade, setQuantidade] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fonteRecurso, setFonteRecurso] = useState('PDDE');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [m, mov] = await Promise.all([listarMateriaisComSaldo(), listarMovimentacoes()]);
      setMateriais(m);
      setMovimentacoes(mov);
      if (!materialId && m.length > 0) setMaterialId(m[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nomeMaterial(id: string): string {
    return materiais.find((m) => m.id === id)?.nome ?? id;
  }

  async function handleRegistrar() {
    if (!materialId || !motivo.trim() || !Number(quantidade)) {
      setErro('Selecione o material, informe a quantidade e o motivo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const valor = tipo === 'AJUSTE' ? Number(quantidade) : Math.abs(Number(quantidade));
      await registrarMovimentacao({
        material_id: materialId,
        tipo,
        quantidade: valor,
        motivo: motivo.trim(),
        referencia: referencia.trim() || null,
        fonte_recurso: tipo === 'ENTRADA' ? (fonteRecurso.trim() || null) : null,
      });
      setMotivo('');
      setReferencia('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar movimentação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Registrar movimentação manual</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {materiais.map((m) => <option key={m.id} value={m.id}>{m.nome} (saldo: {m.saldo})</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacaoMaterial)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="ENTRADA">Entrada (compra/doação)</option>
            <option value="SAIDA">Saída avulsa (perda/descarte)</option>
            <option value="AJUSTE">Ajuste de inventário (+/-)</option>
          </select>
          <input
            type="number"
            placeholder={tipo === 'AJUSTE' ? 'Quantidade (negativa para reduzir)' : 'Quantidade'}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          {tipo === 'ENTRADA' && (
            <input placeholder="Fonte do recurso (ex.: PDDE, APM)" value={fonteRecurso} onChange={(e) => setFonteRecurso(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          )}
        </div>
        <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <input placeholder="Referência (nota fiscal, nº de processo...)" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleRegistrar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Registrar
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Extrato</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : movimentacoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma movimentação registrada.</p>
        ) : (
          movimentacoes.map((mv) => (
            <div key={mv.id} className="flex items-center justify-between px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-sm">
              <div>
                <span className="text-ms-main font-bold">{nomeMaterial(mv.material_id)}</span>
                <span className="text-[11px] text-gray-500 ml-2">{mv.motivo}</span>
              </div>
              <span className={`font-bold ${TIPO_COR[mv.tipo]}`}>
                {mv.tipo === 'SAIDA' ? '-' : mv.tipo === 'AJUSTE' && mv.quantidade < 0 ? '' : '+'}{mv.quantidade} · {TIPO_LABEL[mv.tipo]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
