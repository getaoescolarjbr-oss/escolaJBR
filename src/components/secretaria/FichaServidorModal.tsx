import { useEffect, useState } from 'react';
import { Loader2, X, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { TipoDocumentoPessoa } from '../../types/secretaria';
import { DocumentosServidor } from './DocumentosServidor';
import { CATEGORIAS_SERVIDOR } from '../../utils/categoriasServidor';

interface Props {
  servidor: { id: string; nome: string; cargo?: string | null; email?: string | null; telefone?: string | null };
  onClose: () => void;
}

// Ficha do servidor: hoje concentra os documentos (certificados, documentos pessoais,
// atestados médicos, termos assinados e outros) — cada um com descrição e escâner.
export function FichaServidorModal({ servidor, onClose }: Props) {
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<TipoDocumentoPessoa>('CERTIFICADO');

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data, error } = await supabase.from('professores').select('pessoa_id').eq('id', servidor.id).single();
      if (error) setErro(error.message);
      else if (!data?.pessoa_id) setErro('Este servidor ainda não tem cadastro de pessoa vinculado (Pessoas).');
      else setPessoaId(data.pessoa_id);
      setCarregando(false);
    }, 0);
    return () => clearTimeout(t);
  }, [servidor.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-ms-dark border border-gray-800 w-full sm:max-w-3xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-ms-blueText flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> Ficha do servidor</p>
            <h3 className="text-lg font-bold text-ms-main truncate">{servidor.nome}</h3>
            <p className="text-xs text-gray-400 truncate">{[servidor.cargo, servidor.email, servidor.telefone].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-200 rounded-lg" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-5 pt-4 shrink-0">
          {CATEGORIAS_SERVIDOR.map((c) => (
            <button key={c.tipo} onClick={() => setAba(c.tipo)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${aba === c.tipo ? 'bg-ms-blue text-white' : 'bg-ms-card text-gray-400 border border-gray-800 hover:text-gray-200'}`}>
              {c.rotulo}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {carregando ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
          ) : erro ? (
            <p className="text-sm text-red-400">{erro}</p>
          ) : (
            pessoaId && <DocumentosServidor pessoaId={pessoaId} tipo={aba} nomeServidor={servidor.nome} />
          )}
        </div>
      </div>
    </div>
  );
}
