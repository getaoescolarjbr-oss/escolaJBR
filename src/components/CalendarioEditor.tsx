import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Trash2, Edit3, CheckCircle, AlertCircle, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calendarData } from '../data/calendarData';
import type { DiaCalendario, DiaCategoria } from '../data/calendarData';

interface CalendarioEditorProps {
  isOpen: boolean;
  onClose: () => void;
  professorNome?: string;
}

interface EventoCustom {
  id?: string;
  data: string;
  categoria: string;
  abreviacao: string;
  descricao: string;
}

interface FormState {
  data: string;
  categoria: DiaCategoria;
  abreviacao: string;
  descricao: string;
  isCustom: boolean;
  eventoId?: string;
  cor?: string;
}

const meses = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const categorias: { value: DiaCategoria; label: string; color: string }[] = [
  { value: 'letivo',      label: 'Dia Letivo',           color: '#7cb342' },
  { value: 'nao_letivo',  label: 'Feriado / Não Letivo', color: '#e53935' },
  { value: 'ferias',      label: 'Férias / Recesso',     color: '#ffd700' },
  { value: 'em_apc',      label: 'Emenda / APC',         color: '#81c784' },
  { value: 'inicio_ano',  label: 'Início do Ano',        color: '#1565c0' },
  { value: 'exame_final', label: 'Exame Final',          color: '#8e24aa' },
  { value: 'normal',      label: 'Sem marcação',         color: '#9e9e9e' },
];

const coresPaleta = [
  { hex: '#7cb342', nome: 'Verde Letivo' },
  { hex: '#e53935', nome: 'Vermelho Feriado' },
  { hex: '#ffd700', nome: 'Dourado Férias' },
  { hex: '#81c784', nome: 'Verde Claro APC' },
  { hex: '#1565c0', nome: 'Azul Início' },
  { hex: '#8e24aa', nome: 'Roxo Exame' },
  { hex: '#0ea5e9', nome: 'Celeste' },
  { hex: '#10b981', nome: 'Esmeralda' },
  { hex: '#f59e0b', nome: 'Âmbar' },
  { hex: '#6366f1', nome: 'Índigo' },
  { hex: '#ec4899', nome: 'Rosa' },
  { hex: '#14b8a6', nome: 'Teal' },
  { hex: '#f43f5e', nome: 'Rose' },
  { hex: '#8b5cf6', nome: 'Violeta' },
];

function parseCategoria(catString: string) {
  if (!catString) return { categoriaBase: 'normal' as DiaCategoria, corCustom: null };
  const parts = catString.split(':');
  return {
    categoriaBase: parts[0] as DiaCategoria,
    corCustom: parts[1] || null
  };
}

function getContrastColor(hexColor: string) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

function getCorCategoria(categoria: string) {
  switch (categoria) {
    case 'ferias':      return 'bg-[#ffd700] text-black border-[#e6c200]';
    case 'nao_letivo':  return 'bg-[#e53935] text-white border-[#c62828]';
    case 'letivo':      return 'bg-[#7cb342] text-black border-[#558b2f]';
    case 'em_apc':      return 'bg-[#81c784] text-black border-[#388e3c]';
    case 'inicio_ano':  return 'bg-[#1565c0] text-white border-[#0d47a1]';
    case 'exame_final': return 'bg-[#8e24aa] text-white border-[#6a1b9a]';
    default:            return 'bg-transparent text-gray-700';
  }
}

export function CalendarioEditor({ isOpen, onClose, professorNome }: CalendarioEditorProps) {
  const [eventosCustom, setEventosCustom] = useState<Record<string, EventoCustom>>({});
  const [avaliacoesPublicadas, setAvaliacoesPublicadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const ano = 2026;

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    // 1. Buscar eventos customizados
    const { data, error } = await supabase.from('calendario_eventos').select('*');
    if (!error && data) {
      const map: Record<string, EventoCustom> = {};
      data.forEach((e: any) => { map[e.data] = e; });
      setEventosCustom(map);
    }

    // 2. Buscar avaliações publicadas
    const { data: avals } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('publicada', true)
      .not('data_avaliacao', 'is', null);

    if (avals && avals.length > 0) {
      const classIds = [...new Set(avals.map(a => a.turma_id).filter(Boolean))];
      const discIds = [...new Set(avals.map(a => a.disciplina_id).filter(Boolean))];
      const profIds = [...new Set(avals.map(a => a.professor_id).filter(Boolean))];

      const [resTurmas, resDisciplinas, resProfessores] = await Promise.all([
        classIds.length > 0 ? supabase.from('turmas').select('id, nome').in('id', classIds) : { data: [] },
        discIds.length > 0 ? supabase.from('disciplinas').select('id, nome').in('id', discIds) : { data: [] },
        profIds.length > 0 ? supabase.from('professores').select('id, nome').in('id', profIds) : { data: [] }
      ]);

      const turmasMap = Object.fromEntries((resTurmas.data || []).map(t => [t.id, t.nome]));
      const discMap = Object.fromEntries((resDisciplinas.data || []).map(d => [d.id, d.nome]));
      const profMap = Object.fromEntries((resProfessores.data || []).map(p => [p.id, p.nome]));

      const mappedAvals = avals.map(a => ({
        ...a,
        turmaNome: turmasMap[a.turma_id] || 'Turma não encontrada',
        disciplinaNome: discMap[a.disciplina_id] || 'Disciplina não encontrada',
        professorNome: profMap[a.professor_id] || 'Professor não encontrado'
      }));

      setAvaliacoesPublicadas(mappedAvals);
    } else {
      setAvaliacoesPublicadas([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) fetchEventos();
  }, [isOpen, fetchEventos]);

  if (!isOpen) return null;

  const getDiasNoMes = (mes: number) => {
    const numDias = new Date(ano, mes + 1, 0).getDate();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    return { numDias, primeiroDia };
  };

  const getMergedDia = (dataStr: string): DiaCalendario | undefined => {
    if (eventosCustom[dataStr]) return eventosCustom[dataStr] as DiaCalendario;
    return calendarData[dataStr];
  };

  const handleDayClick = (dataStr: string) => {
    const custom = eventosCustom[dataStr];
    const base = calendarData[dataStr];
    const current = custom || base;
    setSelectedDay(dataStr);

    let parsedCat = (current?.categoria as DiaCategoria) || 'normal';
    let parsedCor = '';
    if (current?.categoria && current.categoria.includes(':')) {
      const parts = current.categoria.split(':');
      parsedCat = parts[0] as DiaCategoria;
      parsedCor = parts[1] || '';
    }

    setForm({
      data: dataStr,
      categoria: parsedCat,
      abreviacao: current?.abreviacao || '',
      descricao: current?.descricao || '',
      isCustom: !!custom,
      eventoId: custom?.id,
      cor: parsedCor,
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);

    const categoriaSalvar = form.cor ? `${form.categoria}:${form.cor}` : form.categoria;

    const payload = {
      data: form.data,
      categoria: categoriaSalvar,
      abreviacao: form.abreviacao.trim(),
      descricao: form.descricao.trim(),
      criado_por: professorNome || 'Gestor',
    };
    const { error } = await supabase
      .from('calendario_eventos')
      .upsert(payload, { onConflict: 'data' });

    if (error) {
      showToast('Erro ao salvar: ' + error.message, 'error');
    } else {
      showToast('✅ Evento salvo com sucesso!', 'success');
      await fetchEventos();
      setSelectedDay(null);
      setForm(null);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from('calendario_eventos')
      .delete()
      .eq('data', form.data);

    if (error) {
      showToast('Erro ao remover: ' + error.message, 'error');
    } else {
      showToast('🗑️ Evento personalizado removido!', 'success');
      await fetchEventos();
      setSelectedDay(null);
      setForm(null);
    }
    setSaving(false);
  };

  const formatDate = (dataStr: string) => {
    const [y, m, d] = dataStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-stretch bg-black/90 backdrop-blur-sm">
      {/* GRID PRINCIPAL */}
      <div className="flex-1 overflow-y-auto bg-[#f5f7fa]">
        {/* CABEÇALHO */}
        <div className="bg-white p-4 md:p-6 flex items-center justify-between border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <Edit3 className="w-6 h-6 text-[#1565c0]" />
            <div>
              <h1 className="text-xl font-black text-[#1565c0] tracking-tight">
                Editor do Calendário Letivo <span className="text-[#81c784]">2026</span>
              </h1>
              <p className="text-xs text-gray-500 font-semibold">
                Clique em qualquer dia para adicionar ou editar um evento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading && <Loader2 className="w-5 h-5 animate-spin text-[#1565c0]" />}
            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <span className="w-3 h-3 rounded border-2 border-amber-500 inline-block"></span>
              = Evento personalizado
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* GRID DOS MESES */}
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {meses.map((mes, mesIndex) => {
              const { numDias, primeiroDia } = getDiasNoMes(mesIndex);
              const dias = Array.from({ length: 42 }, (_, i) => {
                const diaNum = i - primeiroDia + 1;
                return diaNum > 0 && diaNum <= numDias ? diaNum : null;
              });

              return (
                <div key={mes} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div
                    className="text-center py-2 font-black tracking-widest text-sm"
                    style={{ backgroundColor: '#1565c0', color: 'white' }}
                  >
                    {mes}
                  </div>
                  <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
                    {diasSemana.map((d, i) => (
                      <div key={i} className="text-center py-1 text-xs font-black text-gray-600">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 p-1 gap-0.5 bg-white">
                    {dias.map((dia, index) => {
                      if (!dia) return <div key={index} className="p-2" />;
                      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                      const diaDados = getMergedDia(dataStr);
                      const isCustom = !!eventosCustom[dataStr];
                      const isSelected = selectedDay === dataStr;
                      const isWeekend = index % 7 === 0 || index % 7 === 6;
                      const avalsDoDia = avaliacoesPublicadas.filter((a: any) => a.data_avaliacao === dataStr);
                      const temAvaliacao = avalsDoDia.length > 0;

                      let bgClass = 'bg-transparent text-gray-700';
                      let abrev = '';
                      let customStyle: React.CSSProperties = {};

                      if (diaDados) {
                        const { categoriaBase, corCustom } = parseCategoria(diaDados.categoria);
                        bgClass = getCorCategoria(categoriaBase);
                        abrev = diaDados.abreviacao || '';

                        if (corCustom) {
                          const txtColor = getContrastColor(corCustom);
                          bgClass = 'border-[#cbd5e1]';
                          customStyle = {
                            backgroundColor: corCustom,
                            color: txtColor
                          };
                        }
                      } else if (isWeekend) {
                        bgClass = 'bg-gray-50 text-gray-400';
                      }

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDayClick(dataStr)}
                          className={`
                            relative flex flex-col items-center justify-center w-full aspect-square text-[11px] font-bold
                            border rounded-sm cursor-pointer transition-all hover:scale-110 hover:z-10
                            ${bgClass}
                            ${isSelected ? 'ring-2 ring-offset-1 ring-amber-500 scale-110 z-10' : ''}
                            ${isCustom ? 'border-2 border-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : ''}
                          `}
                          style={customStyle}
                          title={temAvaliacao ? avalsDoDia.map(a => `${a.nome} - ${a.disciplinaNome} (${a.turmaNome})`).join('\n') : undefined}
                        >
                          <span>{dia}</span>
                          {abrev && (
                            <span className="text-[7px] font-black leading-none mt-0.5 tracking-tighter">
                              {abrev}
                            </span>
                          )}
                          {isCustom && (
                            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                          )}
                          {temAvaliacao && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {avalsDoDia.slice(0, 3).map((_, i) => (
                                <span key={i} className="w-1 h-1 bg-blue-500 rounded-full" />
                              ))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LEGENDA */}
          <div className="mt-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-black text-gray-800 mb-3 uppercase tracking-widest text-xs">Legenda de Categorias</h3>
            <div className="flex flex-wrap gap-3">
              {categorias.filter(c => c.value !== 'normal').map(cat => (
                <div key={cat.value} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-bold text-gray-600">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL LATERAL DE EDIÇÃO */}
      <div
        className={`w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl transition-all duration-300 ${
          form ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ minWidth: form ? '320px' : '0', overflow: 'hidden' }}
      >
        {form && (
          <>
            {/* Header do painel */}
            <div className="p-5 border-b border-gray-100 bg-[#1565c0] flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-blue-200 uppercase tracking-widest">Editando</p>
                <h2 className="text-xl font-black text-white">{formatDate(form.data)}</h2>
                {form.isCustom && (
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                    ✦ Evento personalizado
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSelectedDay(null); setForm(null); }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Formulário */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Avaliações do Dia Info Box */}
              {avaliacoesPublicadas.filter(a => a.data_avaliacao === form.data).length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100/50">
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    📝 Avaliações Agendadas ({avaliacoesPublicadas.filter(a => a.data_avaliacao === form.data).length})
                  </p>
                  <div className="space-y-1">
                    {avaliacoesPublicadas.filter(a => a.data_avaliacao === form.data).map(av => (
                      <p key={av.id} className="text-[11px] text-blue-950 font-bold leading-normal">
                        · {av.nome} - {av.disciplinaNome} ({av.turmaNome})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoria */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">
                  Categoria
                </label>
                <div className="space-y-2">
                  {categorias.map(cat => (
                    <label
                      key={cat.value}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                        form.categoria === cat.value
                          ? 'border-[#1565c0] bg-blue-50'
                          : 'border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="categoria"
                        value={cat.value}
                        checked={form.categoria === cat.value}
                        onChange={() => setForm(f => f ? { ...f, categoria: cat.value } : f)}
                        className="hidden"
                      />
                      <div className="w-4 h-4 rounded border flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-bold text-gray-700">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cor da Célula */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-widest">
                    Cor da Célula
                  </label>
                  {form.cor && (
                    <button
                      type="button"
                      onClick={() => setForm(f => f ? { ...f, cor: '' } : f)}
                      className="text-[10px] font-black text-[#1565c0] hover:underline uppercase tracking-wider"
                    >
                      Restaurar Padrão
                    </button>
                  )}
                </div>

                {/* Grade de cores pré-definidas */}
                <div className="grid grid-cols-7 gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 mb-3">
                  {coresPaleta.map((c) => {
                    const isSelected = form.cor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setForm(f => f ? { ...f, cor: c.hex } : f)}
                        className={`w-6 h-6 rounded-full border transition-all hover:scale-110 flex items-center justify-center relative ${
                          isSelected ? 'ring-2 ring-offset-1 ring-[#1565c0] scale-105 border-transparent' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.nome}
                      >
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: getContrastColor(c.hex) }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Seletor de cor personalizada */}
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-inner flex-shrink-0">
                    <input
                      type="color"
                      value={form.cor || categorias.find(cat => cat.value === form.categoria)?.color || '#9e9e9e'}
                      onChange={(e) => setForm(f => f ? { ...f, cor: e.target.value } : f)}
                      className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">Cor Personalizada</p>
                    <p className="text-[10px] text-gray-400 font-semibold truncate font-mono">
                      {form.cor ? form.cor.toUpperCase() : 'Usando cor da categoria'}
                    </p>
                  </div>
                </div>
              </div>


              {/* Abreviação */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">
                  Abreviação <span className="text-gray-400 normal-case font-normal">(ex: AB, FN, NL)</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={form.abreviacao}
                  onChange={e => setForm(f => f ? { ...f, abreviacao: e.target.value.toUpperCase() } : f)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:border-[#1565c0] transition-colors"
                  placeholder="Ex: AB"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2">
                  Descrição
                </label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => f ? { ...f, descricao: e.target.value } : f)}
                  rows={3}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#1565c0] transition-colors resize-none"
                  placeholder="Descrição do evento..."
                />
              </div>

              {/* Dado base (referência) */}
              {calendarData[form.data] && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                    Dado original (SED)
                  </p>
                  <p className="text-xs text-gray-600 font-semibold">
                    {calendarData[form.data].descricao || '(sem descrição)'} 
                    <span className="ml-1 text-gray-400">· {calendarData[form.data].categoria}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="p-5 border-t border-gray-100 space-y-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1565c0] hover:bg-[#0d47a1] text-white rounded-xl font-black text-sm transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Evento
              </button>
              {form.isCustom && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-sm transition-all border border-red-200 disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Personalização
                </button>
              )}
            </div>
          </>
        )}

        {/* Estado vazio do painel */}
        {!form && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-0">
            <CalendarDays className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm font-bold text-gray-400">Selecione um dia para editar</p>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-5 h-5" />
            : <AlertCircle className="w-5 h-5" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
