import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SendPushOptions {
  /** IDs dos usuários (auth.users.id) que devem receber */
  user_ids: string[];
  title: string;
  message: string;
  url?: string;
  tag?: string;
}

/**
 * Envia notificações push via Supabase Edge Function
 */
export async function sendPushToUsers(opts: SendPushOptions): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_ANON_KEY;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(opts),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Push notification error:', err);
    } else {
      const result = await res.json();
      console.log('Push sent:', result);
    }
  } catch (err) {
    console.error('sendPushToUsers error:', err);
  }
}

/**
 * Envia notificação para todos os professores quando o coordenador envia mensagem
 */
export async function notifyProfessores(opts: {
  professor_user_id: string;
  mensagem: string;
}): Promise<void> {
  await sendPushToUsers({
    user_ids: [opts.professor_user_id],
    title: '📩 Nova mensagem da Coordenação',
    message: opts.mensagem.length > 100 ? opts.mensagem.slice(0, 97) + '...' : opts.mensagem,
    url: '/',
    tag: 'mensagem-coordenacao',
  });
}

/**
 * Notifica o coordenador quando um professor lança uma ocorrência
 */
export async function notifyCoordenador(opts: {
  coordenador_user_id: string;
  professor_nome: string;
  aluno_nome: string;
  titulo: string;
}): Promise<void> {
  await sendPushToUsers({
    user_ids: [opts.coordenador_user_id],
    title: '⚠️ Nova ocorrência registrada',
    message: `${opts.professor_nome} registrou: ${opts.titulo} (Aluno: ${opts.aluno_nome})`,
    url: '/',
    tag: 'nova-ocorrencia',
  });
}

/**
 * Notifica professor quando coordenador dá devolutiva em uma ocorrência
 */
export async function notifyProfessorDevolutiva(opts: {
  professor_user_id: string;
  aluno_nome: string;
  devolutiva: string;
}): Promise<void> {
  await sendPushToUsers({
    user_ids: [opts.professor_user_id],
    title: '✅ Coordenação revisou sua ocorrência',
    message: `Ocorrência de ${opts.aluno_nome}: ${opts.devolutiva.slice(0, 80)}...`,
    url: '/',
    tag: 'devolutiva-ocorrencia',
  });
}

/**
 * Notifica TODOS os servidores sobre o aniversário de um colega
 */
export async function notifyAniversarioGeral(opts: {
  all_user_ids: string[];
  nome_aniversariante: string;
}): Promise<void> {
  const primeiroNome = opts.nome_aniversariante.split(' ')[0];
  await sendPushToUsers({
    user_ids: opts.all_user_ids,
    title: '🎂 Aniversário na escola!',
    message: `Hoje é aniversário de ${primeiroNome}! Vamos parabenizá-lo(a)! 🎉`,
    url: '/',
    tag: `aniversario-${primeiroNome.toLowerCase()}`,
  });
}

/**
 * Envia mensagem especial de parabéns para o servidor aniversariante
 */
export async function notifyAniversariante(opts: {
  user_id: string;
  nome: string;
}): Promise<void> {
  const primeiroNome = opts.nome.split(' ')[0];
  await sendPushToUsers({
    user_ids: [opts.user_id],
    title: `🎂 Feliz Aniversário, ${primeiroNome}!`,
    message: `🎉 A equipe da Escola JBR deseja a você um dia repleto de alegria e realizações! Feliz Aniversário! ✨`,
    url: '/',
    tag: 'meu-aniversario',
  });
}
