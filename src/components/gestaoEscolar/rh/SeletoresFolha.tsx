import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import type { SubstitutoRapido } from '../../../types/rh';
import { formatarCpf, formatarTelefone, validarCpf } from '../../../utils/cadastroServidor';

const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';
const classeRotulo = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const NAO_HOUVE = 'Não houve';

export interface TitularSel { id: string; nome: string }
export interface SubstitutoSel {
  tipo: 'professor' | 'rapido' | 'nenhum' | 'livre'; // 'livre' só para linhas antigas digitadas à mão
  id: string | null;
  nome: string;
}

function Chip({ texto, detalhe, onLimpar }: { texto: string; detalhe?: string; onLimpar: () => void }) {
  return (
    <div className="mt-1 flex items-center justify-between px-3 py-2 bg-ms-blue/10 border border-ms-blueText/20 rounded-lg">
      <span className="text-sm font-bold text-ms-main truncate">
        {texto}{detalhe && <span className="ml-2 text-[10px] font-normal text-gray-400">{detalhe}</span>}
      </span>
      <button type="button" onClick={onLimpar} className="text-gray-400 hover:text-gray-200 shrink-0" aria-label="Trocar"><X className="w-4 h-4" /></button>
    </div>
  );
}

// Titular: só da lista de servidores (precisa do vínculo para achar as turmas e a grade).
export function SeletorTitular({ valor, opcoes, onChange }: { valor: TitularSel | null; opcoes: { id: string; nome: string }[]; onChange: (t: TitularSel | null) => void }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (t ? opcoes.filter((o) => o.nome.toLowerCase().includes(t)) : opcoes).slice(0, 8);
  }, [busca, opcoes]);

  return (
    <div className="block relative">
      <span className={classeRotulo}>Professor titular (lista de servidores)</span>
      {valor ? (
        <Chip texto={valor.nome} onLimpar={() => { onChange(null); setBusca(''); }} />
      ) : (
        <>
          <div className="relative mt-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
              placeholder="Digite para buscar o servidor..." className={`${classeInput} pl-9`} autoComplete="off" />
          </div>
          {aberto && resultados.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {resultados.map((o) => (
                <button key={o.id} type="button" onMouseDown={(e) => { e.preventDefault(); onChange({ id: o.id, nome: o.nome }); setBusca(''); setAberto(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-ms-main hover:bg-ms-blue/20">{o.nome}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface DadosRapido { nome: string; telefone: string; cpf: string }

// Substituto: escolhe do banco de professores da escola ou do cadastro rápido, ou cadastra
// uma pessoa nova na hora (fica salva e passa a aparecer na lista).
export function SeletorSubstituto({ valor, professores, rapidos, onChange, onCadastrar }: {
  valor: SubstitutoSel | null;
  professores: { id: string; nome: string }[];
  rapidos: SubstitutoRapido[];
  onChange: (s: SubstitutoSel | null) => void;
  onCadastrar: (dados: { nome: string; telefone: string; cpf: string }) => Promise<SubstitutoRapido>;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState<DadosRapido | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const itens = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const todos = [
      ...professores.map((p) => ({ tipo: 'professor' as const, id: p.id, nome: p.nome, detalhe: 'professor da escola' })),
      ...rapidos.filter((r) => r.ativo).map((r) => ({ tipo: 'rapido' as const, id: r.id, nome: r.nome, detalhe: 'cadastro rápido' })),
    ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return (t ? todos.filter((i) => i.nome.toLowerCase().includes(t)) : todos).slice(0, 10);
  }, [busca, professores, rapidos]);

  const escolher = (s: SubstitutoSel) => { onChange(s); setBusca(''); setAberto(false); setNovo(null); };

  async function salvarNovo() {
    if (!novo) return;
    if (novo.nome.trim().length < 3) { setErro('Informe o nome completo.'); return; }
    if (novo.cpf && !validarCpf(novo.cpf)) { setErro('CPF inválido. Confira os números ou deixe em branco.'); return; }
    setErro(null);
    setSalvando(true);
    try {
      const criado = await onCadastrar(novo);
      escolher({ tipo: 'rapido', id: criado.id, nome: criado.nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="block relative">
      <span className={classeRotulo}>Professor substituto</span>
      {valor ? (
        <Chip texto={valor.nome} detalhe={valor.tipo === 'professor' ? 'professor da escola' : valor.tipo === 'rapido' ? 'cadastro rápido' : undefined} onLimpar={() => onChange(null)} />
      ) : novo ? (
        <div className="mt-1 p-3 bg-ms-dark border border-gray-800 rounded-xl space-y-2">
          <p className="text-[11px] font-bold text-ms-main flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Cadastro rápido de substituto</p>
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome completo *" className={classeInput} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: formatarTelefone(e.target.value) })} placeholder="Telefone" inputMode="tel" className={classeInput} />
            <input value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: formatarCpf(e.target.value) })} placeholder="CPF (opcional)" inputMode="numeric" className={classeInput} />
          </div>
          {erro && <p className="text-[11px] text-red-400">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={salvarNovo} disabled={salvando} className="flex items-center gap-1 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold disabled:opacity-50">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Cadastrar e usar
            </button>
            <button type="button" onClick={() => { setNovo(null); setErro(null); }} className="px-3 py-1.5 bg-ms-card border border-gray-800 text-gray-300 rounded-lg text-xs">Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mt-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
              placeholder="Buscar professor ou cadastro rápido..." className={`${classeInput} pl-9`} autoComplete="off" />
          </div>
          {aberto && (
            <div className="absolute z-20 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {itens.map((i) => (
                <button key={`${i.tipo}-${i.id}`} type="button" onMouseDown={(e) => { e.preventDefault(); escolher({ tipo: i.tipo, id: i.id, nome: i.nome }); }}
                  className="w-full text-left px-3 py-2 text-sm text-ms-main hover:bg-ms-blue/20 flex items-center justify-between gap-2">
                  <span className="truncate">{i.nome}</span>
                  <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${i.tipo === 'rapido' ? 'bg-amber-500/15 text-amber-400' : 'bg-ms-blue/15 text-ms-blueText'}`}>{i.tipo === 'rapido' ? 'rápido' : 'escola'}</span>
                </button>
              ))}
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setNovo({ nome: busca.trim(), telefone: '', cpf: '' }); setAberto(false); }}
                className="w-full text-left px-3 py-2 text-sm font-bold text-ms-blueText hover:bg-ms-blue/20 border-t border-gray-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Cadastrar novo substituto{busca.trim() ? `: “${busca.trim()}”` : ''}
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); escolher({ tipo: 'nenhum', id: null, nome: NAO_HOUVE }); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-ms-blue/20 border-t border-gray-800">Não houve substituto</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

