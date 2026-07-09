import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import type { Pessoa } from '../../types/pessoas';
import { criarPessoa, atualizarPessoa } from '../../services/pessoasService';

interface PessoaFormModalProps {
  pessoa: Pessoa | null;
  onClose: () => void;
  onSaved: () => void;
}

function apenasDigitos(v: string) {
  return v.replace(/\D/g, '');
}

export function PessoaFormModal({ pessoa, onClose, onSaved }: PessoaFormModalProps) {
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [cpf, setCpf] = useState(pessoa?.cpf ?? '');
  const [dataNascimento, setDataNascimento] = useState(pessoa?.data_nascimento ?? '');
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? '');
  const [email, setEmail] = useState(pessoa?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (!nome.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    const cpfDigitos = apenasDigitos(cpf);
    if (cpfDigitos && cpfDigitos.length !== 11) {
      setError('CPF deve ter 11 dígitos, ou fique em branco.');
      return;
    }

    const dados: Partial<Pessoa> = {
      nome: nome.trim(),
      cpf: cpfDigitos || null,
      data_nascimento: dataNascimento || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
    };

    try {
      setSaving(true);
      if (pessoa) {
        await atualizarPessoa(pessoa.id, dados);
      } else {
        await criarPessoa(dados);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pessoa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-ms-card w-full max-w-lg rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-ms-blue/10 to-transparent">
          <h3 className="text-xl font-black text-ms-main">{pessoa ? 'Editar Pessoa' : 'Nova Pessoa'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
              placeholder="Nome da pessoa"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">CPF (opcional)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={cpf ?? ''}
                onChange={(e) => setCpf(apenasDigitos(e.target.value))}
                className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                placeholder="Somente números"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Data de nascimento</label>
              <input
                type="date"
                value={dataNascimento ?? ''}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Telefone</label>
              <input
                type="text"
                value={telefone ?? ''}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                placeholder="(67) 90000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">E-mail</label>
              <input
                type="email"
                value={email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-500">
            Só os dados de identidade ficam aqui (princípio da minimização). Matrícula,
            prontuário e dados funcionais continuam nas telas de Alunos/Servidores.
          </p>

          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-gray-800/30 border-t border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:bg-gray-800 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {pessoa ? 'Salvar Alterações' : 'Cadastrar Pessoa'}
          </button>
        </div>
      </div>
    </div>
  );
}
