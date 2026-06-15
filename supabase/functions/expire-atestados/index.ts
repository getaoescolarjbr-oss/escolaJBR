// Supabase Edge Function: expire-atestados
// Roda via cron para encerrar atestados vencidos automaticamente
// Deploy: supabase functions deploy expire-atestados
// Cron: supabase functions schedule expire-atestados "0 3 * * *" (todo dia às 03h00 UTC)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    // 1. Buscar todos os atestados ativos que venceram
    const { data: vencidos, error: errFetch } = await supabase
      .from('atestados_servidores')
      .select('id, professor_id, substituto_id, data_fim')
      .eq('ativo', true)
      .lt('data_fim', today);

    if (errFetch) throw errFetch;

    if (!vencidos || vencidos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum atestado vencido encontrado.', expirados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalEspelosRemovidos = 0;
    let totalExpirados = 0;

    for (const atestado of vencidos) {
      // 2. Remover alocações espelho deste atestado
      const { count: espelhosRemovidos } = await supabase
        .from('alocacoes_v2')
        .delete({ count: 'exact' })
        .eq('atestado_id', atestado.id)
        .eq('is_espelho', true);

      totalEspelosRemovidos += espelhosRemovidos || 0;

      // 3. Marcar atestado como inativo
      const { error: errUpdate } = await supabase
        .from('atestados_servidores')
        .update({ ativo: false })
        .eq('id', atestado.id);

      if (!errUpdate) {
        totalExpirados++;
      }
    }

    const result = {
      success: true,
      executado_em: new Date().toISOString(),
      data_referencia: today,
      atestados_expirados: totalExpirados,
      espelhos_removidos: totalEspelosRemovidos,
    };

    console.log('Expire-atestados concluído:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na edge function expire-atestados:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
