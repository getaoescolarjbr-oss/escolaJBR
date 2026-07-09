import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, EyeOff, Eye, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { DenunciaDetalhada, ResenhaModeracao, PalavraProibida } from '../../services/bibliotecaSocialService';
import {
  listarDenuncias,
  listarResenhasOcultas,
  moderarResenha,
  tratarDenuncia,
  contarModeracoesDoAluno,
  listarPalavrasProibidas,
  adicionarPalavraProibida,
  atualizarPalavraProibida,
} from '../../services/bibliotecaSocialService';

type SubAba = 'denuncias' | 'ocultas' | 'palavras';

// Fase 7 — a peça de maior responsabilidade do módulo: fila de denúncia, revisão do
// que o filtro automático já ocultou sozinho, e o catálogo de palavras que alimenta
// esse filtro. Reincidência (repeat-offense) é mostrada como contagem pra staff
// decidir se escala pra COORDENACAO — não escalamos automaticamente.
export function ModeracaoTab() {
  const { usuarioId, hasAnyRole } = useAuth();
  const [subAba, setSubAba] = useState<SubAba>('denuncias');

  const [denuncias, setDenuncias] = useState<DenunciaDetalhada[]>([]);
  const [ocultas, setOcultas] = useState<ResenhaModeracao[]>([]);
  const [palavras, setPalavras] = useState<PalavraProibida[]>([]);
  const [contagemReincidencia, setContagemReincidencia] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [novaPalavra, setNovaPalavra] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const podeEscalarCoordenacao = hasAnyRole(['COORDENACAO', 'GESTAO']);

  async function carregar() {
    setLoading(true);
    try {
      const [d, o, p] = await Promise.all([listarDenuncias('ABERTA'), listarResenhasOcultas(), listarPalavrasProibidas()]);
      setDenuncias(d);
      setOcultas(o);
      setPalavras(p);
      const idsAlunos = [...new Set([...d.map((x) => x.autor_id), ...o.map((x) => x.aluno_id)])];
      const contagens = await Promise.all(idsAlunos.map(async (id) => [id, await contarModeracoesDoAluno(id)] as const));
      setContagemReincidencia(Object.fromEntries(contagens));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleModerarResenha(id: string, status: 'VISIVEL' | 'OCULTA' | 'REMOVIDA', motivo: string | null) {
    if (!usuarioId) return;
    setProcessandoId(id);
    setErro(null);
    try {
      await moderarResenha(id, status, motivo, usuarioId);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao moderar resenha.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleTratarDenuncia(denunciaId: string, resenhaId: string, aceitar: boolean) {
    if (!usuarioId) return;
    setProcessandoId(denunciaId);
    setErro(null);
    try {
      if (aceitar) {
        await moderarResenha(resenhaId, 'REMOVIDA', 'Denúncia procedente', usuarioId);
        await tratarDenuncia(denunciaId, 'TRATADA', 'Resenha removida', usuarioId);
      } else {
        await tratarDenuncia(denunciaId, 'ARQUIVADA', 'Denúncia sem procedência', usuarioId);
      }
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao tratar denúncia.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleAdicionarPalavra() {
    if (!novaPalavra.trim()) return;
    try {
      await adicionarPalavraProibida(novaPalavra);
      setNovaPalavra('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar palavra.');
    }
  }

  const subAbas: { id: SubAba; label: string; contagem: number }[] = [
    { id: 'denuncias', label: 'Denúncias', contagem: denuncias.length },
    { id: 'ocultas', label: 'Ocultadas pelo filtro', contagem: ocultas.length },
    { id: 'palavras', label: 'Palavras filtradas', contagem: palavras.length },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap gap-2">
        {subAbas.map((a) => (
          <button
            key={a.id}
            onClick={() => setSubAba(a.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === a.id ? 'bg-ms-blue text-white' : 'bg-ms-dark text-gray-400 border border-gray-800'}`}
          >
            {a.label} {a.contagem > 0 && `(${a.contagem})`}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
      ) : subAba === 'denuncias' ? (
        denuncias.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma denúncia em aberto.</p>
        ) : (
          <div className="space-y-3">
            {denuncias.map((d) => (
              <div key={d.id} className="bg-ms-card border border-gray-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ms-main">{d.autor_nome}</p>
                  {podeEscalarCoordenacao && (contagemReincidencia[d.autor_id] ?? 0) > 1 && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" /> {contagemReincidencia[d.autor_id]}x reincidente</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 bg-ms-dark rounded-lg p-3">{d.resenha_texto}</p>
                <p className="text-[11px] text-gray-500">Denunciado por {d.denunciante_nome} · motivo: {d.motivo}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTratarDenuncia(d.id, d.resenha_id, true)}
                    disabled={processandoId === d.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" /> Remover resenha
                  </button>
                  <button
                    onClick={() => handleTratarDenuncia(d.id, d.resenha_id, false)}
                    disabled={processandoId === d.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-400 hover:text-ms-main transition-colors disabled:opacity-50"
                  >
                    Arquivar (sem procedência)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : subAba === 'ocultas' ? (
        ocultas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma resenha ocultada pelo filtro no momento.</p>
        ) : (
          <div className="space-y-3">
            {ocultas.map((r) => (
              <div key={r.id} className="bg-ms-card border border-amber-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ms-main">{r.aluno_nome} · {r.livro_titulo}</p>
                  {podeEscalarCoordenacao && (contagemReincidencia[r.aluno_id] ?? 0) > 1 && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" /> {contagemReincidencia[r.aluno_id]}x reincidente</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 bg-ms-dark rounded-lg p-3">{r.texto}</p>
                <p className="text-[10px] text-gray-500">{r.motivo_ocultacao}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleModerarResenha(r.id, 'VISIVEL', null)}
                    disabled={processandoId === r.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    <Eye className="w-3 h-3" /> Restaurar (falso positivo)
                  </button>
                  <button
                    onClick={() => handleModerarResenha(r.id, 'REMOVIDA', 'Confirmado pela moderação')}
                    disabled={processandoId === r.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <EyeOff className="w-3 h-3" /> Manter removida
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input placeholder="Nova palavra a filtrar" value={novaPalavra} onChange={(e) => setNovaPalavra(e.target.value)} className="flex-1 px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <button onClick={handleAdicionarPalavra} className="flex items-center gap-1 px-4 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {palavras.map((p) => (
              <label key={p.palavra} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${p.ativo ? 'bg-ms-card border-gray-800 text-gray-300' : 'bg-ms-dark border-gray-800 text-gray-600'}`}>
                <input type="checkbox" checked={p.ativo} onChange={() => atualizarPalavraProibida(p.palavra, !p.ativo).then(carregar)} />
                {p.palavra}
              </label>
            ))}
          </div>
        </div>
      )}

      {!loading && (denuncias.length > 0 || ocultas.length > 0) && (
        <p className="text-[10px] text-gray-600 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Reincidência é só um indicador — a decisão de escalar para a Coordenação é sempre humana.</p>
      )}
    </div>
  );
}
