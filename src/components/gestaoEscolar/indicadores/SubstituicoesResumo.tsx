import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AusenciaServidor, LancamentoFolhaSubstituto } from '../../../types/rh';
import { listarAusencias } from '../../../services/rhService';
import { listarLancamentosFolhaIntervalo } from '../../../services/folhaSubstitutoService';
import { formatarHoras } from '../../../utils/folhaSubstituto';
import { BarrasPorTurma } from './BarrasPorTurma';

const COR = { sed: '#2563eb', part: '#16a34a', indef: '#f59e0b' };
const h = (n: number) => formatarHoras(n) || '0h';

function Kpi({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 p-3">
      <p className="text-[11px] uppercase text-gray-500 font-bold">{rotulo}</p>
      <p className={`text-2xl font-black ${alerta ? 'text-amber-400' : 'text-ms-main'}`}>{valor}</p>
    </div>
  );
}

// Complemento das estatísticas de atestados: o que os afastamentos geraram em substituições
// e pagamentos (controle da folha do substituto, RH > Substituição). Mesmas fontes do relatório
// imprimível da aba Substituição — sem duplicar cadastro.
export function SubstituicoesResumo({ versao }: { versao: number }) {
  const [lanc, setLanc] = useState<LancamentoFolhaSubstituto[] | null>(null);
  const [atestados, setAtestados] = useState<AusenciaServidor[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const [l, a] = await Promise.all([listarLancamentosFolhaIntervalo('2000-01-01', '2100-12-01'), listarAusencias()]);
        if (vivo) { setLanc(l); setAtestados(a); setErro(null); }
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar substituições.');
      }
    }, 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [versao]);

  const d = useMemo(() => {
    if (!lanc) return null;
    const ch = (p: 'SED' | 'PARTICULAR' | null) => lanc.filter((l) => l.pagamento === p).reduce((t, l) => t + (l.carga_horaria ?? 0), 0);
    const ativos = atestados.filter((a) => a.ativo);
    const porSub = new Map<string, { nome: string; sed: number; part: number; indef: number }>();
    for (const l of lanc) {
      const k = l.substituto_nome.trim().toLowerCase();
      const s = porSub.get(k) ?? { nome: l.substituto_nome.trim(), sed: 0, part: 0, indef: 0 };
      const v = l.carga_horaria ?? 0;
      if (l.pagamento === 'SED') s.sed += v; else if (l.pagamento === 'PARTICULAR') s.part += v; else s.indef += v;
      porSub.set(k, s);
    }
    return {
      lancamentos: lanc.length,
      sed: ch('SED'), part: ch('PARTICULAR'), indef: ch(null),
      naoLancados: lanc.filter((l) => !l.lancado_folha).length,
      ativosComSubstituto: ativos.filter((a) => a.substituto_id).length,
      ativosSemSubstituto: ativos.filter((a) => !a.substituto_id).length,
      top: [...porSub.values()].sort((a, b) => (b.sed + b.part + b.indef) - (a.sed + a.part + a.indef)).slice(0, 6),
    };
  }, [lanc, atestados]);

  if (erro) return <p className="text-xs text-red-400">{erro}</p>;
  if (!d) return <Loader2 className="w-4 h-4 animate-spin text-gray-500" />;
  if (d.lancamentos === 0 && d.ativosComSubstituto + d.ativosSemSubstituto === 0) return null;

  return (
    <section className="space-y-3 pt-2" aria-label="Substituições e pagamentos">
      <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Substituições e pagamentos</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi rotulo="Afastamentos ativos c/ substituto" valor={String(d.ativosComSubstituto)} />
        <Kpi rotulo="Ativos sem substituto" valor={String(d.ativosSemSubstituto)} alerta={d.ativosSemSubstituto > 0} />
        <Kpi rotulo="Lançamentos na folha" valor={String(d.lancamentos)} />
        <Kpi rotulo="CH pela SED" valor={h(d.sed)} />
        <Kpi rotulo="CH particular" valor={h(d.part)} />
        <Kpi rotulo="Não lançados" valor={String(d.naoLancados)} alerta={d.naoLancados > 0} />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase font-bold text-[#2563eb]">Carga horária dos substitutos (SED · particular · a definir)</p>
        <BarrasPorTurma rotuloTotal="Total (h)" vazio="Nenhum lançamento na folha ainda."
          itens={d.top.map((s) => ({ id: s.nome, rotulo: s.nome.split(' ')[0], partes: [
            { nome: 'SED', valor: s.sed, cor: COR.sed }, { nome: 'Particular', valor: s.part, cor: COR.part }, { nome: 'A definir', valor: s.indef, cor: COR.indef }] }))} />
      </div>
      <p className="text-[11px] text-gray-500">Relatório completo, com período e impressão: RH › Substituição › Relatório e gráficos.</p>
    </section>
  );
}
