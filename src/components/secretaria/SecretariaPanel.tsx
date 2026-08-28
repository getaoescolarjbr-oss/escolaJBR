import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Pessoa } from '../../types/pessoas';
import { listarPessoas } from '../../services/pessoasService';
import { MatriculaTab } from './MatriculaTab';
import { DocumentosTab } from './DocumentosTab';
import { EmissaoTab } from './EmissaoTab';
import { ProtocolosTab } from './ProtocolosTab';
import { DivergenciasTab } from './DivergenciasTab';
import { SeriesTab } from './SeriesTab';
import { CadastrosBibliotecaTab } from './CadastrosBibliotecaTab';

type Aba = 'matricula' | 'documentos' | 'emissao' | 'protocolos' | 'divergencias' | 'series' | 'biblioteca';

const ABAS_QUE_PRECISAM_DE_PESSOA: Aba[] = ['matricula', 'documentos', 'emissao'];

export function SecretariaPanel() {
  const { hasRole } = useAuth();
  const [aba, setAba] = useState<Aba>('matricula');
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Pessoa[]>([]);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setResultados(busca.trim().length >= 2 ? await listarPessoas(busca) : []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  const abas: { id: Aba; label: string; somenteGestao?: boolean }[] = [
    { id: 'matricula', label: 'Matrícula' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'emissao', label: 'Emissão' },
    { id: 'protocolos', label: 'Protocolo' },
    { id: 'divergencias', label: 'Divergências' },
    { id: 'series', label: 'Séries', somenteGestao: true },
    { id: 'biblioteca', label: 'Cadastros Biblioteca' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {abas
          .filter((a) => !a.somenteGestao || hasRole('GESTAO'))
          .map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? 'page' : undefined}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                aba === a.id ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/30' : 'bg-ms-card text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              {a.label}
            </button>
          ))}
      </div>

      {ABAS_QUE_PRECISAM_DE_PESSOA.includes(aba) && (
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar pessoa por nome, CPF ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
          />
          {resultados.length > 0 && !pessoa && (
            <div className="absolute z-10 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPessoa(p);
                    setResultados([]);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-blue/20 transition-colors"
                >
                  {p.nome} {p.cpf ? `— ${p.cpf}` : ''}
                </button>
              ))}
            </div>
          )}
          {pessoa && (
            <div className="mt-2 flex items-center justify-between px-4 py-2 bg-ms-blue/10 border border-ms-blueText/20 rounded-xl">
              <span className="text-sm font-bold text-ms-main">{pessoa.nome}</span>
              <button onClick={() => { setPessoa(null); setBusca(''); }} className="text-xs text-gray-400 hover:text-gray-200">
                Trocar
              </button>
            </div>
          )}
        </div>
      )}

      {aba === 'matricula' && (pessoa ? <MatriculaTab pessoa={pessoa} /> : <p className="text-sm text-gray-500">Selecione uma pessoa para ver/editar a matrícula.</p>)}
      {aba === 'documentos' && (pessoa ? <DocumentosTab pessoa={pessoa} /> : <p className="text-sm text-gray-500">Selecione uma pessoa para gerenciar documentos.</p>)}
      {aba === 'emissao' && (pessoa ? <EmissaoTab pessoa={pessoa} /> : <p className="text-sm text-gray-500">Selecione uma pessoa para emitir documentos.</p>)}
      {aba === 'protocolos' && <ProtocolosTab />}
      {aba === 'divergencias' && <DivergenciasTab />}
      {aba === 'series' && <SeriesTab />}
      {aba === 'biblioteca' && <CadastrosBibliotecaTab />}
    </div>
  );
}
