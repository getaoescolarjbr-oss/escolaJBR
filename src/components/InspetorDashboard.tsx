import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor, Turma, Student } from '../types';
import { Clock, LogOut, Eye, AlertTriangle, CheckCircle, Loader2, ChevronDown, Users, Zap, Printer } from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { printReport } from '../utils/printUtils';
import { AniversariantesPanel } from './AniversariantesPanel';

interface Props { professor: Professor; theme: 'dark' | 'light'; }

type Tab = 'atrasos' | 'saida' | 'monitor' | 'ocorrencia' | 'aniversariantes';

const TABS: { id: Tab; label: string; icon: React.ElementType | null; color: string; emoji?: string }[] = [
  { id: 'atrasos',        label: 'Controle de Entrada',  icon: Clock,          color: 'orange' },
  { id: 'saida',          label: 'Saída Antecipada',      icon: LogOut,         color: 'red'    },
  { id: 'monitor',        label: 'Monitor de Corredor',  icon: Eye,            color: 'blue'   },
  { id: 'ocorrencia',     label: 'Registrar Ocorrência', icon: AlertTriangle,  color: 'rose'   },
  { id: 'aniversariantes',label: 'Aniversários',         icon: null,           color: 'pink', emoji: '🎂' },
];

export function InspetorDashboard({ professor, theme }: Props) {
  const monitorTableRef = useRef<HTMLTableElement>(null);
  const atrasosTableRef = useRef<HTMLTableElement>(null);
  const saidasTableRef = useRef<HTMLTableElement>(null);
  const [tab, setTab] = useState<Tab>('atrasos');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Student[]>([]);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedAluno, setSelectedAluno] = useState('');
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab-specific state
  const [motivo, setMotivo]           = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [documento, setDocumento]     = useState('');
  const [telefone, setTelefone]       = useState('');
  const [parentesco, setParentesco]   = useState('');
  const [nomeResp, setNomeResp]       = useState('');
  const [assinatura, setAssinatura]   = useState('');
  const [listHoje, setListHoje]       = useState<any[]>([]);
  const [monitor, setMonitor]         = useState<any[]>([]);
  const [monitorTurma, setMonitorTurma] = useState('');
  const [tipos, setTipos]             = useState<any[]>([]);
  const [descOcorrencia, setDescOcorrencia] = useState('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const resetForm = () => {
    setSelectedAluno(''); setMotivo(''); setResponsavel('');
    setDocumento(''); setTelefone(''); setParentesco('');
    setNomeResp(''); setAssinatura(''); setDescOcorrencia('');
  };

  useEffect(() => {
    supabase.from('turmas').select('*').order('nome').then(({ data }) => {
      if (data) { setTurmas(data); setSelectedTurma(data[0]?.id || ''); }
    });
    supabase.from('tipos_ocorrencia').select('id,descricao').eq('ativo', true)
      .then(({ data }) => { if (data) setTipos(data); });
  }, []);

  useEffect(() => {
    if (!selectedTurma) return;
    setLoadingAlunos(true);
    setSelectedAluno('');
    supabase.from('alunos').select('*').eq('turma_id', selectedTurma).eq('status','Ativo').order('aluno_numero')
      .then(({ data }) => { if (data) setAlunos(data); setLoadingAlunos(false); });
  }, [selectedTurma]);

  useEffect(() => { if (tab === 'monitor') fetchMonitor(); }, [tab]);

  const fetchMonitor = async () => {
    const getLocalDateString = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getLocalDateOfISOString = (isoStr: string) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const today = getLocalDateString();
    
    const { data, error } = await supabase
      .from('saidas_sala')
      .select('*')
      .order('hora_saida', { ascending: false });

    if (error) {
      console.error('Erro ao carregar monitor:', error);
      return;
    }

    if (data) {
      const filtered = data.filter((s: any) => {
        const localSaida = getLocalDateOfISOString(s.hora_saida || s.created_at);
        return localSaida === today;
      });

      if (filtered.length > 0) {
        const alunoIds = [...new Set(filtered.map((s: any) => s.aluno_id))].filter(Boolean);
        const professorIds = [...new Set(filtered.map((s: any) => s.id_do_professor))].filter(Boolean);
        const turmaIds = [...new Set(filtered.map((s: any) => s.turma_id))].filter(Boolean);

        const [studentsRes, profsRes, classesRes] = await Promise.all([
          supabase.from('alunos').select('id, nome, aluno_numero, turma_id').in('id', alunoIds),
          supabase.from('professores').select('id, nome').in('id', professorIds),
          supabase.from('turmas').select('id, nome').in('id', turmaIds)
        ]);

        const studentMap = Object.fromEntries((studentsRes.data || []).map((s: any) => [s.id, s]));
        const profMap = Object.fromEntries((profsRes.data || []).map((p: any) => [p.id, p]));
        const classMap = Object.fromEntries((classesRes.data || []).map((c: any) => [c.id, c]));

        const mapped = filtered.map((s: any) => ({
          ...s,
          alunos: studentMap[s.aluno_id] || null,
          professores: profMap[s.id_do_professor] || null,
          turmas: classMap[s.turma_id] || null
        }));

        // Ordena: 1. Alunos que ainda não retornaram ('Fora') no topo.
        //         2. Secundariamente por hora_saida decrescente (mais recente primeiro).
        const sorted = mapped.sort((a: any, b: any) => {
          const aFora = a.status === 'Fora';
          const bFora = b.status === 'Fora';
          if (aFora && !bFora) return -1;
          if (!aFora && bFora) return 1;

          const timeA = a.hora_saida || a.created_at || '';
          const timeB = b.hora_saida || b.created_at || '';
          return timeB.localeCompare(timeA);
        });

        setMonitor(sorted);
      } else {
        setMonitor([]);
      }
    }
  };

  const fetchListaHoje = async (tabela: string) => {
    const today = new Date().toISOString().split('T')[0];
    // Buscamos apenas os registros do dia
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Erro ao carregar ${tabela}:`, error);
      return;
    }

    if (data && data.length > 0) {
      // Obter IDs únicos de alunos e turmas
      const alunoIds = [...new Set(data.map((d: any) => d.aluno_id))].filter(Boolean);
      const turmaIds = [...new Set(data.map((d: any) => d.turma_id))].filter(Boolean);

      // Buscar alunos e turmas correspondentes de forma otimizada
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('alunos').select('id, nome, aluno_numero').in('id', alunoIds),
        supabase.from('turmas').select('id, nome').in('id', turmaIds)
      ]);

      const studentMap = Object.fromEntries((studentsRes.data || []).map((s: any) => [s.id, s]));
      const classMap = Object.fromEntries((classesRes.data || []).map((c: any) => [c.id, c]));

      // Mapeia os relacionamentos manualmente de forma idêntica à estrutura original do PostgREST
      const mapped = data.map((d: any) => ({
        ...d,
        alunos: studentMap[d.aluno_id] || null,
        turmas: classMap[d.turma_id] || null
      }));

      setListHoje(mapped);
    } else {
      setListHoje([]);
    }
  };
  useEffect(() => {
    if (tab === 'atrasos') fetchListaHoje('atrasos');
    if (tab === 'saida') fetchListaHoje('saidas_antecipadas');
  }, [tab]);

  // Auto-refresh monitor
  useEffect(() => {
    if (tab !== 'monitor') return;
    const id = setInterval(fetchMonitor, 30000);
    return () => clearInterval(id);
  }, [tab]);

  const saveAtraso = async () => {
    if (!selectedAluno || !motivo.trim()) return showToast('Selecione o aluno e preencha o motivo.', false);
    setSaving(true);
    const { error } = await supabase.from('atrasos').insert({
      aluno_id: selectedAluno, turma_id: selectedTurma, motivo: motivo.trim(),
      responsavel: responsavel.trim(), documento_responsavel: documento.trim(),
      telefone_responsavel: telefone.trim(), registrado_por: professor.nome, registrado_por_id: professor.id
    });
    setSaving(false);
    if (error) return showToast('Erro: ' + error.message, false);
    showToast('✅ Atraso registrado com sucesso!');
    resetForm(); fetchListaHoje('atrasos');
  };

  const saveSaida = async () => {
    if (!selectedAluno || !nomeResp.trim()) return showToast('Preencha os campos obrigatórios.', false);
    setSaving(true);
    const { error } = await supabase.from('saidas_antecipadas').insert({
      aluno_id: selectedAluno, turma_id: selectedTurma, nome_responsavel: nomeResp.trim(),
      parentesco: parentesco.trim(), documento_responsavel: documento.trim(),
      assinatura_base64: assinatura, registrado_por: professor.nome, registrado_por_id: professor.id
    });
    setSaving(false);
    if (error) return showToast('Erro: ' + error.message, false);
    showToast('✅ Saída antecipada registrada!');
    resetForm(); fetchListaHoje('saidas_antecipadas');
  };

  const saveOcorrencia = async () => {
    if (!selectedAluno || !descOcorrencia.trim()) return showToast('Selecione o aluno e a descrição.', false);
    setSaving(true);
    const { error } = await supabase.from('ocorrências').insert({
      aluno_id: selectedAluno, id_do_professor: professor.id, turma_id: selectedTurma,
      disciplina_id: null, descricao: descOcorrencia.trim(),
      data_registro: new Date().toISOString(),
      registrado_por: professor.nome, registrado_por_cargo: professor.cargo
    });
    setSaving(false);
    if (error) return showToast('Erro: ' + error.message, false);
    showToast('✅ Ocorrência registrada!');
    resetForm();
  };

  const fmtHora = (ts: string) => {
    if (!ts) return '-';
    try { return new Date(ts.includes('T') ? ts : `2000-01-01T${ts}`).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
    catch { return ts.substring(0,5); }
  };

  const alunoNome = alunos.find(a => a.id === selectedAluno)?.nome || '';

  const inputCls = `w-full px-4 py-3 bg-ms-dark border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-ms-blue transition-all text-sm ${theme === 'light' ? 'placeholder:text-[#003366]/60' : ''}`;
  const labelCls = `block text-[10px] font-black ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} uppercase tracking-widest mb-1.5`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-ms-blue/20 flex items-center justify-center border border-ms-blue/30">
          <Users className="w-6 h-6 text-ms-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Portal do Administrativo</h1>
          <p className={`text-sm ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} font-bold`}>{professor.nome} · {professor.cargo}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-ms-dark/50 border border-ms-border rounded-2xl w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                active
                  ? t.color === 'pink' ? 'bg-pink-600 text-white shadow-lg' : 'bg-ms-blue text-white shadow-lg'
                  : `${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} hover:text-white`
              }`}>
              {Icon ? <Icon className="w-4 h-4" /> : <span>{t.emoji}</span>} {t.label}
            </button>
          );
        })}
      </div>

      {/* Seletor de Turma/Aluno (shared, except monitor) */}
      {tab !== 'monitor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-ms-card border border-ms-border rounded-2xl p-5">
          <div>
            <label className={labelCls}>Turma</label>
            <div className="relative">
              <select value={selectedTurma} onChange={e => setSelectedTurma(e.target.value)} className={inputCls}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} pointer-events-none`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Aluno <span className="text-red-400">*</span></label>
            <div className="relative">
              {loadingAlunos
                ? <div className={`${inputCls} flex items-center gap-2`}><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                : <select value={selectedAluno} onChange={e => setSelectedAluno(e.target.value)} className={inputCls}>
                    <option value="">Selecione o aluno...</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.aluno_numero} - {a.nome}</option>)}
                  </select>
              }
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} pointer-events-none`} />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ATRASOS ── */}
      {tab === 'atrasos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-ms-card border border-ms-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4" /> Registrar Atraso de Entrada</h2>
            <div>
              <label className={labelCls}>Motivo do Atraso <span className="text-red-400">*</span></label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo do atraso..." className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>Responsável</label><input value={responsavel} onChange={e=>setResponsavel(e.target.value)} placeholder="Nome (opcional)" className={inputCls} /></div>
              <div><label className={labelCls}>Documento</label><input value={documento} onChange={e=>setDocumento(e.target.value)} placeholder="RG / CPF" className={inputCls} /></div>
              <div><label className={labelCls}>Telefone</label><input value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="(67) 9..." className={inputCls} /></div>
            </div>
            <div className="flex justify-end">
              <button onClick={saveAtraso} disabled={saving || !selectedAluno || !motivo.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all disabled:opacity-50 shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Registrar Atraso
              </button>
            </div>
          </div>
          <div className="bg-ms-card border border-ms-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xs font-black ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} uppercase tracking-widest`}>Registros de Hoje</h3>
              {listHoje.length > 0 && (
                <button
                  onClick={() => printReport(atrasosTableRef.current, {
                    title: 'Controle de Entrada — Registro de Atrasos',
                    subtitle: `Log de Ocorrências Diárias — ${new Date().toLocaleDateString('pt-BR')}`,
                    info: [
                      { label: 'Inspetor', value: professor.nome },
                      { label: 'Data', value: new Date().toLocaleDateString('pt-BR') }
                    ]
                  })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                >
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {listHoje.length === 0
                ? <p className={`${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'} text-xs text-center py-8`}>Nenhum registro hoje.</p>
                : listHoje.map((r,i) => (
                  <div key={i} className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <p className="text-xs font-black text-white">{r.alunos?.nome}</p>
                    <p className={`text-[10px] ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} mt-1`}>{r.motivo}</p>
                    <p className="text-[9px] text-orange-400 mt-1 uppercase font-black">{new Date(r.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                ))}
            </div>

            {/* Tabela Invisível para Impressão */}
            <table ref={atrasosTableRef} className="hidden">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Estudante</th>
                  <th>Turma</th>
                  <th>Motivo</th>
                  <th>Responsável / Doc / Telefone</th>
                  <th>Registrado Por</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {listHoje.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{r.alunos?.nome || '—'}</td>
                    <td>{r.turmas?.nome || '—'}</td>
                    <td>{r.motivo || '—'}</td>
                    <td>
                      {r.responsavel || '—'} 
                      {r.documento_responsavel ? ` (${r.documento_responsavel})` : ''} 
                      {r.telefone_responsavel ? ` - Tel: ${r.telefone_responsavel}` : ''}
                    </td>
                    <td>{r.registrado_por || '—'}</td>
                    <td>{new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: SAÍDA ANTECIPADA ── */}
      {tab === 'saida' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-ms-card border border-ms-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><LogOut className="w-4 h-4" /> Registrar Saída Antecipada</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome de quem buscou <span className="text-red-400">*</span></label><input value={nomeResp} onChange={e=>setNomeResp(e.target.value)} placeholder="Nome completo" className={inputCls} /></div>
              <div><label className={labelCls}>Parentesco / Relação</label><input value={parentesco} onChange={e=>setParentesco(e.target.value)} placeholder="Ex: Mãe, Pai, Tio..." className={inputCls} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Documento (CPF / RG)</label><input value={documento} onChange={e=>setDocumento(e.target.value)} placeholder="Documento do responsável" className={inputCls} /></div>
            </div>
            <div>
              <label className={labelCls}>Assinatura Digital do Responsável <span className="text-red-400">*</span></label>
              <SignaturePad value={assinatura} onChange={setAssinatura} />
            </div>
            <div className="flex justify-end">
              <button onClick={saveSaida} disabled={saving || !selectedAluno || !nomeResp.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all disabled:opacity-50 shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Autorizar Saída
              </button>
            </div>
          </div>
          <div className="bg-ms-card border border-ms-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xs font-black ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} uppercase tracking-widest`}>Saídas de Hoje</h3>
              {listHoje.length > 0 && (
                <button
                  onClick={() => printReport(saidasTableRef.current, {
                    title: 'Controle de Saídas Antecipadas',
                    subtitle: `Log de Autorizações de Saída — ${new Date().toLocaleDateString('pt-BR')}`,
                    info: [
                      { label: 'Inspetor', value: professor.nome },
                      { label: 'Data', value: new Date().toLocaleDateString('pt-BR') }
                    ]
                  })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                >
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {listHoje.length === 0
                ? <p className={`${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'} text-xs text-center py-8`}>Nenhuma saída hoje.</p>
                : listHoje.map((r,i) => (
                  <div key={i} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <p className="text-xs font-black text-white">{r.alunos?.nome}</p>
                    <p className={`text-[10px] ${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'} mt-1`}>{r.nome_responsavel} · {r.parentesco}</p>
                    {r.assinatura_base64 && <span className="text-[9px] text-green-400 font-black uppercase">✅ Assinado</span>}
                    <p className="text-[9px] text-red-400 mt-1 uppercase font-black">{new Date(r.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                ))}
            </div>

            {/* Tabela Invisível para Impressão */}
            <table ref={saidasTableRef} className="hidden">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Estudante</th>
                  <th>Turma</th>
                  <th>Responsável</th>
                  <th>Parentesco</th>
                  <th>Documento</th>
                  <th>Assinatura</th>
                  <th>Registrado Por</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {listHoje.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{r.alunos?.nome || '—'}</td>
                    <td>{r.turmas?.nome || '—'}</td>
                    <td>{r.nome_responsavel || '—'}</td>
                    <td>{r.parentesco || '—'}</td>
                    <td>{r.documento_responsavel || '—'}</td>
                    <td>{r.assinatura_base64 ? 'Assinado' : 'Pendente'}</td>
                    <td>{r.registrado_por || '—'}</td>
                    <td>{new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: MONITOR DE CORREDOR ── */}
      {tab === 'monitor' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${theme === 'light' ? 'text-[#003366]' : 'text-blue-400'}`}>
              <Eye className="w-4 h-4" /> Alunos Fora de Sala — Hoje
            </h2>
            <div className="flex items-center gap-3">
              <select 
                value={monitorTurma} 
                onChange={e=>setMonitorTurma(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-xs font-bold outline-none ${theme === 'light' ? 'bg-white border-blue-200 text-[#003366]' : 'bg-ms-card border-ms-border text-white'}`}
              >
                <option value="">Todas as turmas</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button
                onClick={() => {
                  const currentTurmaNome = turmas.find(t => t.id === monitorTurma)?.nome || 'Todas as Turmas';
                  printReport(monitorTableRef.current, {
                    title: 'Alunos Fora de Sala — Monitor de Corredor',
                    subtitle: `Filtro: ${currentTurmaNome}`,
                    info: [
                      { label: 'Inspetor', value: professor.nome },
                      { label: 'Turma', value: currentTurmaNome }
                    ]
                  });
                }}
                className={`px-3 py-2 border rounded-lg text-xs font-black transition-all flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border-transparent`}
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
              <button 
                onClick={fetchMonitor} 
                className={`px-3 py-2 border rounded-lg text-xs font-black transition-all ${theme === 'light' ? 'bg-[#003366]/10 border-[#003366]/20 text-[#003366] hover:bg-[#003366]/20' : 'bg-ms-blue/20 border border-ms-blue/30 text-blue-400 hover:bg-ms-blue/30'}`}
              >
                ↻ Atualizar
              </button>
            </div>
          </div>
          <div className={`border rounded-2xl overflow-hidden ${theme === 'light' ? 'bg-white border-blue-100 shadow-xl' : 'bg-ms-card border-ms-border'}`}>
            <table ref={monitorTableRef} className="w-full">
              <thead>
                <tr className={`${theme === 'light' ? 'bg-[#003366]' : 'bg-[#0a1a3a]'} border-b border-ms-border`}>
                  {['Nº','Aluno','Turma','Professor','Saída','Retorno Prev.','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ms-border/30">
                {monitor.filter(s => !monitorTurma || s.alunos?.turma_id === monitorTurma || s.turma_id === monitorTurma).length === 0
                  ? <tr><td colSpan={7} className={`text-center py-16 ${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} text-sm`}>Nenhum aluno fora de sala no momento.</td></tr>
                  : monitor
                      .filter(s => !monitorTurma || s.alunos?.turma_id === monitorTurma || s.turma_id === monitorTurma)
                      .map((s,i) => {
                        const isFora = s.status === 'Fora';
                        
                        const rowBgClass = isFora
                          ? theme === 'light'
                            ? 'bg-red-50/70 border-l-4 border-red-500 shadow-sm transition-all'
                            : 'bg-red-950/20 border-l-4 border-red-500 shadow-sm transition-all'
                          : i % 2 === 0
                            ? theme === 'light'
                              ? 'bg-gray-50/40 hover:bg-gray-100/30'
                              : 'bg-ms-dark/20'
                            : 'bg-transparent';

                        const textNameColor = theme === 'light'
                          ? isFora ? 'text-red-950 font-extrabold' : 'text-[#003366] font-bold'
                          : 'text-white';

                        const textNormalColor = theme === 'light'
                          ? isFora ? 'text-red-900/80 font-semibold' : 'text-[#003366]/80'
                          : 'text-gray-400';

                        return (
                          <tr key={i} className={`transition-colors ${rowBgClass}`}>
                            <td className="px-4 py-3 text-xs font-black text-ms-gold">{s.alunos?.aluno_numero||'-'}</td>
                            <td className={`px-4 py-3 text-xs ${textNameColor}`}>{s.alunos?.nome||'-'}</td>
                            <td className={`px-4 py-3 text-xs ${textNormalColor}`}>{s.turmas?.nome||'-'}</td>
                            <td className={`px-4 py-3 text-xs ${textNormalColor}`}>{s.professores?.nome||'-'}</td>
                            <td className={`px-4 py-3 text-xs font-bold ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}>{fmtHora(s.hora_saida||s.horario_saida)}</td>
                            <td className={`px-4 py-3 text-xs ${textNormalColor}`}>{fmtHora(s.hora_retorno||s.horario_retorno)||'—'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                s.status === 'Retornou'
                                  ? theme === 'light'
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-green-500/10 text-green-400'
                                  : theme === 'light'
                                    ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                                    : 'bg-red-500/10 text-red-400'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </div>
          <p className={`text-[10px] ${theme === 'light' ? 'text-[#003366]/70' : 'text-gray-600'} text-center font-bold uppercase tracking-widest`}>
            Atualização automática a cada 30 segundos
          </p>
        </div>
      )}

      {/* ── TAB: OCORRÊNCIA ── */}
      {tab === 'ocorrencia' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-ms-card border border-ms-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Registrar Ocorrência</h2>
            {tipos.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Zap className="w-3 h-3" /> Registros Rápidos</p>
                <div className="flex flex-wrap gap-2">
                  {tipos.map(t => (
                    <button key={t.id} onClick={() => setDescOcorrencia(t.descricao)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        descOcorrencia===t.descricao?'bg-red-600 text-white border-red-500':'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}>
                      {t.descricao}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>Descrição da Ocorrência <span className="text-red-400">*</span></label>
              <textarea value={descOcorrencia} onChange={e=>setDescOcorrencia(e.target.value)} rows={4}
                placeholder="Descreva detalhadamente o ocorrido..." className={inputCls} />
            </div>
            {alunoNome && (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
                <p className={`text-[10px] ${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} font-black uppercase tracking-widest`}>Aluno</p>
                <p className="text-sm font-black text-white mt-0.5">{alunoNome}</p>
                <p className={`text-[10px] ${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'} mt-1`}>Registrado por: <span className="text-rose-400 font-black">{professor.nome} ({professor.cargo})</span></p>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={saveOcorrencia} disabled={saving || !selectedAluno || !descOcorrencia.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl transition-all disabled:opacity-50 shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Registrar Ocorrência
              </button>
            </div>
          </div>
          <div className="bg-ms-card border border-ms-border rounded-2xl p-5 flex items-center justify-center">
            <div className={`text-center ${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'}`}>
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Ocorrências ficam registradas na ficha do aluno no Portal do Coordenador</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'aniversariantes' && (
        <div className="mt-4">
          <AniversariantesPanel />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white ${toast.ok?'bg-green-600':'bg-red-600'}`}>
          {toast.ok ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
