import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CadastroServidorCampos } from '../CadastroServidorCampos';
import { refazerCadastroServidor } from '../../services/cadastroServidorService';
import { CAMPOS_SERVIDOR_VAZIOS, validarCpf, type CamposServidor } from '../../utils/cadastroServidor';

interface Props {
  onCriado: () => void; // pedido criado: a tela volta a ler o cadastro (e abre a etapa dos documentos)
  onCancelar: () => void;
}

// Servidor cujo cadastro em rascunho foi removido (ex.: ficou parado muito tempo) e que entrou de novo
// com a mesma conta: refaz os dados e segue para os documentos. A conta de acesso continua a mesma.
export function RefazerCadastroServidor({ onCriado, onCancelar }: Props) {
  const [dados, setDados] = useState<CamposServidor>(CAMPOS_SERVIDOR_VAZIOS);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!validarCpf(dados.cpf)) { setErro('CPF inválido. Confira os números digitados.'); return; }
    if (dados.telefone.replace(/\D/g, '').length < 10) { setErro('Informe o telefone com DDD.'); return; }
    setEnviando(true);
    try {
      await refazerCadastroServidor(dados);
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 text-left bg-white rounded-xl p-4">
      <CadastroServidorCampos valores={dados} onChange={setDados} />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 py-3 bg-[#003366] text-white rounded-lg text-sm font-bold disabled:opacity-50">
        {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Criar cadastro e continuar
      </button>
      <button type="button" onClick={onCancelar} className="w-full text-xs text-gray-500 hover:text-gray-700">Voltar</button>
    </form>
  );
}
