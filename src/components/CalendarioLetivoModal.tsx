import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Info } from 'lucide-react';
import { calendarData } from '../data/calendarData';
import type { DiaCalendario } from '../data/calendarData';
import { supabase } from '../lib/supabase';

interface CalendarioLetivoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const meses = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function CalendarioLetivoModal({ isOpen, onClose }: CalendarioLetivoModalProps) {
  const [tooltip, setTooltip] = useState<{ text: string, x: number, y: number } | null>(null);
  const [eventosCustom, setEventosCustom] = useState<Record<string, DiaCalendario>>({});
  const [avaliacoesPublicadas, setAvaliacoesPublicadas] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      // 1. Buscar eventos customizados
      const { data: eventos } = await supabase
        .from('calendario_eventos')
        .select('*');

      const map: Record<string, DiaCalendario> = {};
      if (eventos) {
        eventos.forEach((e: any) => { map[e.data] = e; });
      }
      setEventosCustom(map);

      // 2. Buscar avaliações publicadas agendadas
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
    }

    loadData().catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  const ano = 2026;

  const getDiasNoMes = (mes: number) => {
    const numDias = new Date(ano, mes + 1, 0).getDate();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    return { numDias, primeiroDia };
  };

  // Eventos customizados sobrepõem os dados base
  const getMergedDia = (dataStr: string): DiaCalendario | undefined => {
    return eventosCustom[dataStr] ?? calendarData[dataStr];
  };

  const parseCategoria = (catString: string) => {
    if (!catString) return { categoriaBase: 'normal', corCustom: null };
    const parts = catString.split(':');
    return {
      categoriaBase: parts[0],
      corCustom: parts[1] || null
    };
  };

  const getContrastColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  };

  const getCorCategoria = (categoria: string) => {
    switch (categoria) {
      case 'ferias': return 'bg-[#ffd700] text-black border-[#e6c200]';
      case 'nao_letivo': return 'bg-[#e53935] text-white border-[#c62828]';
      case 'letivo': return 'bg-[#7cb342] text-black border-[#558b2f]';
      case 'em_apc': return 'bg-[#81c784] text-black border-[#388e3c]';
      case 'inicio_ano': return 'bg-[#1565c0] text-white border-[#0d47a1]';
      case 'exame_final': return 'bg-[#8e24aa] text-white border-[#6a1b9a]';
      default: return 'bg-transparent text-gray-700';
    }
  };

  // Corrigido: usa clientX/clientY do mouse para posicionamento preciso
  const handleMouseEnter = (e: React.MouseEvent, diaDados?: DiaCalendario, avalsDoDia: any[] = []) => {
    const lines: string[] = [];
    if (diaDados?.descricao) {
      lines.push(diaDados.descricao);
    }
    if (avalsDoDia.length > 0) {
      avalsDoDia.forEach(av => {
        lines.push(`📝 ${av.nome} - ${av.disciplinaNome} (${av.turmaNome})`);
      });
    }

    if (lines.length > 0) {
      setTooltip({
        text: lines.join('\n'),
        x: e.clientX,
        y: e.clientY + 16, // 16px abaixo do cursor
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent, diaDados?: DiaCalendario, avalsDoDia: any[] = []) => {
    const lines: string[] = [];
    if (diaDados?.descricao) {
      lines.push(diaDados.descricao);
    }
    if (avalsDoDia.length > 0) {
      avalsDoDia.forEach(av => {
        lines.push(`📝 ${av.nome} - ${av.disciplinaNome} (${av.turmaNome})`);
      });
    }

    if (lines.length > 0) {
      setTooltip({
        text: lines.join('\n'),
        x: e.clientX,
        y: e.clientY + 16,
      });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-7xl w-full rounded-2xl shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-50 border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* CABEÇALHO */}
        <div className="bg-white rounded-t-2xl p-6 md:p-8 flex items-center justify-between border-b border-gray-200">
          <div>
            <h1 className="text-5xl md:text-7xl font-black text-[#1565c0] tracking-tighter flex items-baseline gap-4">
              CALENDÁRIO <span className="text-[#81c784]">2026</span>
            </h1>
            <h2 className="text-2xl font-black text-[#1565c0] tracking-widest ml-1 mt-[-10px]">ESCOLAR</h2>
          </div>
          <div className="hidden md:block">
            <img src="/logo.png.png" alt="Logo Escola" className="h-16 object-contain" />
          </div>
        </div>
        <div className="bg-[#1565c0] py-2 text-center">
          <p style={{ color: 'white' }} className="font-bold tracking-widest text-sm md:text-base">
            RESOLUÇÃO SED N. 4.490, DE 2 DE DEZEMBRO DE 2025.
          </p>
        </div>

        {/* GRID DOS MESES */}
        <div className="p-4 md:p-8 bg-[#f5f7fa]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {meses.map((mes, mesIndex) => {
              const { numDias, primeiroDia } = getDiasNoMes(mesIndex);
              const dias = Array.from({ length: 42 }, (_, i) => {
                const diaNum = i - primeiroDia + 1;
                return diaNum > 0 && diaNum <= numDias ? diaNum : null;
              });

              return (
                <div key={mes} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Nome do mês — inline style para garantir branco mesmo no light-theme */}
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
                  <div className="grid grid-cols-7 p-1 gap-1 bg-white">
                    {dias.map((dia, index) => {
                      if (!dia) return <div key={index} className="p-2" />;

                      const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                      const diaDados = getMergedDia(dataStr);
                      const isWeekend = index % 7 === 0 || index % 7 === 6;
                      const isCustom = !!eventosCustom[dataStr];
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
                        <div
                          key={index}
                          className={`relative flex flex-col items-center justify-center w-full aspect-square text-sm font-bold border rounded-sm cursor-default transition-transform hover:scale-110 hover:z-10 shadow-sm ${bgClass} ${isCustom ? 'ring-1 ring-amber-400' : ''}`}
                          style={customStyle}
                          onMouseEnter={(e) => handleMouseEnter(e, diaDados, avalsDoDia)}
                          onMouseMove={(e) => handleMouseMove(e, diaDados, avalsDoDia)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span>{dia}</span>
                          {abrev && (
                            <span className="text-[8px] font-black leading-none mt-0.5 tracking-tighter">
                              {abrev}
                            </span>
                          )}
                          {isCustom && (
                            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                          )}
                          {temAvaliacao && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {avalsDoDia.slice(0, 3).map((_, i) => (
                                <span key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-sm" />
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LEGENDA INFERIOR */}
          <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="font-black text-gray-800 mb-4 uppercase tracking-widest text-sm">Legenda</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#ffd700] border border-[#e6c200]"></div>
                  <span className="text-xs font-bold text-gray-600">Férias / Recesso Escolar</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#e53935] border border-[#c62828]"></div>
                  <span className="text-xs font-bold text-gray-600">Feriados / Não Letivos</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#7cb342] border border-[#558b2f]"></div>
                  <span className="text-xs font-bold text-gray-600">Dias Letivos</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#81c784] border border-[#388e3c]"></div>
                  <span className="text-xs font-bold text-gray-600">Letivo / Emenda (EM) com APC</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#1565c0] border border-[#0d47a1]"></div>
                  <span className="text-xs font-bold text-gray-600">Início do Ano Escolar / Confirmação da lotação</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#8e24aa] border border-[#6a1b9a]"></div>
                  <span className="text-xs font-bold text-gray-600">Exame Final / Conselho de Classe Final</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-400/20"></div>
                  <span className="text-xs font-bold text-gray-600">Evento personalizado</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-gray-600">Avaliação Escolar Agendada</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 text-xs font-bold text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>Total de Dias Letivos</span> <span>200</span></p>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>Exames Finais</span> <span>5</span></p>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>Conselho de Classe Final</span> <span>1</span></p>
                  <p className="flex justify-between border-b border-gray-200 py-1 text-gray-800"><span>Início do Ano Letivo</span> <span>3/2/2026</span></p>
                  <p className="flex justify-between py-1 text-gray-800"><span>Término do Ano Letivo</span> <span>9/12/2026</span></p>
                </div>
                <div>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>1º Bimestre</span> <span>3/2 a 30/4</span></p>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>2º Bimestre</span> <span>4/5 a 16/7</span></p>
                  <p className="flex justify-between border-b border-gray-200 py-1"><span>3º Bimestre</span> <span>3/8 a 1/10</span></p>
                  <p className="flex justify-between py-1"><span>4º Bimestre</span> <span>2/10 a 9/12</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLTIP via Portal — fora do container com backdrop-blur para evitar offset de scroll */}
      {tooltip && createPortal(
        <div
          className="text-xs font-bold py-2 px-3 rounded-lg shadow-xl pointer-events-none flex items-center gap-2 max-w-[250px] text-center"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%)',
            backgroundColor: '#1a2a4a',
            color: 'white',
            zIndex: 99999,
          }}
        >
          <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#93c5fd' }} />
          <span style={{ color: 'white' }}>{tooltip.text}</span>
          {/* Seta apontando para cima (tooltip aparece abaixo do cursor) */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderBottomColor: '#1a2a4a' }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
