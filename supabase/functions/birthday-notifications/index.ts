// Supabase Edge Function: birthday-notifications
// Disparada via pg_cron às 11:00 UTC (07:00 Campo Grande) e 17:00 UTC (13:00 Campo Grande)
// Envia notificações de aniversário para todos os servidores

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     || 'mailto:admin@portalprofjbr.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Determina o período com base na hora UTC atual
function getPeriod(): 'morning' | 'afternoon' {
  const hour = new Date().getUTCHours();
  // 11:00 UTC = 07:00 Campo Grande → morning
  // 17:00 UTC = 13:00 Campo Grande → afternoon
  return hour < 14 ? 'morning' : 'afternoon';
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  payload: object
): Promise<{ sent: number; expired: number }> {
  if (userIds.length === 0) return { sent: 0, expired: 0 };

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, expired: 0 };

  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  const expired: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) expired.push(sub.id);
    }
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired);
  }

  return { sent, expired: expired.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const period = getPeriod();

    // ── Hoje em Campo Grande (UTC-4) ────────────────────────────────────────
    const now = new Date();
    // Subtrair 4 horas para obter o horário de Campo Grande
    const cgOffset = -4 * 60; // minutos
    const cgTime = new Date(now.getTime() + cgOffset * 60000);
    const todayDay   = cgTime.getUTCDate();
    const todayMonth = cgTime.getUTCMonth() + 1;
    const todayStr   = cgTime.toISOString().split('T')[0]; // YYYY-MM-DD in CG time

    // ── Buscar aniversariantes de hoje ───────────────────────────────────────
    // Filtrar por dia e mês ignorando o ano
    const { data: todos } = await supabase
      .from('professores')
      .select('id, nome, user_id, publicar_aniversario, data_nascimento')
      .eq('publicar_aniversario', true)
      .not('data_nascimento', 'is', null);

    const aniversariantes = (todos || []).filter((p: any) => {
      if (!p.data_nascimento) return false;
      const parts = p.data_nascimento.split('-');
      const mes = parseInt(parts[1], 10);
      const dia = parseInt(parts[2], 10);
      return dia === todayDay && mes === todayMonth;
    });

    if (aniversariantes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum aniversariante hoje', period }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // ── Buscar TODOS os professores com user_id ──────────────────────────────
    const { data: todosProfessores } = await supabase
      .from('professores')
      .select('id, user_id')
      .not('user_id', 'is', null);

    const aniversariantesIds = new Set(aniversariantes.map((a: any) => a.id));

    // Demais servidores (não aniversariantes)
    const outrosUserIds: string[] = (todosProfessores || [])
      .filter((p: any) => p.user_id && !aniversariantesIds.has(p.id))
      .map((p: any) => p.user_id);

    const results = [];

    for (const aniversariante of aniversariantes) {
      const primeiroNome = aniversariante.nome.split(' ')[0];

      // Verificar se já enviou neste período hoje
      const { data: logExistente } = await supabase
        .from('birthday_notifications_log')
        .select('id')
        .eq('professor_id', aniversariante.id)
        .eq('period', period)
        .gte('sent_at', todayStr + 'T00:00:00Z')
        .lte('sent_at', todayStr + 'T23:59:59Z')
        .maybeSingle();

      if (logExistente) {
        results.push({ nome: aniversariante.nome, status: 'ja_enviado', period });
        continue;
      }

      // 1. Notificação para TODOS os outros servidores
      const mensagemGeral = period === 'morning'
        ? `🎂 Hoje é aniversário de ${aniversariante.nome}! Vamos parabenizá-lo(a)! 🎉`
        : `🎉 Lembrete: ${primeiroNome} está fazendo aniversário hoje! Já mandou os parabéns?`;

      const payloadGeral = {
        title: '🎂 Aniversário na escola!',
        body: mensagemGeral,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `aniversario-${aniversariante.id}-${period}`,
        url: '/',
        requireInteraction: false,
      };

      // 2. Notificação ESPECIAL para o aniversariante
      const mensagensAniversariante = [
        `🎉 Feliz Aniversário, ${primeiroNome}! A equipe da Escola JBR deseja um dia repleto de alegria e realizações! Que este ano traga muito sucesso! 🎂✨`,
        `🌟 ${primeiroNome}, hoje é o seu dia especial! Todo a nossa equipe deseja a você saúde, paz e muitas conquistas. Feliz Aniversário! 🎈`,
        `🎊 Parabéns, ${primeiroNome}! É uma honra tê-lo(a) como parte da nossa equipe. Que Deus abençoe você hoje e sempre! 🙏🎂`,
      ];
      const msgEscolhida = mensagensAniversariante[Math.floor(Math.random() * mensagensAniversariante.length)];

      const payloadAniversariante = {
        title: `🎂 Feliz Aniversário, ${primeiroNome}!`,
        body: msgEscolhida,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `meu-aniversario-${period}`,
        url: '/',
        requireInteraction: true,
      };

      // Enviar para os outros
      const { sent: sentOthers } = await sendPush(supabase, outrosUserIds, payloadGeral);

      // Enviar para o aniversariante (se tiver user_id)
      let sentBirthday = 0;
      if (aniversariante.user_id) {
        const result = await sendPush(supabase, [aniversariante.user_id], payloadAniversariante);
        sentBirthday = result.sent;
      }

      // Registrar no log
      await supabase.from('birthday_notifications_log').insert({
        professor_id: aniversariante.id,
        period,
        sent_at: new Date().toISOString(),
      });

      results.push({
        nome: aniversariante.nome,
        period,
        sentOthers,
        sentBirthday,
        status: 'enviado',
      });
    }

    return new Response(
      JSON.stringify({ success: true, period, aniversariantes: results }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('birthday-notifications error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
