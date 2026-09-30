import { supabase } from '../lib/supabase';

export interface ServidorLista {
  id: string;
  nome: string;
  cargo: string | null;
  pessoa_id: string | null;
}

export interface DadosServidorTermo {
  nome: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  rg: string;
  tituloEleitor: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  endereco: string;
  telefoneFixo: string;
  formacao: string;
  matricula: string;
  disciplinas: string[];
}

interface Complementares {
  rg: string | null;
  titulo_eleitor: string | null;
  zona_eleitoral: string | null;
  secao_eleitoral: string | null;
  endereco: string | null;
  telefone_fixo: string | null;
  formacao: string | null;
  matricula_servidor: string | null;
}

export async function listarServidores(): Promise<ServidorLista[]> {
  const { data, error } = await supabase.from('professores').select('id, nome, cargo, pessoa_id').order('nome');
  if (error) throw error;
  return (data ?? []) as ServidorLista[];
}

// Junta o que já existe: professores + pessoas (CPF, nascimento, telefone) + dados
// complementares + disciplinas das alocações (sugestão para o campo "componente").
export async function obterDadosServidor(servidor: ServidorLista): Promise<DadosServidorTermo> {
  const [prof, pessoa, compl, aloc] = await Promise.all([
    supabase.from('professores').select('nome, email, telefone, data_nascimento').eq('id', servidor.id).single(),
    servidor.pessoa_id
      ? supabase.from('pessoas').select('cpf, data_nascimento, telefone, email').eq('id', servidor.pessoa_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    servidor.pessoa_id
      ? supabase.from('servidor_dados_complementares').select('*').eq('pessoa_id', servidor.pessoa_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('alocacoes_v2').select('disciplinas(nome)').eq('professor_id', servidor.id),
  ]);
  if (prof.error) throw prof.error;
  if (pessoa.error) throw pessoa.error;
  if (compl.error) throw compl.error;
  if (aloc.error) throw aloc.error;

  const p = prof.data;
  const pe = pessoa.data as { cpf: string | null; data_nascimento: string | null; telefone: string | null; email: string | null } | null;
  const c = compl.data as Complementares | null;
  const disciplinas = Array.from(
    new Set(((aloc.data ?? []) as unknown as { disciplinas: { nome: string } | null }[]).map((a) => a.disciplinas?.nome).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return {
    nome: p.nome,
    email: pe?.email || p.email || '',
    cpf: pe?.cpf ?? '',
    dataNascimento: pe?.data_nascimento || p.data_nascimento || '',
    telefone: pe?.telefone || p.telefone || '',
    rg: c?.rg ?? '',
    tituloEleitor: c?.titulo_eleitor ?? '',
    zonaEleitoral: c?.zona_eleitoral ?? '',
    secaoEleitoral: c?.secao_eleitoral ?? '',
    endereco: c?.endereco ?? '',
    telefoneFixo: c?.telefone_fixo ?? '',
    formacao: c?.formacao ?? '',
    matricula: c?.matricula_servidor ?? '',
    disciplinas,
  };
}

export async function obterMatriculaServidor(pessoaId: string): Promise<string> {
  const { data, error } = await supabase.from('servidor_dados_complementares').select('matricula_servidor').eq('pessoa_id', pessoaId).maybeSingle();
  if (error) throw error;
  return data?.matricula_servidor ?? '';
}

const vazioParaNulo = (v: string) => (v.trim() ? v.trim() : null);

// Grava no cadastro do servidor o que a Secretaria preencheu, para não digitar de novo.
// CPF/nascimento/telefone vão para `pessoas` (só campos preenchidos, nunca apaga); o resto
// vai para servidor_dados_complementares.
export async function salvarDadosServidor(pessoaId: string, d: Omit<DadosServidorTermo, 'nome' | 'email' | 'disciplinas'>): Promise<void> {
  const pessoa: Record<string, string> = {};
  if (d.cpf.trim()) pessoa.cpf = d.cpf.replace(/\D/g, '');
  if (d.dataNascimento) pessoa.data_nascimento = d.dataNascimento;
  if (d.telefone.trim()) pessoa.telefone = d.telefone.trim();
  if (Object.keys(pessoa).length) {
    const { error } = await supabase.from('pessoas').update({ ...pessoa, atualizado_em: new Date().toISOString() }).eq('id', pessoaId);
    if (error) throw error;
  }

  const { error } = await supabase.from('servidor_dados_complementares').upsert(
    {
      pessoa_id: pessoaId,
      rg: vazioParaNulo(d.rg),
      titulo_eleitor: vazioParaNulo(d.tituloEleitor),
      zona_eleitoral: vazioParaNulo(d.zonaEleitoral),
      secao_eleitoral: vazioParaNulo(d.secaoEleitoral),
      endereco: vazioParaNulo(d.endereco),
      telefone_fixo: vazioParaNulo(d.telefoneFixo),
      formacao: vazioParaNulo(d.formacao),
      matricula_servidor: vazioParaNulo(d.matricula),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'pessoa_id' }
  );
  if (error) throw error;
}

// Só a matrícula de quem é substituído (professor efetivo): não mexe nos demais campos.
export async function salvarMatriculaServidor(pessoaId: string, matricula: string): Promise<void> {
  const { error } = await supabase
    .from('servidor_dados_complementares')
    .upsert({ pessoa_id: pessoaId, matricula_servidor: vazioParaNulo(matricula), atualizado_em: new Date().toISOString() }, { onConflict: 'pessoa_id' });
  if (error) throw error;
}
