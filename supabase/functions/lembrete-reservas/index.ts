// Supabase Edge Function: lembrete-reservas
// Roda via cron (pg_cron/schedule) a cada ~10-15 min. Avisa o professor ~30 min antes
// do início de uma reserva CONFIRMADA. Segue o mesmo padrão de push das outras
// funções agendadas do projeto (birthday-notifications, expire-atestados) — não
// inventa um serviço de notificação novo, só reaproveita push_subscriptions + web-push.
//
// Deploy:   supabase functions deploy lembrete-reservas
// Cron:     supabase functions schedule lembrete-reservas "*/10 * * * *"
// (Nenhum dos dois comandos foi executado por mim — exigem `supabase login` com
// token de acesso, que não está disponível neste ambiente. O código está pronto
// para rodar assim que alguém com acesso à CLI do Supabase publicar.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     || 'mailto:admin@portalprofjbr.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const JANELA_MINUTOS_ANTES = 30; // avisa reservas que começam entre 20 e 35 min a partir de agora
const TOLERANCIA_MINUTOS = 15;

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: object
): Promise<boolean> {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return false;

  const payloadStr = JSON.stringify(payload);
  let sentAny = false;
  const expired: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      );
      sentAny = true;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) expired.push(sub.id);
    }
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired);
  }

  return sentAny;
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

    const agora = new Date();
    const alvo = new Date(agora.getTime() + JANELA_MINUTOS_ANTES * 60000);
    const dataAlvo = alvo.toISOString().slice(0, 10);
    const horaMin = new Date(alvo.getTime() - TOLERANCIA_MINUTOS * 60000).toISOString().slice(11, 16);
    const horaMax = new Date(alvo.getTime() + TOLERANCIA_MINUTOS * 60000).toISOString().slice(11, 16);

    const { data: reservas, error } = await supabase
      .from('reservas')
      .select('id, data, hora_inicio, professor_id, recursos(nome), professores(user_id)')
      .eq('status', 'CONFIRMADA')
      .eq('data', dataAlvo)
      .gte('hora_inicio', horaMin)
      .lte('hora_inicio', horaMax);

    if (error) throw error;
    if (!reservas || reservas.length === 0) {
      return new Response(JSON.stringify({ success: true, lembretes: 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let enviados = 0;
    for (const r of reservas as any[]) {
      const { data: jaEnviado } = await supabase
        .from('reserva_lembretes_log')
        .select('id')
        .eq('reserva_id', r.id)
        .maybeSingle();
      if (jaEnviado) continue;

      const userId = r.professores?.user_id;
      if (!userId) continue;

      const sent = await sendPush(supabase, userId, {
        title: '⏰ Reserva em breve',
        body: `${r.recursos?.nome ?? 'Recurso'} às ${r.hora_inicio.slice(0, 5)} — daqui a pouco.`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `lembrete-reserva-${r.id}`,
        url: '/?modulo=agendamento',
        requireInteraction: true,
      });

      if (sent) {
        await supabase.from('reserva_lembretes_log').insert({ reserva_id: r.id });
        enviados++;
      }
    }

    return new Response(JSON.stringify({ success: true, lembretes: enviados }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('lembrete-reservas error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
