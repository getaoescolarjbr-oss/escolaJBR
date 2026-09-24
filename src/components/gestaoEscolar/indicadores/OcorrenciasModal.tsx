import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ModalShell } from './ModalShell';
import { NovaOcorrenciaForm } from './NovaOcorrenciaForm';
import { BarrasPorTurma } from './BarrasPorTurma';
import type { ItemBarra } from './BarrasPorTurma';
import { OPCOES_PERIODO, buscarOcorrenciasPeriodo, rotuloPeriodo } from './periodoOcorrencias';
import type { PeriodoOcorrencias } from './periodoOcorrencias';

interface OcorrenciaLinha {
  id: string;
  data: string | null;
  data_registro: string | null;
  descricao: string;
  registrado_por: string | null;
  registrado_por_cargo: string | null;
  visto_coordenador: boolean | null;
  devolutiva_coordenador: string | null;
  turma_id: string | null;
  aluno: { nome: string; turmas: { nome: string } | null } | null;
}

interface OcorrenciasModalProps {
  filtroInicial: 'todas' | 'sem_visto';
  periodoInicial?: PeriodoOcorrencias;
  onClose: () => void;
  onAlterado: () => void;
}

// Renderiza aos poucos: o ano letivo pode passar de mil ocorrências.
const PAGINA = 100;

export function OcorrenciasModal({ filtroInicial, periodoInicial = '30d', onClose, onAlterado }: OcorrenciasModalProps) {
  const [filtro, setFiltro] = useState(filtroInicial);
  const [periodo, setPeriodo] = useState<PeriodoOcorrencias>(periodoInicial);
  const [limite, setLimite] = useState(PAGINA);
  const [linhas, setLinhas] = useState<OcorrenciaLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [devolutivas, setDevolutivas] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [ocorrencias, tu] = await Promise.all([
        buscarOcorrenciasPeriodo<OcorrenciaLinha>(
          'id, data, data_registro, descricao, registrado_por, registrado_por_cargo, visto_coordenador, devolutiva_coordenador, turma_id, aluno:alunos(nome, turmas(nome))',
          periodo
        ),
        supabase.from('turmas').select('id, nome').order('nome'),
      ]);
      setLinhas(ocorrencias);
      setTurmas(tu.data ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar ocorrências.');
      setLinhas([]);
    }
    setLimite(PAGINA);
    setLoading(false);
  }, [periodo]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function darVisto(id: string) {
    setSalvandoId(id);
    setErro(null);
    const devolutiva = (devolutivas[id] ?? '').trim();
    const { error } = await supabase
      .from('ocorrências')
      .update({ visto_coordenador: true, data_visualizacao_coordenador: new Date().toISOString(), devolutiva_coordenador: devolutiva || null })
      .eq('id', id);
    setSalvandoId(null);
    if (error) { setErro(`Erro ao dar visto: ${error.message}`); return; }
    await carregar();
    onAlterado();
  }

  const visiveis = linhas.filter((o) => filtro === 'todas' || !o.visto_coordenador);
  const semVisto = linhas.filter((o) => !o.visto_coordenador).length;
  // Gráfico acompanha o filtro ativo (todas × sem visto).
  const porTurma: ItemBarra[] = turmas.map((t) => ({
    rotulo: t.nome,
    partes: [{ nome: filtro === 'todas' ? 'Ocorrências' : 'Sem visto', valor: visiveis.filter((o) => o.turma_id === t.id).length, cor: filtro === 'todas' ? '#ef4444' : '#f59e0b' }],
  }));

  return (
    <ModalShell titulo={`Ocorrências — ${rotuloPeriodo(periodo)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['todas', 'sem_visto'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filtro === f ? 'bg-ms-blue text-white border-ms-blue' : 'bg-ms-dark text-gray-400 border-gray-700 hover:text-ms-main'}`}
            >
              {f === 'todas' ? `Todas (${linhas.length})` : `Sem visto (${semVisto})`}
            </button>
          ))}
          <select
            aria-label="Período das ocorrências"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoOcorrencias)}
            className="bg-ms-dark border border-gray-700 text-ms-main text-xs font-bold rounded-lg px-2 py-1.5"
          >
            {OPCOES_PERIODO.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
          <button onClick={() => setNovaAberta((v) => !v)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white">
            <Plus className="w-3.5 h-3.5" /> Nova ocorrência
          </button>
        </div>

        {novaAberta && (
          <div className="border border-gray-700 rounded-xl p-3">
            <NovaOcorrenciaForm
              onCancelar={() => setNovaAberta(false)}
              onSalvo={async () => { setNovaAberta(false); await carregar(); onAlterado(); }}
            />
          </div>
        )}

        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {!loading && <BarrasPorTurma itens={porTurma} vazio="Nenhuma ocorrência neste filtro." />}
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" />
        ) : visiveis.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Nenhuma ocorrência neste filtro.</p>
        ) : (
          <ul className="space-y-2">
            {visiveis.slice(0, limite).map((o) => (
              <li key={o.id} className="border border-gray-800 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-bold text-ms-main">
                    {o.aluno?.nome ?? 'Aluno removido'} <span className="font-normal text-gray-500">· {o.aluno?.turmas?.nome ?? '—'}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {o.data ? new Date(`${o.data}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                    {o.registrado_por && ` · ${o.registrado_por}${o.registrado_por_cargo ? ` (${o.registrado_por_cargo})` : ''}`}
                  </p>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{o.descricao}</p>
                {o.visto_coordenador ? (
                  <p className="text-xs text-green-500 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    Visto pela coordenação{o.devolutiva_coordenador ? ` — devolutiva: ${o.devolutiva_coordenador}` : ''}
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      aria-label="Devolutiva (opcional)"
                      value={devolutivas[o.id] ?? ''}
                      onChange={(e) => setDevolutivas((d) => ({ ...d, [o.id]: e.target.value }))}
                      placeholder="Devolutiva (opcional)"
                      className="flex-1 bg-ms-dark border border-gray-700 text-ms-main text-sm rounded-lg px-3 py-1.5"
                    />
                    <button
                      onClick={() => darVisto(o.id)}
                      disabled={salvandoId === o.id}
                      className="px-3 py-1.5 bg-amber-500 text-black text-xs font-black rounded-lg disabled:opacity-50"
                    >
                      {salvandoId === o.id ? 'Salvando…' : 'Dar visto'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && visiveis.length > limite && (
          <button onClick={() => setLimite((l) => l + PAGINA)} className="w-full py-2 text-xs font-bold text-gray-400 hover:text-ms-main border border-gray-800 rounded-lg">
            Mostrar mais ({visiveis.length - limite} restantes)
          </button>
        )}
      </div>
    </ModalShell>
  );
}
