import type { CadastroServidorPendente } from '../services/cadastroServidorService';
import { FUNDAMENTO_VALOR_PADRAO, type DadosTermoConvocado } from './termoConvocado';
import { formatarCpf, formatarTelefone } from './cadastroServidor';

// Campos da convocação guardados no cadastro (convocacao_campos.campo) -> campos do termo.
const CAMPO_DO_TERMO: Record<string, keyof DadosTermoConvocado> = {
  horas_semanais: 'horasSemanais',
  componente: 'componente',
  escola_municipio: 'escolaMunicipio',
  periodo_de: 'periodoDe',
  periodo_ate: 'periodoAte',
  substituido_nome: 'substituidoNome',
  substituido_matricula: 'substituidoMatricula',
  valor_hora: 'valorHora',
  fundamento_valor: 'fundamentoValor',
};

// Só o que foi preenchido: quem chama mantém os padrões (valor da hora, escola, fundamento).
export function convocacaoParaTermo(convocacao: Record<string, string> | null | undefined): Partial<DadosTermoConvocado> {
  const termo: Partial<DadosTermoConvocado> = {};
  Object.entries(convocacao ?? {}).forEach(([campo, valor]) => {
    const destino = CAMPO_DO_TERMO[campo];
    if (destino && valor.trim()) termo[destino] = valor.trim();
  });
  return termo;
}

// Termo montado direto do cadastro em análise (antes de aprovar): dados pessoais do servidor
// + campos da convocação já preenchidos por ele e/ou pela Secretaria.
export function dadosTermoDoCadastro(c: CadastroServidorPendente): DadosTermoConvocado {
  return {
    nome: c.nome,
    rg: c.rg ?? '',
    cpf: formatarCpf(c.cpf),
    dataNascimento: c.data_nascimento,
    tituloEleitor: c.titulo_eleitor ?? '',
    zonaEleitoral: c.zona_eleitoral ?? '',
    secaoEleitoral: c.secao_eleitoral ?? '',
    endereco: c.endereco ?? '',
    telefoneFixo: formatarTelefone(c.telefone_fixo ?? ''),
    celular: formatarTelefone(c.telefone),
    email: c.email,
    formacao: c.formacao ?? '',
    horasSemanais: '',
    componente: '',
    escolaMunicipio: 'E.E. José Barbosa Rodrigues',
    periodoDe: '',
    periodoAte: '',
    substituidoNome: '',
    substituidoMatricula: '',
    valorHora: '43,32777',
    fundamentoValor: FUNDAMENTO_VALOR_PADRAO,
    cidade: 'Campo Grande',
    dataDocumento: new Date().toISOString().slice(0, 10),
    ...convocacaoParaTermo(c.convocacao),
  };
}
