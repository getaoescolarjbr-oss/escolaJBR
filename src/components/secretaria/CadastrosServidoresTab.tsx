import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Eye, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Papel } from '../../types/rbac';
import type { CadastroServidorPendente, DocumentoDoCadastro } from '../../services/cadastroServidorService';
import { listarDocumentosDoCadastro, urlDocumentoDoCadastro } from '../../services/cadastroServidorService';
import {
  listarCadastrosServidoresPendentes,
  aprovarCadastroServidor,
  rejeitarCadastroServidor,
} from '../../services/cadastroServidorService';
import { PAPEIS_SERVIDOR, formatarCpf, formatarTelefone, papelSugeridoPorCargo } from '../../utils/cadastroServidor';

// Aprovação dos servidores que se cadastraram sozinhos no Portal do Servidor. Até aqui a
// conta não tem acesso a nada; ao aprovar, o banco cria professor/pessoa/usuário/papel.
export function CadastrosServidoresTab() {
  const { hasRole } = useAuth();
  const [cadastros, setCadastros] = useState<CadastroServidorPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [papelPorCadastro, setPapelPorCadastro] = useState<Record<string, Papel | ''>>({});
  const [docsPorCadastro, setDocsPorCadastro] = useState<Record<string, DocumentoDoCadastro[]>>({});

  // Só a Gestão concede papéis que dão poder sobre os outros (o banco também confere).
  const papeisDisponiveis = PAPEIS_SERVIDOR.filter((p) => hasRole('GESTAO') || (p !== 'GESTAO' && p !== 'SECRETARIA'));

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarCadastrosServidoresPendentes();
      setCadastros(lista);
      const docs = await listarDocumentosDoCadastro(lista.map((c) => c.id));
      const agrupado: Record<string, DocumentoDoCadastro[]> = {};
      docs.forEach((d) => { (agrupado[d.cadastro_id] ??= []).push(d); });
      setDocsPorCadastro(agrupado);
      setPapelPorCadastro((atual) => {
        const proximo = { ...atual };
        lista.forEach((c) => {
          const sugerido = papelSugeridoPorCargo(c.cargo);
          if (proximo[c.id] === undefined) proximo[c.id] = sugerido && papeisDisponiveis.includes(sugerido) ? sugerido : '';
        });
        return proximo;
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar cadastros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAprovar(c: CadastroServidorPendente) {
    const papel = papelPorCadastro[c.id];
    if (!papel) {
      setErro('Escolha o papel de acesso antes de aprovar.');
      return;
    }
    setProcessandoId(c.id);
    setErro(null);
    try {
      await aprovarCadastroServidor(c.id, papel);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aprovar cadastro.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleRejeitar(c: CadastroServidorPendente) {
    const motivo = window.prompt('Motivo da rejeição (opcional):');
    if (motivo === null) return;
    setProcessandoId(c.id);
    setErro(null);
    try {
      await rejeitarCadastroServidor(c.id, motivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao rejeitar cadastro.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs font-black uppercase tracking-wider text-ms-main">Cadastros de servidores pendentes ({cadastros.length})</p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
      ) : cadastros.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum cadastro aguardando aprovação.</p>
      ) : (
        cadastros.map((c) => (
          <div key={c.id} className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <div>
              <p className="text-sm font-bold text-ms-main">{c.nome}</p>
              <p className="text-[11px] text-gray-500">{c.email} · {c.cargo} · {c.status_servidor}</p>
              <p className="text-[11px] text-gray-500">
                CPF {formatarCpf(c.cpf)} · Nascimento {new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')} · {formatarTelefone(c.telefone)}
              </p>
              {c.area_conhecimento && <p className="text-[11px] text-gray-500">Área: {c.area_conhecimento}</p>}
              <p className="text-[11px] text-gray-500">
                RG {c.rg || '—'}{c.titulo_eleitor ? ` · Título ${c.titulo_eleitor}${c.zona_eleitoral ? `, zona ${c.zona_eleitoral}` : ''}${c.secao_eleitoral ? `, seção ${c.secao_eleitoral}` : ''}` : ''}
              </p>
              <p className="text-[11px] text-gray-500">Endereço: {c.endereco || '—'}{c.telefone_fixo ? ` · Fixo ${formatarTelefone(c.telefone_fixo)}` : ''}</p>
              {c.formacao && <p className="text-[11px] text-gray-500">Formação: {c.formacao}</p>}
              <p className="text-[11px] text-gray-500">Enviado em {new Date(c.enviado_em ?? c.criado_em).toLocaleString('pt-BR')}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Documentos enviados ({(docsPorCadastro[c.id] ?? []).length})</p>
              {(docsPorCadastro[c.id] ?? []).length === 0 ? (
                <p className="text-[11px] text-amber-400">Nenhum documento anexado.</p>
              ) : (
                (docsPorCadastro[c.id] ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg">
                    <span className="flex items-center gap-2 min-w-0 text-xs text-ms-main">
                      <FileText className="w-3.5 h-3.5 text-ms-blueText shrink-0" />
                      <span className="truncate"><b>{d.rotulo}</b>{d.descricao ? ` — ${d.descricao}` : ''}</span>
                    </span>
                    <button
                      onClick={async () => { try { window.open(await urlDocumentoDoCadastro(d), '_blank'); } catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao abrir o documento.'); } }}
                      className="p-1.5 text-ms-blueText hover:bg-ms-blue/20 rounded-lg shrink-0" title="Abrir"
                    ><Eye className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>

            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
              Papel de acesso
              <select
                value={papelPorCadastro[c.id] ?? ''}
                onChange={(e) => setPapelPorCadastro((s) => ({ ...s, [c.id]: e.target.value as Papel | '' }))}
                className="mt-1 w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              >
                <option value="">Selecione...</option>
                {papeisDisponiveis.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => handleAprovar(c)}
                disabled={processandoId === c.id}
                className="flex items-center gap-1 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {processandoId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprovar
              </button>
              <button
                onClick={() => handleRejeitar(c)}
                disabled={processandoId === c.id}
                className="flex items-center gap-1 px-4 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Rejeitar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
