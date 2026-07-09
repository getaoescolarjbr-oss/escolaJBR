import { useEffect, useState } from 'react';
import { BookOpen, Star, LogOut, Loader2, Home, Users, Rss, ShoppingBag, Trophy, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../services/authService';
import { obterMeuAlunoId, obterMeuSaldoPontos } from '../../services/bibliotecaService';
import { AlunoInicioTab } from './AlunoInicioTab';
import { AlunoAcervoTab } from './AlunoAcervoTab';
import { AlunoDuplasTab } from './AlunoDuplasTab';
import { AlunoFeedTab } from './AlunoFeedTab';
import { AlunoLojaTab } from './AlunoLojaTab';
import { AlunoConquistasTab } from './AlunoConquistasTab';

interface AlunoHomeProps {
  onLogout: () => void;
}

type Aba = 'inicio' | 'acervo' | 'duplas' | 'feed' | 'loja' | 'conquistas';

// A "app" do aluno (BiblioClube JBR) — Fase 4 trouxe a primeira versão (empréstimos,
// busca, favoritos); Fase 5 somou metas/conquistas; Fase 6 a loja; Fase 7 duplas de
// leitura e o feed de resenhas. Virou abas porque cresceu demais pra uma tela só.
export function AlunoHome({ onLogout }: AlunoHomeProps) {
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>('inicio');

  async function handleLogout() {
    await signOut();
    onLogout();
  }

  async function carregar() {
    setLoading(true);
    try {
      const id = await obterMeuAlunoId();
      setAlunoId(id);
      if (!id) return;
      const [alunoRow, saldoAtual] = await Promise.all([
        supabase.from('alunos').select('nome').eq('id', id).single(),
        obterMeuSaldoPontos(id),
      ]);
      setNome(alunoRow.data?.nome ?? '');
      setSaldo(saldoAtual);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function atualizarSaldo() {
    if (alunoId) setSaldo(await obterMeuSaldoPontos(alunoId));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ms-dark">
        <Loader2 className="w-10 h-10 animate-spin text-ms-blue" />
      </div>
    );
  }

  if (!alunoId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ms-dark p-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-ms-main">Não encontramos seu vínculo de aluno.</p>
          <p className="text-sm text-gray-400 mt-2">Fale com a Secretaria para regularizar seu cadastro.</p>
          <button onClick={handleLogout} className="mt-6 px-6 py-2 bg-ms-blue text-white rounded-lg font-bold">Sair</button>
        </div>
      </div>
    );
  }

  const abas: { id: Aba; label: string; icon: LucideIcon; cor: string; corAtiva: string }[] = [
    { id: 'inicio', label: 'Início', icon: Home, cor: 'text-sky-400', corAtiva: 'bg-sky-500 shadow-sky-900/40' },
    { id: 'acervo', label: 'Acervo', icon: BookOpen, cor: 'text-indigo-400', corAtiva: 'bg-indigo-500 shadow-indigo-900/40' },
    { id: 'duplas', label: 'Duplas', icon: Users, cor: 'text-pink-400', corAtiva: 'bg-pink-500 shadow-pink-900/40' },
    { id: 'feed', label: 'Feed', icon: Rss, cor: 'text-orange-400', corAtiva: 'bg-orange-500 shadow-orange-900/40' },
    { id: 'loja', label: 'Loja', icon: ShoppingBag, cor: 'text-amber-400', corAtiva: 'bg-amber-500 shadow-amber-900/40' },
    { id: 'conquistas', label: 'Conquistas', icon: Trophy, cor: 'text-purple-400', corAtiva: 'bg-purple-500 shadow-purple-900/40' },
  ];

  return (
    <div className="min-h-screen bg-ms-dark">
      <div className="bg-gradient-to-br from-[#003366] via-[#004a99] to-[#1a1a4d] px-6 py-8 text-center relative overflow-hidden">
        <Sparkles className="absolute top-6 left-8 w-5 h-5 text-amber-300/40" />
        <Sparkles className="absolute bottom-6 right-10 w-4 h-4 text-sky-300/40" />
        <button onClick={handleLogout} className="absolute top-4 right-4 flex items-center gap-1 text-blue-100/70 hover:text-white text-xs font-bold">
          <LogOut className="w-4 h-4" /> Sair
        </button>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-2 backdrop-blur-sm">
          <BookOpen className="w-8 h-8 text-amber-300" />
        </div>
        <h1 className="text-xl font-bold text-white">Olá, {nome.split(' ')[0] || 'aluno'}!</h1>
        <p className="text-blue-100/70 text-sm mt-1 flex items-center justify-center gap-1">
          <Star className="w-4 h-4 text-amber-300 fill-amber-300" /> {saldo} pontos no BiblioClube
        </p>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                aba === a.id ? `${a.corAtiva} text-white shadow-lg` : 'bg-ms-card text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <a.icon className={`w-4 h-4 ${aba === a.id ? 'text-white' : a.cor}`} />
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'inicio' && <AlunoInicioTab alunoId={alunoId} onPontosMudaram={atualizarSaldo} />}
        {aba === 'acervo' && <AlunoAcervoTab alunoId={alunoId} />}
        {aba === 'duplas' && <AlunoDuplasTab alunoId={alunoId} />}
        {aba === 'feed' && <AlunoFeedTab alunoId={alunoId} />}
        {aba === 'loja' && <AlunoLojaTab alunoId={alunoId} onPontosMudaram={atualizarSaldo} />}
        {aba === 'conquistas' && <AlunoConquistasTab alunoId={alunoId} />}
      </div>
    </div>
  );
}
