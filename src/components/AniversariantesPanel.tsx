import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Professor } from '../types';
import { Cake, PartyPopper, Star } from 'lucide-react';
import { SectionIcon } from './ui/SectionIcon';

interface AniversarianteInfo {
  id: string;
  nome: string;
  cargo: string;
  data_nascimento: string;
  dia: number;
  mes: number;
  ehHoje: boolean;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function AniversariantesPanel() {
  const [aniversariantes, setAniversariantes] = useState<AniversarianteInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const diaAtual = hoje.getDate();

  useEffect(() => {
    fetchAniversariantes();
  }, []);

  async function fetchAniversariantes() {
    setLoading(true);
    const { data } = await supabase
      .from('professores')
      .select('id, nome, cargo, data_nascimento, publicar_aniversario')
      .eq('publicar_aniversario', true)
      .not('data_nascimento', 'is', null);

    if (data) {
      const doMes: AniversarianteInfo[] = data
        .filter((p: any) => {
          if (!p.data_nascimento) return false;
          // Parsear a data evitando problemas de timezone
          const parts = p.data_nascimento.split('-');
          const mes = parseInt(parts[1], 10);
          return mes === mesAtual;
        })
        .map((p: any) => {
          const parts = p.data_nascimento.split('-');
          const dia = parseInt(parts[2], 10);
          const mes = parseInt(parts[1], 10);
          return {
            id: p.id,
            nome: p.nome,
            cargo: p.cargo,
            data_nascimento: p.data_nascimento,
            dia,
            mes,
            ehHoje: dia === diaAtual && mes === mesAtual,
          };
        })
        .sort((a: AniversarianteInfo, b: AniversarianteInfo) => a.dia - b.dia);

      setAniversariantes(doMes);
    }
    setLoading(false);
  }

  const aniversariosHoje = aniversariantes.filter(a => a.ehHoje);
  const proximos = aniversariantes.filter(a => !a.ehHoje);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SectionIcon icon={Cake} cor="pink" tamanho="md" />
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Aniversariantes de {MESES[mesAtual - 1]}
          </h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Servidores que fazem aniversário este mês
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full" />
        </div>
      ) : aniversariantes.length === 0 ? (
        <div className="bg-ms-card border border-ms-border rounded-2xl p-12 text-center">
          <Cake className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 font-bold">Nenhum aniversariante neste mês.</p>
          <p className="text-gray-600 text-xs mt-1">Cadastre as datas de nascimento dos servidores para exibir aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Aniversário HOJE */}
          {aniversariosHoje.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-black text-pink-400 uppercase tracking-widest">Hoje!</h3>
              </div>
              {aniversariosHoje.map(a => (
                <div
                  key={a.id}
                  className="relative overflow-hidden rounded-2xl border border-pink-500/40 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent p-5 shadow-lg shadow-pink-900/20"
                >
                  {/* Decoração */}
                  <div className="absolute -right-4 -top-4 text-6xl opacity-10 select-none">🎂</div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                      <span className="text-xl font-black text-pink-400">{a.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-white truncate">{a.nome}</p>
                      <p className="text-xs font-bold text-pink-300">{a.cargo}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-pink-500/20 border border-pink-500/40 rounded-xl">
                        <Star className="w-3 h-3 text-pink-400 fill-pink-400" />
                        <span className="text-lg font-black text-pink-300">
                          {String(a.dia).padStart(2, '0')}/{String(a.mes).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-[9px] text-pink-400 font-black uppercase tracking-wider mt-1">Parabéns! 🎉</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Demais do mês */}
          {proximos.length > 0 && (
            <div className="space-y-3">
              {aniversariosHoje.length > 0 && (
                <div className="flex items-center gap-2">
                  <Cake className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Outros do mês</h3>
                </div>
              )}
              <div className="bg-ms-card border border-ms-border rounded-2xl overflow-hidden">
                {proximos.map((a, idx) => {
                  const jaPAssou = a.dia < diaAtual;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-4 px-5 py-3.5 border-b border-ms-border/40 last:border-b-0 transition-colors hover:bg-ms-dark/20 ${jaPAssou ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${jaPAssou ? 'bg-gray-700/30 text-gray-500' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                        {a.nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${jaPAssou ? 'text-gray-500' : 'text-white'}`}>{a.nome}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{a.cargo}</p>
                      </div>
                      <div className={`shrink-0 text-sm font-black tabular-nums ${jaPAssou ? 'text-gray-500' : 'text-pink-300'}`}>
                        {String(a.dia).padStart(2, '0')}/{String(a.mes).padStart(2, '0')}
                        {jaPAssou && <span className="ml-1 text-[9px] text-gray-600">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
