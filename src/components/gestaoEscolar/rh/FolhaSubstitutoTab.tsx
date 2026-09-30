import { useEffect, useMemo, useState } from 'react';
import { Download, FileInput, Loader2, Pencil, Plus, Printer, Save, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { LancamentoFolhaSubstituto, PagamentoSubstituto } from '../../../types/rh';
import { listarProfessoresParaSelecao, listarTurmas } from '../../../services/agendamentoService';
import {
  atualizarLancamentoFolha, criarLancamentoFolha, excluirLancamentoFolha, importarAtestadosParaFolha, listarLancamentosFolha,
  listarTurmasDoProfessor, type AulaDoProfessor,
} from '../../../services/folhaSubstitutoService';
import {
  MOTIVOS_SUGERIDOS, ROTULO_PAGAMENTO, dataCurta, formatarHoras, gerarCsvControleFolha, gerarHtmlControleFolha, imprimirHtml, lerHoras,
  nomesDasTurmas, rotuloCompetencia, rotuloPeriodo, turmasDoPeriodo,
} from '../../../utils/folhaSubstituto';

interface Pessoa { id: string | null; nome: string }
interface Form {
  modo: 'dia' | 'periodo'; data: string; dataFim: string;
  substituto: Pessoa; titular: Pessoa; motivo: string; turno: string; ch: string; pagamento: '' | PagamentoSubstituto; obs: string;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const FORM_VAZIO = (): Form => ({
  modo: 'dia', data: hoje(), dataFim: '', substituto: { id: null, nome: '' }, titular: { id: null, nome: '' },
  motivo: '', turno: '', ch: '', pagamento: '', obs: '',
});
const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';
const classeRotulo = 'text-[10px] font-black uppercase tracking-wider text-gray-400';

// Nome livre com sugestões da lista de servidores: escolher da lista guarda o vínculo
// (id); digitar um nome que não existe (ex.: "não houve") também vale.
function CampoPessoa({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: Pessoa; opcoes: { id: string; nome: string }[]; onChange: (p: Pessoa) => void }) {
  const [foco, setFoco] = useState(false);
  const termo = valor.nome.trim().toLowerCase();
  const sugestoes = useMemo(
    () => (termo.length < 1 ? [] : opcoes.filter((o) => o.nome.toLowerCase().includes(termo) && o.nome.toLowerCase() !== termo).slice(0, 6)),
    [opcoes, termo],
  );
  return (
    <label className="block relative">
      <span className={classeRotulo}>{rotulo}</span>
      <input
        value={valor.nome}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onChange={(e) => {
          const nome = e.target.value;
          const exato = opcoes.find((o) => o.nome.toLowerCase() === nome.trim().toLowerCase());
          onChange({ id: exato?.id ?? null, nome });
        }}
        className={`${classeInput} mt-1`}
        autoComplete="off"
      />
      {foco && sugestoes.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden">
          {sugestoes.map((o) => (
            <button key={o.id} type="button" onMouseDown={(e) => { e.preventDefault(); onChange({ id: o.id, nome: o.nome }); }}
              className="w-full text-left px-3 py-2 text-sm text-ms-main hover:bg-ms-blue/20">{o.nome}</button>
          ))}
        </div>
      )}
    </label>
  );
}

// Controle de lançamento de folha do professor substituto — a planilha de papel da
// secretaria em forma de tela. Os lançamentos nascem sozinhos quando um atestado é
// registrado com substituto; aqui se completa CH e forma de pagamento (SED ou particular),
// acompanha termo/justificativa/lançamento e imprime ou exporta a competência.
export function FolhaSubstitutoTab() {
  const { usuarioId } = useAuth();
  const [competencia, setCompetencia] = useState(() => hoje().slice(0, 7)); // AAAA-MM
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [lista, setLista] = useState<LancamentoFolhaSubstituto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [turmaNomes, setTurmaNomes] = useState<Record<string, string>>({});
  const [turmasTitular, setTurmasTitular] = useState<{ profId: string; aulas: AulaDoProfessor[]; alocadas: string[] } | null>(null);
  // null = automático (as turmas com aula no dia/período); lista = escolha manual da secretaria.
  const [turmasSel, setTurmasSel] = useState<string[] | null>(null);
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const [filtroPgto, setFiltroPgto] = useState<'' | PagamentoSubstituto | 'INDEFINIDO'>('');

  const competenciaDia1 = `${competencia}-01`;

  async function carregar() {
    setCarregando(true);
    try {
      setLista(await listarLancamentosFolha(competenciaDia1));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os lançamentos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setProfessores(await listarProfessoresParaSelecao()); } catch { /* sugestões são opcionais */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setTurmaNomes(Object.fromEntries((await listarTurmas()).map((x) => [x.id, x.nome]))); } catch { /* só afeta os nomes exibidos */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const titularId = form.titular.id;
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!titularId) { setTurmasTitular(null); return; }
      try { setTurmasTitular({ profId: titularId, ...(await listarTurmasDoProfessor(titularId)) }); }
      catch { setTurmasTitular(null); }
    }, 0);
    return () => clearTimeout(t);
  }, [titularId]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  const turmasForm = useMemo(() => {
    if (!titularId || !turmasTitular || turmasTitular.profId !== titularId || !form.data) return null;
    return turmasDoPeriodo(turmasTitular.aulas, turmasTitular.alocadas, form.data, form.modo === 'periodo' ? form.dataFim || null : null);
  }, [titularId, turmasTitular, form.data, form.dataFim, form.modo]);
  const turmasMarcadas = turmasSel ?? turmasForm?.padrao ?? [];

  function alternarTurma(id: string) {
    setTurmasSel(turmasMarcadas.includes(id) ? turmasMarcadas.filter((x) => x !== id) : [...turmasMarcadas, id]);
  }

  async function salvar() {
    if (!usuarioId) return;
    const ch = lerHoras(form.ch);
    if (!form.data || !form.substituto.nome.trim() || !form.titular.nome.trim() || !form.motivo.trim()) {
      setErro('Preencha a data, o professor substituto, o professor titular e o motivo.');
      return;
    }
    if (form.modo === 'periodo' && (!form.dataFim || form.dataFim < form.data)) {
      setErro('No período, a data final não pode ser anterior à inicial.');
      return;
    }
    if (Number.isNaN(ch)) { setErro('Carga horária inválida. Use números, ex.: 8 ou 3,75.'); return; }
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      const dados = {
        competencia: competenciaDia1,
        data: form.data,
        data_fim: form.modo === 'periodo' && form.dataFim !== form.data ? form.dataFim : null,
        turma_ids: titularId ? turmasMarcadas : [],
        substituto_id: form.substituto.id, substituto_nome: form.substituto.nome.trim(),
        titular_id: form.titular.id, titular_nome: form.titular.nome.trim(),
        motivo: form.motivo.trim(), periodo: form.turno.trim() || null, carga_horaria: ch,
        pagamento: form.pagamento || null, observacoes: form.obs.trim() || null,
      };
      if (editId) await atualizarLancamentoFolha(editId, dados);
      else await criarLancamentoFolha(dados, usuarioId);
      // Mantém data, motivo e pagamento para agilizar a próxima linha (várias substituições no mesmo dia).
      setForm({ ...FORM_VAZIO(), data: form.data, motivo: editId ? '' : form.motivo, pagamento: editId ? '' : form.pagamento });
      setEditId(null);
      setTurmasSel(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function editar(l: LancamentoFolhaSubstituto) {
    setEditId(l.id);
    setTurmasSel(l.turma_ids);
    setForm({
      modo: l.data_fim ? 'periodo' : 'dia', data: l.data, dataFim: l.data_fim ?? '',
      substituto: { id: l.substituto_id, nome: l.substituto_nome }, titular: { id: l.titular_id, nome: l.titular_nome },
      motivo: l.motivo, turno: l.periodo ?? '', ch: l.carga_horaria === null ? '' : String(l.carga_horaria).replace('.', ','),
      pagamento: l.pagamento ?? '', obs: l.observacoes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function alterar(l: LancamentoFolhaSubstituto, dados: Partial<LancamentoFolhaSubstituto>) {
    setLista((atual) => atual.map((x) => (x.id === l.id ? { ...x, ...dados } : x)));
    try {
      await atualizarLancamentoFolha(l.id, dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar.');
      await carregar();
    }
  }

  async function excluir(l: LancamentoFolhaSubstituto) {
    if (!confirm(`Excluir o lançamento de ${l.substituto_nome} (${dataCurta(l.data)})?`)) return;
    try { await excluirLancamentoFolha(l.id); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    setAviso(null);
    try {
      const n = await importarAtestadosParaFolha(competenciaDia1);
      setAviso(n === 0 ? 'Nada novo para importar nesta competência.' : `${n} lançamento${n > 1 ? 's' : ''} trazido${n > 1 ? 's' : ''} dos atestados e substituições.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar.');
    } finally {
      setImportando(false);
    }
  }

  function exportarCsv() {
    const blob = new Blob([gerarCsvControleFolha(lista, turmaNomes)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `controle-folha-substituto-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((l) =>
      (!soPendentes || !l.lancado_folha) &&
      (!filtroPgto || (filtroPgto === 'INDEFINIDO' ? !l.pagamento : l.pagamento === filtroPgto)) &&
      (!t || `${l.substituto_nome} ${l.titular_nome} ${l.motivo} ${nomesDasTurmas(l.turma_ids, turmaNomes)}`.toLowerCase().includes(t)));
  }, [lista, busca, soPendentes, filtroPgto, turmaNomes]);

  const resumo = useMemo(() => {
    const mapa = new Map<string, { nome: string; n: number; sed: number; part: number; indef: number; pendentes: number }>();
    for (const l of lista) {
      const k = l.substituto_nome.trim().toLowerCase();
      const r = mapa.get(k) ?? { nome: l.substituto_nome.trim(), n: 0, sed: 0, part: 0, indef: 0, pendentes: 0 };
      r.n++;
      if (l.pagamento === 'SED') r.sed += l.carga_horaria ?? 0;
      else if (l.pagamento === 'PARTICULAR') r.part += l.carga_horaria ?? 0;
      else r.indef += l.carga_horaria ?? 0;
      if (!l.lancado_folha) r.pendentes++;
      mapa.set(k, r);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [lista]);

  const pendentes = lista.filter((l) => !l.lancado_folha).length;
  const semPagamento = lista.filter((l) => !l.pagamento).length;
  const semCh = lista.filter((l) => l.carga_horaria === null).length;
  const chTotal = lista.reduce((s, l) => s + (l.carga_horaria ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={classeRotulo}>Competência</span>
          <input type="month" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} className={`${classeInput} mt-1`} />
        </label>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button onClick={importar} disabled={importando} title="Traz os atestados e as substituições com professor substituto que ainda não estão na lista"
            className="flex items-center gap-2 px-4 py-2 bg-ms-card border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue disabled:opacity-50">
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileInput className="w-4 h-4" />} Importar atestados e substituições
          </button>
          <button onClick={() => imprimirHtml(gerarHtmlControleFolha(lista, competenciaDia1, turmaNomes))} className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600">
            <Printer className="w-4 h-4" /> Imprimir controle
          </button>
          <button onClick={exportarCsv} disabled={lista.length === 0} className="flex items-center gap-2 px-4 py-2 bg-ms-card border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel (CSV)
          </button>
        </div>
      </div>

      {aviso && <p className="text-xs text-green-400">{aviso}</p>}
      <p className="text-[11px] text-gray-500">
        Quando um atestado ou uma substituição (aba Substituição) é registrado com professor substituto, o lançamento aparece aqui sozinho. Falta só informar a carga horária e se o pagamento é pela SED ou particular. Se não servir, é só excluir a linha.
      </p>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">{editId ? 'Editar lançamento' : `Novo lançamento — ${rotuloCompetencia(competenciaDia1)}`}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2 space-y-1">
            <span className={classeRotulo}>Dia ou período da substituição</span>
            <div className="flex gap-2 items-center">
              <div className="flex rounded-lg overflow-hidden border border-gray-800 shrink-0">
                {(['dia', 'periodo'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, modo: m, dataFim: m === 'dia' ? '' : form.dataFim })}
                    className={`px-3 py-2 text-xs font-bold ${form.modo === m ? 'bg-ms-blue text-white' : 'bg-ms-dark text-gray-400 hover:text-gray-200'}`}>{m === 'dia' ? 'Um dia' : 'Período'}</button>
                ))}
              </div>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={classeInput} aria-label="Data inicial" />
              {form.modo === 'periodo' && (
                <>
                  <span className="text-xs text-gray-500">até</span>
                  <input type="date" value={form.dataFim} min={form.data} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} className={classeInput} aria-label="Data final" />
                </>
              )}
            </div>
          </div>
          <label className="block"><span className={classeRotulo}>Turno / horário (opcional)</span>
            <input value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} placeholder="manhã · vespertino · 3 aulas" className={`${classeInput} mt-1`} /></label>
          <label className="block"><span className={classeRotulo}>Motivo</span>
            <input list="motivos-folha" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className={`${classeInput} mt-1`} />
            <datalist id="motivos-folha">{MOTIVOS_SUGERIDOS.map((m) => <option key={m} value={m} />)}</datalist></label>
          <CampoPessoa rotulo="Professor substituto" valor={form.substituto} opcoes={professores} onChange={(p) => setForm({ ...form, substituto: p })} />
          <CampoPessoa rotulo="Professor titular" valor={form.titular} opcoes={professores} onChange={(p) => { if (p.id !== form.titular.id) setTurmasSel(null); setForm({ ...form, titular: p }); }} />
          <label className="block"><span className={classeRotulo}>CH (horas)</span>
            <input inputMode="decimal" value={form.ch} onChange={(e) => setForm({ ...form, ch: e.target.value })} placeholder="Ex.: 8 ou 3,75" className={`${classeInput} mt-1`} /></label>
          <label className="block"><span className={classeRotulo}>Pagamento</span>
            <select value={form.pagamento} onChange={(e) => setForm({ ...form, pagamento: e.target.value as Form['pagamento'] })} className={`${classeInput} mt-1`}>
              <option value="">A definir</option>
              <option value="SED">Pela SED</option>
              <option value="PARTICULAR">Particular</option>
            </select></label>
          <div className="sm:col-span-2 lg:col-span-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={classeRotulo}>Turmas substituídas</span>
              {turmasForm && (
                <>
                  <button type="button" onClick={() => setTurmasSel(turmasForm.opcoes.map((o) => o.id))} className="text-[11px] text-ms-blueText hover:underline">Marcar todas</button>
                  <button type="button" onClick={() => setTurmasSel([])} className="text-[11px] text-ms-blueText hover:underline">Limpar</button>
                  {turmasSel !== null && <button type="button" onClick={() => setTurmasSel(null)} className="text-[11px] text-ms-blueText hover:underline">Só as com aula no dia/período</button>}
                </>
              )}
            </div>
            {!titularId ? (
              <p className="text-[11px] text-gray-500">Escolha o professor titular na lista para ver as turmas dele.</p>
            ) : !turmasForm ? (
              <p className="text-[11px] text-gray-500">Carregando as turmas...</p>
            ) : turmasForm.opcoes.length === 0 ? (
              <p className="text-[11px] text-gray-500">Este professor não tem turmas cadastradas (grade ou alocações).</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {[...turmasForm.opcoes].sort((a, b) => (turmaNomes[a.id] ?? '').localeCompare(turmaNomes[b.id] ?? '', 'pt-BR', { numeric: true })).map((o) => {
                    const marcada = turmasMarcadas.includes(o.id);
                    return (
                      <label key={o.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none ${marcada ? 'bg-ms-blue/15 border-ms-blueText/40 text-ms-main' : 'bg-ms-dark border-gray-800 text-gray-400'}`}>
                        <input type="checkbox" checked={marcada} onChange={() => alternarTurma(o.id)} className="accent-blue-600" />
                        <span className="font-bold">{turmaNomes[o.id] ?? 'Turma'}</span>
                        <span className="text-[10px] opacity-70">{o.aulas > 0 ? `${o.aulas} aula${o.aulas > 1 ? 's' : ''} no período` : 'sem aula no período'}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500">{turmasSel === null ? 'Marcadas automaticamente as turmas que têm aula nos dias da substituição.' : 'Seleção manual.'}</p>
              </>
            )}
          </div>
          <label className="block sm:col-span-2 lg:col-span-4"><span className={classeRotulo}>Observação</span>
            <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Ex.: falta a folha" className={`${classeInput} mt-1`} /></label>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editId ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(FORM_VAZIO()); setTurmasSel(null); setErro(null); }} className="flex items-center gap-1 px-4 py-2 bg-ms-dark border border-gray-800 text-gray-300 rounded-lg text-sm"><X className="w-4 h-4" /> Cancelar</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span><b className="text-ms-main">{lista.length}</b> lançamentos</span>
        <span><b className={pendentes ? 'text-amber-400' : 'text-green-400'}>{pendentes}</b> a lançar</span>
        {semPagamento > 0 && <span><b className="text-amber-400">{semPagamento}</b> sem forma de pagamento</span>}
        {semCh > 0 && <span><b className="text-amber-400">{semCh}</b> sem CH</span>}
        <span>CH total <b className="text-ms-main">{formatarHoras(chTotal) || '0h'}</b></span>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou motivo..." className="pl-9 pr-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <select value={filtroPgto} onChange={(e) => setFiltroPgto(e.target.value as typeof filtroPgto)} className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none" aria-label="Filtrar por pagamento">
          <option value="">Todos os pagamentos</option>
          <option value="SED">Só SED</option>
          <option value="PARTICULAR">Só particular</option>
          <option value="INDEFINIDO">A definir</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} className="accent-blue-600" /> Só os não lançados</label>
      </div>

      <div className="overflow-x-auto bg-ms-card border border-gray-800 rounded-2xl">
        <table className="w-full text-sm min-w-[1080px]">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-800">
              <th className="px-3 py-3">Data / período</th><th className="px-3 py-3">Substituto</th><th className="px-3 py-3">Titular</th><th className="px-3 py-3">Turmas</th><th className="px-3 py-3">Motivo</th>
              <th className="px-3 py-3">CH</th><th className="px-3 py-3">Pagamento</th>
              <th className="px-2 py-3 text-center">Termo</th><th className="px-2 py-3 text-center">Just.</th><th className="px-2 py-3 text-center">Lançado / pago</th><th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={11} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-ms-blueText" /></td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={11} className="py-8 text-center text-gray-500">{lista.length === 0 ? 'Nenhum lançamento nesta competência.' : 'Nada encontrado com esse filtro.'}</td></tr>
            ) : (
              visiveis.map((l) => (
                <tr key={l.id} className={`border-b border-gray-800/60 ${l.lancado_folha ? 'bg-yellow-400/10' : ''}`}>
                  <td className="px-3 py-2">
                    <span className="whitespace-nowrap">{l.data_fim ? rotuloPeriodo({ data: l.data, data_fim: l.data_fim, periodo: null }) : dataCurta(l.data)}</span>
                    {l.periodo && <span className="block text-[11px] text-gray-400">{l.periodo}</span>}
                  </td>
                  <td className="px-3 py-2 font-bold text-ms-main">{l.substituto_nome}{l.origem !== 'MANUAL' && <span className="ml-2 align-middle text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-ms-blue/15 text-ms-blueText" title={l.origem === 'ATESTADO' ? 'Veio do lançamento do atestado' : 'Veio da aba Substituição'}>{l.origem === 'ATESTADO' ? 'atestado' : 'substituição'}</span>}</td>
                  <td className="px-3 py-2">{l.titular_nome}</td>
                  <td className="px-3 py-2 text-xs text-gray-300 max-w-[160px]">{nomesDasTurmas(l.turma_ids, turmaNomes) || <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2">{l.motivo}{l.observacoes && <span className="block text-[11px] text-amber-400">{l.observacoes}</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.carga_horaria === null ? <span className="text-amber-400 text-xs">informar</span> : formatarHoras(l.carga_horaria)}</td>
                  <td className="px-3 py-2">
                    <select value={l.pagamento ?? ''} onChange={(e) => alterar(l, { pagamento: (e.target.value || null) as PagamentoSubstituto | null })}
                      className={`px-2 py-1 bg-ms-dark border rounded-lg text-xs outline-none ${l.pagamento ? 'border-gray-800 text-ms-main' : 'border-amber-500/60 text-amber-400'}`} aria-label="Forma de pagamento">
                      <option value="">A definir</option>
                      {(Object.keys(ROTULO_PAGAMENTO) as PagamentoSubstituto[]).map((p) => <option key={p} value={p}>{ROTULO_PAGAMENTO[p]}</option>)}
                    </select>
                  </td>
                  {(['termo_ok', 'justificativa_ok', 'lancado_folha'] as const).map((c) => (
                    <td key={c} className="px-2 py-2 text-center"><input type="checkbox" checked={l[c]} onChange={() => alterar(l, { [c]: !l[c] })} className="w-4 h-4 accent-green-600 cursor-pointer" aria-label={c} /></td>
                  ))}
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => editar(l)} className="p-1.5 text-ms-blueText hover:bg-ms-blue/20 rounded-lg" title="Editar"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => excluir(l)} className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resumo.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">Resumo por professor substituto</p>
          <div className="flex flex-wrap gap-2">
            {resumo.map((r) => (
              <div key={r.nome} className="px-3 py-2 bg-ms-card border border-gray-800 rounded-xl text-xs">
                <p className="font-bold text-ms-main">{r.nome}</p>
                <p className="text-gray-400">
                  {r.n} lançamento{r.n > 1 ? 's' : ''}
                  {r.sed > 0 && <> · SED {formatarHoras(r.sed)}</>}
                  {r.part > 0 && <> · particular {formatarHoras(r.part)}</>}
                  {r.indef > 0 && <span className="text-amber-400"> · a definir {formatarHoras(r.indef)}</span>}
                  {r.pendentes > 0 && <span className="text-amber-400"> · {r.pendentes} a lançar</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
